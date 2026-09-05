# Atlas regression checks

Run from the repository root using Node 22 or newer and the installed Playwright package:

```sh
node atlas/e2e/run.mjs --list
ATLAS_URL=http://127.0.0.1:3342 node atlas/e2e/run.mjs
ATLAS_URL=http://127.0.0.1:3342 node atlas/e2e/run.mjs migration localization-failures
```

`ATLAS_URL` accepts the complete-site origin or its `/atlas/` URL. The default is the complete-site preview on port 3342. `ATLAS_DIST` must point to the **complete root build**, which includes `atlas/sw.js`, the personal homepage and legacy redirects. `ATLAS_PREVIOUS_DIST` defaults to `work/atlas-migration/previous`. The runner starts suites sequentially; never run another graphics/browser suite alongside it. Set `ATLAS_QA_DIR` for evidence output. A failed suite stops the runner and preserves its diagnostics; explicitly select it to retry.

The 16 existing suites retain localization, mobile/RTL, camera/animation, shiny, all landscapes, mega/regional forms, six-member scenes, local photo import/export, denied storage, quotas, offline first use, long-term cache retention, update and consent checks. New `migration` checks personal-root stability, 63 static indexes, initial/rendered metadata, legacy shared links and root/Atlas navigation. New `migration-pwa` serves the actual previous and current builds under one temporary local origin, saves a six-member scene/photo in the previous release, then checks the worker bridge, storage, old model cache keys, scope isolation and offline restoration. `performance-regressions` instruments actual WebGL2 draw calls to check paused/offscreen suppression and recovery, selected-only dictionary requests and decoder preload transfer reuse. UI dictionary startup and transactional retry cases are added to `localization-failures`.

Ordinary checks allow only the configured origin and local servers. `advertising` serves local consent/ad fixtures and never continues any external request. `privacy` allows only the actual Google tag script; its measurement and ad endpoints are intercepted and unknown external requests are blocked. `advertising-google` allows narrowly classified real Google SDK/CMP resources, while blocking all ad delivery, clicks, impressions and measurement. This last suite exercises consent UI, **never real ads**. Its network boundary can be checked without a browser or any requests:

```sh
node atlas/e2e/advertising-google.mjs --check-policy
```

`privacy` uses native metric entries, trusted interactions and the actual `web-vitals` library. Its hidden lifecycle signal is simulated because this automated Chrome environment remained visible during tab/window changes; it does not certify real-device unload delivery. The withdrawal assertion drains pre-withdrawal SDK batches first, then verifies that neither model nor lifecycle commands or events are added after withdrawal.

`performance-comparison.mjs` separately serves the previous and current builds on one local gzip server. It runs three cold trials per build for species 6 and 753 at 390 px, 4× CPU slowdown, 1.6 Mbps and 150 ms latency, with service workers and all third parties blocked. Output records all trials, medians/ranges and request bytes; it creates no duplicate build.

Passing browser checks confirms the tested Chrome desktop/emulated-mobile environment. It does not measure field Core Web Vitals or prove physical Safari/iOS behavior. The performance audit's one-sample lab values are kept separate from regression results.
