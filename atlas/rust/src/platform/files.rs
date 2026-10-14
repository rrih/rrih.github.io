use super::background::{load_background, save_background};
use crate::{
    browser,
    core::{scene_files, scene_studio::SavedScene},
};
use base64::{Engine, engine::general_purpose::STANDARD};
use wasm_bindgen::JsCast;
use wasm_bindgen_futures::JsFuture;
pub async fn export_scene(scene: &SavedScene) -> Result<String, String> {
    let mut background = None;
    if scene.settings.habitat == "custom"
        && let Some(id) = &scene.settings.background_id
    {
        let stored = load_background(id)
            .await?
            .ok_or_else(|| "Missing background".to_string())?;
        let result = async {
            let response = JsFuture::from(browser::window().fetch_with_str(&stored.url))
                .await
                .map_err(|_| "Missing background")?
                .dyn_into::<web_sys::Response>()
                .map_err(|_| "Missing background")?;
            let blob = JsFuture::from(response.blob().map_err(|_| "Missing background")?)
                .await
                .map_err(|_| "Missing background")?
                .dyn_into::<web_sys::Blob>()
                .map_err(|_| "Missing background")?;
            let bytes = js_sys::Uint8Array::new(
                &JsFuture::from(blob.array_buffer())
                    .await
                    .map_err(|_| "Missing background")?,
            )
            .to_vec();
            Ok::<_, &str>(format!(
                "data:{};base64,{}",
                blob.type_(),
                STANDARD.encode(bytes)
            ))
        }
        .await;
        let _ = web_sys::Url::revoke_object_url(&stored.url);
        background = Some(result.map_err(str::to_string)?);
    }
    scene_files::export_scene(scene, background.as_deref()).map_err(|e| e.to_string())
}
pub async fn read_scene_file(file: web_sys::File) -> Result<SavedScene, String> {
    if file.size() > scene_files::MAX_SCENE_FILE_BYTES as f64 {
        return Err("Oversized scene".into());
    }
    let text = JsFuture::from(file.text())
        .await
        .map_err(|_| "Invalid scene")?
        .as_string()
        .ok_or("Invalid scene")?;
    let mut imported = scene_files::read_scene_file(text.as_bytes()).map_err(|e| e.to_string())?;
    if let Some(background) = imported.background {
        let parts = js_sys::Array::new();
        parts.push(&js_sys::Uint8Array::from(background.bytes.as_slice()));
        let args = js_sys::Array::new();
        args.push(&parts);
        args.push(&"background".into());
        args.push(&browser::json(&serde_json::json!({"type":background.mime})));
        let constructor = browser::get(browser::window().as_ref(), "File")
            .dyn_into::<js_sys::Function>()
            .map_err(|_| "Invalid background")?;
        let file = js_sys::Reflect::construct(&constructor, &args)
            .map_err(|_| "Invalid background")?
            .dyn_into::<web_sys::File>()
            .map_err(|_| "Invalid background")?;
        let saved = save_background(file).await?;
        imported.scene.settings.background_id = Some(saved.id);
        let _ = web_sys::Url::revoke_object_url(&saved.url);
    }
    imported.scene.id = browser::uuid();
    Ok(imported.scene)
}
