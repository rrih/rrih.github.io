use std::collections::VecDeque;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Condvar, Mutex};
use std::thread;
use std::time::Duration;

/// Manages a collection of threads.
///
/// A new thread is created every time all the existing threads are full.
/// Any idle thread will automatically die after a few seconds.
pub struct TaskPool {
    sharing: Arc<Sharing>,
}

struct Sharing {
    // list of the tasks to be done by worker threads
    todo: Mutex<VecDeque<Box<dyn FnMut() + Send>>>,

    // condvar that will be notified whenever a task is added to `todo`
    condvar: Condvar,

    // number of total worker threads running
    active_tasks: AtomicUsize,

    // number of idle worker threads
    waiting_tasks: AtomicUsize,
}

/// Minimum number of active threads.
static MIN_THREADS: usize = 4;

struct Registration<'a> {
    nb: &'a AtomicUsize,
}

impl<'a> Registration<'a> {
    fn new(nb: &'a AtomicUsize) -> Registration<'a> {
        nb.fetch_add(1, Ordering::Release);
        Registration { nb }
    }
}

impl<'a> Drop for Registration<'a> {
    fn drop(&mut self) {
        self.nb.fetch_sub(1, Ordering::Release);
    }
}

impl TaskPool {
    pub fn new() -> TaskPool {
        let pool = TaskPool {
            sharing: Arc::new(Sharing {
                todo: Mutex::new(VecDeque::new()),
                condvar: Condvar::new(),
                active_tasks: AtomicUsize::new(0),
                waiting_tasks: AtomicUsize::new(0),
            }),
        };

        for _ in 0..MIN_THREADS {
            pool.add_thread(None)
        }

        pool
    }

    /// Executes a function in a thread.
    /// If no thread is available, spawns a new one.
    pub fn spawn(&self, code: Box<dyn FnMut() + Send>) {
        let mut queue = self.sharing.todo.lock().unwrap();
        self.spawn_locked(&mut queue, code);
    }

    fn spawn_locked(
        &self,
        queue: &mut VecDeque<Box<dyn FnMut() + Send>>,
        code: Box<dyn FnMut() + Send>,
    ) {
        // Queued tasks already reserve idle workers, even before those workers
        // wake up and decrement waiting_tasks while holding this queue lock.
        if queue.len() >= self.sharing.waiting_tasks.load(Ordering::Acquire) {
            self.add_thread(Some(code));
        } else {
            queue.push_back(code);
            self.sharing.condvar.notify_one();
        }
    }

    fn add_thread(&self, initial_fn: Option<Box<dyn FnMut() + Send>>) {
        let sharing = self.sharing.clone();

        thread::spawn(move || {
            let sharing = sharing;
            let _active_guard = Registration::new(&sharing.active_tasks);

            if let Some(mut f) = initial_fn {
                f();
            }

            loop {
                let mut task: Box<dyn FnMut() + Send> = {
                    let mut todo = sharing.todo.lock().unwrap();

                    let task;
                    loop {
                        if let Some(poped_task) = todo.pop_front() {
                            task = poped_task;
                            break;
                        }
                        let _waiting_guard = Registration::new(&sharing.waiting_tasks);

                        let received =
                            if sharing.active_tasks.load(Ordering::Acquire) <= MIN_THREADS {
                                todo = sharing.condvar.wait(todo).unwrap();
                                true
                            } else {
                                let (new_lock, waitres) = sharing
                                    .condvar
                                    .wait_timeout(todo, Duration::from_millis(5000))
                                    .unwrap();
                                todo = new_lock;
                                !waitres.timed_out()
                            };

                        if !received && todo.is_empty() {
                            return;
                        }
                    }

                    task
                };

                task();
            }
        });
    }
}

impl Drop for TaskPool {
    fn drop(&mut self) {
        self.sharing
            .active_tasks
            .store(999_999_999, Ordering::Release);
        self.sharing.condvar.notify_all();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;
    use std::time::Instant;

    #[test]
    fn queued_connections_reserve_waiting_workers() {
        let pool = TaskPool::new();
        let deadline = Instant::now() + Duration::from_secs(5);
        let mut queue = loop {
            let queue = pool.sharing.todo.lock().unwrap();
            if pool.sharing.waiting_tasks.load(Ordering::Acquire) == MIN_THREADS {
                break queue;
            }
            drop(queue);
            assert!(Instant::now() < deadline, "initial readers became idle");
            thread::yield_now();
        };
        let gate = Arc::new((Mutex::new(false), Condvar::new()));
        let (started_tx, started_rx) = mpsc::channel();
        let (finished_tx, finished_rx) = mpsc::channel();
        let connections = MIN_THREADS + 2;
        // Hold the real queue lock across a producer burst. This fixes a legal
        // schedule where accept submits six connections before an idle reader
        // reacquires the lock. The same method is used by production spawn().
        for id in 0..connections {
            let gate = gate.clone();
            let started = started_tx.clone();
            let finished = finished_tx.clone();
            pool.spawn_locked(
                &mut queue,
                Box::new(move || {
                    started.send(id).unwrap();
                    let (lock, changed) = &*gate;
                    let mut released = lock.lock().unwrap();
                    while !*released {
                        released = changed.wait(released).unwrap();
                    }
                    finished.send(id).unwrap();
                }),
            );
        }
        drop(queue);
        let deadline = Instant::now() + Duration::from_secs(2);
        let mut started = Vec::new();
        while started.len() < connections {
            match started_rx.recv_timeout(deadline.saturating_duration_since(Instant::now())) {
                Ok(id) => started.push(id),
                Err(_) => break,
            }
        }
        // Release every simulated keep-alive connection before asserting, even
        // on the old failing implementation, so no blocked test thread leaks.
        *gate.0.lock().unwrap() = true;
        gate.1.notify_all();
        for _ in 0..connections {
            finished_rx.recv_timeout(Duration::from_secs(5)).unwrap();
        }
        let (reused_tx, reused_rx) = mpsc::channel();
        pool.spawn(Box::new(move || reused_tx.send(()).unwrap()));
        reused_rx.recv_timeout(Duration::from_secs(5)).unwrap();
        eprintln!(
            "connections started before releasing keep-alives: {}/{}",
            started.len(),
            connections
        );
        assert_eq!(
            started.len(),
            connections,
            "queued connections must not reserve the same idle reader twice"
        );
    }
}
