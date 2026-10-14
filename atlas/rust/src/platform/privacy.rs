use super::telemetry;
use crate::{
    browser::{self, call, get, set},
    core::locales,
    ui::locale::use_language,
};
use gloo_events::EventListener;
use serde_json::{Value, json};
use std::{
    cell::{Cell, RefCell},
    rc::Rc,
};
use wasm_bindgen::JsValue;
use wasm_bindgen_futures::{JsFuture, future_to_promise};
use yew::prelude::*;
const MEASUREMENT_ID: &str = "G-4GYW68LVTM";
const STORAGE_KEY: &str = "atlas-privacy-v1";
#[derive(Default)]
struct Analytics {
    permitted: bool,
    initialized: bool,
    loading: Option<js_sys::Promise>,
    cancel: Option<Rc<dyn Fn()>>,
    load_id: u64,
}
thread_local! {static ANALYTICS:RefCell<Analytics>=RefCell::new(Analytics::default());static NAVIGATION_CONSENT:Cell<Option<bool>>=const{Cell::new(None)};}
#[wasm_bindgen::prelude::wasm_bindgen(module = "/src/platform/web-vitals-bridge.js")]
unsafe extern "C" {
    #[wasm_bindgen::prelude::wasm_bindgen(js_name=analyticsArguments)]
    fn analytics_arguments(values: &js_sys::Array) -> JsValue;
}
fn safe_page() -> Value {
    json!({"page_location":"https://rrih.github.io/atlas/","page_title":"Pokémon Atlas","page_referrer":""})
}
fn read_choice() -> Option<bool> {
    let value: Value = serde_json::from_str(&browser::stored(STORAGE_KEY)?).ok()?;
    if value["version"].as_f64() != Some(1.0)
        || !js_sys::Date::parse(value["updatedAt"].as_str()?).is_finite()
    {
        return None;
    }
    value["analytics"].as_bool()
}
fn save_choice(analytics: bool) -> bool {
    let saved=browser::store(STORAGE_KEY,&json!({"version":1,"analytics":analytics,"updatedAt":js_sys::Date::new_0().to_iso_string().as_string().unwrap_or_default()}).to_string());
    if !saved && !analytics {
        browser::remove(STORAGE_KEY)
    }
    saved
}
fn command(args: &[JsValue]) {
    if args.is_empty() || !ANALYTICS.with(|a| a.borrow().permitted) {
        return;
    }
    let target = browser::window();
    let mut queue = get(target.as_ref(), "dataLayer");
    if queue.is_null() || queue.is_undefined() {
        queue = js_sys::Array::new().into();
        let _ = set(target.as_ref(), "dataLayer", &queue);
    }
    let values = js_sys::Array::new();
    for argument in args {
        values.push(argument);
    }
    let _ = call(&queue, "push", &[analytics_arguments(&values)]);
}
fn clear_cookies() {
    let document = browser::document();
    let cookies = get(document.as_ref(), "cookie")
        .as_string()
        .unwrap_or_default();
    let host = browser::window().location().hostname().unwrap_or_default();
    for entry in cookies.split(';') {
        let name = entry.trim().split('=').next().unwrap_or_default();
        if !["_ga", "_ga_4GYW68LVTM"].contains(&name) {
            continue;
        }
        for domain in [String::new(), host.clone(), format!(".{host}")] {
            let suffix = if domain.is_empty() {
                String::new()
            } else {
                format!("; Domain={domain}")
            };
            let _ = set(
                document.as_ref(),
                "cookie",
                &format!("{name}=; Max-Age=0; Path=/; SameSite=Lax{suffix}").into(),
            );
        }
    }
}
fn stop_analytics() {
    telemetry::set_telemetry_enabled(false, None, false);
    let cancel = ANALYTICS.with(|a| {
        let mut a = a.borrow_mut();
        a.permitted = false;
        if a.loading.is_some() {
            a.load_id += 1;
            a.loading = None;
        }
        a.cancel.take()
    });
    let _ = set(
        browser::window().as_ref(),
        "ga-disable-G-4GYW68LVTM",
        &true.into(),
    );
    if let Some(cancel) = cancel {
        cancel();
    }
    clear_cookies();
}
fn start_analytics() -> js_sys::Promise {
    if browser::window().location().hostname().unwrap_or_default() != "rrih.github.io" {
        return js_sys::Promise::resolve(&JsValue::FALSE);
    }
    let existing = ANALYTICS.with(|a| {
        let mut a = a.borrow_mut();
        a.permitted = true;
        if a.initialized {
            Some(js_sys::Promise::resolve(&JsValue::TRUE))
        } else {
            a.loading.clone()
        }
    });
    let _ = set(
        browser::window().as_ref(),
        "ga-disable-G-4GYW68LVTM",
        &false.into(),
    );
    if let Some(existing) = existing {
        return existing;
    }
    command(&[
        "consent".into(),
        "default".into(),
        browser::json(&json!({"analytics_storage":"granted"})),
    ]);
    let mut settings = safe_page();
    settings["ads_data_redaction"] = true.into();
    settings["url_passthrough"] = false.into();
    command(&["set".into(), browser::json(&settings)]);
    command(&["js".into(), js_sys::Date::new_0().into()]);
    let mut config = safe_page();
    for (key, value) in [
        ("send_page_view", false.into()),
        ("allow_google_signals", false.into()),
        ("allow_ad_personalization_signals", false.into()),
        (
            "cookie_domain",
            browser::window()
                .location()
                .hostname()
                .unwrap_or_default()
                .into(),
        ),
        ("cookie_path", "/".into()),
        ("cookie_flags", "SameSite=Lax;Secure".into()),
    ] {
        config[key] = value;
    }
    command(&[
        "config".into(),
        MEASUREMENT_ID.into(),
        browser::json(&config),
    ]);
    let id = ANALYTICS.with(|a| {
        let mut a = a.borrow_mut();
        a.load_id += 1;
        a.load_id
    });
    let promise = future_to_promise(async move {
        if !ANALYTICS.with(|a| {
            let a = a.borrow();
            a.permitted && a.load_id == id
        }) {
            return Ok(false.into());
        }
        let script = browser::document().create_element("script")?;
        script.set_id("atlas-analytics");
        let _ = script.set_attribute("async", "");
        let _ = script.set_attribute("referrerpolicy", "no-referrer");
        let _ = script.set_attribute(
            "src",
            &format!("https://www.googletagmanager.com/gtag/js?id={MEASUREMENT_ID}"),
        );
        let mut listeners = Vec::new();
        let pending = js_sys::Promise::new(&mut |resolve, _reject| {
            let loaded = resolve.clone();
            listeners.push(EventListener::new(&script, "load", move |_| {
                let _ = loaded.call1(&JsValue::NULL, &true.into());
            }));
            let failed = resolve.clone();
            listeners.push(EventListener::new(&script, "error", move |_| {
                let _ = failed.call1(&JsValue::NULL, &false.into());
            }));
            let script = script.clone();
            let cancel: Rc<dyn Fn()> = Rc::new(move || {
                script.remove();
                let _ = set(
                    browser::window().as_ref(),
                    "dataLayer",
                    &js_sys::Array::new(),
                );
                ANALYTICS.with(|a| {
                    let mut a = a.borrow_mut();
                    if a.load_id == id {
                        a.loading = None;
                    }
                });
                let _ = resolve.call1(&JsValue::NULL, &false.into());
            });
            ANALYTICS.with(|a| a.borrow_mut().cancel = Some(cancel));
        });
        if let Some(head) = browser::document().head() {
            head.append_child(&script)?;
        }
        let success = JsFuture::from(pending)
            .await
            .ok()
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        drop(listeners);
        let (ready, current) = ANALYTICS.with(|a| {
            let mut a = a.borrow_mut();
            if a.load_id != id {
                return (false, false);
            }
            a.cancel = None;
            a.loading = None;
            a.initialized = success && a.permitted;
            (a.initialized, true)
        });
        if !success {
            script.remove();
        }
        if !success && current {
            let _ = set(
                browser::window().as_ref(),
                "dataLayer",
                &js_sys::Array::new(),
            );
        }
        Ok(ready.into())
    });
    ANALYTICS.with(|a| a.borrow_mut().loading = Some(promise.clone()));
    promise
}
fn enable_telemetry() {
    if !ANALYTICS.with(|a| a.borrow().permitted) {
        return;
    }
    let from_navigation = NAVIGATION_CONSENT.with(|v| v.get().unwrap_or(false));
    telemetry::set_telemetry_enabled(
        true,
        Some(Rc::new(|name, parameters| {
            let mut payload = parameters;
            for (key, value) in safe_page().as_object().unwrap() {
                payload[key] = value.clone();
            }
            payload["send_to"] = MEASUREMENT_ID.into();
            command(&["event".into(), name.into(), browser::json(&payload)]);
        })),
        from_navigation,
    );
}
/// Call before locale/model loading so metrics cannot span an unconsented interval.
pub fn initialize_saved_analytics() {
    let accepted = read_choice() == Some(true);
    NAVIGATION_CONSENT.with(|v| {
        if v.get().is_none() {
            v.set(Some(accepted));
        }
    });
    if accepted {
        let _ = start_analytics();
        enable_telemetry();
    }
}
#[derive(Properties, PartialEq)]
pub struct PrivacyProps {
    pub page_id: u16,
    #[prop_or_default]
    pub form_id: String,
    pub locale: String,
}
#[function_component(Privacy)]
pub fn privacy(props: &PrivacyProps) -> Html {
    let language = use_language();
    let choice = use_state(read_choice);
    let expanded = use_state(|| {
        read_choice().is_none() || browser::query().get("privacy").as_deref() == Some("1")
    });
    let saved = use_state(|| true);
    let last_view = use_mut_ref(String::new);
    {
        let choice = choice.clone();
        let expanded = expanded.clone();
        let saved = saved.clone();
        use_effect_with((), move |_| {
            let listener = EventListener::new(&browser::window(), "storage", move |event| {
                let key = get(event.as_ref(), "key");
                if !key.is_null() && key.as_string().as_deref() != Some(STORAGE_KEY) {
                    return;
                }
                let next = read_choice();
                if next != Some(true) {
                    stop_analytics()
                }
                choice.set(next);
                saved.set(true);
                if next.is_none() {
                    expanded.set(true);
                }
            });
            move || {
                drop(listener);
                stop_analytics();
            }
        });
    }
    {
        let last_view = last_view.clone();
        use_effect_with(
            (
                *choice,
                props.page_id,
                props.form_id.clone(),
                props.locale.clone(),
            ),
            move |(choice, page_id, form_id, locale)| {
                let current = Rc::new(Cell::new(true));
                if *choice != Some(true) {
                    stop_analytics();
                    last_view.borrow_mut().clear();
                } else {
                    let identity = json!([page_id, form_id, locale]).to_string();
                    let locale = locale.clone();
                    let ready = start_analytics();
                    enable_telemetry();
                    let active = current.clone();
                    wasm_bindgen_futures::spawn_local(async move {
                        let ready = JsFuture::from(ready)
                            .await
                            .ok()
                            .and_then(|v| v.as_bool())
                            .unwrap_or(false);
                        if !ready
                            || !active.get()
                            || !ANALYTICS.with(|a| a.borrow().permitted)
                            || *last_view.borrow() == identity
                        {
                            return;
                        }
                        *last_view.borrow_mut() = identity;
                        let mut payload = safe_page();
                        payload["send_to"] = MEASUREMENT_ID.into();
                        payload["language"] =
                            if locales::LOCALES.iter().any(|entry| entry.0 == locale) {
                                locale
                            } else {
                                "en".into()
                            }
                            .into();
                        command(&["event".into(), "page_view".into(), browser::json(&payload)]);
                    });
                }
                move || current.set(false)
            },
        );
    }
    let choose = {
        let choice = choice.clone();
        let expanded = expanded.clone();
        let saved = saved.clone();
        Callback::from(move |analytics: bool| {
            if !analytics {
                stop_analytics()
            }
            let stored = save_choice(analytics);
            saved.set(stored);
            choice.set(Some(analytics));
            expanded.set(!stored);
        })
    };
    let accept = {
        let choose = choose.clone();
        Callback::from(move |_| choose.emit(true))
    };
    let decline = {
        let choose = choose.clone();
        Callback::from(move |_| choose.emit(false))
    };
    let toggle = {
        let expanded = expanded.clone();
        Callback::from(move |event: Event| {
            let target = event.target().unwrap();
            expanded.set(get(target.as_ref(), "open").as_bool().unwrap_or(false));
        })
    };
    html! {
        <details class="privacy-settings" open={*expanded} ontoggle={toggle}>
            <summary>{language.t("Privacy settings")}</summary>
            <section class="privacy-panel" aria-label={language.t("Optional analytics")}>
                <h2>{language.t("Optional analytics")}</h2>
                <p>{language.t("Analytics is off until you agree. Your images and saved scenes are never sent.")}</p>
                <p role="status">{language.t(if *choice==Some(true){"Analytics is on."}else{"Analytics is off."})}</p>
                <div class="privacy-actions">
                    {if *choice==Some(true) {
                        html! {<button type="button" onclick={decline.clone()}>{language.t("Stop analytics")}</button>}
                    } else {
                        html! {<>
                            <button type="button" onclick={accept}>{language.t("Accept analytics")}</button>
                            <button type="button" onclick={decline}>{language.t("Decline")}</button>
                        </>}
                    }}
                    <a href={format!("/atlas/legal/{}/privacy.html",if props.locale=="ja"{"ja"}else{"en"})}>{language.t("Privacy policy")}</a>
                </div>
            </section>
            {if !*saved {
                html! {<p role="status">{language.t("Your choice could not be saved. It will apply for this visit.")}</p>}
            } else {Html::default()}}
        </details>
    }
}
