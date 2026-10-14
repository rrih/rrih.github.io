# Pokémon Atlas

[Explore Pokémon in 3D](https://rrih.github.io/atlas/): rotate animated models, try different forms and landscapes, and arrange up to six Pokémon. Share arrangements by URL, or keep scenes on your device; install the PWA to revisit cached models offline.

## Development

Atlas runs its UI, state, storage, localization, scene rules and renderer control in Rust/WebAssembly. The same Rust metadata code generates its static pages. Three.js provides the existing WebGPU/WebGL renderer through a small vendor adapter; models, artwork, CSS, URLs and saved-data namespaces are preserved.

Service-worker cache-key and offline fallback policies also run in Rust. Workbox supplies cache strategies and browser event wiring through the retained Vite configuration and worker bootstrap. JavaScript remains at these library boundaries and in the independent browser tests.

Install the Rust toolchain in the repository's `rust-toolchain.toml` and `wasm-bindgen-cli` 0.2.129. From this directory, run `bun install --frozen-lockfile`, then `bun run dev`. `bun run dev-check` checks Rust formatting, Clippy, native tests, real GLB assets, the WASM build and all generated pages. It does not substitute for browser verification.

After building the profile and Pictulane independently, run `bun run compose` and `bun run e2e` from the repository root. See [browser regression coverage](../e2e/README.md) for mobile, offline, scene migration and exact procedural-renderer checks.

See the [migration verification record](../deployment/RUST-MIGRATION.md) for completed checks, outstanding work, previous-release upgrade validation and performance comparisons. The local results do not establish a Pages deployment.

## Compatibility and credits

Uses WebGPU with a WebGL 2 fallback. Model detail varies, and some source effects are approximated. See [assets and sources](scripts/README-assets.md) and [localization](scripts/README-localization.md).

An unofficial fan project. Original code is MIT licensed; Pokémon assets retain their owners’ rights. [Credits](https://rrih.github.io/atlas/legal/en/rights.html) · [Terms](https://rrih.github.io/atlas/legal/en/terms.html) · [Privacy](https://rrih.github.io/atlas/legal/en/privacy.html).
