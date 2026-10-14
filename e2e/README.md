# Browser regression gate

Use Node 22, the installed root and Atlas Playwright packages, and Chrome. Each
product must be built independently before composing the production `site-dist`.
The runner serves that directory on an unused local port and runs one browser
suite at a time. It stops on the first failure and preserves evidence.

```sh
node e2e/run.mjs
node e2e/run.mjs profile
```

The default gate includes the profile and 20 Atlas suites. It covers:

- Profile: all 12 languages at 1440, 390 and 320 pixels; language navigation,
  keyboard dismissal, independent links, preserved Atlas storage, and no root PWA.
  Three additional same-origin HTTP-cache cases separately retain an incompatible
  response at each former fixed entry/bindings/WASM URL, switch to current HTML,
  and require the paired Rust application to redirect language and dismiss its
  menu. They use real HTTP caching without Playwright routing and run in the
  default profile/CI gate. Run just these cases with
  `PROFILE_DIST=dist node e2e/profile-cache.mjs`.
- Atlas: actual rendered 3D pixels and animation, model changes, camera controls,
  capture, search and filters, forms/shiny, mobile and reduced motion, localization
  and RTL, static/rendered metadata, legacy routes, six-member shared scenes,
  local scene/photo persistence, denied storage, PWA offline operation, cache
  retention and updates, old root worker retirement, and local consent fixtures.
  The `http-cache` suite also retains the former fixed Atlas bootstrap in the real
  HTTP cache, switches to current HTML, and requires exact current JS/WASM bytes,
  rendered camera controls and favorites without a controlling service worker.
- Migration edge cases: Solo navigation must preserve a dormant Together scene;
  missing custom photos fall back to Studio; saved mobile hearts stay filled;
  cleared notices stop scheduling work; accepted installation requests storage
  persistence even before the browser emits its installed event.

The suite list and per-suite diagnostics are in `work/rust-migration/e2e/` by
default. Set `SITE_E2E_OUTPUT` to preserve a separate before/after run. Set
`SITE_E2E_DIST` to test an immutable Rust build. The current ABI-cache tests require
Rust artifacts; use the explicit release-upgrade and performance comparison below
for the historical JavaScript build.

Pictulane's existing Playwright suite uses an explicitly marked fixture build.
Run it independently and then restore the production build before composition:

```sh
(cd tools/pictulane && npm run build:test)
node e2e/run.mjs pictulane
(cd tools/pictulane && npm run build)
```

The original 15 tests and one added worker-restart check retain keyboard history/focus, complete forward/reverse navigation,
deep links, account request races, swipe intent, four viewport widths, storage
denial, namespace isolation, cache TTL/limits/offline, service worker updates and
multiple tabs. The composed gate rejects `TEST-ONLY` Pictulane output. Fixture
success does not demonstrate acquisition of live X images: the current production
provider explicitly reports that its source is unavailable.

The actual release migration check uses two complete, independently built site
directories. It serves the previous JavaScript release and then the Rust release
at the same local origin. The saved baseline is read only throughout the test:

```sh
ATLAS_PREVIOUS_DIST=work/rust-migration/baseline/site-dist node e2e/run.mjs upgrade
```

It imports and saves six Pokémon with a local photo in the old app, records the
favorite, Japanese preference, exact scene state, IndexedDB image bytes and old
model-cache keys, installs the real new worker and clicks the old app's public
update control while offline. It requires the resulting page to load application
WASM, render the saved scene, survive another offline reload and preserve
unrelated storage, caches and worker scopes. This is separate from the legacy
root-worker fixture in `migration-pwa`.

The old app is saved after its final UI choices, and its pre-update evidence uses
a viewport screenshot. Full-page capture can trigger the old viewer's resize
framing without synchronizing its shared URL. The check requires the saved scene
to equal localStorage read before Rust starts, as well as the state after both
offline navigations. Camera numbers and private scene metadata remain exact.
This historical release check is explicit, since clean CI has no previous build;
the default CI gate runs the self-contained profile and Atlas suites above.

