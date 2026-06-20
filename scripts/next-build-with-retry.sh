#!/usr/bin/env bash
set -euo pipefail

tmp_log="$(mktemp)"
cleanup() {
  rm -f "$tmp_log"
}
trap cleanup EXIT

run_next_build() {
  next build 2>&1 | tee "$tmp_log"
}

if run_next_build; then
  exit 0
fi

if ! rg -q "(ENOENT: no such file or directory.*\\.next/(build-manifest|server/pages-manifest|static/.+/_ssgManifest|export/500)\\.(json|js|html)|Cannot find module '.*/\\.next/server/app/.+/(route|page)\\.js')" "$tmp_log"; then
  exit 1
fi

echo "Next static export hit a transient .next manifest race; retrying once with clean artifacts..."
pkill -f "$PWD/node_modules/.bin/next build" 2>/dev/null || true
pkill -f "$PWD/node_modules/next/dist/compiled/jest-worker/processChild.js" 2>/dev/null || true
rm -rf .next out tsconfig.tsbuildinfo

run_next_build
