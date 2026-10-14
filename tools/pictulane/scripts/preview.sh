#!/bin/sh
set -eu
pictulane_root="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
if [ -n "${SITE_DIR:-}" ]; then
  pictulane_site="$(CDPATH= cd -- "$SITE_DIR" && pwd)"
  pictulane_base=/
else
  pictulane_site="$pictulane_root/dist"
  pictulane_base=/tools/pictulane/
fi
export SITE_BASE="${SITE_BASE:-$pictulane_base}"
export PORT="${PORT:-4173}"
exec sh "$pictulane_root/../../scripts/rust.sh" run --locked -p xtask -- serve "$pictulane_site"
