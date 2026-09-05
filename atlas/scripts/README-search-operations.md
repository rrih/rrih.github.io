# Search and measurement operations

The September 2026 migration restores the personal homepage at `/` and moves Atlas to `/atlas/`. Search Console's existing `https://rrih.github.io/` property covers both. Submit the root `/sitemap.xml`, which contains the personal page and every indexable Atlas URL. Remove the obsolete `/shitsugyo-hoken/sitemap.xml` submission. Do not use Search Console's change-of-address tool for a same-origin path migration.

Keep the root Google verification HTML file in the site composition. The previous HTML-tag method was still listed as verified, but its tag was absent from the deployed homepage; the migration adds the current account's offered HTML-file method and checks it after deployment. This public marker is independent of Analytics consent and of Atlas's directory.

## Release and comparison

Record the actual successful Pages deployment timestamp and commit in the release evidence. Inspect the personal home, Japanese Atlas home, species 753, species 1025, and a Mega form with URL Inspection after release. Record both declared and Google-selected canonical, last crawl and indexing state. A successful public HTTP check or sitemap submission does not mean Google has crawled or indexed all pages.

The previous confirmed 28-day interval (2026-08-07 through 2026-09-03, Search Console's reporting timezone) contains 17 clicks and 1,003 impressions from the former tools. Keep it as historical context, not an Atlas growth baseline. After release, filter pages beginning `https://rrih.github.io/atlas/`; report the personal homepage and legacy tools separately. Use only finalized dates and compare the first complete 28 days with the next complete 28 days. Until enough data exists, report unavailable metrics as unknown.

Review weekly: new URL indexing and canonical samples, sitemap processing, language/country/device segments, 404 reports, and queries that actually lead to the 3D viewer. Evaluate species-name plus 3D, forms, shiny viewing and multiple Pokémon scenes as hypotheses. Do not infer demand for model downloads, game guides or breeding tools that Atlas does not provide. Keep factual titles and improve useful pages from observed queries instead of adding repetitive pages.

## Performance and privacy

Optional Analytics uses the fixed `/atlas/` URL and title; Search Console provides search landing-page analysis. With consent already present at navigation, `atlas_web_vital` reports LCP, INP and CLS through the official web-vitals library. `atlas_model_load` separately reports model load duration and ready/failed outcomes for loads started during consent. Neither includes model IDs, URLs, queries, scene names or private images. A new opt-in does not replay earlier activity, and withdrawal disables further collection. Enable no enhanced measurement or automatic page tracking.

Custom definitions: event dimensions `metric_name`, `metric_rating`, `outcome`, `view_mode`; numeric metrics `metric_value` (standard units; interpret by metric_name), `model_load_ms` (milliseconds). Avoid registering high-cardinality `metric_id` as a dimension. Use p75 field CWV only when sufficient representative visits exist; do not present a local fast-device result as a field improvement. Segment aggregate performance by device. Compare fresh, cached and offline visits under the same browser/network settings and record whether third-party requests were intercepted.

The single footer ad remains size-limited, lazy and separate from controls. Test regional consent and narrow-screen layout with intercepted ad requests; never generate repeated real impressions or click ads for QA. Actual fill, revenue and regional provider behavior need real traffic or one ordinary authorized observation and remain unknown until observed.

## Routine checks

The `Check published personal site and Atlas` GitHub workflow runs after a successful deployment, daily, and manually. It verifies representative HTTP responses, declared canonicals, meaningful initial HTML, legacy moves, real missing-page status, sitemap/robots, ads.txt and app identity. It writes an artifact and fails on actionable problems; it does not send messages or claim Google indexing. Rendered metadata, localization, model interactions, mobile layout and old-cache migration remain release checks in `e2e/`.

Run the public check locally with `bun deployment/verify-production.ts` from the repository root. For the complete local preview, use `SITE_URL=http://127.0.0.1:3342 bun deployment/verify-production.ts`. It needs no account credentials and does not load ad or Analytics scripts.

Natural discovery is provided by the personal project page, public README, crawlable catalogue/form/type/generation links, short help pages and species/form share links. Contact is the public GitHub issue tracker as disclosed on About; do not invent an unverified private mailbox. A demonstration video is optional when a real usability problem needs it; the current short steps work without one. Do not mark a WebGL canvas as a video or buy/exchange links for rankings.

The profile sitemap is `/sitemap.xml` (12 profile language pages); the application sitemap is `/atlas/sitemap.xml` (10,756 Atlas URLs). Treat them as separate submissions and reports. The origin robots.txt lists both for crawler discovery.
