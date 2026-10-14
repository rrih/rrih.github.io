// Browser ABI loader. UI, state, model control and metadata are implemented in Rust.
import init from './rust/pkg/atlas.js'
import './src/style.css'
import './src/scene-editor.css'
import './src/ad-slot.css'
await init({ module_or_path: new URL('./rust/pkg/atlas_bg.wasm', import.meta.url) })
