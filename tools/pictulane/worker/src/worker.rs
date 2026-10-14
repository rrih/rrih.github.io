use crate::{IMAGE_CACHE, META_CACHE, expired, image_limit, valid_media_path};
use futures::lock::Mutex;
use serde_json::{Value, json};
use std::{cell::RefCell, rc::Rc};
use wasm_bindgen::{JsCast, JsValue, prelude::wasm_bindgen};
use wasm_bindgen_futures::JsFuture;
const BASE: &str = "/tools/pictulane/";
const ACTIVATION_KEY: &str = "/tools/pictulane/__shell_activation";
#[derive(Default)]
struct Config {
    shell: String,
    assets: Vec<String>,
}
thread_local! {static CONFIG:RefCell<Config>=RefCell::new(Config::default());static QUEUE:Rc<Mutex<()>>=Rc::new(Mutex::new(()));}
fn global() -> JsValue {
    js_sys::global().into()
}
fn get(object: &JsValue, key: &str) -> JsValue {
    js_sys::Reflect::get(object, &key.into()).unwrap_or(JsValue::UNDEFINED)
}
fn call(object: &JsValue, key: &str, args: &[JsValue]) -> Result<JsValue, JsValue> {
    let function = get(object, key).dyn_into::<js_sys::Function>()?;
    let array = js_sys::Array::new();
    for arg in args {
        array.push(arg);
    }
    function.apply(object, &array)
}
async fn promise(value: JsValue) -> Result<JsValue, JsValue> {
    JsFuture::from(js_sys::Promise::resolve(&value)).await
}
async fn invoke(object: &JsValue, key: &str, args: &[JsValue]) -> Result<JsValue, JsValue> {
    promise(call(object, key, args)?).await
}
fn from_js(value: &JsValue) -> Option<Value> {
    serde_json::from_str(&js_sys::JSON::stringify(value).ok()?.as_string()?).ok()
}
fn to_js(value: &Value) -> JsValue {
    js_sys::JSON::parse(&value.to_string()).unwrap_or(JsValue::NULL)
}
fn missing(value: &JsValue) -> bool {
    value.is_null() || value.is_undefined()
}
fn origin() -> String {
    get(&get(&global(), "location"), "origin")
        .as_string()
        .unwrap_or_default()
}
fn config_url() -> String {
    format!("{}{BASE}__cache_settings", origin())
}
fn allowed(raw: &str) -> bool {
    web_sys::Url::new(raw).is_ok_and(|u| {
        u.protocol() == "https:"
            && u.hostname() == "pbs.twimg.com"
            && u.username().is_empty()
            && u.password().is_empty()
            && u.port().is_empty()
            && valid_media_path(&u.pathname())
    })
}
async fn open_cache(name: &str) -> Result<JsValue, JsValue> {
    invoke(&get(&global(), "caches"), "open", &[name.into()]).await
}
async fn stores() -> Result<(JsValue, JsValue), JsValue> {
    Ok((
        open_cache(IMAGE_CACHE).await?,
        open_cache(META_CACHE).await?,
    ))
}
async fn matching(cache: &JsValue, key: &JsValue) -> Result<JsValue, JsValue> {
    invoke(cache, "match", std::slice::from_ref(key)).await
}
async fn keys(cache: &JsValue) -> Result<Vec<JsValue>, JsValue> {
    Ok(js_sys::Array::from(&invoke(cache, "keys", &[]).await?)
        .iter()
        .collect())
}
async fn delete(cache: &JsValue, key: &JsValue) -> Result<(), JsValue> {
    invoke(cache, "delete", std::slice::from_ref(key)).await?;
    Ok(())
}
async fn response_json(response: &JsValue) -> Result<Value, JsValue> {
    from_js(&invoke(response, "json", &[]).await?)
        .ok_or_else(|| JsValue::from_str("Invalid cache metadata"))
}
async fn put_json(cache: &JsValue, key: &JsValue, value: Value) -> Result<(), JsValue> {
    let response = web_sys::Response::new_with_opt_str(Some(&value.to_string()))?;
    invoke(cache, "put", &[key.clone(), response.into()]).await?;
    Ok(())
}
async fn enabled(meta: &JsValue) -> Result<bool, JsValue> {
    let config = matching(meta, &config_url().into()).await?;
    if missing(&config) {
        return Ok(true);
    }
    let data = response_json(&config).await?;
    if data.is_null() {
        return Err(JsValue::from_str("Invalid cache settings"));
    }
    Ok(data["enabled"] != false)
}
async fn prune(images: &JsValue, meta: &JsValue) -> Result<(), JsValue> {
    let now = js_sys::Date::now();
    let mut entries = Vec::new();
    for request in keys(images).await? {
        let record = matching(meta, &request).await?;
        let metadata = if missing(&record) {
            None
        } else {
            response_json(&record).await.ok()
        };
        let saved = metadata.as_ref().and_then(|m| m["saved"].as_f64());
        if expired(saved, now) {
            delete(images, &request).await?;
            delete(meta, &request).await?;
        } else if let Some(metadata) = metadata {
            entries.push((request, metadata));
        }
    }
    for opaque in [false, true] {
        let mut group: Vec<_> = entries
            .iter()
            .filter(|(_, metadata)| metadata["opaque"].as_bool() == Some(opaque))
            .collect();
        group.sort_by(|(_, a), (_, b)| {
            b["used"]
                .as_f64()
                .unwrap_or(f64::NAN)
                .partial_cmp(&a["used"].as_f64().unwrap_or(f64::NAN))
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        for (request, _) in group.into_iter().skip(image_limit(opaque)) {
            delete(images, request).await?;
            delete(meta, request).await?;
        }
    }
    for request in keys(meta).await? {
        if get(&request, "url").as_string().as_deref() != Some(&config_url())
            && missing(&matching(images, &request).await?)
        {
            delete(meta, &request).await?;
        }
    }
    Ok(())
}
#[wasm_bindgen]
pub fn initialize(shell: String, assets: js_sys::Array) {
    CONFIG.with(|c| {
        *c.borrow_mut() = Config {
            shell,
            assets: assets.iter().filter_map(|v| v.as_string()).collect(),
        }
    });
}
#[wasm_bindgen]
pub async fn on_install() -> Result<(), JsValue> {
    let (shell, assets) = CONFIG.with(|c| {
        let c = c.borrow();
        (c.shell.clone(), c.assets.clone())
    });
    let cache_storage = get(&global(), "caches");
    let existed = invoke(&cache_storage, "has", &[shell.clone().into()])
        .await?
        .as_bool()
        .unwrap_or(false);
    let cache = open_cache(&shell).await?;
    let list = js_sys::Array::new();
    for asset in assets {
        // Refresh the complete shell, including resources whose public URLs stay stable.
        let options = web_sys::RequestInit::new();
        options.set_cache(web_sys::RequestCache::Reload);
        list.push(&web_sys::Request::new_with_str_and_init(&asset, &options)?.into());
    }
    if let Err(error) = invoke(&cache, "addAll", &[list.into()]).await {
        // A comment-only SW update may reuse an active shell. addAll is atomic;
        // preserve that existing cache when its reinstall encounters a failure.
        if !existed {
            let _ = delete(&cache_storage, &shell.into()).await;
        }
        return Err(error);
    }
    if missing(&matching(&cache, &ACTIVATION_KEY.into()).await?) {
        put_json(&cache, &ACTIVATION_KEY.into(), json!({"active":false})).await?;
    }
    Ok(())
}
#[wasm_bindgen]
pub async fn on_activate() -> Result<(), JsValue> {
    let shell = CONFIG.with(|c| c.borrow().shell.clone());
    let cache_storage = get(&global(), "caches");
    let old: Vec<_> = keys(&cache_storage)
        .await?
        .into_iter()
        .filter_map(|v| v.as_string())
        .filter(|name| name.starts_with("pictulane-shell-") && name != &shell)
        .collect();
    let mut active = None;
    let mut order = 0;
    let mut legacy = Vec::new();
    for name in &old {
        let cache = open_cache(name).await?;
        if missing(&matching(&cache, &BASE.into()).await?) {
            continue;
        }
        let marker = matching(&cache, &ACTIVATION_KEY.into()).await?;
        if missing(&marker) {
            // Pre-migration workers did not record activation. Conservatively
            // retain their complete shells until a marked predecessor exists.
            legacy.push(name);
        } else {
            let marker = response_json(&marker).await?;
            if marker["active"] == true {
                let previous_order = marker["order"].as_u64().unwrap_or(0);
                if active.is_none() || previous_order >= order {
                    active = Some(name);
                    order = previous_order;
                }
            }
        }
    }
    let current = open_cache(&shell).await?;
    let marker = matching(&current, &ACTIVATION_KEY.into()).await?;
    if !missing(&marker) {
        order = order.max(response_json(&marker).await?["order"].as_u64().unwrap_or(0));
    }
    put_json(
        &current,
        &ACTIVATION_KEY.into(),
        json!({"active":true,"order":order.saturating_add(1)}),
    )
    .await?;
    for name in &old {
        let retained = active.map_or_else(|| legacy.contains(&name), |active| name == active);
        if !retained {
            delete(&cache_storage, &name.clone().into()).await?;
        }
    }
    invoke(&get(&global(), "clients"), "claim", &[]).await?;
    Ok(())
}
#[wasm_bindgen]
pub async fn on_message(event: JsValue) -> Result<(), JsValue> {
    let client = get(&event, "source");
    let Some(raw) = get(&client, "url").as_string() else {
        return Ok(());
    };
    let Ok(url) = web_sys::Url::new(&raw) else {
        return Ok(());
    };
    if url.origin() != origin() || !url.pathname().starts_with(BASE) {
        return Ok(());
    }
    let data = get(&event, "data");
    let kind = get(&data, "type").as_string().unwrap_or_default();
    if kind == "activate" {
        invoke(&global(), "skipWaiting", &[]).await?;
        return Ok(());
    }
    let result = async {
        let queue = QUEUE.with(Clone::clone);
        let _guard = queue.lock().await;
        let (images, meta) = stores().await?;
        if kind == "configure"
            && let Some(value) = get(&data, "enabled").as_bool()
        {
            put_json(&meta, &config_url().into(), json!({"enabled":value})).await?;
        }
        if kind == "clear" {
            for request in keys(&images).await? {
                delete(&images, &request).await?;
                delete(&meta, &request).await?;
            }
        }
        if kind == "invalidate"
            && let Some(raw) = get(&data, "url").as_string().filter(|s| allowed(s))
        {
            let key = raw.into();
            delete(&images, &key).await?;
            delete(&meta, &key).await?;
        }
        prune(&images, &meta).await?;
        Ok::<_, JsValue>(
            json!({"count":keys(&images).await?.len(),"enabled":enabled(&meta).await?}),
        )
    }
    .await;
    let port = get(&get(&event, "ports"), "0");
    if !missing(&port) {
        let _ = call(
            &port,
            "postMessage",
            &[to_js(
                &result.unwrap_or_else(|_| json!({"error":"storage"})),
            )],
        );
    }
    Ok(())
}
async fn fetch(request: &web_sys::Request) -> Result<web_sys::Response, JsValue> {
    invoke(&global(), "fetch", &[JsValue::from(request)])
        .await?
        .dyn_into()
}
async fn runtime(request: &web_sys::Request) -> Result<web_sys::Response, JsValue> {
    let hit = async {
        let queue = QUEUE.with(Clone::clone);
        let _guard = queue.lock().await;
        let (images, meta) = stores().await?;
        if !enabled(&meta).await? {
            return Ok(JsValue::UNDEFINED);
        }
        prune(&images, &meta).await?;
        let hit = matching(&images, request.as_ref()).await?;
        if !missing(&hit) {
            let mut metadata = response_json(&matching(&meta, request.as_ref()).await?).await?;
            metadata["used"] = js_sys::Date::now().into();
            put_json(&meta, request.as_ref(), metadata).await?;
        }
        Ok::<_, JsValue>(hit)
    }
    .await;
    if let Ok(hit) = hit
        && !missing(&hit)
    {
        return hit.dyn_into();
    }
    let response = fetch(request).await?;
    let opaque = get(response.as_ref(), "type").as_string().as_deref() == Some("opaque");
    let image = response.ok()
        && response
            .headers()
            .get("content-type")?
            .is_some_and(|v| v.starts_with("image/"));
    if opaque || image {
        if !opaque
            && response
                .headers()
                .get("cache-control")?
                .is_some_and(|v| v.to_lowercase().contains("no-store"))
        {
            return Ok(response);
        }
        let _: Result<(), JsValue> = async {
            let queue = QUEUE.with(Clone::clone);
            let _guard = queue.lock().await;
            let (images, meta) = stores().await?;
            if !enabled(&meta).await? {
                return Ok(());
            }
            let copy = call(response.as_ref(), "clone", &[])?;
            invoke(&images, "put", &[JsValue::from(request), copy]).await?;
            put_json(
                &meta,
                request.as_ref(),
                json!({"saved":js_sys::Date::now(),"used":js_sys::Date::now(),"opaque":opaque}),
            )
            .await?;
            prune(&images, &meta).await
        }
        .await;
    }
    Ok(response)
}
#[wasm_bindgen]
pub async fn on_fetch(
    request: web_sys::Request,
    client_id: String,
) -> Result<web_sys::Response, JsValue> {
    let url = web_sys::Url::new(&request.url())?;
    let (shell, asset) = CONFIG.with(|c| {
        let c = c.borrow();
        (c.shell.clone(), c.assets.contains(&url.pathname()))
    });
    let shell_key = if url.origin() == origin() && asset {
        Some(url.pathname())
    } else if get(request.as_ref(), "mode").as_string().as_deref() == Some("navigate")
        && url.origin() == origin()
        && [BASE, &format!("{BASE}index.html")].contains(&url.pathname().as_str())
    {
        Some(BASE.into())
    } else {
        None
    };
    if let Some(key) = shell_key {
        let hit = async { matching(&open_cache(&shell).await?, &key.into()).await }.await;
        if let Ok(hit) = hit
            && !missing(&hit)
        {
            return hit.dyn_into();
        }
        return fetch(&request).await;
    }
    // A different tab can activate an update after this page has loaded its JS
    // but before it requests WASM. Keep that immutable pair in the retained shell.
    if url.origin() == origin()
        && crate::versioned_runtime_path(&url.pathname())
        && let Ok(previous) = keys(&get(&global(), "caches")).await
    {
        for name in previous.into_iter().filter_map(|name| name.as_string()) {
            if name.starts_with("pictulane-shell-")
                && name != shell
                && let Ok(cache) = open_cache(&name).await
                && let Ok(hit) = matching(&cache, &url.pathname().into()).await
                && !missing(&hit)
            {
                return hit.dyn_into();
            }
        }
    }
    if get(request.as_ref(), "destination").as_string().as_deref() == Some("image")
        && allowed(&request.url())
    {
        let client = invoke(&get(&global(), "clients"), "get", &[client_id.into()]).await?;
        if get(&client, "url")
            .as_string()
            .and_then(|s| web_sys::Url::new(&s).ok())
            .is_some_and(|u| u.pathname().starts_with(BASE))
        {
            return runtime(&request).await;
        }
    }
    fetch(&request).await
}
