#!/bin/sh
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
if command -v cargo >/dev/null 2>&1; then
  exec cargo "$@"
fi
if [ -x "$HOME/.cargo/bin/cargo" ]; then
  exec "$HOME/.cargo/bin/cargo" "$@"
fi
printf '%s\n' 'Rust is required. Install the minimal toolchain from https://rust-lang.org/tools/install/.' >&2
exit 127
