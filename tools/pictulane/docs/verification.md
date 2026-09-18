# Verification record — 2026-09-18

**Status: live acquisition remains unestablished. This is an independently implemented and tested viewer/PWA foundation, not a completed account-to-X-photos product.** No tests below prove live retrieval.

## Local commands and evidence

- Root `bun run dev-check`: pass; 12 localized profile pages.
- Atlas `bun run dev-check`: pass; 52 tests, 10756 generated sitemap URLs. Existing build warnings: large chunks, generated SEO CSS resolved at runtime. No Atlas runtime, data, cache or dependency changes.
- App `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`: pass (5 focused model/storage tests).
- `npm run build:test` then `CHROME_CHANNEL=chrome npm run e2e`: 15 deterministic fresh-context browser tests passed. Fixtures are compiled into this separate test build only, marked TEST-ONLY. Production composition rejects it.
- `npm audit`: zero reported vulnerabilities in the app dependency graph after selecting compatible patched Vite/sharp versions. No bulk updates to other apps.

Browser checks cover image/post transitions and reverse order; string post IDs and direct links; 202 replaceState transitions and Back focus restoration; pointer intent, diagonal and multitouch rejection; stale account responses; corrupt/denied storage; 320/375/390/1440 widths; readable-cache TTL/100 limit; actual browser opaque responses/10 limit; invalidation; offline shell and saved image; cache toggle; separate app storage/cache/worker preservation; update waiting and second-tab continuity; cancellation of pending resume saves after history deletion; restoring disabled cache preference after cache-metadata eviction.

Synthetic performance uses local test SVG images (portrait and landscape), Chrome on this Mac, normal CPU, two requestAnimationFrame callbacks after each key event, warmed images, 40 transitions. It asserts that each image ID actually changes. Network is synthetic and excluded as a real-X measurement; Playwright command roundtrip timing is recorded separately. Measured event-to-two-rAF p95: 34.5ms; the separate 202-step Playwright roundtrip p95 was 41ms in the final run. No claim about live X image decode/network p95.

## Scope and limitations

- No compliant provider: live post selection, original attachment order/type filtering, pagination, private/deleted distinctions and independent real-image URL restoration remain unverified/unavailable. Unit tests of normalized data do not validate an HTML parser.
- No pagination is advertised; no synthetic cursor. End-of-available-range is separate from unavailable continuation.
- Real iOS/Android installation, OS storage sharing, native pinch zoom, physical swipe/edge gesture behavior and long-duration memory profiling are not verified by desktop emulation.
- Cache capacity tests use synthetic data. Opaque response size and status are not inspected. Source-specific live reuse permission remains a provider prerequisite.
- Source probe results: [data-source.md](data-source.md). `CHROME_CHANNEL=chrome node scripts/probe-source.mjs` repeats the small static/browser probe and writes ignored `work/source-probe.json`.
- Deployment and public-origin checks must be reported separately from these code/test results. GitHub Actions is the single Pages deployment path; only composed finished artifacts are uploaded.
