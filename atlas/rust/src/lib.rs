// The core module is shared by the browser and static generator.
pub mod core;

#[cfg(target_arch = "wasm32")]
pub mod viewer;

#[cfg(target_arch = "wasm32")]
pub mod browser;
#[cfg(all(target_arch = "wasm32", not(feature = "renderer-qa")))]
pub mod platform;
#[cfg(all(target_arch = "wasm32", not(feature = "renderer-qa")))]
pub mod ui;

#[cfg(all(target_arch = "wasm32", not(feature = "renderer-qa")))]
#[wasm_bindgen::prelude::wasm_bindgen(start)]
pub fn start() -> Result<(), wasm_bindgen::JsValue> {
    browser::retire_root_worker();
    if browser::document()
        .get_element_by_id("atlas-not-found")
        .is_some()
    {
        browser::not_found()?;
    } else {
        ui::start();
    }
    Ok(())
}
