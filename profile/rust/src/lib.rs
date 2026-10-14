use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn start() -> Result<(), JsValue> {
    let window = web_sys::window().ok_or_else(|| JsValue::from_str("Window unavailable"))?;
    let document = window
        .document()
        .ok_or_else(|| JsValue::from_str("Document unavailable"))?;
    let navigator = window.navigator();
    if js_sys::Reflect::has(&navigator, &JsValue::from_str("serviceWorker"))? {
        let workers = navigator.service_worker();
        let origin = window.location().origin()?;
        wasm_bindgen_futures::spawn_local(async move {
            if let Ok(registrations) =
                wasm_bindgen_futures::JsFuture::from(workers.get_registrations()).await
            {
                for value in js_sys::Array::from(&registrations).iter() {
                    if let Ok(registration) = value.dyn_into::<web_sys::ServiceWorkerRegistration>()
                        && registration.scope() == format!("{origin}/")
                        && let Ok(promise) = registration.unregister()
                    {
                        let _ = wasm_bindgen_futures::JsFuture::from(promise).await;
                    }
                }
            }
        });
    }
    let query = web_sys::UrlSearchParams::new_with_str(&window.location().search()?)?;
    if let Some(language) = query.get("lang").filter(|value| !value.is_empty()) {
        let links = document.query_selector_all("a[hreflang]")?;
        for index in 0..links.length() {
            if let Some(link) = links
                .item(index)
                .and_then(|node| node.dyn_into::<web_sys::HtmlAnchorElement>().ok())
                && link.hreflang().eq_ignore_ascii_case(&language)
            {
                if link.pathname() != window.location().pathname()? {
                    window.location().replace(&link.href())?;
                }
                break;
            }
        }
    }
    let doc = document.clone();
    let keydown =
        Closure::<dyn FnMut(web_sys::KeyboardEvent)>::new(move |event: web_sys::KeyboardEvent| {
            if event.key() == "Escape"
                && let Ok(Some(details)) = doc.query_selector("details")
            {
                let _ = details.remove_attribute("open");
            }
        });
    document.add_event_listener_with_callback("keydown", keydown.as_ref().unchecked_ref())?;
    keydown.forget();
    Ok(())
}
