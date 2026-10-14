# tiny_http 0.12.0: reserve idle connection readers

This directory contains the published crates.io `tiny_http` 0.12.0 source,
normalized Cargo manifest, README, and both original licenses. It was copied
from Cargo's verified registry package, not recreated. `UPSTREAM-SOURCE.json`
records the archive checksum, upstream revision, and the SHA-256 of each
original copied file. Upstream examples and integration-test fixtures are not
needed by the preview dependency and are omitted.

The only modified upstream file is `src/util/task_pool.rs`. The scheduling
condition now compares the queued task count with the waiting reader count.
Queued connections already reserve waiting readers before those readers wake
and decrement the counter. Checking only for zero waiting readers lets a burst
reserve the same readers repeatedly. Existing HTTP keep-alive connections can
then occupy every reader while other accepted connections remain queued.

The queue mutex protects both the producer's decision and the readers' waiting
counter transitions. Enqueuing only when `queue.len() < waiting_tasks` preserves
the invariant that every queued task has an available reader. Otherwise the
original thread creation path is used. Public APIs, HTTP semantics, feature
defaults, cache behavior, and worker lifetimes are unchanged.

`spawn_locked` is a private extraction of the existing locked scheduling block.
The regression test holds that real mutex across six submissions with four
waiting readers, forcing a legal producer-burst schedule. Each callback holds a
simulated keep-alive until all starts are observed. The original condition starts
only four connections; the corrected condition starts all six. Both runs release
and finish every callback before asserting, then check that the pool can be
reused.

Run `sh scripts/test-preview-pool.sh` from the repository root. It compiles this
exact std-only module with `rustc --test`; it does not copy a model of the pool or
pull in unrelated upstream test dependencies. The root `test` / `dev-check` and
the profile CI build execute it. The native `xtask` tests additionally exercise
real HTTP keep-alive reuse and speculative idle connections.

The runtime diagnosis and red/green evidence are recorded in the ignored
`work/rust-migration/preview-2x2/` and `preview-pool-fix/` directories. The failure
had four readers awaiting further headers, two accepted sockets with unread
request bytes, and all eight response workers idle. This patch fixes that reader
reservation race; it is not a redesign of upstream thread management.

Upstream source reviewed:
https://github.com/tiny-http/tiny-http/blob/e2215636a73c7c3ac2d0a59d607454591f2cb2ac/src/util/task_pool.rs

Upstream remains licensed under MIT OR Apache-2.0; see `LICENSE-MIT` and
`LICENSE-APACHE`.
