mod app;
mod cards;
pub mod icons;
pub mod locale;
mod metadata;
mod preload;
mod scene_editor;

use crate::browser;
use wasm_bindgen::{JsCast, JsValue};

pub fn start() {
    crate::platform::privacy::initialize_saved_analytics();
    let code = locale::initial_locale();
    wasm_bindgen_futures::spawn_local(async move {
        match locale::prepare_initial(&code).await {
            Ok(language) => {
                if let Ok(Some(retry)) = browser::document().query_selector("#atlas-start-retry") {
                    retry.remove();
                }
                if let Some(root) = browser::document().get_element_by_id("root") {
                    yew::Renderer::<app::App>::with_root_and_props(
                        root,
                        app::Props {
                            initial_language: language,
                        },
                    )
                    .render();
                }
            }
            Err(_) => {
                if browser::document()
                    .get_element_by_id("atlas-start-retry")
                    .is_some()
                {
                    return;
                }
                let add = || -> Result<(), JsValue> {
                    let doc = browser::document();
                    let aside = doc.create_element("aside")?;
                    aside.set_id("atlas-start-retry");
                    aside.set_class_name("seo-static");
                    aside.set_attribute("role", "status")?;
                    aside.set_attribute("lang", "en")?;
                    let message = doc.create_element("p")?;
                    message.set_text_content(Some("The language could not be loaded. Try again."));
                    let button = doc.create_element("button")?;
                    button.set_class_name("viewer-link");
                    button.set_text_content(Some("Retry translations"));
                    button.set_attribute("type", "button")?;
                    let action = wasm_bindgen::closure::Closure::<dyn FnMut()>::new(|| {
                        if let Some(retry) =
                            browser::document().get_element_by_id("atlas-start-retry")
                        {
                            retry.remove();
                        }
                        start();
                    });
                    button.add_event_listener_with_callback(
                        "click",
                        action.as_ref().unchecked_ref(),
                    )?;
                    action.forget();
                    aside.append_child(&message)?;
                    aside.append_child(&button)?;
                    if let Some(root) = doc.get_element_by_id("root")
                        && let Some(parent) = root.parent_node()
                    {
                        parent.insert_before(&aside, root.next_sibling().as_ref())?;
                    }
                    Ok(())
                };
                let _ = add();
            }
        }
    });
}
