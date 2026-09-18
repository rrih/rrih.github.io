# pictulane

Independent static photo viewer at https://rrih.github.io/tools/pictulane/ . **Live X photo acquisition is not established under the required no-API/no-auth/no-backend constraints.** Production explicitly displays that limitation. See [investigation](docs/data-source.md); test-build fixtures are not live-data proof.

## Development

Node 20.19+ or 22.13+ (CI: 22.14), npm. React 19 / Vite 7 / TypeScript. No application runtime or build output imports from Atlas or the profile.

```sh
cd tools/pictulane
npm ci
npm run dev
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

Local installed Chrome can be selected with `CHROME_CHANNEL=chrome npm run e2e`. Preview is a plain static HTTP server on 127.0.0.1:4173 with real 404s and no proxy. Test builds carry a TEST-ONLY marker and the composition script refuses them. Only dist is published; tests, docs, source and node_modules are excluded. No fixture account or fallback photos are in production.

From repository root run `bun run dev-check` and `(cd atlas && bun run dev-check)` before each commit, then `bun deployment/compose.ts`. Each independent build completes before the final `site-dist` composition. Existing Pages workflow uploads one combined artifact, preserving profiles, Atlas, compatibility pages and true 404s.

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