Compare cold loading against the same previous release under the driver's
declared mobile CPU/network limits:

```sh
ATLAS_PREVIOUS_BASE=/atlas ATLAS_PREVIOUS_DIST=work/rust-migration/baseline/site-dist \
  ATLAS_DIST=site-dist ATLAS_QA_DIR=work/rust-migration/performance \
  node atlas/e2e/performance-comparison.mjs
```

This records three samples per release for English Charizard and Japanese
Fomantis. Compare total JavaScript plus WASM transfer and readiness time; a
smaller JavaScript bundle alone does not establish a faster application.

The procedural renderer also has an exact geometry/animation regression oracle:

```sh
node atlas/scripts/build-renderer-qa.mjs
node atlas/e2e/renderer-geometry.mjs
node atlas/e2e/search-normalization.mjs
```

This checks 55 snapshots against hashes captured from the original JavaScript
renderer in Node 22/V8: all 11 procedural landscapes at initial state and four
animation times. Vertex positions/normals/colors, triangle indices, instance
transforms/colors and shadow flags must match exactly. The feature's inspection
exports and browser fixtures are omitted from production builds.

The same QA module compares the WASM search normalizer with the original
JavaScript rule. It exercises every catalog, form and search-index name, Unicode
compatibility/decomposition, kana and combining marks, context-sensitive casing,
whitespace, and the twelve supported decimal digit systems. The frozen oracle is
a test fixture; production normalization remains in Rust using standard browser
Unicode operations.

With a preview serving the original assets at `/atlas/`, the same QA build also
compares real model measurements and exercises the rendered controls:

```sh
ATLAS_URL=http://127.0.0.1:3393 node atlas/e2e/model-bounds.mjs
ATLAS_URL=http://127.0.0.1:3393 node atlas/e2e/renderer-browser.mjs
```

The model oracle freezes the original measurement and animation preparation
functions with source hashes. Ten sourced GLB cases cover normal/shiny forms,
visibility tracks, parent transforms and no animation clip. Both implementations
receive independent scenes decoded from identical bytes. Bounds, sampled points
and normalization must match as Float64 bytes, including signed zero. Its timing
output describes individual measurements, not full cold-load performance.

The rendered-control driver collects both uncaught exceptions and console errors.
It rejects all console errors except the original JavaScript renderer's exact
`NodeBuffer_*` uniform-block-size error, and accepts that signature only after
the actual forced WebGL 2 context reports a 16,384-byte uniform-block limit.
Those occurrences are recorded separately as `expectedBaselineLimitations`,
alongside the GPU capability. They mean some instanced vegetation may be missing;
passing the 18 control/scene checks does not certify that every shader rendered.
Any other shader or console error fails the driver.

The preview image driver uses this same Rust renderer. Its default output and
capture settings remain `atlas/public/previews`, 512×512, high quality and WebP
quality 0.84. A small sample can be checked without replacing existing images:

```sh
node atlas/scripts/render-previews.mjs --skip-profile \
  --ids 6,25,charizard-mega-x,raichu-alola \
  --output work/rust-renderer-qa/previews \
  --records work/rust-renderer-qa/preview-evidence
```

The driver builds its isolated browser bundle automatically. QA builds use a
different Cargo feature and leave production `atlas/dist` untouched; run the
normal production build before extracting a production WASM from the shared
Cargo target directory.

The Google privacy and CMP checks use external SDK resources and are explicit:

```sh
node e2e/run.mjs google
```

Their existing network policies still intercept ad delivery, clicks, impressions
and measurement. They are separate from the reproducible local regression gate.
See [Atlas's test notes](../atlas/e2e/README.md) for the network and lifecycle
limitations. Chromium with emulated mobile sizes does not certify physical
Safari/iOS behavior. These tests establish the behaviors they exercise, not an
absolute guarantee that every possible regression has been excluded.
