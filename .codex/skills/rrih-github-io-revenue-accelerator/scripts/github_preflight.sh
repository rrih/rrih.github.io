#!/usr/bin/env bash
set -u -o pipefail

repo="${1:-rrih/rrih.github.io}"
attempts="${GITHUB_PREFLIGHT_ATTEMPTS:-4}"
sleep_seconds="${GITHUB_PREFLIGHT_SLEEP_SECONDS:-10}"
tmpdir="$(mktemp -d "${TMPDIR:-/tmp}/rrih-gh-preflight.XXXXXX")"

cleanup() {
  rm -rf "$tmpdir"
}
trap cleanup EXIT

if ! [[ "$attempts" =~ ^[0-9]+$ ]] || [ "$attempts" -lt 1 ]; then
  echo "invalid GITHUB_PREFLIGHT_ATTEMPTS=$attempts" >&2
  exit 64
fi

echo "github preflight repo=$repo attempts=$attempts"

if ! gh auth status >"$tmpdir/auth.out" 2>"$tmpdir/auth.err"; then
  echo "github preflight auth failed"
  cat "$tmpdir/auth.out"
  cat "$tmpdir/auth.err" >&2
  exit 20
fi

cat "$tmpdir/auth.out"

run_json() {
  local name="$1"
  shift

  if "$@" >"$tmpdir/$name.json" 2>"$tmpdir/$name.err"; then
    echo "$name: ok"
    cat "$tmpdir/$name.json"
    echo
    return 0
  fi

  echo "$name: failed" >&2
  cat "$tmpdir/$name.err" >&2
  return 1
}

for attempt in $(seq 1 "$attempts"); do
  echo "github preflight attempt $attempt/$attempts"

  if curl -fsS --connect-timeout 10 --max-time 20 \
    https://api.github.com/rate_limit >"$tmpdir/curl-rate-limit.json" 2>"$tmpdir/curl-rate-limit.err"; then
    echo "api.github.com curl: ok"
  else
    echo "api.github.com curl: failed" >&2
    cat "$tmpdir/curl-rate-limit.err" >&2
  fi

  gh api rate_limit --jq \
    '.rate | "gh api rate_limit: remaining=\(.remaining) limit=\(.limit) reset=\(.reset)"' \
    >"$tmpdir/gh-rate-limit.out" 2>"$tmpdir/gh-rate-limit.err"
  gh_rate_status=$?
  if [ "$gh_rate_status" -eq 0 ]; then
    cat "$tmpdir/gh-rate-limit.out"
  else
    echo "gh api rate_limit: failed" >&2
    cat "$tmpdir/gh-rate-limit.err" >&2
  fi

  failures=0

  run_json growth_prs gh pr list \
    --repo "$repo" \
    --state open \
    --label growth \
    --json number,title,url,headRefName,isDraft,mergeStateStatus,statusCheckRollup \
    --limit 20 || failures=$((failures + 1))

  run_json revenue_accelerator_prs gh pr list \
    --repo "$repo" \
    --state open \
    --label revenue-accelerator \
    --json number,title,url,headRefName,isDraft,mergeStateStatus,statusCheckRollup \
    --limit 20 || failures=$((failures + 1))

  run_json growth_issues gh issue list \
    --repo "$repo" \
    --state open \
    --label growth \
    --json number,title,url,updatedAt,labels \
    --limit 20 || failures=$((failures + 1))

  run_json revenue_accelerator_issues gh issue list \
    --repo "$repo" \
    --state open \
    --label revenue-accelerator \
    --json number,title,url,updatedAt,labels \
    --limit 20 || failures=$((failures + 1))

  if [ "$failures" -eq 0 ]; then
    echo "github preflight: success"
    exit 0
  fi

  echo "github preflight attempt $attempt failed with $failures list failure(s)" >&2

  if [ "$attempt" -lt "$attempts" ]; then
    echo "sleeping ${sleep_seconds}s before retry" >&2
    sleep "$sleep_seconds"
  fi
done

echo "github preflight: failed after $attempts attempts" >&2
exit 21
