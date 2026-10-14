//! Browser fixtures are compiled only for the renderer-qa feature.
use super::*;

/// Case-only oracle. The old Rust implementation intentionally remains in this QA
/// module so Unicode-table/version differences cannot disappear from the report.
#[wasm_bindgen]
pub fn qa_unicode_case_batch(input: &str) -> Result<String, JsValue> {
    let values: Vec<String> =
        serde_json::from_str(input).map_err(|error| JsValue::from_str(&error.to_string()))?;
    let rows: Vec<[String; 6]> = values
        .iter()
        .map(|value| {
            let mut chars = value.chars();
            let first = chars.next();
            let candidate_first = first
                .map(|c| {
                    format!(
                        "{}{}",
                        crate::core::case::upper(&c.to_string()),
                        chars.as_str()
                    )
                })
                .unwrap_or_default();
            let original_first = first
                .map(|c| format!("{}{}", c.to_uppercase(), chars.as_str()))
                .unwrap_or_default();
            [
                crate::core::case::lower(value),
                crate::core::case::upper(value),
                value.to_lowercase(),
                value.to_uppercase(),
                candidate_first,
                original_first,
            ]
        })
        .collect();
    serde_json::to_string(&rows).map_err(|error| JsValue::from_str(&error.to_string()))
}

/// Exercises the browser search implementation without shipping a test ABI.
#[wasm_bindgen]
pub fn qa_normalize_search(value: &str) -> String {
    crate::core::locales::normalize_search(value)
}

/// Return raw floating-point arrays so the oracle also detects signed-zero drift.
#[wasm_bindgen]
pub fn qa_measure_motion(scene: JsValue, mixer: JsValue, clips: JsValue) -> JsValue {
    let (bounds, points) = models::measure_motion(&J(scene), &J(mixer), &J(clips).list());
    let bounds = [
        bounds.min[0],
        bounds.min[1],
        bounds.min[2],
        bounds.max[0],
        bounds.max[1],
        bounds.max[2],
    ];
    object(&[
        (
            "bounds",
            J(js_sys::Float64Array::from(bounds.as_slice()).into()),
        ),
        (
            "points",
            J(js_sys::Float64Array::from(points.as_slice()).into()),
        ),
    ])
    .0
}

#[wasm_bindgen]
pub fn qa_normalized_points(points: &[f64], normalization: JsValue) -> Vec<f64> {
    models::normalized_points(points, &J(normalization))
}

thread_local! {
    static APP: RefCell<Option<yew::AppHandle<Viewer>>> = const { RefCell::new(None) };
    static PROPS: RefCell<Option<ViewerProps>> = const { RefCell::new(None) };
    static HANDLE: Rc<RefCell<Option<ViewerHandle>>> = Rc::new(RefCell::new(None));
}
fn marker(key: &str, value: &str) {
    let _ = web_sys::window()
        .unwrap()
        .document()
        .unwrap()
        .body()
        .unwrap()
        .set_attribute(key, value);
}
#[wasm_bindgen]
pub fn renderer_qa_mount(
    id: u16,
    form: Option<String>,
    settings_json: &str,
    members_json: Option<String>,
) -> Result<(), JsValue> {
    let settings: ViewerSettings =
        serde_json::from_str(settings_json).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let members: Option<Vec<SceneMember>> = members_json
        .map(|s| serde_json::from_str(&s))
        .transpose()
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    let entries = if let Some(members) = &members {
        members
            .iter()
            .map(|m| {
                let model = crate::core::forms::model_for(m.species_id, m.form_id.as_deref());
                ModelRequest {
                    key: m.key.clone(),
                    species_id: m.species_id,
                    url: model.and_then(|model| {
                        if m.shiny {
                            model.shiny.clone()
                        } else {
                            Some(model.url.clone())
                        }
                    }),
                }
            })
            .collect()
    } else {
        let model = crate::core::forms::model_for(id, form.as_deref());
        vec![ModelRequest {
            key: "solo".into(),
            species_id: id,
            url: model.and_then(|m| {
                if settings.shiny {
                    m.shiny.clone()
                } else {
                    Some(m.url.clone())
                }
            }),
        }]
    };
    let props = ViewerProps {
        label: format!("Pokemon {id}"),
        slug: id.to_string(),
        entries,
        settings,
        members,
        background_url: None,
        on_load: Callback::from(|names: Vec<String>| {
            marker("data-animations", &serde_json::to_string(&names).unwrap())
        }),
        on_error: Callback::from(|message: String| marker("data-error", &message)),
        on_loading: Callback::from(|loading| {
            marker("data-loading", if loading { "true" } else { "false" })
        }),
        on_camera_change: Callback::from(|pose: CameraPose| {
            marker("data-camera", &serde_json::to_string(&pose).unwrap())
        }),
        on_background_error: Callback::from(|_| marker("data-background-error", "true")),
        handle: HANDLE.with(Clone::clone),
    };
    marker("data-key", form.as_deref().unwrap_or(&id.to_string()));
    marker(
        "data-model",
        props
            .entries
            .first()
            .and_then(|m| m.url.as_deref())
            .unwrap_or(""),
    );
    marker("data-error", "");
    PROPS.with(|p| *p.borrow_mut() = Some(props.clone()));
    APP.with(|app| {
        let mut stored = app.borrow_mut();
        if let Some(app) = stored.as_mut() {
            app.update(props.clone());
        } else {
            let root = web_sys::window()
                .unwrap()
                .document()
                .unwrap()
                .get_element_by_id("viewer-qa")
                .unwrap();
            *stored = Some(yew::Renderer::<Viewer>::with_root_and_props(root, props).render());
        }
    });
    Ok(())
}
#[wasm_bindgen]
pub fn renderer_qa_settings(json: &str) -> Result<(), JsValue> {
    let settings: ViewerSettings =
        serde_json::from_str(json).map_err(|e| JsValue::from_str(&e.to_string()))?;
    PROPS.with(|p| {
        let mut p = p.borrow_mut();
        if let Some(p) = p.as_mut() {
            p.settings = settings;
            APP.with(|app| {
                if let Some(app) = app.borrow_mut().as_mut() {
                    app.update(p.clone());
                }
            })
        }
    });
    Ok(())
}
#[wasm_bindgen]
pub fn renderer_qa_view(angle: &str) {
    HANDLE.with(|h| {
        if let Some(h) = h.borrow().as_ref() {
            h.view(angle)
        }
    })
}
#[wasm_bindgen]
pub fn renderer_qa_camera() -> String {
    HANDLE.with(|h| {
        serde_json::to_string(&h.borrow().as_ref().and_then(ViewerHandle::get_camera)).unwrap()
    })
}
#[wasm_bindgen]
pub async fn renderer_qa_capture() -> Result<(), JsValue> {
    let handle = HANDLE
        .with(|h| h.borrow().clone())
        .ok_or(JsValue::from_str("Not ready"))?;
    handle.capture().await
}
#[wasm_bindgen]
pub fn renderer_qa_dispose() {
    APP.with(|app| {
        if let Some(app) = app.borrow_mut().take() {
            app.destroy();
        }
    });
    PROPS.with(|p| p.borrow_mut().take());
}
