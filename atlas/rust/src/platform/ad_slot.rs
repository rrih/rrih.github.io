use crate::browser::{self, call, get};
use gloo_events::EventListener;
use gloo_timers::callback::Timeout;
use std::cell::Cell;
use wasm_bindgen::{JsCast, JsValue, closure::Closure};
use yew::prelude::*;
thread_local! {static REQUESTED:Cell<bool>=const{Cell::new(false)};}
#[derive(Properties, PartialEq, Clone)]
pub struct AdSlotProps {
    pub client: String,
    pub slot: String,
    pub enabled: bool,
    pub script_ready: bool,
    #[prop_or_default]
    pub script_failed: bool,
    pub label: String,
}
#[function_component(AdSlot)]
pub fn ad_slot(props: &AdSlotProps) -> Html {
    let client = props
        .client
        .strip_prefix("ca-pub-")
        .is_some_and(|s| s.len() == 16 && s.bytes().all(|b| b.is_ascii_digit()));
    let slot = (6..=20).contains(&props.slot.len())
        && props.slot.bytes().all(|b| b.is_ascii_digit())
        && props.slot.bytes().any(|b| b != b'0');
    if !props.enabled || !client || !slot {
        return Html::default();
    }
    html! {<ConfiguredAdSlot ..props.clone()/>}
}
#[derive(Clone, Copy, PartialEq)]
struct Size {
    width: u32,
    height: u32,
}
struct ConfiguredAdSlot {
    host: NodeRef,
    ad: NodeRef,
    chosen: Option<Size>,
    measured: bool,
    fits: bool,
    near: bool,
    closed: bool,
    attempted: Option<f64>,
    events: Vec<EventListener>,
    observers: Vec<JsValue>,
    callbacks: Vec<JsValue>,
    timer: Option<Timeout>,
    observing_ad: bool,
}
enum Msg {
    Measure,
    Near(bool),
    InspectNear,
    Status,
    Expire,
}
fn rect(element: &web_sys::Element) -> JsValue {
    call(element.as_ref(), "getBoundingClientRect", &[]).unwrap_or(JsValue::UNDEFINED)
}
fn number(value: &JsValue, key: &str) -> f64 {
    get(value, key).as_f64().unwrap_or(0.0)
}
fn now() -> f64 {
    call(&get(browser::window().as_ref(), "performance"), "now", &[])
        .ok()
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0)
}
impl ConfiguredAdSlot {
    fn observer(
        &mut self,
        name: &str,
        callback: JsValue,
        target: &web_sys::Element,
        options: Option<JsValue>,
    ) -> bool {
        let ctor = get(browser::window().as_ref(), name).dyn_into::<js_sys::Function>();
        let Ok(ctor) = ctor else { return false };
        let args = js_sys::Array::new();
        args.push(&callback);
        if name != "MutationObserver"
            && let Some(options) = &options
        {
            args.push(options);
        }
        let Ok(observer) = js_sys::Reflect::construct(&ctor, &args) else {
            return false;
        };
        let mut observe_args = vec![target.clone().into()];
        if name == "MutationObserver"
            && let Some(options) = options
        {
            observe_args.push(options);
        }
        if call(&observer, "observe", &observe_args).is_err() {
            return false;
        }
        self.observers.push(observer);
        self.callbacks.push(callback);
        true
    }
    fn request(&mut self, ctx: &Context<Self>) {
        if self.closed || self.chosen.is_none() {
            return;
        }
        let Some(ad) = self.ad.cast::<web_sys::Element>() else {
            return;
        };
        if ad.get_attribute("data-ad-status").as_deref() == Some("unfilled") {
            self.closed = true;
            ctx.link().send_message(Msg::Status);
            return;
        }
        if self.attempted.is_none() {
            if !ctx.props().script_ready || !self.near || !self.fits || browser::document().hidden()
            {
                return;
            }
            if REQUESTED.with(Cell::get) {
                self.closed = true;
                ctx.link().send_message(Msg::Status);
                return;
            }
            if ad.has_attribute("data-ad-status") || ad.has_attribute("data-adsbygoogle-status") {
                REQUESTED.with(|r| r.set(true));
                self.attempted = Some(now());
            } else {
                let size = self.chosen.unwrap();
                let visible = number(&rect(&ad), "width") >= size.width as f64
                    && call(ad.as_ref(), "getClientRects", &[])
                        .ok()
                        .is_some_and(|v| number(&v, "length") > 0.0);
                if !visible {
                    self.closed = true;
                    ctx.link().send_message(Msg::Status);
                    return;
                }
                REQUESTED.with(|r| r.set(true));
                self.attempted = Some(now());
                let mut queue = get(browser::window().as_ref(), "adsbygoogle");
                if queue.is_null() || queue.is_undefined() {
                    queue = js_sys::Array::new().into();
                    let _ = browser::set(browser::window().as_ref(), "adsbygoogle", &queue);
                }
                if call(&queue, "push", &[js_sys::Object::new().into()]).is_err() {
                    self.closed = true;
                    ctx.link().send_message(Msg::Status);
                }
            }
        }
        if self.timer.is_none()
            && let Some(start) = self.attempted
        {
            let link = ctx.link().clone();
            self.timer = Some(Timeout::new(
                (30_000.0 - (now() - start)).max(0.0) as u32,
                move || link.send_message(Msg::Expire),
            ));
        }
    }
}
impl Component for ConfiguredAdSlot {
    type Message = Msg;
    type Properties = AdSlotProps;
    fn create(ctx: &Context<Self>) -> Self {
        Self {
            host: NodeRef::default(),
            ad: NodeRef::default(),
            chosen: None,
            measured: false,
            fits: false,
            near: false,
            closed: ctx.props().script_failed || REQUESTED.with(Cell::get),
            attempted: None,
            events: vec![],
            observers: vec![],
            callbacks: vec![],
            timer: None,
            observing_ad: false,
        }
    }
    fn changed(&mut self, ctx: &Context<Self>, _: &Self::Properties) -> bool {
        if ctx.props().script_failed {
            self.closed = true;
        }
        true
    }
    fn rendered(&mut self, ctx: &Context<Self>, first: bool) {
        if first && let Some(host) = self.host.cast::<web_sys::Element>() {
            let link = ctx.link().clone();
            let resize =
                Closure::<dyn FnMut(JsValue)>::new(move |_| link.send_message(Msg::Measure));
            if !self.observer("ResizeObserver", resize.into_js_value(), &host, None) {
                let link = ctx.link().clone();
                self.events.push(EventListener::new(
                    &browser::window(),
                    "resize",
                    move |_| link.send_message(Msg::Measure),
                ));
            }
            ctx.link().send_message(Msg::Measure);
            if !self.closed {
                let link = ctx.link().clone();
                let intersection = Closure::<dyn FnMut(JsValue)>::new(move |entries| {
                    let entry = get(&entries, "0");
                    link.send_message(Msg::Near(
                        get(&entry, "isIntersecting").as_bool().unwrap_or(false),
                    ));
                });
                if !self.observer(
                    "IntersectionObserver",
                    intersection.into_js_value(),
                    &host,
                    Some(browser::json(
                        &serde_json::json!({"rootMargin":"200px 0px"}),
                    )),
                ) {
                    for event in ["scroll", "resize"] {
                        let link = ctx.link().clone();
                        self.events.push(EventListener::new(
                            &browser::window(),
                            event,
                            move |_| link.send_message(Msg::InspectNear),
                        ));
                    }
                    ctx.link().send_message(Msg::InspectNear);
                }
            }
            let link = ctx.link().clone();
            self.events.push(EventListener::new(
                &browser::document(),
                "visibilitychange",
                move |_| link.send_message(Msg::Status),
            ));
        }
        if !self.observing_ad
            && let Some(ad) = self.ad.cast::<web_sys::Element>()
        {
            let link = ctx.link().clone();
            let callback =
                Closure::<dyn FnMut(JsValue)>::new(move |_| link.send_message(Msg::Status));
            self.observing_ad = self.observer(
                "MutationObserver",
                callback.into_js_value(),
                &ad,
                Some(browser::json(
                    &serde_json::json!({"attributes":true,"attributeFilter":["data-ad-status"]}),
                )),
            );
        }
        self.request(ctx);
    }
    fn update(&mut self, ctx: &Context<Self>, msg: Msg) -> bool {
        match msg {
            Msg::Measure => {
                let Some(host) = self.host.cast::<web_sys::Element>() else {
                    return false;
                };
                let width = number(&rect(&host), "width");
                if width <= 0.0 {
                    return false;
                }
                let old = (self.measured, self.chosen, self.fits);
                if !self.measured {
                    self.measured = true;
                    self.chosen = [
                        Size {
                            width: 728,
                            height: 90,
                        },
                        Size {
                            width: 468,
                            height: 60,
                        },
                        Size {
                            width: 320,
                            height: 50,
                        },
                        Size {
                            width: 300,
                            height: 50,
                        },
                    ]
                    .into_iter()
                    .find(|s| s.width as f64 <= width);
                }
                self.fits = self.chosen.is_some_and(|s| width >= s.width as f64);
                return old != (self.measured, self.chosen, self.fits);
            }
            Msg::Near(near) => {
                if self.near == near {
                    return false;
                }
                self.near = near;
            }
            Msg::InspectNear => {
                if let Some(host) = self.host.cast::<web_sys::Element>() {
                    let bounds = rect(&host);
                    let near = number(&bounds, "bottom") >= -200.0
                        && number(&bounds, "top")
                            <= browser::window()
                                .inner_height()
                                .ok()
                                .and_then(|v| v.as_f64())
                                .unwrap_or(0.0)
                                + 200.0;
                    if near == self.near {
                        return false;
                    }
                    self.near = near;
                }
            }
            Msg::Status => {
                if let Some(ad) = self.ad.cast::<web_sys::Element>()
                    && ad.get_attribute("data-ad-status").as_deref() == Some("unfilled")
                {
                    self.closed = true;
                }
                self.request(ctx);
            }
            Msg::Expire => {
                if let Some(ad) = self.ad.cast::<web_sys::Element>()
                    && !ad.has_attribute("data-ad-status")
                    && ad.query_selector("iframe").ok().flatten().is_none()
                {
                    self.closed = true;
                }
            }
        }
        true
    }
    fn view(&self, ctx: &Context<Self>) -> Html {
        html! {<div ref={self.host.clone()} class="atlas-ad-placement" data-state={if self.closed||(self.measured&&self.chosen.is_none()){"empty"}else if self.chosen.is_some(){"ready"}else{"pending"}}>{if !self.closed{if let Some(size)=self.chosen{html!{<aside class="atlas-ad-slot" aria-label={ctx.props().label.clone()} hidden={!self.fits}><span class="atlas-ad-label">{ctx.props().label.clone()}</span><div class="atlas-ad-creative" style={format!("width:{}px;height:{}px",size.width,size.height)}><ins ref={self.ad.clone()} class="adsbygoogle" style={format!("display:inline-block;width:{}px;height:{}px",size.width,size.height)} data-ad-client={ctx.props().client.clone()} data-ad-slot={ctx.props().slot.clone()}/></div></aside>}}else{Html::default()}}else{Html::default()}}</div>}
    }
    fn destroy(&mut self, _: &Context<Self>) {
        for observer in &self.observers {
            let _ = call(observer, "disconnect", &[]);
        }
        self.events.clear();
        self.timer = None;
    }
}
