# pictulane

Independent static photo viewer at https://rrih.github.io/tools/pictulane/ . **Live X photo acquisition is not established under the required no-API/no-auth/no-backend constraints.** Production explicitly displays that limitation. See [investigation](docs/data-source.md); test-build fixtures are not live-data proof.

## Development

Rust (see the repository toolchain), the `wasm32-unknown-unknown` target, and wasm-bindgen CLI 0.2.129 are required for builds. The application is Rust / Yew, compiled to WebAssembly; locale text is JSON data and CSS is unchanged. The external bootstrap and generated wasm-bindgen imports are the browser ABI boundary. The service worker cache policy, URL allowlist, TTL, LRU ordering, message handling, and offline responses are Rust in `worker/src/`. Its small JavaScript entry only connects browser events synchronously and loads the matching worker WASM from the versioned shell cache, enabling offline worker restarts. Cache and storage namespaces are preserved. No application runtime or build output imports from Atlas or the profile.

Node 20.19+ or 22.13+ and npm are used for the existing Playwright E2E oracle and optional source-investigation tooling. Application state, routing, validation, persistence, gestures, and UI rendering are implemented in `rust/src/`. Production and test-only fixture builds are separated by a Rust feature; test fixtures are absent from the production WASM.

The optional `scripts/icons.mjs` is a Sharp adapter for resizing the existing SVG into PNG icons. The independent browser tests and source-investigation scripts remain JavaScript/TypeScript. See [migration verification](docs/rust-migration.md) for the 21 passing browser scenarios, update-cache checks, and the boundaries of that evidence.

```sh
cd tools/pictulane
npm ci
npm run dev # builds Rust/WASM, then serves the static output
npm run lint
npm run typecheck
npm test
npm run build
npm run preview
# Deterministic browser checks with a separate test-only build:
npx playwright install chromium
npm run build:test
npm run e2e
# Always restore a production build before composition:
npm run build
```

Local installed Chrome can be selected with `CHROME_CHANNEL=chrome npm run e2e`. Preview is the Rust xtask static HTTP server on 127.0.0.1:4173 with real 404s and no proxy. Test builds carry a TEST-ONLY marker and the composition script refuses them. Only dist is published; tests, docs, source and node_modules are excluded. No fixture account or fallback photos are in production.

From repository root run `bun run dev-check` and `(cd atlas && bun run dev-check)` before each commit, then `bun run compose`. Each independent build completes before the final `site-dist` composition. Existing Pages workflow uploads one combined artifact, preserving profiles, Atlas, compatibility pages and true 404s.

## Viewer and persistence

Hash routes: `#/username` and `#/username/status/postId/media/imageKey`. Open album/image with pushState; use replaceState for image navigation. IDs are strings, current selection is by post/media ID. Arrow keys navigate images across posts, up/down jump to the next retrieved post. Escape closes settings before the viewer; history restores the selected thumbnail and scroll. Touch intent excludes edges, diagonal movement, cancellation and multiple pointers; browser pinch zoom remains enabled. Real iOS installation/pinch behavior has not been device-tested.

Local metadata: `pictulane:v1:*`, schema 1, up to 8 accounts, 300 posts per saved account and 60k serialized characters per album. Resume writes are delayed 350ms and flushed on pagehide/visibility change; photo binaries never enter localStorage. Denied, corrupt or full storage must not stop viewing. Storage events refresh only recent-account UI, never the current image.

Worker and manifest scope/id/start_url: `/tools/pictulane/`. CSP is a **meta policy**, not a server response header. Scripts/styles stay on the same origin; external image URLs are validated. No root worker is installed or unregistered. No origin-wide storage clearing or cross-cache resource searches.

Image cache: `pictulane-images-v1`, management records in `pictulane-image-meta-v1`; 24h TTL by save time, LRU-like access ordering, 100 readable and 10 opaque responses, full URLs preserve size parameters. Broken images trigger targeted invalidation and user-directed retry. Shell cache names have a build hash; keep the previous shell for existing tabs. Updates wait for user action; other tabs are not reloaded. Cache failures fall back to network. Runtime cache requests must come from this app's client and an allowlisted image host. Cache disabled means app caching is disabled, not the browser HTTP cache. No IndexedDB or backend.

Offline startup uses the shell; images require both metadata and retained cache entries. Browser eviction is possible. Source state cannot be checked offline. Tab/PWA shared storage varies by platform; installation is optional.

## Remaining acceptance gaps

- A compliant live provider, actual public-account multi-post data and source-specific reuse permission.
- Live individual-image resolution and live public-state/deletion revalidation.
- Real iOS/Android installation, native pinch/edge gestures and installed-app storage behavior.
- See verification report for exact automated coverage; fixture tests do not establish acquisition correctness or live-network performance.
