# Pokémon Atlas

This repository deploys to GitHub Pages from `main`. Work in the canonical project checkout and preserve unrelated worktrees.
The owner requested a full replacement of the old tools site and its Git history on 2026-09-05.

- Keep the interface focused on browsing Pokémon; do not show debug, infrastructure, conversion, or internal status details.
- Use real sourced species data and 3D assets. Do not substitute one species for another or describe synthesized movement as recorded character animation.
- Preserve sources and conversion limitations in README and asset records.
- Keep all species searchable and provide clear loading, failure, and offline states.
- Preserve keyboard, touch, reduced-motion, and battery-friendly controls.
- Run `bun run dev-check` before every commit. The pre-commit hook runs the same lint, test, and production-build checks.
- Verify the actual browser rendering, mobile layout, model switching, and PWA before shipping. A successful build alone does not verify 3D rendering.
- Preserve unrelated local files, credentials, and `.env` files. Publish only the intended application and its build inputs.
- Update ignored DEVELOPMENT_HISTORY.md for a material working session.
- Distinguish code commit, remote push, Pages deployment, and live-site verification in reports.

- When updating model or artwork contents at existing URLs, change the corresponding runtime cache version in vite.config.ts so returning visitors fetch the updated asset. Keep unchanged asset cache versions stable to preserve opened resources across application updates.
