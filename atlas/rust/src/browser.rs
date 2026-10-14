use serde_json::Value;
use wasm_bindgen::{JsCast, JsValue};
use wasm_bindgen_futures::JsFuture;

pub fn window() -> web_sys::Window {
    web_sys::window().expect("browser window")
}
pub fn document() -> web_sys::Document {
    window().document().expect("browser document")
}
pub fn get(object: &JsValue, key: &str) -> JsValue {
    js_sys::Reflect::get(object, &key.into()).unwrap_or(JsValue::UNDEFINED)
}
pub fn set(object: &JsValue, key: &str, value: &JsValue) -> Result<(), JsValue> {
    js_sys::Reflect::set(object, &key.into(), value).map(|_| ())
}
pub fn call(object: &JsValue, key: &str, args: &[JsValue]) -> Result<JsValue, JsValue> {
    let function = get(object, key).dyn_into::<js_sys::Function>()?;
    let array = js_sys::Array::new();
    for value in args {
        array.push(value);
    }
    function.apply(object, &array)
}
pub async fn promise(value: JsValue) -> Result<JsValue, JsValue> {
    JsFuture::from(js_sys::Promise::resolve(&value)).await
}
pub fn json(value: &Value) -> JsValue {
    js_sys::JSON::parse(&value.to_string()).unwrap_or(JsValue::NULL)
}
pub fn from_js(value: &JsValue) -> Option<Value> {
    serde_json::from_str(&js_sys::JSON::stringify(value).ok()?.as_string()?).ok()
}
pub fn stored(key: &str) -> Option<String> {
    window()
        .local_storage()
        .ok()
        .flatten()?
        .get_item(key)
        .ok()
        .flatten()
}
pub fn store(key: &str, value: &str) -> bool {
    window()
        .local_storage()
        .ok()
        .flatten()
        .is_some_and(|s| s.set_item(key, value).is_ok())
}
pub fn remove(key: &str) {
    if let Ok(Some(storage)) = window().local_storage() {
        let _ = storage.remove_item(key);
    }
}
pub fn query() -> web_sys::UrlSearchParams {
    web_sys::UrlSearchParams::new_with_str(&window().location().search().unwrap_or_default())
        .unwrap()
}
pub fn hash() -> web_sys::UrlSearchParams {
    web_sys::UrlSearchParams::new_with_str(
        window()
            .location()
            .hash()
            .unwrap_or_default()
            .trim_start_matches('#'),
    )
    .unwrap()
}
pub fn media(query: &str) -> bool {
    window()
        .match_media(query)
        .ok()
        .flatten()
        .is_some_and(|m| m.matches())
}
pub fn uuid() -> String {
    call(&get(window().as_ref(), "crypto"), "randomUUID", &[])
        .ok()
        .and_then(|s| s.as_string())
        .expect("secure-context UUID")
}
pub fn focus(selector: &str) {
    if let Ok(Some(element)) = document().query_selector(selector)
        && let Some(element) = element.dyn_ref::<web_sys::HtmlElement>()
    {
        let _ = element.focus();
    }
}
pub async fn fetch_json(url: &str) -> Result<Value, JsValue> {
    let controller = web_sys::AbortController::new()?;
    let options = web_sys::RequestInit::new();
    options.set_signal(Some(&controller.signal()));
    let abort = controller.clone();
    let timeout = gloo_timers::callback::Timeout::new(15_000, move || abort.abort());
    let result = async {
        let response = JsFuture::from(window().fetch_with_str_and_init(url, &options))
            .await?
            .dyn_into::<web_sys::Response>()?;
        if !response.ok() {
            return Err(JsValue::from_str("Resource unavailable"));
        }
        // Response.text and Response.json use the same UTF-8 body decoding.
        // Translation payloads contain strings, so parse them once in Rust.
        let text = JsFuture::from(response.text()?)
            .await?
            .as_string()
            .ok_or_else(|| JsValue::from_str("Invalid JSON"))?;
        if let Ok(value) = serde_json::from_str::<Value>(&text)
            && !has_json_number(&value)
        {
            return Ok(value);
        }
        // Retain the previous JS Number semantics for exceptional payloads:
        // large integers round to f64, -0 stringifies to 0, and overflow to null.
        let value = js_sys::JSON::parse(&text)?;
        from_js(&value).ok_or_else(|| JsValue::from_str("Invalid JSON"))
    }
    .await;
    drop(timeout);
    result
}
fn has_json_number(value: &Value) -> bool {
    match value {
        Value::Number(_) => true,
        Value::Array(values) => values.iter().any(has_json_number),
        Value::Object(values) => values.values().any(has_json_number),
        _ => false,
    }
}
pub fn after_frame(action: impl FnOnce() + 'static) {
    let callback = wasm_bindgen::closure::Closure::once_into_js(action);
    let _ = window().request_animation_frame(callback.unchecked_ref());
}

pub fn retire_root_worker() {
    let navigator = window().navigator();
    if !js_sys::Reflect::has(navigator.as_ref(), &"serviceWorker".into()).unwrap_or(false) {
        return;
    }
    let origin = window().location().origin().unwrap_or_default();
    wasm_bindgen_futures::spawn_local(async move {
        if let Ok(registrations) =
            JsFuture::from(navigator.service_worker().get_registrations()).await
        {
            for value in js_sys::Array::from(&registrations).iter() {
                if let Ok(registration) = value.dyn_into::<web_sys::ServiceWorkerRegistration>()
                    && registration.scope() == format!("{origin}/")
                    && let Ok(promise) = registration.unregister()
                {
                    let _ = JsFuture::from(promise).await;
                }
            }
        }
    });
}

#[cfg(not(feature = "renderer-qa"))]
pub fn not_found() -> Result<(), JsValue> {
    let doc = document();
    let code = crate::ui::locale::initial_locale();
    let words = doc
        .get_element_by_id("atlas-not-found-words")
        .and_then(|node| node.text_content())
        .and_then(|text| serde_json::from_str::<Value>(&text).ok())
        .ok_or_else(|| JsValue::from_str("Missing page translations"))?;
    let copy = &words[&code];
    if let Some(root) = doc.document_element() {
        root.set_attribute("lang", &code)?;
        root.set_attribute(
            "dir",
            if crate::core::locales::is_rtl(&code) {
                "rtl"
            } else {
                "ltr"
            },
        )?;
    }
    let title = copy["title"].as_str().unwrap_or("Page not found");
    doc.set_title(&format!("{title} · Pokémon Atlas"));
    for (selector, key) in [("h1", "title"), ("main p", "text"), ("main a", "link")] {
        if let Some(node) = doc.query_selector(selector)? {
            node.set_text_content(copy[key].as_str());
        }
    }
    if let Some(link) = doc.query_selector("main a")? {
        link.set_attribute(
            "href",
            &format!(
                "/atlas/?lang={}",
                crate::core::routes::encode_component(&code)
            ),
        )?;
    }
    Ok(())
}
