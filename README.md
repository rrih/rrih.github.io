# Pokémon Atlas

A 3D Pokémon observatory at [rrih.github.io](https://rrih.github.io/).

Choose from 49 interface languages and regions. Search the national collection using 7,374 names from 12 source language/writing variants, or by number, filter by generation and type, and save favorites on your device. Orbit, zoom, inspect fixed camera angles, control motion, adjust lighting, switch environments, inspect geometry, and save a studio image. The app uses Three.js with WebGPU and falls back to WebGL 2.

## Languages

The language selector supports English, Japanese, Korean, Simplified/Traditional Chinese, French, German, Spanish (Spain/Latin America), Italian, Portuguese (Portugal/Brazil), Dutch, Swedish, Danish, Norwegian Bokmål, Finnish, Icelandic, Polish, Czech, Slovak, Hungarian, Romanian, Bulgarian, Ukrainian, Russian, Greek, Turkish, Arabic, Hebrew, Persian, Urdu, Hindi, Bengali, Tamil, Telugu, Marathi, Nepali, Thai, Vietnamese, Indonesian, Malay, Filipino, Swahili, Afrikaans, Catalan, Croatian, Serbian, and Slovenian.

All 195 interface messages are translated, including controls, accessibility labels, installation help, offline/errors, credits, and the missing-page screen. The explicit `?lang=` in a shared URL takes precedence over the saved device choice, then supported browser languages. Opening an installed app uses the latest saved choice. Arabic, Hebrew, Persian, and Urdu use right-to-left layouts and directional navigation. Numbers use the selected locale.

Pokédex content follows the pinned PokéAPI source, which has complete names for 12 language/writing variants. Descriptions exist for 1,025 English entries, 898 Japanese/Korean/French/German/Spanish/Italian entries, and 722 entries in each Chinese script. Missing descriptions and unsupported catalog languages display a visibly labeled English entry; interface translations are independently authored and are not represented as official Pokémon localization. All sourced names remain searchable in every interface language, with accent, kana-width, hiragana/katakana, and localized-number normalization.

Reproduce the data with `python3 scripts/fetch-localizations.py` (or add `--offline` to reuse the verified source cache). Source hashes and coverage are recorded in `scripts/data/localization-verification.json`. The build validates every dictionary key and placeholder, then generates all localized manifests and the 404 page. UI dictionaries and all source catalogs are available offline after the PWA finishes its initial cache.

## Development

```sh
bun install --frozen-lockfile
bun dev
bun run dev-check
```

`dev-check` runs Biome, catalog/asset assertions, TypeScript, and the production build. The pre-commit hook runs the same checks. GitHub Actions verifies and deploys `dist/` to GitHub Pages. No server, account, secrets, database, paid service, or runtime API is needed for the application.

Browser checks:

```sh
node e2e/verify.mjs
bun run preview -- --port 3335
ATLAS_URL=http://127.0.0.1:3335 ATLAS_VERIFY_PWA=1 node e2e/verify.mjs
```

The multilingual checks are `node e2e/localization.mjs`, `node e2e/localization-failures.mjs`, and `node e2e/localization-pwa.mjs` (set `ATLAS_URL` to the production preview). They cover all 49 locales at desktop and mobile widths, source-language fallback/retry, persistence and shared links, camera preservation, missing-page localization, and offline language changes.

The dedicated `node e2e/cache-retention.mjs` check covers first-view capture, more than 24 opened models, old cached responses, offline manifests, cache hits, and storage failure recovery. `node e2e/storage-persistence.mjs` uses controlled browser responses to verify denied, granted, already-persistent, unsupported, and throwing storage APIs, standalone startup, and accepted installation without repeated requests.

The dedicated `node e2e/pwa.mjs` check verifies an actual failed uncached request, offline 3D reload, reconnection, and cached shiny variants. `node e2e/unavailable.mjs` checks graphics failure, species switching during failure, and recovery after graphics become available. Chromium currently resets its reported online state after a cached reload in Playwright, so the harness additionally uses the documented CDP network-state emulation for the offline banner.

The browser checks require a local Chrome installation. Evidence goes to ignored `work/qa/`. They exercise real 3D rendering, animation/pause, reduced-motion preferences, camera angles, image download, persistent favorites, Japanese search, first/last species, mobile widths, and (with the flag) an offline reload through the production service worker.

## Data and assets

- The catalog contains the 1,025 numbered species, covering generations 1–9. All IDs, slugs, dimensions, stats, names, and evolution references were checked against the [PokéAPI](https://pokeapi.co/) source snapshot. Alternate forms are not a complete collection.
- Species data can be reproduced with `python3 scripts/fetch-catalog.py --output src/data/catalog.json --cache work/catalog-cache`. The script pins its source revision and validates the live species index. Audit details are in `scripts/data/catalog-verification.json`.
- Official artwork is sourced from [PokéAPI sprites](https://github.com/PokeAPI/sprites), resized for collection thumbnails by `node scripts/prepare-artwork.mjs`.
- 3D sources are [Pokémon 3D API assets](https://github.com/Pokemon-3D-api/assets), [Pokémon HOME GLB Models](https://github.com/Lilothestitch16/Pokemon-HOME-GLB-Models), and [Pokémon HOME Unity Models](https://github.com/Lilothestitch16/Pokemon-HOME-Unity-Models).
- All 1,025 base models, their textures, and a source idle animation per species are bundled with the site. The optional 150 shiny variants are separate assets fetched from an immutable source revision.
- HOME conversion uses exact material GUIDs, texture atlases, skeleton paths, source animation curves, and Unity-to-glTF coordinates. Scripts and per-species conversion records are in `scripts/`. Compression uses Draco for geometry and lossless WebP for embedded textures.
- The forest habitat was generated with OpenAI's built-in image-generation tool. Prompt: a photorealistic ancient temperate forest clearing, unobstructed center, ferns, moss, morning mist and light, no creatures, people, text, or logos.

Model geometry, material quality, and animation fidelity are limited by the source assets. They are game character models rendered with physical lighting, not newly sculpted photorealistic creatures. Unity-only material/shader effects are approximated with standard real-time materials. Imported special effects and optional shiny variants can differ in fidelity from the base models. No source-license statement here grants rights to Pokémon intellectual property.

## PWA and privacy

The manifest includes standard and maskable app icons. The service worker initially caches the application, the first 24 collection thumbnails, fonts, background, decoder, default Pokémon, all 12 source catalogs, and all 49 localized app manifests. Other thumbnails and models are cached as they are viewed, up to 1,025 thumbnails and all 1,175 available base/shiny model URLs, with no time-based expiration. Existing runtime caches survive application updates. On the first visit, the active worker also saves the opened model and current collection thumbnails after taking control. Cache hits are served locally without background re-downloads. Browsers may still evict stored data; on a runtime-write quota failure, Workbox clears runtime caches it has used in that worker so subsequent requests can recover, while the current network response remains usable. A new service-worker installation can still fail if the browser cannot allocate space. The app requests persistent storage after installation or on standalone launch when supported; denial does not block viewing. New uncached images and models require connectivity. Updates are offered through a user-visible refresh action. UI, catalogs, and manifests use revisioned precaching; model/artwork changes at existing URLs require a bump of their corresponding runtime cache version.

Favorites and the selected language are stored locally. There are no accounts, analytics, trackers, advertisements, or payments. Copying a link and saving a PNG are user-triggered actions.

## Compatibility and maintenance

WebGPU is selected when available; WebGL 2 is supported as a fallback. If neither is available, the app shows a recoverable loading message. High-detail and battery-friendly settings limit pixel density. Reduced-motion preferences disable initial movement, and hidden tabs stop animation work.

`esbuild` is pinned to 0.28.0 because the 0.28.2 macOS ARM binary was terminated on this workstation. The failure matches the [upstream macOS report](https://github.com/evanw/esbuild/issues/4504); the supported 0.28.0 version built successfully. The lockfile is committed for repeatable installs.

## Credits

Pokémon and Pokémon character names are trademarks of Nintendo, Creatures Inc., and GAME FREAK inc. This is an independent, non-commercial fan project, unaffiliated with those companies. Their models, textures, and artwork are excluded from the application-code license.

Three.js, React, Vite, Workbox, Lucide, Draco, and glTF Transform power the experience. DM Sans and Manrope are bundled under the SIL Open Font License. Bundled Draco files retain their upstream notices.
