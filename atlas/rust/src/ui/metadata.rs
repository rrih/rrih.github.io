use crate::{browser, core::seo::PageSeo};
use wasm_bindgen::JsValue;
fn element(
    selector: &str,
    tag: &str,
    attributes: &[(&str, &str)],
) -> Result<web_sys::Element, JsValue> {
    let document = browser::document();
    if let Some(element) = document.query_selector(selector)? {
        return Ok(element);
    }
    let element = document.create_element(tag)?;
    for (name, value) in attributes {
        element.set_attribute(name, value)?;
    }
    document
        .query_selector("head")?
        .ok_or_else(|| JsValue::from_str("Missing head"))?
        .append_child(&element)?;
    Ok(element)
}
pub fn apply(seo: &PageSeo) -> Result<(), JsValue> {
    browser::document().set_title(&seo.title);
    for (name, value, property) in [
        ("description", &seo.description, false),
        ("og:title", &seo.title, true),
        ("og:description", &seo.description, true),
        ("og:url", &seo.canonical, true),
        ("og:locale", &seo.og_locale, true),
        ("og:image", &seo.image, true),
        ("og:image:alt", &seo.image_alt, true),
    ] {
        let attribute = if property { "property" } else { "name" };
        element(
            &format!("meta[{attribute}=\"{name}\"]"),
            "meta",
            &[(attribute, name)],
        )?
        .set_attribute("content", value)?;
    }
    element("link[rel=canonical]", "link", &[("rel", "canonical")])?
        .set_attribute("href", &seo.canonical)?;
    let previous = browser::document().query_selector_all("head link[hreflang]")?;
    for i in 0..previous.length() {
        if let Some(node) = previous.item(i)
            && let Some(parent) = node.parent_node()
        {
            parent.remove_child(&node)?;
        }
    }
    let head = browser::document()
        .query_selector("head")?
        .ok_or_else(|| JsValue::from_str("Missing head"))?;
    for alternate in &seo.alternates {
        let link = browser::document().create_element("link")?;
        for (key, value) in [
            ("rel", "alternate"),
            ("hreflang", alternate.lang.as_str()),
            ("href", alternate.href.as_str()),
        ] {
            link.set_attribute(key, value)?;
        }
        head.append_child(&link)?;
    }
    element(
        "script[type='application/ld+json']",
        "script",
        &[("type", "application/ld+json")],
    )?
    .set_text_content(Some(&seo.json_ld.to_string()));
    Ok(())
}
