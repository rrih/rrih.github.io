use serde_json::Value;
use wasm_bindgen::{JsCast, JsValue, closure::Closure};
use wasm_bindgen_futures::JsFuture;
use web_sys::{ServiceWorkerRegistration, ServiceWorkerState};
use yew::Callback;

pub async fn message(kind: &str, data: Value) -> Value {
    let navigator = web_sys::window().unwrap().navigator();
    if !js_sys::Reflect::has(&navigator, &"serviceWorker".into()).unwrap_or(false) {
        return serde_json::json!({"error":"unavailable"});
    }
    let Some(sw) = web_sys::window()
        .unwrap()
        .navigator()
        .service_worker()
        .controller()
    else {
        return serde_json::json!({"error":"unavailable"});
    };
    let Ok(channel) = web_sys::MessageChannel::new() else {
        return serde_json::json!({"error":"unavailable"});
    };
    let mut payload = data.as_object().cloned().unwrap_or_default();
    payload.insert("type".into(), Value::String(kind.into()));
    let payload = js_sys::JSON::parse(&Value::Object(payload).to_string()).unwrap();
    let port = channel.port1();
    let promise = js_sys::Promise::new(&mut |resolve, _reject| {
        let resolve_timeout = resolve.clone();
        let port_timeout = port.clone();
        let timeout = gloo_timers::callback::Timeout::new(2500, move || {
            port_timeout.close();
            let _ = resolve_timeout.call1(&JsValue::NULL, &JsValue::NULL);
        });
        let handler = Closure::once_into_js(move |event: web_sys::MessageEvent| {
            drop(timeout);
            let _ = resolve.call1(&JsValue::NULL, &event.data());
        });
        port.set_onmessage(Some(handler.unchecked_ref()));
    });
    let transfer = js_sys::Array::new();
    transfer.push(&channel.port2());
    if sw
        .post_message_with_transferable(&payload, &transfer)
        .is_err()
    {
        return serde_json::json!({"error":"unavailable"});
    }
    let result = JsFuture::from(promise).await.ok();
    port.set_onmessage(None);
    port.close();
    result
        .and_then(|v| js_sys::JSON::stringify(&v).ok())
        .and_then(|v| serde_json::from_str(&v.as_string()?).ok())
        .unwrap_or_else(|| serde_json::json!({"error":"timeout"}))
}
pub fn configure(enabled: bool) {
    wasm_bindgen_futures::spawn_local(async move {
        message("configure", serde_json::json!({"enabled":enabled})).await;
    });
}
pub async fn register(callback: Callback<ServiceWorkerRegistration>) {
    let nav = web_sys::window().unwrap().navigator();
    if !js_sys::Reflect::has(&nav, &"serviceWorker".into()).unwrap_or(false) {
        return;
    }
    let options = web_sys::RegistrationOptions::new();
    options.set_scope("/tools/pictulane/");
    options.set_update_via_cache(web_sys::ServiceWorkerUpdateViaCache::None);
    let Ok(value) = JsFuture::from(
        nav.service_worker()
            .register_with_options("/tools/pictulane/sw.js", &options),
    )
    .await
    else {
        return;
    };
    let Ok(registration) = value.dyn_into::<ServiceWorkerRegistration>() else {
        return;
    };
    if registration.waiting().is_some() {
        callback.emit(registration.clone());
    }
    let reg = registration.clone();
    let on_update = Closure::<dyn FnMut()>::new(move || {
        if let Some(worker) = reg.installing() {
            let worker_state = worker.clone();
            let reg_state = reg.clone();
            let callback = callback.clone();
            let handler = Closure::<dyn FnMut()>::new(move || {
                if worker_state.state() == ServiceWorkerState::Installed
                    && web_sys::window()
                        .unwrap()
                        .navigator()
                        .service_worker()
                        .controller()
                        .is_some()
                {
                    callback.emit(reg_state.clone());
                }
            });
            worker.set_onstatechange(Some(handler.as_ref().unchecked_ref()));
            handler.forget();
        }
    });
    registration.set_onupdatefound(Some(on_update.as_ref().unchecked_ref()));
    on_update.forget();
}
