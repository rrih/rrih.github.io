#!/bin/sh
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
if command -v rustc >/dev/null 2>&1; then
  preview_test_rustc=rustc
else
  preview_test_rustc="$HOME/.cargo/bin/rustc"
fi
mkdir -p target/preview-pool-tests
# Test the exact vendored std-only module used by tiny_http without pulling in
# the upstream crate's unrelated integration-test and example dependencies.
"$preview_test_rustc" --edition=2018 --test vendor/tiny_http/src/util/task_pool.rs \
  -o target/preview-pool-tests/task_pool
target/preview-pool-tests/task_pool --nocapture
