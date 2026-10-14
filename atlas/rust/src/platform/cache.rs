use crate::browser::{self, call, get};
use std::{cell::Cell, rc::Rc};
use wasm_bindgen::{JsCast, JsValue};
use wasm_bindgen_futures::{JsFuture, future_to_promise};
thread_local! {static PERSISTENCE_REQUESTED:Cell<bool>=const{Cell::new(false)};}
pub async fn cache_opened_view(model_urls: Vec<String>) {
    let navigator = browser::window().navigator();
    let worker = get(navigator.as_ref(), "serviceWorker");
    if get(&worker, "controller").is_null()
        || get(&worker, "controller").is_undefined()
        || !navigator.on_line()
    {
        return;
    }
    let mut urls = model_urls;
    if let Ok(images) = browser::document().query_selector_all("img") {
        for i in 0..images.length() {
            if let Some(image) = images.item(i) {
                let src = get(image.as_ref(), "currentSrc")
                    .as_string()
                    .filter(|s| !s.is_empty())
                    .or_else(|| get(image.as_ref(), "src").as_string())
                    .unwrap_or_default();
                if let Ok(url) = web_sys::Url::new_with_base(
                    &src,
                    &browser::window().location().href().unwrap_or_default(),
                ) && url.origin() == browser::window().location().origin().unwrap_or_default()
                    && url
                        .pathname()
                        .strip_prefix("/atlas/artwork/")
                        .and_then(|p| p.strip_suffix(".webp"))
                        .is_some_and(|id| !id.is_empty() && id.bytes().all(|b| b.is_ascii_digit()))
                {
                    urls.push(src);
                }
            }
        }
    }
    let mut seen = std::collections::HashSet::new();
    urls.retain(|url| seen.insert(url.clone()));
    let urls = Rc::new(urls);
    let next = Rc::new(Cell::new(0));
    let workers = js_sys::Array::new();
    for _ in 0..4.min(urls.len()) {
        let urls = urls.clone();
        let next = next.clone();
        workers.push(&future_to_promise(async move {
            while next.get() < urls.len() && browser::window().navigator().on_line() {
                let i = next.get();
                next.set(i + 1);
                if let Ok(response) =
                    JsFuture::from(browser::window().fetch_with_str(&urls[i])).await
                    && let Ok(response) = response.dyn_into::<web_sys::Response>()
                    && let Ok(buffer) = response.array_buffer()
                {
                    let _ = JsFuture::from(buffer).await;
                }
            }
            Ok(JsValue::UNDEFINED)
        }));
    }
    let _ = JsFuture::from(js_sys::Promise::all(&workers)).await;
}
pub async fn retain_installed_storage() {
    if PERSISTENCE_REQUESTED.with(|v| v.replace(true)) {
        return;
    }
    let storage = get(browser::window().navigator().as_ref(), "storage");
    let persisted = if let Ok(value) = call(&storage, "persisted", &[]) {
        browser::promise(value)
            .await
            .ok()
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
    } else {
        false
    };
    if !persisted && let Ok(value) = call(&storage, "persist", &[]) {
        let _ = browser::promise(value).await;
    }
}
