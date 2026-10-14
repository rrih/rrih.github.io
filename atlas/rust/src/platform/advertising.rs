//! One consent controller per document. It never treats a callback notification alone as permission.
use super::ad_slot::AdSlot;
use crate::{
    browser::{self, call, get, set},
    ui::locale::use_language,
};
use gloo_events::EventListener;
use gloo_timers::callback::Timeout;
use serde_json::Value;
use std::{cell::RefCell, collections::BTreeMap};
use wasm_bindgen::{JsValue, closure::Closure};
use yew::prelude::*;
pub const AD_CLIENT: &str = "ca-pub-6426570202991325";
pub const AD_SLOT: &str = "9649739784";
pub use crate::core::advertising::{
    is_advertising_page, permits_initial_us_advertising, permits_tcf_advertising,
};
#[derive(Clone, Default, PartialEq)]
pub struct AdvertisingState {
    pub enabled: bool,
    pub script_ready: bool,
    pub script_failed: bool,
    pub can_reopen_consent: bool,
    pub can_open_us_choices: bool,
}
#[derive(Default)]
struct Controller {
    snapshot: AdvertisingState,
    active: bool,
    started: bool,
    ready: bool,
    failed: bool,
    tcf_allowed: bool,
    gdpr: Option<bool>,
    us_status: i32,
    gpp_ready: bool,
    initial_gpp: Option<String>,
    us_changed: bool,
    tcf_subscribed: bool,
    gpp_subscribed: bool,
    listeners: BTreeMap<u32, Callback<AdvertisingState>>,
    next_listener: u32,
    callbacks: Vec<JsValue>,
    events: Vec<EventListener>,
    timers: Vec<Timeout>,
}
thread_local! {static CONTROLLER:RefCell<Controller>=RefCell::new(Controller::default());}
fn refresh() {
    let (state, listeners, started) = CONTROLLER.with(|c| {
        let mut c = c.borrow_mut();
        let google = get(browser::window().as_ref(), "googlefc");
        let next = AdvertisingState {
            enabled: c.active
                && c.ready
                && !c.failed
                && c.tcf_allowed
                && permits_initial_us_advertising(&Value::from(c.us_status))
                && (c.us_status == 1 || (c.gpp_ready && !c.us_changed)),
            script_ready: c.ready && !c.failed,
            script_failed: c.failed,
            can_reopen_consent: c.active
                && c.gdpr == Some(true)
                && get(&google, "showRevocationMessage").is_function(),
            can_open_us_choices: c.active
                && c.us_status == 2
                && get(&get(&google, "usstatesoptout"), "openConfirmationDialog").is_function(),
        };
        let changed = next != c.snapshot;
        c.snapshot = next.clone();
        (
            next,
            if changed {
                c.listeners.values().cloned().collect::<Vec<_>>()
            } else {
                vec![]
            },
            c.started,
        )
    });
    if started {
        let ads = get(browser::window().as_ref(), "adsbygoogle");
        if !ads.is_undefined() {
            let _ = set(&ads, "requestNonPersonalizedAds", &1.into());
            let _ = set(
                &ads,
                "pauseAdRequests",
                &if state.enabled { 0 } else { 1 }.into(),
            );
        }
    }
    for listener in listeners {
        listener.emit(state.clone());
    }
}
fn keep(value: JsValue) -> JsValue {
    CONTROLLER.with(|c| c.borrow_mut().callbacks.push(value.clone()));
    value
}
fn subscribe_cmp() {
    let browser = browser::window();
    let tcf = get(browser.as_ref(), "__tcfapi");
    let subscribe = CONTROLLER.with(|c| {
        let mut c = c.borrow_mut();
        if !c.tcf_subscribed && tcf.is_function() {
            c.tcf_subscribed = true;
            true
        } else {
            false
        }
    });
    if subscribe {
        let callback = Closure::<dyn FnMut(JsValue, bool)>::new(|data, success| {
            let value = browser::from_js(&data).unwrap_or(Value::Null);
            CONTROLLER.with(|c| {
                let mut c = c.borrow_mut();
                c.gdpr = if success && value["cmpStatus"] != "error" {
                    value["gdprApplies"].as_bool()
                } else {
                    None
                };
                c.tcf_allowed = permits_tcf_advertising(&value, success);
            });
            refresh();
        });
        let callback = keep(callback.into_js_value());
        if call(
            browser.as_ref(),
            "__tcfapi",
            &["addEventListener".into(), 0.into(), callback],
        )
        .is_err()
        {
            CONTROLLER.with(|c| c.borrow_mut().tcf_allowed = false);
            refresh();
        }
    }
    let gpp = get(browser.as_ref(), "__gpp");
    let subscribe = CONTROLLER.with(|c| {
        let mut c = c.borrow_mut();
        if !c.gpp_subscribed && gpp.is_function() {
            c.gpp_subscribed = true;
            true
        } else {
            false
        }
    });
    if subscribe {
        let callback = Closure::<dyn FnMut(JsValue, bool)>::new(|event, success| {
            let value = browser::from_js(&event).unwrap_or(Value::Null);
            let data = &value["pingData"];
            CONTROLLER.with(|c| {
                let mut c = c.borrow_mut();
                c.gpp_ready = success
                    && value["eventName"] != "error"
                    && data["cmpStatus"] == "loaded"
                    && data["signalStatus"] == "ready"
                    && data["gppString"].as_str().is_some_and(|s| !s.is_empty());
                if c.initial_gpp.is_some()
                    && (!c.gpp_ready || c.initial_gpp.as_deref() != data["gppString"].as_str())
                {
                    c.us_changed = true;
                }
                if c.gpp_ready && c.initial_gpp.is_none() {
                    c.initial_gpp = data["gppString"].as_str().map(str::to_string);
                }
            });
            refresh();
        });
        let callback = keep(callback.into_js_value());
        if call(
            browser.as_ref(),
            "__gpp",
            &["addEventListener".into(), callback],
        )
        .is_err()
        {
            CONTROLLER.with(|c| c.borrow_mut().gpp_ready = false);
            refresh();
        }
    }
    refresh();
}
fn queue(key: &str, action: impl FnMut() + 'static) {
    let callback = Closure::<dyn FnMut()>::new(action);
    let record = js_sys::Object::new();
    let _ = set(&record, key, &keep(callback.into_js_value()));
    let _ = call(
        &get(
            &get(browser::window().as_ref(), "googlefc"),
            "callbackQueue",
        ),
        "push",
        &[record.into()],
    );
}
fn fail(script: &web_sys::Element) {
    script.remove();
    CONTROLLER.with(|c| c.borrow_mut().failed = true);
    refresh();
}
fn load_script(id: &str, url: &str, advertising: bool) -> Result<(), JsValue> {
    let script = browser::document().create_element("script")?;
    script.set_id(id);
    script.set_attribute("async", "")?;
    script.set_attribute("referrerpolicy", "strict-origin-when-cross-origin")?;
    if advertising {
        script.set_attribute("crossorigin", "anonymous")?;
        script.set_attribute("data-privacy-treatments", "disablePersonalization")?;
    }
    script.set_attribute("src", url)?;
    let timeout_script = script.clone();
    let done = std::rc::Rc::new(std::cell::Cell::new(false));
    let done_timeout = done.clone();
    let timer = Timeout::new(30_000, move || {
        if !done_timeout.get() {
            done_timeout.set(true);
            fail(&timeout_script);
        }
    });
    let done_loaded = done.clone();
    let loaded = EventListener::new(&script, "load", move |_| {
        if done_loaded.replace(true) {
            return;
        }
        let failed = CONTROLLER.with(|c| c.borrow().failed);
        if failed {
            return;
        }
        if advertising {
            CONTROLLER.with(|c| c.borrow_mut().ready = true);
        }
        refresh();
    });
    let error_script = script.clone();
    let error = EventListener::new(&script, "error", move |_| {
        if !done.replace(true) {
            fail(&error_script);
        }
    });
    CONTROLLER.with(|c| {
        let mut c = c.borrow_mut();
        c.events.extend([loaded, error]);
        c.timers.push(timer);
    });
    if let Some(head) = browser::document().head() {
        head.append_child(&script)?;
    }
    Ok(())
}
fn start() -> Result<(), JsValue> {
    let browser = browser::window();
    if browser.location().hostname().unwrap_or_default() != "rrih.github.io" {
        return Ok(());
    }
    let start = CONTROLLER.with(|c| {
        let mut c = c.borrow_mut();
        if c.started {
            false
        } else {
            c.started = true;
            true
        }
    });
    if !start {
        return Ok(());
    }
    let mut ads = get(browser.as_ref(), "adsbygoogle");
    if ads.is_null() || ads.is_undefined() {
        ads = js_sys::Array::new().into();
        set(browser.as_ref(), "adsbygoogle", &ads)?;
    }
    set(&ads, "pauseAdRequests", &1.into())?;
    set(&ads, "requestNonPersonalizedAds", &1.into())?;
    let mut google = get(browser.as_ref(), "googlefc");
    if google.is_null() || google.is_undefined() {
        google = js_sys::Object::new().into();
        set(browser.as_ref(), "googlefc", &google)?;
    }
    if get(&google, "callbackQueue").is_undefined() || get(&google, "callbackQueue").is_null() {
        set(&google, "callbackQueue", &js_sys::Array::new())?;
    }
    let mut us = get(&google, "usstatesoptout");
    if us.is_null() || us.is_undefined() {
        us = js_sys::Object::new().into();
        set(&google, "usstatesoptout", &us)?;
    }
    set(&us, "overrideDnsLink", &true.into())?;
    queue("CONSENT_API_READY", subscribe_cmp);
    queue("CONSENT_DATA_READY", subscribe_cmp);
    queue("INITIAL_US_STATES_OPT_OUT_DATA_READY", || {
        let us = get(
            &get(browser::window().as_ref(), "googlefc"),
            "usstatesoptout",
        );
        let status = call(&us, "getInitialUsStatesOptOutStatus", &[])
            .ok()
            .and_then(|v| v.as_f64())
            .filter(|s| [1.0, 2.0, 3.0].contains(s))
            .unwrap_or(0.0) as i32;
        CONTROLLER.with(|c| c.borrow_mut().us_status = status);
        subscribe_cmp();
        refresh();
    });
    let page = browser::document();
    if page.get_element_by_id("atlas-advertising").is_some()||page.get_element_by_id("atlas-ad-consent").is_some()||page.query_selector("script[src*=\"fundingchoicesmessages.google.com/i/pub-\"],script[src*=\"pagead2.googlesyndication.com/pagead/js/adsbygoogle.js\"]")?.is_some(){CONTROLLER.with(|c|c.borrow_mut().failed=true);refresh();return Ok(())}
    if page
        .query_selector("iframe[name='googlefcPresent']")?
        .is_none()
    {
        let marker = page.create_element("iframe")?;
        marker.set_attribute("name", "googlefcPresent")?;
        marker.set_attribute("style", "display:none")?;
        marker.set_attribute("tabindex", "-1")?;
        marker.set_attribute("aria-hidden", "true")?;
        if let Some(body) = page.body() {
            body.append_child(&marker)?;
        }
    }
    load_script(
        "atlas-advertising",
        &format!(
            "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={AD_CLIENT}"
        ),
        true,
    )?;
    load_script(
        "atlas-ad-consent",
        "https://fundingchoicesmessages.google.com/i/pub-6426570202991325?ers=1",
        false,
    )?;
    Ok(())
}
fn set_active(locale: &str) {
    let active = is_advertising_page(
        &browser::window().location().hostname().unwrap_or_default(),
        locale,
    );
    CONTROLLER.with(|c| c.borrow_mut().active = active);
    if active && start().is_err() {
        CONTROLLER.with(|c| c.borrow_mut().failed = true);
    }
    refresh();
}
fn reopen_consent() {
    if !CONTROLLER.with(|c| c.borrow().snapshot.can_reopen_consent) {
        return;
    }
    CONTROLLER.with(|c| c.borrow_mut().tcf_allowed = false);
    refresh();
    queue("CONSENT_API_READY", || {
        if call(
            &get(browser::window().as_ref(), "googlefc"),
            "showRevocationMessage",
            &[],
        )
        .is_err()
        {
            CONTROLLER.with(|c| c.borrow_mut().tcf_allowed = false);
            refresh();
        }
    });
}
fn open_us_choices() {
    if !CONTROLLER.with(|c| c.borrow().snapshot.can_open_us_choices) {
        return;
    }
    CONTROLLER.with(|c| c.borrow_mut().us_changed = true);
    refresh();
    queue("INITIAL_US_STATES_OPT_OUT_DATA_READY", || {
        let callback = Closure::<dyn FnMut(bool)>::new(|opted_out| {
            if opted_out {
                CONTROLLER.with(|c| c.borrow_mut().us_status = 3);
            }
            refresh();
        });
        let callback = keep(callback.into_js_value());
        if call(
            &get(
                &get(browser::window().as_ref(), "googlefc"),
                "usstatesoptout",
            ),
            "openConfirmationDialog",
            &[callback],
        )
        .is_err()
        {
            CONTROLLER.with(|c| c.borrow_mut().us_status = 0);
            refresh();
        }
    });
}
#[hook]
fn use_advertising_state() -> AdvertisingState {
    let state = use_state(|| CONTROLLER.with(|c| c.borrow().snapshot.clone()));
    {
        let state = state.clone();
        use_effect_with((), move |_| {
            let listener = Callback::from(move |value| state.set(value));
            let id = CONTROLLER.with(|c| {
                let mut c = c.borrow_mut();
                c.next_listener += 1;
                let id = c.next_listener;
                c.listeners.insert(id, listener);
                id
            });
            move || {
                CONTROLLER.with(|c| c.borrow_mut().listeners.remove(&id));
            }
        });
    }
    (*state).clone()
}
#[derive(Properties, PartialEq)]
pub struct PlacementProps {
    pub locale: String,
    pub label: String,
}
#[function_component(AdPlacement)]
pub fn placement(props: &PlacementProps) -> Html {
    let state = use_advertising_state();
    {
        use_effect_with(props.locale.clone(), move |locale| {
            set_active(locale);
            || {
                CONTROLLER.with(|c| c.borrow_mut().active = false);
                refresh();
            }
        });
    }
    let eligible = is_advertising_page(
        &browser::window().location().hostname().unwrap_or_default(),
        &props.locale,
    );
    html! {<AdSlot client={AD_CLIENT} slot={AD_SLOT} enabled={eligible&&state.enabled} script_ready={state.script_ready} script_failed={state.script_failed} label={props.label.clone()}/>}
}
#[derive(Properties, PartialEq)]
pub struct ChoicesProps {
    pub locale: String,
}
#[function_component(AdChoices)]
pub fn choices(props: &ChoicesProps) -> Html {
    let language = use_language();
    let state = use_advertising_state();
    let eligible = is_advertising_page(
        &browser::window().location().hostname().unwrap_or_default(),
        &props.locale,
    );
    html! {<>{if eligible&&state.can_reopen_consent{html!{<button type="button" onclick={Callback::from(|_|reopen_consent())}>{language.t("Ad privacy choices")}</button>}}else{Html::default()}}{if eligible&&state.can_open_us_choices{html!{<button type="button" onclick={Callback::from(|_|open_us_choices())}>{language.t("Do not sell or share my personal information")}</button>}}else{Html::default()}}</>}
}
