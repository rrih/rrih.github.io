#[cfg(target_arch = "wasm32")]
mod app;
pub mod model;
#[cfg(target_arch = "wasm32")]
mod pwa;
#[cfg(target_arch = "wasm32")]
mod storage;
