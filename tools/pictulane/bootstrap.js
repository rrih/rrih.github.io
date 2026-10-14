// Browser ABI entry point. Application behavior is implemented in Rust/WASM.
import init from '__APP_MODULE__'
await init()
