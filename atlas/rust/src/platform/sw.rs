use crate::browser::{self, call, get};
use gloo_events::EventListener;
use gloo_timers::callback::Timeout;
use std::cell::RefCell;
use wasm_bindgen::JsCast;
use yew::Callback;
#[derive(Default)]
struct State {
    registration: Option<web_sys::ServiceWorkerRegistration>,
    registering: bool,
    refresh: bool,
    requested: bool,
    settled: Option<bool>,
    timer: Option<Timeout>,
    on_refresh: Callback<bool>,
    on_reload: Callback<()>,
    listeners: Vec<EventListener>,
}
thread_local! {static STATE:RefCell<State>=RefCell::new(State::default());}
fn notify() {
    let callback = STATE.with(|s| {
        let mut s = s.borrow_mut();
        s.refresh = true;
        s.on_refresh.clone()
    });
    callback.emit(true);
}
async fn register() {
    let should = STATE.with(|s| {
        let mut s = s.borrow_mut();
        if s.registration.is_some() || s.registering {
            false
        } else {
            s.registering = true;
            true
        }
    });
    if !should {
        return;
    }
    let nav = browser::window().navigator();
    let worker = get(nav.as_ref(), "serviceWorker");
    let registration = match call(
        &worker,
        "register",
        &[
            "/atlas/sw.js".into(),
            browser::json(&serde_json::json!({"scope":"/atlas/","updateViaCache":"none"})),
        ],
    ) {
        Ok(value) => browser::promise(value)
            .await
            .ok()
            .and_then(|v| v.dyn_into::<web_sys::ServiceWorkerRegistration>().ok()),
        Err(_) => None,
    };
    STATE.with(|s| s.borrow_mut().registering = false);
    let Some(registration) = registration else {
        return;
    };
    if registration.waiting().is_some() {
        notify();
    }
    let observed = registration.clone();
    let listener = EventListener::new(&registration, "updatefound", move |_| {
        if let Some(installing) = observed.installing() {
            let worker = installing.clone();
            let listener = EventListener::new(&installing, "statechange", move |_| {
                if get(worker.as_ref(), "state").as_string().as_deref() == Some("installed")
                    && !get(
                        &get(browser::window().navigator().as_ref(), "serviceWorker"),
                        "controller",
                    )
                    .is_null()
                {
                    notify();
                }
            });
            STATE.with(|s| s.borrow_mut().listeners.push(listener));
        }
    });
    let target = worker.dyn_into::<web_sys::EventTarget>();
    if let Ok(target) = target {
        let listener = EventListener::new(&target, "controllerchange", move |_| {
            let callback = STATE.with(|s| {
                let s = s.borrow();
                s.requested.then(|| s.on_reload.clone())
            });
            if let Some(callback) = callback {
                callback.emit(());
            }
        });
        STATE.with(|s| s.borrow_mut().listeners.push(listener));
    }
    STATE.with(|s| {
        let mut s = s.borrow_mut();
        s.registration = Some(registration);
        s.listeners.push(listener);
    });
}
/// Restart the initial wait only when model settling changes; callbacks always stay current.
pub fn register_deferred(
    model_settled: bool,
    on_refresh: Callback<bool>,
    on_reload: Callback<()>,
) -> bool {
    let worker = get(browser::window().navigator().as_ref(), "serviceWorker");
    if worker.is_undefined() {
        return false;
    }
    let controlled = get(&get(&worker, "controller"), "scriptURL")
        .as_string()
        .is_some_and(|s| s.contains("/atlas/sw.js"));

    STATE.with(|s| {
        let mut s = s.borrow_mut();
        s.on_refresh = on_refresh.clone();
        s.on_reload = on_reload;
        if s.registration.is_none() && s.settled != Some(model_settled) {
            s.settled = Some(model_settled);
            s.timer = Some(Timeout::new(
                if model_settled || controlled {
                    250
                } else {
                    30_000
                },
                || wasm_bindgen_futures::spawn_local(register()),
            ));
        }
        s.refresh
    })
}
pub async fn apply_update(reload: bool) {
    STATE.with(|s| s.borrow_mut().requested = reload);
    register().await;
    let worker = get(browser::window().navigator().as_ref(), "serviceWorker");
    let existing = match call(&worker, "getRegistration", &["/atlas/".into()]) {
        Ok(value) => browser::promise(value).await.ok(),
        Err(_) => None,
    };
    let waiting = existing
        .as_ref()
        .map(|r| get(r, "waiting"))
        .filter(|w| !w.is_null() && !w.is_undefined());
    if let Some(waiting) = waiting {
        let _ = call(
            &waiting,
            "postMessage",
            &[browser::json(&serde_json::json!({"type":"SKIP_WAITING"}))],
        );
    } else if reload {
        let callback = STATE.with(|s| s.borrow().on_reload.clone());
        callback.emit(());
    }
}
