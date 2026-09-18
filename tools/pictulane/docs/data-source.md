# Data source investigation

Checked 2026-09-18 JST. **No compliant production data source was established.** This is an incomplete acquisition integration, not a working X album product. The production provider returns an explicit unavailable state and makes no API or proxy calls. It does not label failures as private, nonexistent or zero-photo accounts. No demo fallback or manual import exists in production.

## Actual browser checks

Playwright driving installed Chrome, a new browser context per origin, no storage state, cookies or user login imported; `credentials: omit`, ordinary CORS fetch, 12-second timeout. A plain local HTTP server returned static HTML only (no proxy). The same probes were then run on `https://rrih.github.io/`.

| URL | Static preview | Pages origin | Usable post/media data |
| --- | --- | --- | --- |
| `https://x.com/NASA/media` | 200, readable CORS response, 297549 characters | Same | None established |
| `https://x.com/NatGeo/media` | 200, readable CORS response, 297549 characters | Same | None established |
| `https://twitter.com/NASA/media` | 200, readable CORS response, 297549 characters | Same | None established |

After the first Pages deployment, the same checks were repeated from the actual `/tools/pictulane/` page: all three responses were readable HTTP 200 shells with zero post articles, zero post-photo images and no tweet results. Exact timestamp and machine-readable evidence: [source-probe.json](source-probe.json).

The returned HTML was the common JavaScript application shell: no `tweet_results`, no post-photo `<img>` list; the only HTML image was an `abs.twimg.com` warning emoji. This environment did **not** reproduce a CORS rejection; successful reading of an app shell is still not successful retrieval of posts. Results are environment/time specific, not a promise of CORS availability elsewhere. No X application scripts, guest activation or GraphQL request were executed to complete the data.

## Candidate decisions

- Public X/Twitter HTML: browser-readable shell in the checks above, but no verified author/attachment order, chronological posts, public-state information or pagination data. Cannot implement truthful extraction by collecting arbitrary `img` tags.
- Nitter public HTML/RSS: [upstream README](https://github.com/zedeus/nitter) expressly describes Twitter's unofficial API and backend requests. [Source](https://github.com/zedeus/nitter/blob/master/src/api.nim) implements the API layer. RSS wrapping does not remove this dependency. Rejected under the no-X-API condition; no rate-limit or challenge bypass attempted. Instance permission, CORS and continued availability are not established or relied upon.
- Syndication / embedded timeline or tweet data: [X documentation](https://docs.x.com/overview) and [an implementation's explicit syndication API description](https://github.com/osolmaz/janitr/blob/main/docs/SYNDICATION_API.md) identify this as an API-backed embedded-data route. Rejected; lack of an API key does not make it API-free. Not used or called.
- Generic CORS proxies, authenticated scraping, server-side relay, Actions retrieval and paid APIs: not adopted. None resolves all specified conditions with verified upstream provenance/permission.

## Supported range and consequences

No verified live accounts, posts, image ordering, cursor, public-state check, user ID or individual-post resolver are currently available. Do not infer any of them. Multi-post navigation and direct image restoration are tested only against a test-build provider. In production a direct image URL displays a failure with retry, album and original-post links; it never substitutes another image. Future acquisition work must first establish permission/provenance, browser access, author and attachment type/order, sensitive flags and public status. Do not merely enable an unverified endpoint.

`imageKey` in the viewer is a provider-supplied stable media identifier (or a documented original attachment position once verified). Post IDs remain strings. Runtime image validation accepts only HTTPS `pbs.twimg.com/media/…`; this allowlist is a security constraint, **not** evidence of a usable or authorized feed. The app stores no live photos today. Source-specific cache/reuse terms must be checked before enabling any real source; generic test cache behavior does not establish those rights.

## Platform references

- [GitHub Pages static hosting](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [Pages custom 404](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-custom-404-page-for-your-github-pages-site)
- [Fetch and CORS](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch)
- [Cache.put and opaque responses](https://developer.mozilla.org/en-US/docs/Web/API/Cache/put)
- [Service worker scope](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register)

No claim is made that account-only live retrieval, live image sharing or current-public-state revalidation has passed acceptance.
