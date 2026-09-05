# rrih.github.io — personal site and Pokémon Atlas

This repository deploys to GitHub Pages from `main`. Work in the canonical project checkout and preserve unrelated worktrees.
The owner requested a full replacement of the old tools site and its Git history on 2026-09-05. On 2026-09-06, the personal homepage was restored at `/` and the complete Atlas project moved under `/atlas/` in both repository and published URLs.

- Keep the personal root based on the owner-provided biography. Keep Atlas functionality, assets, app documentation and source in `atlas/`; each product builds independently; deployment/ only composes finished artifacts. Root README covers only the profile.
- Keep the Atlas interface focused on browsing Pokémon; do not show debug, infrastructure, conversion, or internal status details.
- Use real sourced species data and 3D assets. Do not substitute one species for another or describe synthesized movement as recorded character animation.
- Preserve sources and conversion limitations in README and asset records.
- Keep all species searchable and provide clear loading, failure, and offline states.
- Preserve keyboard, touch, reduced-motion, and battery-friendly controls.
- Run `bun run dev-check` and `cd atlas && bun run dev-check` before every commit. The pre-commit hook runs the same lint, test, and production-build checks.
- Verify the actual browser rendering, mobile layout, model switching, and PWA before shipping. A successful build alone does not verify 3D rendering.
- Preserve unrelated local files, credentials, and `.env` files. Publish only the intended application and its build inputs.
- Update ignored DEVELOPMENT_HISTORY.md for a material working session.
- Distinguish code commit, remote push, Pages deployment, and live-site verification in reports.

- When updating model or artwork contents at existing URLs, change the corresponding runtime cache version in atlas/vite.config.ts so returning visitors fetch the updated asset. Keep unchanged asset cache versions stable to preserve opened resources across application updates.

- Preserve existing Atlas localStorage/IndexedDB and model/artwork cache keys. The owner explicitly superseded the previous root-PWA identity rule: only /atlas/ has a PWA, with id/start/scope under /atlas/. Retire the old root worker without deleting data. No profile-to-Atlas redirects or mutual UI links. Equivalent old non-root Atlas routes remain hosting compatibility redirects. Keep unrelated missing routes true 404s.
- Per-species and form metadata must share the same generator before and after JavaScript. Keep truthful content-based sitemap dates and only supported, translated pages in hreflang.
