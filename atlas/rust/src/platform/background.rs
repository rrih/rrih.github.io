//! Browser-local raster backgrounds. Database, object-store, and structured-clone schema
//! deliberately match the original application so an update preserves users' images.
use crate::browser::{self, call, get, set};
use gloo_events::EventListener;
use std::cell::Cell;
use std::rc::Rc;
use wasm_bindgen::{JsCast, JsValue, closure::Closure};
use wasm_bindgen_futures::JsFuture;
const DATABASE: &str = "atlas-backgrounds-v1";
const STORE: &str = "images";
const MAX_INPUT: f64 = 10.0 * 1024.0 * 1024.0;
const MAX_STORED: f64 = 4.0 * 1024.0 * 1024.0;
pub const MAX_EDGE: u32 = 2048;
#[derive(Clone, Debug, PartialEq)]
pub struct Background {
    pub id: String,
    pub url: String,
}
fn error(code: &str) -> String {
    code.into()
}
fn valid_id(id: &str) -> bool {
    let bytes = id.as_bytes();
    bytes.len() == 36
        && [8, 13, 18, 23].iter().all(|i| bytes[*i] == b'-')
        && bytes[14] == b'4'
        && matches!(bytes[19].to_ascii_lowercase(), b'8' | b'9' | b'a' | b'b')
        && bytes
            .iter()
            .enumerate()
            .all(|(i, c)| [8, 13, 18, 23].contains(&i) || c.is_ascii_hexdigit())
}
async fn raster_type(blob: &web_sys::Blob) -> Option<&'static str> {
    let slice = blob.slice_with_f64_and_f64(0.0, 16.0).ok()?;
    let bytes = js_sys::Uint8Array::new(&JsFuture::from(slice.array_buffer()).await.ok()?).to_vec();
    if bytes.starts_with(&[0xff, 0xd8, 0xff]) {
        Some("image/jpeg")
    } else if bytes.starts_with(&[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) {
        Some("image/png")
    } else if bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WEBP") {
        Some("image/webp")
    } else if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        Some("image/gif")
    } else if bytes.get(4..8) == Some(b"ftyp")
        && [b"avif", b"avis", b"mif1"]
            .iter()
            .any(|v| bytes.get(8..12) == Some(v.as_slice()))
    {
        Some("image/avif")
    } else {
        None
    }
}
struct Database {
    value: JsValue,
    _listener: EventListener,
}
impl Drop for Database {
    fn drop(&mut self) {
        let _ = call(&self.value, "close", &[]);
    }
}
async fn open_database() -> Result<Database, String> {
    let request = call(
        &get(browser::window().as_ref(), "indexedDB"),
        "open",
        &[DATABASE.into(), 1.into()],
    )
    .map_err(|_| error("storage"))?;
    let blocked = Rc::new(Cell::new(false));
    let mut handlers: Vec<Closure<dyn FnMut(web_sys::Event)>> = vec![];
    let promise = js_sys::Promise::new(&mut |resolve, reject| {
        let success = request.clone();
        let handler = Closure::new(move |_: web_sys::Event| {
            let _ = resolve.call1(&JsValue::NULL, &get(&success, "result"));
        });
        let _ = set(&request, "onsuccess", handler.as_ref());
        handlers.push(handler);
        let reject_error = reject.clone();
        let handler = Closure::new(move |_: web_sys::Event| {
            let _ = reject_error.call1(&JsValue::NULL, &"storage".into());
        });
        let _ = set(&request, "onerror", handler.as_ref());
        handlers.push(handler);
        let pending = request.clone();
        let blocked_flag = blocked.clone();
        let handler = Closure::new(move |_: web_sys::Event| {
            blocked_flag.set(true);
            let late = pending.clone();
            let close = Closure::once_into_js(move |_: web_sys::Event| {
                let _ = call(&get(&late, "result"), "close", &[]);
            });
            let _ = set(&pending, "onsuccess", &close);
            let _ = reject.call1(&JsValue::NULL, &"storage".into());
        });
        let _ = set(&request, "onblocked", handler.as_ref());
        handlers.push(handler);
        let upgrading = request.clone();
        let handler = Closure::new(move |_: web_sys::Event| {
            let db = get(&upgrading, "result");
            let exists = call(&get(&db, "objectStoreNames"), "contains", &[STORE.into()])
                .ok()
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            if !exists {
                let _ = call(
                    &db,
                    "createObjectStore",
                    &[
                        STORE.into(),
                        browser::json(&serde_json::json!({"keyPath":"id"})),
                    ],
                );
            }
        });
        let _ = set(&request, "onupgradeneeded", handler.as_ref());
        handlers.push(handler);
    });
    let result = JsFuture::from(promise).await;
    for property in ["onsuccess", "onerror", "onblocked", "onupgradeneeded"] {
        if property != "onsuccess" || !blocked.get() {
            let _ = set(&request, property, &JsValue::NULL);
        }
    }
    drop(handlers);
    let value = result.map_err(|_| error("storage"))?;
    let db = value.clone();
    let target = value
        .clone()
        .dyn_into::<web_sys::EventTarget>()
        .map_err(|_| error("storage"))?;
    let listener = EventListener::new(&target, "versionchange", move |_| {
        let _ = call(&db, "close", &[]);
    });
    Ok(Database {
        value,
        _listener: listener,
    })
}
async fn transact(mode: &str, method: &str, value: &JsValue) -> Result<JsValue, String> {
    let database = open_database().await?;
    let transaction = call(&database.value, "transaction", &[STORE.into(), mode.into()])
        .map_err(|_| error("storage"))?;
    let store = call(&transaction, "objectStore", &[STORE.into()]).map_err(|_| error("storage"))?;
    let request =
        call(&store, method, std::slice::from_ref(value)).map_err(|_| error("storage"))?;
    let mut handlers: Vec<Closure<dyn FnMut(web_sys::Event)>> = vec![];
    let promise = js_sys::Promise::new(&mut |resolve, reject| {
        let request = request.clone();
        let handler = Closure::new(move |_: web_sys::Event| {
            let _ = resolve.call1(&JsValue::NULL, &get(&request, "result"));
        });
        let _ = set(&transaction, "oncomplete", handler.as_ref());
        handlers.push(handler);
        for property in ["onabort", "onerror"] {
            let reject = reject.clone();
            let handler = Closure::new(move |_: web_sys::Event| {
                let _ = reject.call1(&JsValue::NULL, &"storage".into());
            });
            let _ = set(&transaction, property, handler.as_ref());
            handlers.push(handler);
        }
    });
    let result = JsFuture::from(promise).await.map_err(|_| error("storage"));
    for property in ["oncomplete", "onabort", "onerror"] {
        let _ = set(&transaction, property, &JsValue::NULL);
    }
    drop(handlers);
    result
}
struct Decoded {
    image: JsValue,
    width: f64,
    height: f64,
    url: Option<String>,
}
impl Drop for Decoded {
    fn drop(&mut self) {
        if let Some(url) = &self.url {
            let _ = set(&self.image, "src", &"".into());
            let _ = web_sys::Url::revoke_object_url(url);
        } else {
            let _ = call(&self.image, "close", &[]);
        }
    }
}
async fn decode(blob: &web_sys::Blob) -> Result<Decoded, String> {
    if let Ok(value) = call(
        browser::window().as_ref(),
        "createImageBitmap",
        &[blob.clone().into()],
    ) && let Ok(image) = browser::promise(value).await
    {
        return Ok(Decoded {
            width: get(&image, "width").as_f64().unwrap_or(0.0),
            height: get(&image, "height").as_f64().unwrap_or(0.0),
            image,
            url: None,
        });
    }
    let url = web_sys::Url::create_object_url_with_blob(blob).map_err(|_| error("decode"))?;
    let image: JsValue = browser::document()
        .create_element("img")
        .map_err(|_| error("decode"))?
        .into();
    let _ = set(&image, "src", &url.clone().into());
    let loaded = match call(&image, "decode", &[]) {
        Ok(value) => browser::promise(value).await.is_ok(),
        Err(_) => false,
    };
    if !loaded {
        let _ = web_sys::Url::revoke_object_url(&url);
        return Err(error("decode"));
    }
    Ok(Decoded {
        width: get(&image, "naturalWidth").as_f64().unwrap_or(0.0),
        height: get(&image, "naturalHeight").as_f64().unwrap_or(0.0),
        image,
        url: Some(url),
    })
}
pub async fn save_background(file: web_sys::File) -> Result<Background, String> {
    let mime = crate::core::case::lower(&file.type_());
    if ![
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/avif",
    ]
    .contains(&mime.as_str())
    {
        return Err(error("unsupported"));
    }
    if file.size() == 0.0 {
        return Err(error("decode"));
    }
    if file.size() > MAX_INPUT {
        return Err(error("too-large"));
    }
    let source: &web_sys::Blob = file.as_ref();
    if raster_type(source).await != Some(mime.as_str()) {
        return Err(error("unsupported"));
    }
    let decoded = decode(source).await?;
    let (w, h) = (decoded.width, decoded.height);
    if w == 0.0 || h == 0.0 {
        return Err(error("decode"));
    }
    if w > 16384.0 || h > 16384.0 || w * h > 40_000_000.0 {
        return Err(error("too-large"));
    }
    let scale = (MAX_EDGE as f64 / w.max(h)).min(1.0);
    let width = (w * scale).round().max(1.0) as u32;
    let height = (h * scale).round().max(1.0) as u32;
    let canvas = browser::document()
        .create_element("canvas")
        .map_err(|_| error("decode"))?
        .dyn_into::<web_sys::HtmlCanvasElement>()
        .map_err(|_| error("decode"))?;
    canvas.set_width(width);
    canvas.set_height(height);
    let result = async {
        let context = canvas
            .get_context("2d")
            .map_err(|_| error("decode"))?
            .ok_or_else(|| error("decode"))?;
        call(
            &context,
            "drawImage",
            &[
                decoded.image.clone(),
                0.into(),
                0.into(),
                width.into(),
                height.into(),
            ],
        )
        .map_err(|_| error("decode"))?;
        let promise = js_sys::Promise::new(&mut |resolve, reject| {
            let callback = Closure::once_into_js(move |blob: JsValue| {
                let _ = resolve.call1(&JsValue::NULL, &blob);
            });
            if call(
                canvas.as_ref(),
                "toBlob",
                &[callback, "image/webp".into(), 0.86.into()],
            )
            .is_err()
            {
                let _ = reject.call1(&JsValue::NULL, &"decode".into());
            }
        });
        let blob = JsFuture::from(promise)
            .await
            .map_err(|_| error("decode"))?
            .dyn_into::<web_sys::Blob>()
            .map_err(|_| error("decode"))?;
        if !["image/jpeg", "image/png", "image/webp"].contains(&blob.type_().as_str()) {
            return Err(error("decode"));
        }
        if blob.size() > MAX_STORED {
            return Err(error("too-large"));
        }
        let id = browser::uuid();
        let record = js_sys::Object::new();
        for (key, value) in [
            ("version", 1.into()),
            ("id", id.clone().into()),
            ("blob", blob.clone().into()),
            ("width", width.into()),
            ("height", height.into()),
        ] {
            set(&record, key, &value).map_err(|_| error("decode"))?;
        }
        transact("readwrite", "put", record.as_ref()).await?;
        let url = web_sys::Url::create_object_url_with_blob(&blob).map_err(|_| error("decode"))?;
        Ok(Background { id, url })
    }
    .await;
    canvas.set_width(0);
    canvas.set_height(0);
    result
}
pub async fn load_background(id: &str) -> Result<Option<Background>, String> {
    if !valid_id(id) {
        return Ok(None);
    }
    let record = transact("readonly", "get", &id.into()).await?;
    if get(&record, "version").as_f64() != Some(1.0)
        || get(&record, "id").as_string().as_deref() != Some(id)
    {
        return Ok(None);
    }
    let Ok(blob) = get(&record, "blob").dyn_into::<web_sys::Blob>() else {
        return Ok(None);
    };
    let (width, height) = (
        get(&record, "width").as_f64().unwrap_or(0.0),
        get(&record, "height").as_f64().unwrap_or(0.0),
    );
    if !["image/jpeg", "image/png", "image/webp"].contains(&blob.type_().as_str())
        || blob.size() == 0.0
        || blob.size() > MAX_STORED
        || [width, height]
            .iter()
            .any(|v| !v.is_finite() || v.fract() != 0.0 || *v < 1.0 || *v > MAX_EDGE as f64)
    {
        return Ok(None);
    }
    if raster_type(&blob).await != Some(blob.type_().as_str()) {
        return Ok(None);
    }
    let Ok(decoded) = decode(&blob).await else {
        return Ok(None);
    };
    if decoded.width != width || decoded.height != height {
        return Ok(None);
    }
    let url = web_sys::Url::create_object_url_with_blob(&blob).map_err(|_| error("storage"))?;
    Ok(Some(Background { id: id.into(), url }))
}
pub async fn delete_background(id: &str) -> Result<(), String> {
    if valid_id(id) {
        transact("readwrite", "delete", &id.into()).await?;
    }
    Ok(())
}

pub use super::background_picker::BackgroundPicker;
