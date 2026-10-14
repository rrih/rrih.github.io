use crate::model::*;
use crate::{pwa, storage};
use gloo_events::EventListener;
use gloo_timers::callback::Timeout;
use serde_json::{Value, json};
use wasm_bindgen::{JsCast, JsValue};
use wasm_bindgen_futures::{JsFuture, spawn_local};
use web_sys::{
    HtmlDialogElement, HtmlElement, HtmlImageElement, HtmlInputElement, HtmlSelectElement,
    ServiceWorkerRegistration,
};
use yew::prelude::*;

fn window() -> web_sys::Window {
    web_sys::window().unwrap()
}
fn document() -> web_sys::Document {
    window().document().unwrap()
}
fn js(value: Value) -> JsValue {
    js_sys::JSON::parse(&value.to_string()).unwrap()
}
fn history_state() -> Value {
    window()
        .history()
        .ok()
        .and_then(|h| h.state().ok())
        .and_then(|v| js_sys::JSON::stringify(&v).ok())
        .and_then(|s| serde_json::from_str(&s.as_string()?).ok())
        .unwrap_or(Value::Null)
}
fn date(value: &str, lang: &str) -> String {
    js_sys::Date::new(&value.into())
        .to_locale_string(lang, &JsValue::UNDEFINED)
        .as_string()
        .unwrap_or_default()
}
#[derive(Default)]
struct Gesture {
    x: f64,
    y: f64,
    time: f64,
    multi: bool,
    id: i32,
}
struct App {
    route: Route,
    input: String,
    invalid: bool,
    lang: String,
    copies: Value,
    album: Option<Album>,
    status: String,
    recents: Vec<String>,
    settings: bool,
    cache_enabled: bool,
    cache_count: Option<u64>,
    online: bool,
    message: String,
    save_failed: bool,
    update: Option<ServiceWorkerRegistration>,
    install: Option<web_sys::Event>,
    updating: bool,
    revealed: Option<String>,
    failed: Option<String>,
    loaded: Option<String>,
    retry: u32,
    dialog: NodeRef,
    close_button: NodeRef,
    last_focus: Option<HtmlElement>,
    suppress_resume: bool,
    resume_timer: Option<Timeout>,
    provider_timer: Option<Timeout>,
    last_slide: Option<String>,
    previous_viewer: bool,
    gesture: Option<Gesture>,
    listeners: Vec<EventListener>,
    preloads: Vec<HtmlImageElement>,
    load_generation: u64,
}
enum Msg {
    Sync,
    Input(String),
    Submit,
    ClearMessage,
    Refresh,
    #[cfg(feature = "test-fixtures")]
    Provider(u64, Album),
    Settings(bool),
    Language(String),
    Cache(bool),
    Open(usize),
    Close,
    Move(i32, bool),
    Online,
    Storage,
    SaveResume,
    Key(web_sys::KeyboardEvent),
    PointerDown(web_sys::PointerEvent),
    PointerUp(web_sys::PointerEvent),
    PointerCancel,
    Reveal,
    Loaded(String),
    Failed(String),
    RetryImage,
    Copy,
    Copied(bool),
    CacheStats(Value),
    ClearCache,
    ClearHistory,
    UpdateReady(ServiceWorkerRegistration),
    ApplyUpdate,
    Controller,
    InstallEvent(web_sys::Event),
    Install,
}
impl App {
    fn t(&self, key: &str) -> String {
        self.copies["copies"][&self.lang][key]
            .as_str()
            .unwrap_or(key)
            .into()
    }
    fn slides(&self) -> Vec<Slide> {
        self.album
            .as_ref()
            .filter(|a| Some(&a.username) == self.route.username.as_ref())
            .map(flatten)
            .unwrap_or_default()
    }
    fn index(&self, slides: &[Slide]) -> Option<usize> {
        slides.iter().position(|s| {
            Some(&s.post.id) == self.route.post_id.as_ref()
                && Some(&s.photo.key) == self.route.image_key.as_ref()
        })
    }
    fn navigate(&mut self, ctx: &Context<Self>, hash: &str, replace: bool, state: Value) {
        if let Ok(h) = window().history() {
            let _ = if replace {
                h.replace_state_with_url(&js(state), "", Some(hash))
            } else {
                h.push_state_with_url(&js(state), "", Some(hash))
            };
        }
        ctx.link().send_message(Msg::Sync);
    }
    fn save_resume(&mut self) {
        if self.suppress_resume {
            return;
        }
        let slides = self.slides();
        if let (Some(a), Some(i)) = (&self.route.username, self.index(&slides))
            && !storage::write(&format!("resume:{a}"), &slides[i].id)
        {
            self.save_failed = true;
        }
    }
    fn settings_save(&mut self) {
        if !storage::write(
            "settings",
            &json!({"language":self.lang,"cache":self.cache_enabled}),
        ) {
            self.save_failed = true;
        }
    }
    fn fetch(&mut self, ctx: &Context<Self>) {
        self.suppress_resume = false;
        self.load_generation += 1;
        self.provider_timer = None;
        let Some(account) = self.route.username.clone() else {
            self.album = None;
            self.status.clear();
            return;
        };
        self.album = storage::cached_album(&account);
        storage::remember(&account);
        self.recents = storage::recent();
        self.status = if self.online {
            "unavailable"
        } else {
            "offline"
        }
        .into();
        #[cfg(feature = "test-fixtures")]
        {
            self.status = "loading".into();
            let generation = self.load_generation;
            let link = ctx.link().clone();
            let delay = if account == "slow" { 800 } else { 30 };
            self.provider_timer = Some(Timeout::new(delay, move || {
                link.send_message(Msg::Provider(generation, fixture_album(&account)))
            }));
        }
        #[cfg(not(feature = "test-fixtures"))]
        let _ = ctx;
    }
    fn worker(ctx: &Context<Self>, kind: &'static str) {
        let link = ctx.link().clone();
        spawn_local(async move {
            link.send_message(Msg::CacheStats(pwa::message(kind, json!({})).await));
        });
    }
    fn notice(&self, ctx: &Context<Self>) -> Html {
        html! {<div class="notice" role="status"><strong>{self.t("notice")}</strong><p>{self.t("blocked")}</p>{if self.route.username.is_some(){html!{<button onclick={ctx.link().callback(|_|Msg::Refresh)} disabled={self.status=="loading"}>{self.t("retry")}</button>}}else{Html::default()}}</div>}
    }
}
impl Component for App {
    type Message = Msg;
    type Properties = ();
    fn create(ctx: &Context<Self>) -> Self {
        let settings = storage::read::<Value>("settings").unwrap_or(Value::Null);
        let copies: Value = serde_json::from_str(include_str!("copies.json")).unwrap();
        let lang = settings["language"]
            .as_str()
            .filter(|s| copies["copies"].get(s).is_some())
            .unwrap_or("ja")
            .to_string();
        let mut app = Self {
            route: parse_route(&window().location().hash().unwrap_or_default()),
            input: String::new(),
            invalid: false,
            lang,
            copies,
            album: None,
            status: String::new(),
            recents: storage::recent(),
            settings: false,
            cache_enabled: settings["cache"] != false,
            cache_count: None,
            online: window().navigator().on_line(),
            message: String::new(),
            save_failed: false,
            update: None,
            install: None,
            updating: false,
            revealed: None,
            failed: None,
            loaded: None,
            retry: 0,
            dialog: NodeRef::default(),
            close_button: NodeRef::default(),
            last_focus: None,
            suppress_resume: false,
            resume_timer: None,
            provider_timer: None,
            last_slide: None,
            previous_viewer: false,
            gesture: None,
            listeners: Vec::new(),
            preloads: Vec::new(),
            load_generation: 0,
        };
        for event in ["popstate", "hashchange"] {
            let link = ctx.link().clone();
            app.listeners
                .push(EventListener::new(&window(), event, move |_| {
                    link.send_message(Msg::Sync)
                }));
        }
        for event in ["online", "offline"] {
            let link = ctx.link().clone();
            app.listeners
                .push(EventListener::new(&window(), event, move |_| {
                    link.send_message(Msg::Online)
                }));
        }
        let link = ctx.link().clone();
        app.listeners
            .push(EventListener::new(&window(), "storage", move |_| {
                link.send_message(Msg::Storage)
            }));
        let link = ctx.link().clone();
        app.listeners
            .push(EventListener::new(&window(), "pagehide", move |_| {
                link.send_message(Msg::SaveResume)
            }));
        let link = ctx.link().clone();
        app.listeners.push(EventListener::new(
            &document(),
            "visibilitychange",
            move |_| {
                if document().visibility_state() == web_sys::VisibilityState::Hidden {
                    link.send_message(Msg::SaveResume)
                }
            },
        ));
        let link = ctx.link().clone();
        app.listeners
            .push(EventListener::new(&window(), "keydown", move |e| {
                if let Some(e) = e.dyn_ref::<web_sys::KeyboardEvent>() {
                    link.send_message(Msg::Key(e.clone()))
                }
            }));
        let link = ctx.link().clone();
        app.listeners.push(EventListener::new(
            &window(),
            "beforeinstallprompt",
            move |e| {
                e.prevent_default();
                link.send_message(Msg::InstallEvent(e.clone()))
            },
        ));
        if js_sys::Reflect::has(&window().navigator(), &"serviceWorker".into()).unwrap_or(false) {
            let link = ctx.link().clone();
            app.listeners.push(EventListener::new(
                &window().navigator().service_worker(),
                "controllerchange",
                move |_| link.send_message(Msg::Controller),
            ));
        }
        let callback = ctx.link().callback(Msg::UpdateReady);
        spawn_local(async move {
            pwa::register(callback).await;
        });
        pwa::configure(app.cache_enabled);
        app.fetch(ctx);
        app
    }
    fn update(&mut self, ctx: &Context<Self>, msg: Msg) -> bool {
        match msg {
            Msg::ClearMessage => self.message.clear(),
            Msg::Sync => {
                let route = parse_route(&window().location().hash().unwrap_or_default());
                let changed = route.username != self.route.username;
                self.route = route;
                if changed {
                    self.fetch(ctx);
                }
            }
            Msg::Input(value) => {
                self.input = value;
                return false;
            }
            Msg::Submit => match username(&self.input) {
                Ok(account) => {
                    self.invalid = false;
                    if Some(&account) == self.route.username.as_ref() {
                        self.fetch(ctx)
                    } else {
                        self.navigate(ctx, &route_url(&account, None), false, json!({}))
                    }
                }
                Err(_) => self.invalid = true,
            },
            Msg::Refresh => self.fetch(ctx),
            #[cfg(feature = "test-fixtures")]
            Msg::Provider(generation, album) => {
                if generation != self.load_generation {
                    return false;
                }
                self.save_failed |= !storage::save_album(&album);
                self.album = Some(album);
                self.status.clear();
            }
            Msg::Settings(open) => {
                self.settings = open;
                if open {
                    self.last_focus = document()
                        .active_element()
                        .and_then(|e| e.dyn_into::<HtmlElement>().ok());
                    Self::worker(ctx, "stats");
                }
            }
            Msg::Language(lang) => {
                if self.copies["copies"].get(&lang).is_some() {
                    self.lang = lang;
                    self.settings_save();
                }
            }
            Msg::Cache(enabled) => {
                self.cache_enabled = enabled;
                self.settings_save();
                pwa::configure(enabled);
            }
            Msg::Open(i) => {
                let slides = self.slides();
                if let (Some(s), Some(account)) = (slides.get(i), self.route.username.clone()) {
                    let _ = window().history().unwrap().replace_state_with_url(
                        &js(json!({"scroll":window().scroll_y().unwrap_or(0.0),"focus":s.id})),
                        "",
                        window().location().href().ok().as_deref(),
                    );
                    self.navigate(
                        ctx,
                        &route_url(&account, Some(s)),
                        false,
                        json!({"fromList":true}),
                    );
                }
            }
            Msg::Close => {
                self.save_resume();
                if history_state()["fromList"] == true {
                    let _ = window().history().unwrap().back();
                } else if let Some(account) = self.route.username.clone() {
                    self.navigate(ctx, &route_url(&account, None), true, json!({}));
                }
            }
            Msg::Move(delta, by_post) => {
                let slides = self.slides();
                let Some(index) = self.index(&slides) else {
                    return false;
                };
                let i = if by_post {
                    post_step(&slides, index, delta) as i32
                } else {
                    index as i32 + delta
                };
                if i < 0 || i >= slides.len() as i32 {
                    self.message = self.t(if delta < 0 {
                        "start"
                    } else if self.album.as_ref().is_some_and(|a| a.range == "end") {
                        "end"
                    } else {
                        "unavailable"
                    });
                } else {
                    self.message.clear();
                    self.navigate(
                        ctx,
                        &route_url(
                            self.route.username.as_deref().unwrap_or_default(),
                            Some(&slides[i as usize]),
                        ),
                        true,
                        history_state(),
                    );
                }
            }
            Msg::Online => self.online = window().navigator().on_line(),
            Msg::Storage => self.recents = storage::recent(),
            Msg::SaveResume => self.save_resume(),
            Msg::Key(e) => {
                if self.settings || self.route.post_id.is_none() {
                    return false;
                }
                let target = e
                    .target()
                    .and_then(|t| t.dyn_into::<web_sys::Element>().ok());
                if target.as_ref().is_some_and(|t| {
                    t.closest("input,textarea,select,[contenteditable=\"true\"]")
                        .ok()
                        .flatten()
                        .is_some()
                }) {
                    return false;
                }
                let key = e.key();
                if key == "Escape" {
                    e.prevent_default();
                    ctx.link().send_message(Msg::Close)
                } else if ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"]
                    .contains(&key.as_str())
                {
                    if ["ArrowUp", "ArrowDown"].contains(&key.as_str())
                        && target
                            .is_some_and(|t| t.closest(".post-details").ok().flatten().is_some())
                    {
                        return false;
                    }
                    e.prevent_default();
                    ctx.link().send_message(Msg::Move(
                        if ["ArrowRight", "ArrowDown"].contains(&key.as_str()) {
                            1
                        } else {
                            -1
                        },
                        ["ArrowUp", "ArrowDown"].contains(&key.as_str()),
                    ));
                }
                return false;
            }
            Msg::PointerDown(e) => {
                if e.pointer_type() == "mouse" {
                    return false;
                }
                if let Some(g) = &mut self.gesture {
                    g.multi = true
                } else {
                    self.gesture = Some(Gesture {
                        x: e.client_x() as f64,
                        y: e.client_y() as f64,
                        time: window().performance().unwrap().now(),
                        multi: !e.is_primary(),
                        id: e.pointer_id(),
                    })
                }
                return false;
            }
            Msg::PointerCancel => {
                self.gesture = None;
                return false;
            }
            Msg::PointerUp(e) => {
                if let Some(g) = self.gesture.take().filter(|g| g.id == e.pointer_id()) {
                    let delta = swipe(
                        e.client_x() as f64 - g.x,
                        e.client_y() as f64 - g.y,
                        window().performance().unwrap().now() - g.time,
                        window().inner_width().unwrap().as_f64().unwrap(),
                        g.x,
                        window().visual_viewport().map_or(1.0, |v| v.scale()),
                        g.multi,
                    );
                    if delta != 0 {
                        ctx.link().send_message(Msg::Move(delta, false))
                    }
                }
                return false;
            }
            Msg::Reveal => {
                let s = self.slides();
                self.revealed = self.index(&s).map(|i| s[i].id.clone());
            }
            Msg::Loaded(id) => {
                self.loaded = Some(id);
                self.failed = None;
            }
            Msg::Failed(id) => {
                self.failed = Some(id.clone());
                if let Some(s) = self.slides().into_iter().find(|s| s.id == id) {
                    spawn_local(async move {
                        pwa::message("invalidate", json!({"url":s.photo.url})).await;
                    });
                }
            }
            Msg::RetryImage => {
                self.failed = None;
                self.loaded = None;
                self.retry += 1;
            }
            Msg::Copy => {
                let s = self.slides();
                if let Some(i) = self.index(&s) {
                    let value = s[i].photo.url.clone();
                    let link = ctx.link().clone();
                    spawn_local(async move {
                        let result =
                            JsFuture::from(window().navigator().clipboard().write_text(&value))
                                .await;
                        link.send_message(Msg::Copied(result.is_ok()));
                    });
                }
            }
            Msg::Copied(ok) => self.message = self.t(if ok { "copied" } else { "copyFailed" }),
            Msg::CacheStats(value) => self.cache_count = value["count"].as_u64(),
            Msg::ClearCache => Self::worker(ctx, "clear"),
            Msg::ClearHistory => {
                self.suppress_resume = true;
                self.resume_timer = None;
                storage::clear_history();
                self.recents.clear();
            }
            Msg::UpdateReady(registration) => self.update = Some(registration),
            Msg::ApplyUpdate => {
                self.updating = true;
                self.save_resume();
                if let Some(worker) = self.update.as_ref().and_then(|r| r.waiting()) {
                    let _ = worker.post_message(&js(json!({"type":"activate"})));
                }
            }
            Msg::Controller => {
                pwa::configure(self.cache_enabled);
                if self.updating {
                    let _ = window().location().reload();
                }
                return false;
            }
            Msg::InstallEvent(event) => self.install = Some(event),
            Msg::Install => {
                if let Some(event) = self.install.take()
                    && let Ok(prompt) = js_sys::Reflect::get(&event, &"prompt".into())
                        .and_then(|v| v.dyn_into::<js_sys::Function>())
                {
                    let _ = prompt.call0(&event);
                }
            }
        }
        true
    }
    fn rendered(&mut self, ctx: &Context<Self>, _first: bool) {
        let _ = document()
            .document_element()
            .unwrap()
            .set_attribute("lang", &self.lang);
        let viewer = self.route.post_id.is_some();
        if viewer != self.previous_viewer {
            self.previous_viewer = viewer;
            if viewer {
                if let Some(close) = self.close_button.cast::<HtmlElement>() {
                    let opts = web_sys::FocusOptions::new();
                    opts.set_prevent_scroll(true);
                    let _ = close.focus_with_options(&opts);
                }
            } else {
                let state = history_state();
                Timeout::new(0, move || {
                    if let Some(id) = state["focus"].as_str()
                        && let Some(el) = document()
                            .get_element_by_id(&format!("photo-{id}"))
                            .and_then(|e| e.dyn_into::<HtmlElement>().ok())
                    {
                        let opts = web_sys::FocusOptions::new();
                        opts.set_prevent_scroll(true);
                        let _ = el.focus_with_options(&opts);
                    }
                    window().scroll_to_with_x_and_y(0.0, state["scroll"].as_f64().unwrap_or(0.0));
                })
                .forget();
            }
        }
        if let Some(dialog) = self.dialog.cast::<HtmlDialogElement>() {
            if self.settings && !dialog.open() {
                let _ = dialog.show_modal();
            } else if !self.settings && dialog.open() {
                dialog.close();
                if let Some(el) = self.last_focus.take() {
                    let _ = el.focus();
                }
            }
        }
        let slides = self.slides();
        let index = self.index(&slides);
        let id = index.map(|i| slides[i].id.clone());
        if id != self.last_slide {
            self.last_slide = id;
            self.resume_timer = None;
            for image in &self.preloads {
                let _ = image.remove_attribute("src");
            }
            self.preloads.clear();
            if let Some(i) = index {
                let link = ctx.link().clone();
                self.resume_timer = Some(Timeout::new(350, move || {
                    link.send_message(Msg::SaveResume)
                }));
                if slides[i].post.sensitive != Some(true)
                    || self.revealed.as_ref() == Some(&slides[i].id)
                {
                    for j in [i as i32 - 1, i as i32 + 1, i as i32 + 2] {
                        if let Some(slide) = slides
                            .get(j as usize)
                            .filter(|s| s.post.sensitive != Some(true))
                            && let Ok(image) = HtmlImageElement::new()
                        {
                            image.set_src(&slide.photo.url);
                            self.preloads.push(image);
                        }
                    }
                }
            }
        }
    }
    fn view(&self, ctx: &Context<Self>) -> Html {
        let slides = self.slides();
        let index = self.index(&slides);
        let slide = index.map(|i| slides[i].clone());
        let viewer = self.route.post_id.is_some();
        let account = self.route.username.clone().unwrap_or_default();
        let source_link = format!("https://x.com/{account}");
        html! {<>
          <header><a class="brand" href="#/" onclick={ctx.link().callback(|_|Msg::ClearMessage)}><img src="/tools/pictulane/icon.svg" alt=""/>{"pictulane"}</a><div class="header-actions"><select aria-label={self.t("language")} value={self.lang.clone()} onchange={ctx.link().callback(|e:Event|Msg::Language(e.target_unchecked_into::<HtmlSelectElement>().value()))}>{for ["ja","en","es","fr","de","ko","zh-Hans"].iter().map(|code|html!{<option value={code.to_string()} selected={*code==self.lang}>{self.copies["languages"][code].as_str().unwrap_or(code)}</option>})}</select><button onclick={ctx.link().callback(|_|Msg::Settings(true))}>{self.t("settings")}</button></div></header>
          {if !self.online{html!{<p class="banner" role="status">{self.t("offline")}</p>}}else{Html::default()}}
          {if self.save_failed{html!{<p class="banner" role="status">{self.t("savedFailure")}</p>}}else{Html::default()}}
          {if self.update.is_some(){html!{<p class="banner">{self.t("update")}{" "}<button onclick={ctx.link().callback(|_|Msg::ApplyUpdate)}>{self.t("apply")}</button></p>}}else{Html::default()}}
          <main hidden={viewer}>
            {if self.route.username.is_none(){html!{<section class="intro"><span class="eyebrow">{"pictulane / PHOTO VIEWER"}</span><h1>{self.t("tag")}</h1><p class="lead">{self.t("intro")}</p></section>}}else{html!{<section class="account-heading"><div><span class="eyebrow">{"ALBUM"}</span><h1>{format!("@{account}")}</h1></div><a href={source_link.clone()} target="_blank" rel="noreferrer">{self.t("profile")}{" ↗"}</a></section>}}}
            <form onsubmit={ctx.link().callback(|e:SubmitEvent|{e.prevent_default();Msg::Submit})}><label for="account">{self.t("account")}</label><div class="input-row"><span aria-hidden="true">{"@"}</span><input id="account" value={self.input.clone()} oninput={ctx.link().callback(|e:InputEvent|Msg::Input(e.target_unchecked_into::<HtmlInputElement>().value()))} autocapitalize="none" autocomplete="off" spellcheck="false" placeholder="username / https://x.com/username" maxlength="256" aria-invalid={self.invalid.to_string()} aria-describedby={self.invalid.then_some("input-error")}/><button class="primary" type="submit">{self.t("open")}{" "}<span aria-hidden="true">{"→"}</span></button></div>{if self.invalid{html!{<p id="input-error" role="alert">{self.t("invalid")}</p>}}else{Html::default()}}</form>
            {if self.route.invalid{html!{<p role="alert">{self.t("missing")}</p>}}else{Html::default()}}
            {if self.album.is_none()&&self.status!="loading"{self.notice(ctx)}else{Html::default()}}
            {if self.status=="loading"{html!{<p role="status">{self.t("loading")}</p>}}else{Html::default()}}
            {if self.route.username.is_some(){html!{<><div class="album-status"><span>{format!("{}: {}",self.t("acquired"),slides.len())}</span><span>{format!("{}: {}",self.t("fetched"),self.album.as_ref().map(|a|date(&a.fetched_at,&self.lang)).unwrap_or_else(||self.t("unknown")))}</span><span>{self.t(if self.album.as_ref().is_some_and(|a|a.range=="end"){"end"}else{"unavailable"})}</span></div>
              {if !slides.is_empty(){html!{<><div class="album-actions"><button class="primary" onclick={ctx.link().callback(|_|Msg::Open(0))}>{self.t("first")}</button>{if let Some(resume)=storage::resume(&account){let resume_index=slides.iter().position(|s|s.id==resume).unwrap_or(usize::MAX);html!{<button onclick={ctx.link().callback(move |_|Msg::Open(resume_index))}>{self.t("resume")}</button>}}else{Html::default()}}</div><div class="grid">{for slides.iter().enumerate().map(|(i,s)|html!{<button class="thumb" id={format!("photo-{}",s.id)} key={s.id.clone()} onclick={ctx.link().callback(move |_|Msg::Open(i))} aria-label={format!("{} · {} · {}/{}",i+1,s.photo.alt.as_deref().unwrap_or(&s.post.id),s.photo.position+1,s.total)}><img loading="lazy" decoding="async" src={if s.post.sensitive==Some(true){"/tools/pictulane/icon.svg".into()}else{s.photo.thumb.clone()}} alt={if s.post.sensitive==Some(true){self.t("sensitive")}else{s.photo.alt.clone().unwrap_or_default()}}/><span>{format!("{}/{}",s.photo.position+1,s.total)}</span></button>})}</div></>}}else{html!{<div class="empty"><span aria-hidden="true">{"▧"}</span><p>{self.t("empty")}</p></div>}}}</>}}else{Html::default()}}
            {if self.route.username.is_none()&&!self.recents.is_empty(){html!{<section class="recent"><h2>{self.t("recent")}</h2>{for self.recents.iter().map(|a|html!{<div key={a.clone()}><a href={route_url(a,None)}>{format!("@{a}")}</a>{if let Some(resume)=storage::resume(a){let (post,image)=resume.split_once(':').unwrap();html!{<a href={format!("#/{a}/status/{post}/media/{image}")}>{self.t("resume")}{" →"}</a>}}else{Html::default()}}</div>})}</section>}}else{Html::default()}}
            <footer><details><summary>{self.t("privacy")}</summary><p>{self.t("privacyText")}</p><p>{self.t("shortcuts")}</p></details><p>{"pictulane · Independent photo viewer"}</p></footer>
          </main>
          {if viewer{html!{<section class="viewer" aria-label={self.t("range")}><div class="viewer-bar"><button ref={self.close_button.clone()} onclick={ctx.link().callback(|_|Msg::Close)} aria-label={self.t("close")}>{"✕"}</button><span>{format!("@{account} ")}<small>{index.map(|i|format!("{} / {}",i+1,slides.len())).unwrap_or_default()}</small></span><button onclick={ctx.link().callback(|_|Msg::Settings(true))}>{self.t("settings")}</button></div>
            {if let Some(s)=slide{let image_id=s.id.clone();let loaded_id=s.id.clone();let failed_id=s.id.clone();html!{<>
              <div class="stage" onpointerdown={ctx.link().callback(Msg::PointerDown)} onpointerup={ctx.link().callback(Msg::PointerUp)} onpointercancel={ctx.link().callback(|_|Msg::PointerCancel)}>
                {if s.post.sensitive==Some(true)&&self.revealed.as_ref()!=Some(&s.id){html!{<div class="image-state"><p>{self.t("sensitive")}</p><button onclick={ctx.link().callback(|_|Msg::Reveal)}>{self.t("reveal")}</button></div>}}else{html!{<><img key={format!("{}-{}",s.id,self.retry)} class="main-image" data-image-id={image_id} src={s.photo.url.clone()} alt={s.photo.alt.clone().unwrap_or_else(||format!("@{} · {}/{}",s.post.author,s.photo.position+1,s.total))} onload={ctx.link().callback(move |_|Msg::Loaded(loaded_id.clone()))} onerror={ctx.link().callback(move |_|Msg::Failed(failed_id.clone()))}/>{if self.failed.as_ref()==Some(&s.id){html!{<div class="image-state"><p>{self.t("failed")}</p><button onclick={ctx.link().callback(|_|Msg::RetryImage)}>{self.t("retry")}</button></div>}}else if self.loaded.as_ref()!=Some(&s.id){html!{<span class="image-loading" role="status">{"…"}</span>}}else{Html::default()}}</>}}}
                <button class="arrow previous" onclick={ctx.link().callback(|_|Msg::Move(-1,false))} aria-label={self.t("prev")} disabled={index==Some(0)}>{"‹"}</button><button class="arrow next" onclick={ctx.link().callback(|_|Msg::Move(1,false))} aria-label={self.t("next")} disabled={index==Some(slides.len()-1)}>{"›"}</button>
              </div><div class="viewer-info"><div class="meta"><span>{format!("{} / {}",s.photo.position+1,s.total)}</span><span>{s.post.date.as_ref().map(|d|date(d,&self.lang)).unwrap_or_default()}</span><a href={format!("https://x.com/{}/status/{}",s.post.author,s.post.id)} target="_blank" rel="noreferrer">{self.t("post")}{" ↗"}</a><button onclick={ctx.link().callback(|_|Msg::Copy)}>{self.t("copy")}</button></div><details class="post-details"><summary>{self.t("details")}</summary><p>{s.post.text.clone().unwrap_or_default()}</p><p>{s.photo.alt.clone().unwrap_or_default()}</p></details><p class="range">{self.t("range")}{" · "}{self.t(if index==Some(0){"start"}else if index==Some(slides.len()-1){if self.album.as_ref().is_some_and(|a|a.range=="end"){"end"}else{"unavailable"}}else{"shortcuts"})}</p><p role="status" class="feedback">{self.message.clone()}</p></div></>}}else{html!{<div class="unresolved"><h1>{self.t("missing")}</h1><p>{self.t(if self.status=="loading"{"loading"}else{"blocked"})}</p><button onclick={ctx.link().callback(|_|Msg::Refresh)}>{self.t("retry")}</button><button onclick={ctx.link().callback(|_|Msg::Close)}>{self.t("list")}</button><a href={format!("{source_link}/status/{}",self.route.post_id.as_deref().unwrap_or_default())} target="_blank" rel="noreferrer">{self.t("post")}{" ↗"}</a></div>}}}
          </section>}}else{Html::default()}}
          <dialog ref={self.dialog.clone()} oncancel={ctx.link().callback(|e:Event|{e.prevent_default();Msg::Settings(false)})}><div class="dialog-heading"><h2>{self.t("settings")}</h2><button aria-label={self.t("close")} onclick={ctx.link().callback(|_|Msg::Settings(false))}>{"✕"}</button></div><label class="toggle"><input type="checkbox" checked={self.cache_enabled} onchange={ctx.link().callback(|e:Event|Msg::Cache(e.target_unchecked_into::<HtmlInputElement>().checked()))}/>{self.t("cache")}</label><p>{format!("{}: {}",self.t("cached"),self.cache_count.map(|n|n.to_string()).unwrap_or_else(||self.t("noCache")))}</p><div class="settings-actions"><button onclick={ctx.link().callback(|_|Msg::ClearCache)}>{self.t("clearCache")}</button><button onclick={ctx.link().callback(|_|Msg::ClearHistory)}>{self.t("clearHistory")}</button>{if self.install.is_some(){html!{<button onclick={ctx.link().callback(|_|Msg::Install)}>{self.t("install")}</button>}}else{Html::default()}}</div><p>{self.t("installHelp")}</p><p>{self.t("privacyText")}</p></dialog>
        </>}
    }
}
#[cfg(feature = "test-fixtures")]
fn fixture_album(account: &str) -> Album {
    let posts = if account == "empty" {
        vec![]
    } else {
        [
            ("900000000000000003", vec!["A1", "A2", "A3"]),
            ("900000000000000002", vec!["B1"]),
            ("900000000000000001", vec![]),
            ("900000000000000000", vec!["D1", "D2"]),
        ]
        .into_iter()
        .map(|(id, keys)| Post {
            id: id.into(),
            author: account.into(),
            date: Some("2026-09-18T00:00:00Z".into()),
            text: Some(format!("TEST ONLY {id} {}", "Long text. ".repeat(80))),
            sensitive: None,
            repost: None,
            images: keys
                .into_iter()
                .enumerate()
                .map(|(position, key)| Photo {
                    key: key.into(),
                    position: position as u8,
                    url: format!(
                        "https://pbs.twimg.com/media/PICTULANE_TEST_{key}?format=png&name=large"
                    ),
                    thumb: format!(
                        "https://pbs.twimg.com/media/PICTULANE_TEST_{key}?format=png&name=small"
                    ),
                    alt: Some(format!("Test photo {key}")),
                })
                .collect(),
        })
        .collect()
    };
    Album {
        version: 1,
        username: account.into(),
        user_id: None,
        fetched_at: js_sys::Date::new_0().to_iso_string().as_string().unwrap(),
        posts,
        range: if account == "limited" {
            "unavailable"
        } else {
            "end"
        }
        .into(),
    }
}
#[wasm_bindgen::prelude::wasm_bindgen(start)]
pub fn start() {
    yew::Renderer::<App>::with_root(document().get_element_by_id("root").unwrap()).render();
}
