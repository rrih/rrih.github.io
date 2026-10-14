use crate::browser;
pub use crate::core::telemetry::vital_parameters;
use crate::core::telemetry::{Consent, emit_ignoring_failure};
use serde_json::Value;
use std::{cell::RefCell, rc::Rc};
use wasm_bindgen::{JsCast, JsValue, closure::Closure};
pub type Sender = Rc<dyn Fn(&str, Value)>;
#[derive(Default)]
struct State {
    sender: Option<Sender>,
    consent: Consent,
}
thread_local! {static STATE:RefCell<State>=RefCell::new(State::default());}
#[wasm_bindgen::prelude::wasm_bindgen(module = "/src/platform/web-vitals-bridge.js")]
unsafe extern "C" {
    #[wasm_bindgen::prelude::wasm_bindgen(js_name=observeVitals,catch)]
    fn observe_vitals(callback: &js_sys::Function) -> Result<(), JsValue>;
}
fn now() -> f64 {
    browser::call(
        &browser::get(browser::window().as_ref(), "performance"),
        "now",
        &[],
    )
    .ok()
    .and_then(|v| v.as_f64())
    .unwrap_or(f64::NAN)
}
fn emit(epoch: u64, name: &str, value: Value) {
    let sender = STATE.with(|s| {
        let s = s.borrow();
        s.consent.current(epoch).then(|| s.sender.clone()).flatten()
    });
    if let Some(sender) = sender {
        // The public Rust sender API remains unchanged. Invoke it across a caught
        // JS function boundary so an external analytics exception cannot escape.
        let name = name.to_owned();
        let callback = Closure::<dyn FnMut()>::new(move || sender(&name, value.clone()));
        emit_ignoring_failure(|| {
            callback
                .as_ref()
                .unchecked_ref::<js_sys::Function>()
                .call0(&JsValue::NULL)
                .map(|_| ())
        });
    }
}
pub fn set_telemetry_enabled(enabled: bool, sender: Option<Sender>, from_navigation_start: bool) {
    let epoch = STATE.with(|state| {
        let mut state = state.borrow_mut();
        state.sender = if enabled {
            sender.or_else(|| state.sender.clone())
        } else {
            None
        };
        let sender_ready = state.sender.is_some();
        state
            .consent
            .update(enabled, sender_ready, from_navigation_start)
    });
    if let Some(epoch) = epoch {
        let callback = Closure::<dyn FnMut(JsValue)>::new(move |metric| {
            let current = STATE.with(|s| {
                let s = s.borrow();
                s.consent.permits_vital(epoch)
            });
            if current
                && let Some(parameters) = browser::from_js(&metric)
                    .as_ref()
                    .and_then(vital_parameters)
            {
                emit(epoch, "atlas_web_vital", parameters);
            }
        });
        if observe_vitals(callback.as_ref().unchecked_ref()).is_ok() {
            callback.forget();
        }
    }
}
pub fn begin_model_observation(view_mode: &str) -> Rc<dyn Fn(&str)> {
    let observation =
        RefCell::new(STATE.with(|s| s.borrow().consent.observe_model(view_mode, now())));
    Rc::new(move |outcome| {
        let event = STATE.with(|state| {
            observation
                .borrow_mut()
                .finish(&state.borrow().consent, outcome, now())
        });
        if let Some((epoch, value)) = event {
            emit(epoch, "atlas_model_load", value);
        }
    })
}
