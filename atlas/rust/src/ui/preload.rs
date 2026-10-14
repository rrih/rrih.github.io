use crate::browser;
use serde::Deserialize;
use wasm_bindgen::{JsCast, JsValue};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct InitialModel {
    path: String,
    form_id: Option<String>,
    url: String,
    shiny: Option<String>,
}

/// Only called for initial startup, after the UI dictionary succeeds. Route data
/// is generated from the same inventory used by the viewer, without loading it.
pub(super) fn initial_model() -> Result<(), JsValue> {
    let document = browser::document();
    let Some(data) = document.get_element_by_id("atlas-initial-model") else {
        return Ok(());
    };
    let Some(hint) = data
        .text_content()
        .and_then(|text| serde_json::from_str::<InitialModel>(&text).ok())
    else {
        return Ok(());
    };
    let hash = browser::hash();
    if browser::window().location().pathname()? != hint.path
        || hash.get("view").as_deref() == Some("together")
        || hash.has("layout")
        || (hint.form_id.is_none() && hash.has("form"))
    {
        return Ok(());
    }
    let url = if hash.get("shiny").as_deref() == Some("1") {
        hint.shiny.as_deref().unwrap_or(&hint.url)
    } else {
        &hint.url
    };
    // Hints never authorize cross-origin requests or arbitrary asset fetches.
    if !url.starts_with("/atlas/models/") || !url.ends_with(".glb") {
        return Ok(());
    }
    let base = browser::window().location().href()?;
    let absolute = web_sys::Url::new_with_base(url, &base)?.href();
    let links = document.query_selector_all("link[rel='preload'][as='fetch']")?;
    for index in 0..links.length() {
        if let Some(link) = links
            .item(index)
            .and_then(|node| node.dyn_into::<web_sys::Element>().ok())
            && let Some(href) = link.get_attribute("href")
            && web_sys::Url::new_with_base(&href, &base)
                .is_ok_and(|existing| existing.href() == absolute)
        {
            return Ok(());
        }
    }
    let link = document.create_element("link")?;
    link.set_attribute("rel", "preload")?;
    link.set_attribute("as", "fetch")?;
    link.set_attribute("crossorigin", "anonymous")?;
    link.set_attribute("href", url)?;
    if let Some(head) = document.query_selector("head")? {
        head.append_child(&link)?;
    }
    Ok(())
}
