mod view;
use super::{
    cards::{self, FormSelect, PokemonCard, TypePill},
    icons::{icon, icon_class, icon_filled},
    locale::{self, Language, Species},
    metadata,
    scene_editor::SceneEditor,
};
use crate::{
    browser,
    core::{
        catalog, forms, locales, previews,
        routes::{self, AtlasPage},
        scene_link,
        scene_studio::{self, CameraPose, MAX_SCENES, SavedScene, SceneMember, StudioState},
        seo,
        types::{HABITATS, Pokemon, ViewerSettings, habitat_name, is_habitat},
    },
    viewer::{ModelRequest, Viewer, ViewerHandle},
};
use gloo_events::EventListener;
use std::{cell::RefCell, collections::HashSet, rc::Rc};
use wasm_bindgen::{JsCast, JsValue};
use wasm_bindgen_futures::spawn_local;
use yew::prelude::*;

#[derive(Properties, PartialEq)]
pub struct Props {
    pub initial_language: Language,
}
#[derive(Clone)]
pub enum Msg {
    Text(&'static str, String),
    Setting(&'static str, String),
    Toggle(&'static str),
    Choose(u16),
    Form(String),
    Move(i32),
    Clear,
    More,
    Dialog(Option<String>),
    Notice(String),
    Language(String, bool),
    LanguageReady(u64, Result<Language, ()>),
    RetryLanguage,
    Favorite,
    Solo,
    Together,
    Members(Vec<SceneMember>),
    SceneName(String),
    Save,
    Open(SavedScene),
    Delete(String),
    Download,
    Import(web_sys::File),
    Imported(Result<SavedScene, String>),
    Share,
    View(String),
    Zoom(f64),
    Capture,
    Camera(CameraPose),
    Loaded(Vec<String>),
    Loading(bool),
    Error(String),
    Retry,
    Key(KeyboardEvent),
    Location,
    Online,
    InstallPrompt(JsValue),
    Install,
    Background(String),
    BackgroundReady(u64, Result<Option<String>, ()>),
    BackgroundFailed,
    RemoveBackground,
    RetryBackground,
    Persist,
    NeedRefresh(bool),
    ApplyUpdate,
    CacheOpened,
    Installed,
    Refresh,
}
pub struct App {
    language: Language,
    language_request: u64,
    language_persist: bool,
    language_status: String,
    pending_language: Option<String>,
    query: String,
    generation: u8,
    pokemon_type: String,
    form_kind: String,
    language_query: String,
    selected: u16,
    form_id: String,
    page_home: bool,
    favorites: HashSet<u16>,
    saved_only: bool,
    limit: usize,
    studio: StudioState,
    settings: ViewerSettings,
    default_settings: ViewerSettings,
    storage_failed: bool,
    animations: Vec<String>,
    loading: bool,
    error: String,
    reload: u64,
    tab: String,
    dialog: Option<String>,
    notice: String,
    offline: bool,
    mobile_collection: bool,
    focus: bool,
    install: Option<JsValue>,
    background_url: Option<String>,
    background_failed: bool,
    background_request: u64,
    loaded_background: Option<String>,
    loaded_habitat: String,
    pending_camera: Option<CameraPose>,
    handle: Rc<RefCell<Option<ViewerHandle>>>,
    modal: NodeRef,
    events: Vec<EventListener>,
    notice_timer: Option<gloo_timers::callback::Timeout>,
    need_refresh: bool,
    persist_pending: bool,
}
impl App {
    fn together(&self) -> bool {
        self.studio.active && self.studio.draft.is_some()
    }
    fn selected(&self) -> &'static Pokemon {
        catalog::pokemon_by_id(self.selected).unwrap_or(&catalog::pokemon()[5])
    }
    fn form(&self) -> Option<&'static forms::PokemonForm> {
        forms::find_form(self.selected, Some(&self.form_id))
    }
    fn model(&self) -> Option<&'static crate::core::types::ModelEntry> {
        forms::model_for(self.selected, Some(&self.form_id))
    }
    fn page(&self) -> AtlasPage {
        if self.together() || self.page_home {
            AtlasPage::Home
        } else {
            AtlasPage::Pokemon {
                id: self.selected,
                form_id: (!self.form_id.is_empty()).then(|| self.form_id.clone()),
            }
        }
    }
    fn details(&self) -> Species {
        let mut details = self.language.species(self.selected());
        if let Some(form) = self.form() {
            details.entry.name = form
                .names
                .get(&self.language.locale)
                .cloned()
                .unwrap_or_else(|| {
                    format!(
                        "{} ({})",
                        details.entry.name,
                        forms::form_label(form, |s| self.language.t(s))
                    )
                });
            if form.names.contains_key(&self.language.locale) {
                details.name_lang = self.language.locale.clone();
            }
        }
        details
    }
    fn filter(&self) -> Vec<&'static Pokemon> {
        let favorites = self.saved_only.then_some(&self.favorites);
        let matched: HashSet<u16> =
            catalog::filter_pokemon(&self.query, self.generation, "", favorites)
                .iter()
                .map(|p| p.id)
                .collect();
        catalog::filter_pokemon("", self.generation, "", favorites)
            .into_iter()
            .filter(|entry| {
                let alternatives = forms::forms_for(entry.id);
                let check = |form: &&forms::PokemonForm| {
                    (matched.contains(&entry.id)
                        || self.query.trim().is_empty()
                        || self.form_matches(form))
                        && (self.pokemon_type.is_empty() || form.types.contains(&self.pokemon_type))
                };
                if !self.form_kind.is_empty() {
                    alternatives
                        .iter()
                        .filter(|f| f.kind == self.form_kind)
                        .any(check)
                } else {
                    (matched.contains(&entry.id)
                        && (self.pokemon_type.is_empty()
                            || entry.types.contains(&self.pokemon_type)))
                        || (!self.query.trim().is_empty()
                            && alternatives.iter().any(|f| {
                                self.form_matches(f)
                                    && (self.pokemon_type.is_empty()
                                        || f.types.contains(&self.pokemon_type))
                            }))
                }
            })
            .collect()
    }
    fn form_matches(&self, form: &forms::PokemonForm) -> bool {
        let names = form
            .names
            .values()
            .cloned()
            .chain(std::iter::once(form.name.clone()))
            .collect::<Vec<_>>()
            .join(" ");
        self.query.trim().is_empty()
            || locales::normalize_search(&names).contains(&locales::normalize_search(&self.query))
    }
    fn form_choice(&self, entry: &Pokemon) -> Option<&'static forms::PokemonForm> {
        let base = catalog::filter_pokemon(&self.query, 0, "", None)
            .iter()
            .any(|p| p.id == entry.id);
        if self.form_kind.is_empty()
            && base
            && (self.pokemon_type.is_empty() || entry.types.contains(&self.pokemon_type))
        {
            return None;
        }
        forms::forms_for(entry.id).into_iter().find(|form| {
            (self.form_kind.is_empty() || form.kind == self.form_kind)
                && (self.pokemon_type.is_empty() || form.types.contains(&self.pokemon_type))
                && (base || self.form_matches(form))
        })
    }
    fn neighbor(&self, direction: i32) -> u16 {
        let mut entries = self.filter();
        if entries.is_empty() {
            entries = catalog::pokemon().iter().collect()
        }
        let index = entries
            .iter()
            .position(|p| p.id == self.selected)
            .map(|i| (i as i32 + direction).rem_euclid(entries.len() as i32) as usize)
            .unwrap_or(if direction > 0 { 0 } else { entries.len() - 1 });
        entries[index].id
    }
    fn choose(&mut self, id: u16) {
        let Some(entry) = catalog::pokemon_by_id(id) else {
            return;
        };
        let form = self
            .form_choice(entry)
            .map(|f| f.id.clone())
            .unwrap_or_default();
        self.page_home = false;
        self.mobile_collection = false;
        if self.selected == id && self.form_id == form {
            return;
        }
        self.selected = id;
        self.form_id = form;
        if !self.together() {
            self.animations.clear();
            self.error.clear();
            self.loading = true;
            self.settings.shiny = false;
            self.settings.animation = 0;
        }
    }
    fn notice(&mut self, ctx: &Context<Self>, message: String) {
        self.notice = message;
        self.notice_timer = None;
        if self.notice.is_empty() {
            return;
        }
        let link = ctx.link().clone();
        self.notice_timer = Some(gloo_timers::callback::Timeout::new(4000, move || {
            link.send_message(Msg::Notice(String::new()))
        }));
    }
    fn snapshot(&self) -> Option<SavedScene> {
        if !self.together() {
            return None;
        }
        let mut scene = self.studio.draft.clone()?;
        scene.name = if scene.name.trim().is_empty() {
            self.language.t("Your scene")
        } else {
            scene.name.trim().into()
        };
        scene.settings = self.settings.clone();
        if !self.loading {
            scene.camera = self
                .handle
                .borrow()
                .as_ref()
                .and_then(|h| h.get_camera())
                .or(scene.camera);
        }
        scene_studio::parse_scene(&serde_json::to_value(scene).ok()?)
    }
    fn persist(&mut self) {
        if self.studio.draft.is_none() && self.studio.saved.is_empty() {
            return;
        }
        let mut state = self.studio.clone();
        if state.active
            && let Some(draft) = state.draft.as_mut()
        {
            draft.settings = self.settings.clone();
            if draft.name.trim().is_empty() {
                draft.name = self.language.t("Your scene")
            }
        }
        let existing = browser::stored(scene_studio::STORAGE_KEY);
        self.storage_failed = scene_studio::studio_write(existing.as_deref(), &state)
            .is_none_or(|text| !browser::store(scene_studio::STORAGE_KEY, &text));
    }
    fn open(&mut self, scene: SavedScene) {
        let identity = |members: &[SceneMember]| {
            members
                .iter()
                .map(|m| (&m.key, m.species_id, m.shiny, &m.form_id))
                .map(|(k, id, s, f)| format!("{k}:{id}:{s}:{f:?}"))
                .collect::<Vec<_>>()
        };
        let needs = !self.together()
            || self
                .studio
                .draft
                .as_ref()
                .is_none_or(|d| identity(&d.members) != identity(&scene.members));
        self.pending_camera = if needs { scene.camera.clone() } else { None };
        self.settings = scene.settings.clone();
        self.settings.playing &= self.default_settings.playing;
        self.studio.active = true;
        self.studio.draft = Some(scene.clone());
        if !needs && let Some(camera) = scene.camera {
            let handle = self.handle.clone();
            browser::after_frame(move || {
                browser::after_frame(move || {
                    if let Some(viewer) = handle.borrow().as_ref() {
                        viewer.restore_camera(camera);
                    }
                })
            });
        }
    }
    fn background(&mut self, ctx: &Context<Self>) {
        self.background_request += 1;
        let id = self.settings.background_id.clone();
        self.loaded_background = id.clone();
        self.loaded_habitat = self.settings.habitat.clone();
        ctx.link().send_message(Msg::Refresh);
        if let Some(url) = self.background_url.take() {
            let _ = web_sys::Url::revoke_object_url(&url);
        }
        self.background_failed = false;
        let Some(id) = id else {
            if self.settings.habitat == "custom" {
                self.settings.habitat = "studio".into()
            }
            return;
        };
        let epoch = self.background_request;
        let link = ctx.link().clone();
        spawn_local(async move {
            let result = crate::platform::background::load_background(&id)
                .await
                .map(|value| value.map(|v| v.url))
                .map_err(|_| ());
            link.send_message(Msg::BackgroundReady(epoch, result));
        });
    }
    fn request_language(&mut self, ctx: &Context<Self>, code: String, persist: bool) {
        self.language_request += 1;
        self.language_persist = persist;
        let epoch = self.language_request;
        self.language_status = "loading".into();
        self.pending_language = Some(code.clone());
        let link = ctx.link().clone();
        spawn_local(async move {
            let result = locale::prepare(&code).await.map_err(|_| ());
            link.send_message(Msg::LanguageReady(epoch, result));
        });
    }
    fn sync(&self) {
        self.language.apply();
        let hash = web_sys::UrlSearchParams::new().unwrap();
        hash.set("pokemon", &self.selected.to_string());
        hash.set("scene", &self.settings.habitat);
        if self.settings.shiny {
            hash.set("shiny", "1")
        }
        if !self.form_id.is_empty() {
            hash.set("form", &self.form_id)
        }
        if self.together() {
            hash.set("view", "together");
            if let Some(mut draft) = self.studio.draft.clone() {
                draft.settings = self.settings.clone();
                if let Some(token) = scene_link::encode_scene_link(&draft) {
                    hash.set("layout", &token)
                }
            }
        }
        if let Ok(url) = web_sys::Url::new_with_base(
            &routes::ui_href(&self.page(), &self.language.locale),
            &browser::window().location().origin().unwrap_or_default(),
        ) {
            if browser::query().get("privacy").as_deref() == Some("1") {
                url.search_params().set("privacy", "1")
            }
            url.set_hash(&hash.to_string().as_string().unwrap_or_default());
            let _ = browser::window().history().and_then(|h| {
                h.replace_state_with_url(
                    &JsValue::NULL,
                    "",
                    Some(&format!("{}{}{}", url.pathname(), url.search(), url.hash())),
                )
            });
        }
        if self.language.catalog_status == "ready" {
            let _ = metadata::apply(&self.seo());
        }
    }
    fn seo(&self) -> seo::PageSeo {
        if matches!(self.page(), AtlasPage::Home) {
            return seo::build_index_seo(
                &AtlasPage::Home,
                &self.language.locale,
                &Default::default(),
            );
        }
        let displayed = forms::form_pokemon(self.selected(), self.form());
        let details = self.details();
        let mut input =
            seo::PokemonSeoInput::new(&displayed, details.entry.name, &self.language.locale);
        input.localized.description = Some(details.entry.description);
        input.form = self.form().map(|f| seo::SeoForm {
            id: f.id.clone(),
            name: Some(f.name.clone()),
        });
        input.base_name = Some(self.language.species(self.selected()).entry.name);
        input.type_names = Some(
            displayed
                .types
                .iter()
                .map(|kind| self.language.type_name(kind))
                .collect(),
        );
        input.image = Some(previews::preview_image(
            self.selected,
            self.form().map(|f| f.id.as_str()),
        ));
        input.og_image = input.image.clone();
        seo::build_pokemon_seo(&input)
    }
    fn click(ctx: &Context<Self>, message: Msg) -> Callback<MouseEvent> {
        ctx.link().callback(move |_| message.clone())
    }
    fn input(ctx: &Context<Self>, name: &'static str) -> Callback<InputEvent> {
        ctx.link().callback(move |event: InputEvent| {
            Msg::Text(
                name,
                event
                    .target_unchecked_into::<web_sys::HtmlInputElement>()
                    .value(),
            )
        })
    }
    fn select(ctx: &Context<Self>, name: &'static str) -> Callback<Event> {
        ctx.link().callback(move |event: Event| {
            Msg::Text(
                name,
                event
                    .target_unchecked_into::<web_sys::HtmlSelectElement>()
                    .value(),
            )
        })
    }
    fn setting(ctx: &Context<Self>, name: &'static str) -> Callback<InputEvent> {
        ctx.link().callback(move |event: InputEvent| {
            Msg::Setting(
                name,
                event
                    .target_unchecked_into::<web_sys::HtmlInputElement>()
                    .value(),
            )
        })
    }
}
impl Component for App {
    type Message = Msg;
    type Properties = Props;
    fn create(ctx: &Context<Self>) -> Self {
        let hash = browser::hash();
        let route =
            routes::parse_atlas_route(&browser::window().location().pathname().unwrap_or_default());
        let id = route
            .as_ref()
            .and_then(|r| {
                if let AtlasPage::Pokemon { id, .. } = r.page {
                    Some(id)
                } else {
                    None
                }
            })
            .or_else(|| hash.get("pokemon").and_then(|v| v.parse().ok()))
            .filter(|id| catalog::pokemon_by_id(*id).is_some())
            .unwrap_or(6);
        let raw_form = route
            .as_ref()
            .and_then(|r| {
                if let AtlasPage::Pokemon { form_id, .. } = &r.page {
                    form_id.clone()
                } else {
                    None
                }
            })
            .or_else(|| hash.get("form"));
        let form_id = forms::find_form(id, raw_form.as_deref())
            .map(|f| f.id.clone())
            .unwrap_or_default();
        let default_settings = ViewerSettings {
            playing: !browser::media("(prefers-reduced-motion: reduce)"),
            ..ViewerSettings::default()
        };
        let mut studio =
            scene_studio::read_studio(browser::stored(scene_studio::STORAGE_KEY).as_deref());
        let mut same_local = false;
        let incoming = if hash.get("view").as_deref() == Some("together") {
            let token = hash.get("layout");
            let shared = scene_link::decode_scene_link(token.as_deref());
            same_local = studio.active
                && studio
                    .draft
                    .as_ref()
                    .zip(shared.as_ref())
                    .is_some_and(|(local, shared)| scene_link::matches_shared_scene(local, shared));
            if same_local {
                studio.draft.clone()
            } else {
                shared
            }
        } else {
            None
        };
        let invalid = hash.has("layout") && incoming.is_none();
        if let Some(mut scene) = incoming {
            if !same_local {
                scene.name = ctx.props().initial_language.t("Your scene");
            }
            studio.active = true;
            studio.draft = Some(scene)
        } else if hash.has("layout") {
            studio.active = false
        } else {
            let explicit = hash.has("pokemon")
                || route
                    .as_ref()
                    .is_some_and(|r| matches!(r.page, AtlasPage::Pokemon { .. }));
            studio.active = if hash.get("view").as_deref() == Some("together") {
                studio.draft.is_some()
            } else if explicit {
                false
            } else {
                studio.active
            };
        }
        let mut settings = if studio.active {
            studio
                .draft
                .as_ref()
                .map(|s| s.settings.clone())
                .unwrap_or_default()
        } else {
            let mut s = default_settings.clone();
            s.habitat = hash
                .get("scene")
                .filter(|v| is_habitat(v))
                .unwrap_or_else(|| "studio".into());
            s.shiny = hash.get("shiny").as_deref() == Some("1")
                && forms::model_for(id, Some(&form_id)).is_some_and(|m| m.shiny.is_some());
            s.background_id = browser::stored("atlas-background").filter(|id| {
                id.len() == 36 && id.chars().all(|c| c.is_ascii_hexdigit() || c == '-')
            });
            s
        };
        settings.playing &= default_settings.playing;
        let mut events = vec![];
        let link = ctx.link().clone();
        events.push(EventListener::new_with_options(
            &browser::window(),
            "keydown",
            gloo_events::EventListenerOptions::enable_prevent_default(),
            move |event| {
                if let Some(event) = event.dyn_ref::<KeyboardEvent>() {
                    let editable = event
                        .target()
                        .and_then(|target| target.dyn_into::<web_sys::Element>().ok())
                        .is_some_and(|element| {
                            ["INPUT", "SELECT", "TEXTAREA", "BUTTON"]
                                .contains(&element.tag_name().as_str())
                                || element.has_attribute("contenteditable")
                        });
                    let modal = browser::document()
                        .query_selector("dialog[open]")
                        .ok()
                        .flatten()
                        .is_some();
                    if !editable
                        && !modal
                        && (["/", "ArrowLeft", "ArrowRight"].contains(&event.key().as_str())
                            || event.code() == "Space")
                    {
                        event.prevent_default();
                    }
                    link.send_message(Msg::Key(event.clone()));
                }
            },
        ));
        for name in ["hashchange", "popstate"] {
            let link = ctx.link().clone();
            events.push(EventListener::new(&browser::window(), name, move |_| {
                link.send_message(Msg::Location)
            }));
        }
        for name in ["online", "offline"] {
            let link = ctx.link().clone();
            events.push(EventListener::new(&browser::window(), name, move |_| {
                link.send_message(Msg::Online)
            }));
        }
        let link = ctx.link().clone();
        events.push(EventListener::new_with_options(
            &browser::window(),
            "beforeinstallprompt",
            gloo_events::EventListenerOptions::enable_prevent_default(),
            move |event| {
                event.prevent_default();
                link.send_message(Msg::InstallPrompt(event.clone().into()))
            },
        ));
        let link = ctx.link().clone();
        events.push(EventListener::new(
            &browser::window(),
            "pagehide",
            move |_| link.send_message(Msg::Persist),
        ));
        let link = ctx.link().clone();
        events.push(EventListener::new(
            &browser::document(),
            "visibilitychange",
            move |_| {
                if browser::document().hidden() {
                    link.send_message(Msg::Persist)
                }
            },
        ));
        let link = ctx.link().clone();
        let worker = browser::get(browser::window().navigator().as_ref(), "serviceWorker");
        if let Some(target) = worker.dyn_ref::<web_sys::EventTarget>() {
            events.push(EventListener::new(target, "controllerchange", move |_| {
                link.send_message(Msg::CacheOpened)
            }));
        }
        let link = ctx.link().clone();
        events.push(EventListener::new(
            &browser::window(),
            "appinstalled",
            move |_| link.send_message(Msg::Installed),
        ));
        if let Ok(Some(media)) = browser::window().match_media("(max-width: 700px)") {
            let link = ctx.link().clone();
            events.push(EventListener::new(&media, "change", move |_| {
                link.send_message(Msg::Text("close-mobile", String::new()))
            }));
        }
        let pending_camera = if studio.active {
            studio.draft.as_ref().and_then(|s| s.camera.clone())
        } else {
            None
        };
        Self {
            language: ctx.props().initial_language.clone(),
            language_request: 0,
            language_persist: false,
            language_status: "ready".into(),
            pending_language: None,
            query: String::new(),
            generation: 0,
            pokemon_type: String::new(),
            form_kind: String::new(),
            language_query: String::new(),
            selected: id,
            form_id,
            page_home: route.is_some_and(|r| matches!(r.page, AtlasPage::Home)),
            favorites: catalog::parse_favorites(browser::stored("atlas-favorites").as_deref()),
            saved_only: false,
            limit: 40,
            studio,
            settings,
            default_settings,
            storage_failed: false,
            animations: vec![],
            loading: true,
            error: String::new(),
            reload: 0,
            tab: "overview".into(),
            dialog: None,
            notice: if invalid {
                "Preview unavailable".into()
            } else {
                String::new()
            },
            offline: !browser::window().navigator().on_line(),
            mobile_collection: false,
            focus: false,
            install: None,
            background_url: None,
            background_failed: false,
            background_request: 0,
            loaded_background: None,
            loaded_habitat: String::new(),
            pending_camera,
            handle: Rc::new(RefCell::new(None)),
            modal: NodeRef::default(),
            events,
            notice_timer: None,
            need_refresh: false,
            persist_pending: false,
        }
    }
    fn rendered(&mut self, ctx: &Context<Self>, first: bool) {
        if first && !self.notice.is_empty() {
            self.notice(ctx, self.notice.clone());
        }
        self.sync();
        self.need_refresh = crate::platform::sw::register_deferred(
            !self.loading || !self.error.is_empty(),
            ctx.link().callback(Msg::NeedRefresh),
            Callback::from(|_| {
                let _ = browser::window().location().reload();
            }),
        );
        if first
            && (browser::media("(display-mode: standalone)")
                || browser::get(browser::window().navigator().as_ref(), "standalone").as_bool()
                    == Some(true))
        {
            spawn_local(crate::platform::cache::retain_installed_storage());
        }
        if first
            || self.loaded_background != self.settings.background_id
            || self.loaded_habitat != self.settings.habitat
        {
            self.background(ctx);
        }
        if let Some(dialog) = self.modal.cast::<web_sys::HtmlDialogElement>() {
            if self.dialog.is_some() && !dialog.open() {
                let _ = dialog.show_modal();
                if self.dialog.as_deref() == Some("language") {
                    browser::after_frame(|| browser::focus(".language-dialog input"));
                }
            } else if self.dialog.is_none() && dialog.open() {
                dialog.close();
            }
        }
        if self.persist_pending {
            self.persist_pending = false;
            let previous = self.storage_failed;
            self.persist();
            if previous != self.storage_failed {
                ctx.link().send_message(Msg::Refresh);
            }
        }
    }
    fn update(&mut self, ctx: &Context<Self>, message: Msg) -> bool {
        if matches!(message, Msg::Refresh) {
            return true;
        }
        self.persist_pending = true;
        match message {
            Msg::Text(field, value) => match field {
                "close-mobile" => self.mobile_collection = false,
                "query" => {
                    self.query = value;
                    self.limit = 40
                }
                "generation" => {
                    self.generation = value.parse().unwrap_or(0);
                    self.limit = 40
                }
                "type" => {
                    self.pokemon_type = value;
                    self.limit = 40
                }
                "forms" => {
                    self.form_kind = value;
                    self.limit = 40
                }
                "language-query" => self.language_query = value,
                "tab" => self.tab = value,
                _ => (),
            },
            Msg::Setting(field, value) => match field {
                "speed" => self.settings.speed = value.parse().unwrap_or(1.),
                "light" => self.settings.light = value.parse().unwrap_or(1.),
                "quality" => self.settings.quality = value,
                "animation" => self.settings.animation = value.parse().unwrap_or(0),
                "habitat" => self.settings.habitat = value,
                _ => (),
            },
            Msg::Toggle(field) => match field {
                "playing" => self.settings.playing = !self.settings.playing,
                "rotate" => self.settings.rotate = !self.settings.rotate,
                "wireframe" => self.settings.wireframe = !self.settings.wireframe,
                "shiny" => {
                    self.settings.shiny = !self.settings.shiny;
                    self.settings.animation = 0;
                    self.loading = true
                }
                "focus" => self.focus = !self.focus,
                "mobile" => self.mobile_collection = !self.mobile_collection,
                "collection" => {
                    self.saved_only = true;
                    self.limit = 40;
                    self.mobile_collection = true
                }
                "browse" => {
                    self.saved_only = false;
                    self.mobile_collection = true
                }
                "reset" => {
                    self.settings = self.default_settings.clone();
                    if let Some(h) = self.handle.borrow().as_ref() {
                        h.view("reset");
                    }
                }
                _ => (),
            },
            Msg::Choose(id) => self.choose(id),
            Msg::Move(direction) => self.choose(self.neighbor(direction)),
            Msg::Form(form) => {
                self.page_home = false;
                self.form_id = form;
                self.loading = true;
                self.error.clear();
                self.animations.clear();
                self.settings.shiny &= self.model().is_some_and(|m| m.shiny.is_some());
                self.settings.animation = 0;
            }
            Msg::Clear => {
                self.query.clear();
                self.generation = 0;
                self.pokemon_type.clear();
                self.form_kind.clear();
                self.saved_only = false;
                self.limit = 40
            }
            Msg::More => self.limit += 40,
            Msg::Dialog(dialog) => {
                self.dialog = dialog;
                if self.dialog.as_deref() == Some("language") {
                    self.language_query.clear();
                }
            }
            Msg::Notice(message) => self.notice(ctx, message),
            Msg::Language(code, persist) => self.request_language(ctx, code, persist),
            Msg::RetryLanguage => {
                let code = self
                    .pending_language
                    .clone()
                    .unwrap_or_else(|| self.language.locale.clone());
                self.request_language(ctx, code, true)
            }
            Msg::LanguageReady(epoch, result) => {
                if epoch != self.language_request {
                    return false;
                }
                match result {
                    Ok(language) => {
                        self.language = language;
                        self.language_status = "ready".into();
                        self.pending_language = None;
                        if self.language_persist {
                            browser::store("atlas-language", &self.language.locale);
                        }
                        self.dialog = None;
                    }
                    Err(_) => self.language_status = "failed".into(),
                }
            }
            Msg::Favorite => {
                if !self.favorites.remove(&self.selected) {
                    self.favorites.insert(self.selected);
                }
                if !browser::store(
                    "atlas-favorites",
                    &serde_json::to_string(&self.favorites).unwrap(),
                ) {
                    self.notice(
                        ctx,
                        "Saved for this visit. Your browser could not store this collection."
                            .into(),
                    );
                }
            }
            Msg::Solo => {
                if let Some(scene) = self.snapshot() {
                    self.studio.draft = Some(scene)
                }
                self.studio.active = false;
                self.pending_camera = None;
                self.settings.shiny = false;
                self.settings.animation = 0;
            }
            Msg::Together => {
                if self.together() {
                    return false;
                }
                self.tab = "studio".into();
                let draft = self.studio.draft.clone().unwrap_or_else(|| SavedScene {
                    id: browser::uuid(),
                    name: self.language.t("Your scene"),
                    members: vec![SceneMember {
                        key: browser::uuid(),
                        species_id: self.selected,
                        form_id: (!self.form_id.is_empty()).then(|| self.form_id.clone()),
                        shiny: self.settings.shiny
                            && self.model().is_some_and(|m| m.shiny.is_some()),
                        x: 0.,
                        z: 0.,
                        rotation: 0.,
                        scale: 1.,
                    }],
                    settings: self.settings.clone(),
                    camera: None,
                });
                self.open(draft);
            }
            Msg::Members(members) => {
                if let Some(scene) = self.studio.draft.as_mut() {
                    scene.members = members
                }
            }
            Msg::SceneName(name) => {
                if let Some(scene) = self.studio.draft.as_mut() {
                    scene.name = name
                }
            }
            Msg::Save => {
                let Some(mut draft) = self.snapshot() else {
                    return false;
                };
                let existing = self.studio.saved.iter().position(|s| s.name == draft.name);
                if existing.is_none() && self.studio.saved.len() >= MAX_SCENES {
                    self.notice(
                        ctx,
                        self.language.tv(
                            "You can save up to {count} scenes.",
                            &[("count", self.language.number(MAX_SCENES as f64))],
                        ),
                    );
                    return true;
                }
                draft.id = existing
                    .map(|i| self.studio.saved[i].id.clone())
                    .unwrap_or_else(browser::uuid);
                if let Some(index) = existing {
                    self.studio.saved[index] = draft.clone()
                } else {
                    self.studio.saved.push(draft.clone())
                }
                self.studio.draft = Some(draft);
                self.persist();
                self.notice(
                    ctx,
                    if self.storage_failed {
                        "This scene could not be saved on this device."
                    } else {
                        "Scene saved on this device."
                    }
                    .into(),
                );
            }
            Msg::Open(scene) => self.open(scene),
            Msg::Delete(id) => self.studio.saved.retain(|s| s.id != id),
            Msg::Download => {
                if let Some(scene) = self.snapshot() {
                    let link = ctx.link().clone();
                    spawn_local(async move {
                        match crate::platform::files::export_scene(&scene).await {
                            Ok(text) => {
                                let parts = js_sys::Array::new();
                                parts.push(&text.into());
                                let options = web_sys::BlobPropertyBag::new();
                                options.set_type("application/json");
                                if let Ok(blob) = web_sys::Blob::new_with_str_sequence_and_options(
                                    &parts, &options,
                                ) && let Ok(url) =
                                    web_sys::Url::create_object_url_with_blob(&blob)
                                {
                                    if let Ok(element) = browser::document().create_element("a") {
                                        let _ = element.set_attribute("href", &url);
                                        let _ = element
                                            .set_attribute("download", "pokemon-atlas-scene.json");
                                        let _ = browser::call(&element.into(), "click", &[]);
                                    }
                                    gloo_timers::callback::Timeout::new(1000, move || {
                                        let _ = web_sys::Url::revoke_object_url(&url);
                                    })
                                    .forget();
                                }
                            }
                            Err(_) => link.send_message(Msg::Notice(
                                "This scene could not be downloaded.".into(),
                            )),
                        }
                    });
                }
            }
            Msg::Import(file) => {
                let link = ctx.link().clone();
                spawn_local(async move {
                    link.send_message(Msg::Imported(
                        crate::platform::files::read_scene_file(file).await,
                    ));
                });
            }
            Msg::Imported(result) => match result {
                Ok(scene) => {
                    self.open(scene);
                    self.notice(ctx, "Scene imported.".into());
                }
                Err(_) => self.notice(ctx, "This scene file could not be opened.".into()),
            },
            Msg::Share => {
                let Ok(url) =
                    web_sys::Url::new(&browser::window().location().href().unwrap_or_default())
                else {
                    return false;
                };
                let hash =
                    web_sys::UrlSearchParams::new_with_str(url.hash().trim_start_matches('#'))
                        .unwrap();
                if self.together() {
                    let token = self
                        .snapshot()
                        .and_then(|s| scene_link::encode_scene_link(&s));
                    let Some(token) = token else {
                        self.notice(ctx, "Preview unavailable".into());
                        return true;
                    };
                    hash.set("view", "together");
                    hash.set("layout", &token);
                }
                if self.settings.habitat == "custom" {
                    hash.set("scene", "studio");
                }
                url.set_hash(&hash.to_string().as_string().unwrap_or_default());
                if self.together() {
                    let _ = browser::window().history().and_then(|h| {
                        h.replace_state_with_url(&JsValue::NULL, "", Some(&url.href()))
                    });
                }
                let link = ctx.link().clone();
                spawn_local(async move {
                    let result = browser::call(
                        &browser::get(browser::window().navigator().as_ref(), "clipboard"),
                        "writeText",
                        &[url.href().into()],
                    );
                    let success = match result {
                        Ok(value) => browser::promise(value).await.is_ok(),
                        Err(_) => false,
                    };
                    link.send_message(Msg::Notice(
                        if success {
                            "Link copied."
                        } else {
                            "Copy the address from your browser to share this Pokémon."
                        }
                        .into(),
                    ));
                });
            }
            Msg::View(angle) => {
                if let Some(handle) = self.handle.borrow().as_ref() {
                    handle.view(&angle);
                }
            }
            Msg::Zoom(direction) => {
                if let Some(handle) = self.handle.borrow().as_ref() {
                    handle.zoom(direction);
                }
            }
            Msg::Capture => {
                let handle = self.handle.borrow().clone();
                let link = ctx.link().clone();
                spawn_local(async move {
                    let success = if let Some(handle) = handle {
                        handle.capture().await.is_ok()
                    } else {
                        false
                    };
                    link.send_message(Msg::Notice(
                        if success {
                            "Your studio image is ready."
                        } else {
                            "The image could not be saved. Please try again."
                        }
                        .into(),
                    ));
                });
            }
            Msg::Camera(camera) => {
                if self.together()
                    && !self.loading
                    && let Some(scene) = self.studio.draft.as_mut()
                {
                    scene.camera = Some(camera)
                }
            }
            Msg::Loaded(names) => {
                self.animations = names;
                self.error.clear();
            }
            Msg::Loading(loading) => {
                self.loading = loading;
                if loading {
                    self.error.clear();
                } else {
                    if let Some(camera) = self.pending_camera.take()
                        && let Some(handle) = self.handle.borrow().as_ref()
                    {
                        handle.restore_camera(camera);
                    }
                    if self.together() {
                        let camera = self.handle.borrow().as_ref().and_then(|h| h.get_camera());
                        if let (Some(scene), Some(camera)) = (self.studio.draft.as_mut(), camera) {
                            scene.camera = Some(camera);
                        }
                    }
                }
            }
            Msg::Error(error) => {
                self.error = error;
                self.animations.clear();
                self.loading = false
            }
            Msg::Retry => {
                self.error.clear();
                self.loading = true;
                self.reload += 1;
            }
            Msg::Key(event) => {
                if event.key() == "Escape" {
                    self.focus = false;
                    self.mobile_collection = false;
                }
                let tag = event
                    .target()
                    .and_then(|t| t.dyn_into::<web_sys::Element>().ok())
                    .map(|e| e.tag_name())
                    .unwrap_or_default();
                if self.dialog.is_some()
                    || ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].contains(&tag.as_str())
                {
                    return true;
                }
                match event.key().as_str() {
                    "/" => {
                        event.prevent_default();
                        self.mobile_collection = true;
                        cards::focus_collection();
                    }
                    "ArrowRight" => {
                        event.prevent_default();
                        self.choose(self.neighbor(if locales::is_rtl(&self.language.locale) {
                            -1
                        } else {
                            1
                        }));
                    }
                    "ArrowLeft" => {
                        event.prevent_default();
                        self.choose(self.neighbor(if locales::is_rtl(&self.language.locale) {
                            1
                        } else {
                            -1
                        }));
                    }
                    _ => (),
                }
                if event.code() == "Space" {
                    event.prevent_default();
                    self.settings.playing = !self.settings.playing;
                }
            }
            Msg::Location => {
                self.location(ctx);
            }
            Msg::Online => self.offline = !browser::window().navigator().on_line(),
            Msg::InstallPrompt(event) => self.install = Some(event),
            Msg::Install => {
                browser::store("atlas-language", &self.language.locale);
                if let Some(event) = self.install.take() {
                    let link = ctx.link().clone();
                    spawn_local(async move {
                        if let Ok(promise) = browser::call(&event, "prompt", &[]) {
                            let _ = browser::promise(promise).await;
                            if let Ok(result) =
                                browser::promise(browser::get(&event, "userChoice")).await
                                && browser::get(&result, "outcome").as_string().as_deref()
                                    == Some("accepted")
                            {
                                spawn_local(crate::platform::cache::retain_installed_storage());
                                link.send_message(Msg::Notice(
                                    "Atlas is ready for your home screen.".into(),
                                ));
                            }
                        }
                    })
                } else {
                    self.dialog = Some("install".into());
                }
            }
            Msg::Background(id) => {
                self.settings.background_id = Some(id.clone());
                self.settings.habitat = "custom".into();
                browser::store("atlas-background", &id);
            }
            Msg::BackgroundReady(epoch, result) => {
                if epoch != self.background_request {
                    if let Ok(Some(url)) = result {
                        let _ = web_sys::Url::revoke_object_url(&url);
                    }
                    return false;
                }
                match result {
                    Ok(Some(url)) => self.background_url = Some(url),
                    _ => self.background_failed = true,
                }
            }
            Msg::BackgroundFailed => {
                self.background_failed = true;
                self.notice(ctx, "The background could not be opened.".into());
            }
            Msg::RemoveBackground => {
                self.settings.background_id = None;
                if self.settings.habitat == "custom" {
                    self.settings.habitat = "studio".into()
                }
                browser::remove("atlas-background");
            }
            Msg::RetryBackground => self.background(ctx),
            Msg::Persist => {
                if let Some(scene) = self.snapshot() {
                    self.studio.draft = Some(scene);
                }
                self.persist();
                return false;
            }
            Msg::NeedRefresh(value) => self.need_refresh = value,
            Msg::ApplyUpdate => {
                if let Some(scene) = self.snapshot() {
                    self.studio.draft = Some(scene);
                }
                self.persist();
                spawn_local(crate::platform::sw::apply_update(true));
            }
            Msg::Refresh => (),
            Msg::CacheOpened => {
                let urls = if self.together() {
                    self.studio
                        .draft
                        .as_ref()
                        .unwrap()
                        .members
                        .iter()
                        .filter_map(|member| {
                            forms::model_for(member.species_id, member.form_id.as_deref()).map(
                                |model| {
                                    if member.shiny {
                                        model.shiny.clone().unwrap_or_else(|| model.url.clone())
                                    } else {
                                        model.url.clone()
                                    }
                                },
                            )
                        })
                        .collect()
                } else {
                    self.model()
                        .map(|model| {
                            if self.settings.shiny {
                                model.shiny.clone().unwrap_or_else(|| model.url.clone())
                            } else {
                                model.url.clone()
                            }
                        })
                        .into_iter()
                        .collect()
                };
                spawn_local(crate::platform::cache::cache_opened_view(urls));
                return false;
            }
            Msg::Installed => {
                spawn_local(crate::platform::cache::retain_installed_storage());
                return false;
            }
        }
        true
    }
    fn view(&self, ctx: &Context<Self>) -> Html {
        self.render(ctx)
    }
    fn destroy(&mut self, _: &Context<Self>) {
        if let Some(url) = self.background_url.take() {
            let _ = web_sys::Url::revoke_object_url(&url);
        }
        self.events.clear();
    }
}
impl App {
    fn location(&mut self, ctx: &Context<Self>) {
        let hash = browser::hash();
        let route =
            routes::parse_atlas_route(&browser::window().location().pathname().unwrap_or_default());
        let locale = browser::query()
            .get("lang")
            .and_then(|v| locales::resolve_locale(&v).map(str::to_owned))
            .or_else(|| route.as_ref().map(|r| r.locale.clone()));
        if let Some(locale) = locale.filter(|l| l != &self.language.locale) {
            self.request_language(ctx, locale, false);
        }
        if hash.has("layout") {
            if let Some(mut scene) = scene_link::decode_scene_link(hash.get("layout").as_deref())
                .filter(|_| hash.get("view").as_deref() == Some("together"))
            {
                scene.name = self
                    .studio
                    .draft
                    .as_ref()
                    .map(|s| s.name.clone())
                    .unwrap_or_else(|| "Shared scene".into());
                self.selected = scene.members[0].species_id;
                self.form_id = scene.members[0].form_id.clone().unwrap_or_default();
                self.page_home = true;
                self.open(scene);
                self.loading = true;
                self.error.clear();
                self.animations.clear();
                self.reload += 1;
            } else {
                self.notice(ctx, "Preview unavailable".into());
            }
            return;
        }
        let id = route
            .as_ref()
            .and_then(|r| {
                if let AtlasPage::Pokemon { id, .. } = r.page {
                    Some(id)
                } else {
                    None
                }
            })
            .or_else(|| hash.get("pokemon").and_then(|s| s.parse().ok()))
            .unwrap_or(6);
        if catalog::pokemon_by_id(id).is_none() {
            return;
        }
        let raw_form = route
            .as_ref()
            .and_then(|r| {
                if let AtlasPage::Pokemon { form_id, .. } = &r.page {
                    form_id.clone()
                } else {
                    None
                }
            })
            .or_else(|| hash.get("form"));
        let form = forms::find_form(id, raw_form.as_deref())
            .map(|f| f.id.clone())
            .unwrap_or_default();
        let shiny = hash.get("shiny").as_deref() == Some("1")
            && forms::model_for(id, Some(&form)).is_some_and(|m| m.shiny.is_some());
        let changed = self.selected != id || self.form_id != form || self.settings.shiny != shiny;
        self.page_home = route.is_some_and(|r| matches!(r.page, AtlasPage::Home));
        if hash.get("view").as_deref() == Some("together")
            && let Some(scene) = self.studio.draft.clone()
        {
            self.open(scene);
            return;
        }
        if self.together()
            && let Some(scene) = self.snapshot()
        {
            self.studio.draft = Some(scene)
        }
        self.studio.active = false;
        self.pending_camera = None;
        self.selected = id;
        self.form_id = form;
        self.settings.habitat = hash
            .get("scene")
            .filter(|s| is_habitat(s))
            .unwrap_or_else(|| "studio".into());
        self.settings.shiny = shiny;
        if changed {
            self.settings.animation = 0;
            self.error.clear();
            self.animations.clear();
            self.loading = true;
        }
    }
}
