use crate::{
    browser,
    core::{
        locales::{self, Messages},
        routes,
        types::Pokemon,
    },
};
use serde_json::Value;
use std::{cell::RefCell, collections::BTreeMap, rc::Rc};
use wasm_bindgen::{JsCast, JsValue};
use wasm_bindgen_futures::{JsFuture, future_to_promise};
use yew::prelude::*;

thread_local! { static PENDING: RefCell<BTreeMap<String,js_sys::Promise>> = const {RefCell::new(BTreeMap::new())}; static DICTIONARIES: RefCell<BTreeMap<String, Rc<Messages>>> = const { RefCell::new(BTreeMap::new()) }; static CATALOGS: RefCell<BTreeMap<String, Rc<Value>>> = const { RefCell::new(BTreeMap::new()) }; }
#[derive(Clone)]
pub struct Language {
    pub locale: String,
    pub messages: Rc<Messages>,
    pub catalog: Option<Rc<Value>>,
    pub catalog_status: String,
}
impl PartialEq for Language {
    fn eq(&self, other: &Self) -> bool {
        self.locale == other.locale
            && self.catalog_status == other.catalog_status
            && Rc::ptr_eq(&self.messages, &other.messages)
            && match (&self.catalog, &other.catalog) {
                (None, None) => true,
                (Some(a), Some(b)) => Rc::ptr_eq(a, b),
                _ => false,
            }
    }
}
#[derive(Clone)]
pub struct Species {
    pub entry: Pokemon,
    pub name_lang: String,
    pub genus_lang: String,
    pub description_lang: String,
}
impl Language {
    pub fn english() -> Self {
        Self {
            locale: "en".into(),
            messages: Rc::new(locales::english_messages().clone()),
            catalog: None,
            catalog_status: "ready".into(),
        }
    }
    pub fn t(&self, key: &str) -> String {
        self.tv(key, &[])
    }
    pub fn tv(&self, key: &str, values: &[(&str, String)]) -> String {
        locales::translate(&self.messages, key, values)
    }
    pub fn number(&self, value: f64) -> String {
        self.format(value, serde_json::json!({"maximumFractionDigits":3}))
    }
    pub fn format(&self, value: f64, options: Value) -> String {
        let intl = browser::get(browser::window().as_ref(), "Intl");
        let result = (|| {
            let ctor = browser::get(&intl, "NumberFormat").dyn_into::<js_sys::Function>()?;
            let args = js_sys::Array::new();
            args.push(&self.locale.clone().into());
            args.push(&browser::json(&options));
            let formatter = js_sys::Reflect::construct(&ctor, &args)?;
            browser::call(&formatter, "format", &[value.into()])
        })();
        result
            .ok()
            .and_then(|v| v.as_string())
            .unwrap_or_else(|| value.to_string())
    }
    pub fn name(&self, code: &str) -> String {
        let result = (|| {
            let ctor = browser::get(
                &browser::get(browser::window().as_ref(), "Intl"),
                "DisplayNames",
            )
            .dyn_into::<js_sys::Function>()?;
            let args = js_sys::Array::new();
            args.push(&browser::json(&serde_json::json!([self.locale])));
            args.push(&browser::json(&serde_json::json!({"type":"language"})));
            let formatter = js_sys::Reflect::construct(&ctor, &args)?;
            browser::call(&formatter, "of", &[code.into()])
        })();
        result.ok().and_then(|v| v.as_string()).unwrap_or_else(|| {
            locales::LOCALES
                .iter()
                .find(|entry| entry.0 == code)
                .map(|entry| entry.2)
                .unwrap_or(code)
                .into()
        })
    }
    pub fn species(&self, entry: &Pokemon) -> Species {
        let fields = self
            .catalog
            .as_ref()
            .and_then(|catalog| catalog["species"].get(entry.id.to_string()));
        let translated = fields.and_then(|value| serde_json::from_value(value.clone()).ok());
        let mut entry = locales::localize_pokemon(entry, translated.as_ref());
        if self.catalog.is_some()
            && !fields.is_some_and(|f| f["genus"].as_str().is_some_and(|s| !s.is_empty()))
        {
            entry.genus.clear();
        }
        let language = |field: &str| {
            if fields.is_some_and(|value| value[field].as_str().is_some_and(|s| !s.is_empty())) {
                self.locale.clone()
            } else {
                "en".into()
            }
        };
        Species {
            entry,
            name_lang: language("name"),
            genus_lang: language("genus"),
            description_lang: language("description"),
        }
    }
    pub fn type_name(&self, key: &str) -> String {
        self.catalog
            .as_ref()
            .and_then(|c| c["types"][key].as_str())
            .map(str::to_owned)
            .unwrap_or_else(|| self.t(key))
    }
    pub fn generation(&self, index: u8) -> String {
        if index == 0 {
            self.t("All generations")
        } else {
            self.tv(
                "Generation {number}",
                &[(
                    "number",
                    if self.locale == "en" {
                        ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"][index as usize]
                            .into()
                    } else {
                        self.number(index as f64)
                    },
                )],
            )
        }
    }
    pub fn apply(&self) {
        let doc = browser::document();
        if let Some(root) = doc.document_element() {
            let _ = root.set_attribute("lang", &self.locale);
            let _ = root.set_attribute(
                "dir",
                if locales::is_rtl(&self.locale) {
                    "rtl"
                } else {
                    "ltr"
                },
            );
        }
        if let Ok(Some(manifest)) = doc.query_selector("link[rel='manifest']") {
            let _ = manifest.set_attribute(
                "href",
                &routes::asset_path(&if self.locale == "en" {
                    "/manifest.webmanifest".into()
                } else {
                    format!("/locales/manifests/{}.webmanifest", self.locale)
                }),
            );
        }
    }
}
pub fn initial_locale() -> String {
    let saved = browser::stored("atlas-language");
    let route =
        routes::parse_atlas_route(&browser::window().location().pathname().unwrap_or_default());
    let explicit = browser::query()
        .get("lang")
        .filter(|v| !v.is_empty())
        .or_else(|| route.map(|r| r.locale));
    let languages: Vec<String> = browser::window()
        .navigator()
        .languages()
        .iter()
        .filter_map(|v| v.as_string())
        .collect();
    locales::preferred_locale(explicit.as_deref(), saved.as_deref(), &languages).into()
}
async fn catalog(locale: &str) -> Option<Rc<Value>> {
    if let Some(value) = CATALOGS.with(|all| all.borrow().get(locale).cloned()) {
        return Some(value);
    }
    let value = browser::fetch_json(&routes::asset_path(&format!(
        "/locales/catalog/{locale}.json"
    )))
    .await
    .ok()?;
    if value["locale"] != locale || !value["species"].is_object() || !value["types"].is_object() {
        return None;
    }
    let value = Rc::new(value);
    CATALOGS.with(|all| all.borrow_mut().insert(locale.into(), value.clone()));
    Some(value)
}
async fn dictionary(locale: &str) -> Result<Rc<Messages>, JsValue> {
    if let Some(cached) = DICTIONARIES.with(|all| all.borrow().get(locale).cloned()) {
        return Ok(cached);
    }
    if locale == "en" {
        let messages = Rc::new(locales::english_messages().clone());
        DICTIONARIES.with(|all| all.borrow_mut().insert(locale.into(), messages.clone()));
        return Ok(messages);
    }
    let pending = PENDING
        .with(|all| all.borrow().get(locale).cloned())
        .unwrap_or_else(|| {
            let code = locale.to_owned();
            let promise = future_to_promise(async move {
                let value =
                    browser::fetch_json(&routes::asset_path(&format!("/locales/ui/{code}.json")))
                        .await?;
                let messages = Rc::new(
                    locales::parse_dictionary(value)
                        .ok_or_else(|| JsValue::from_str("Invalid language"))?,
                );
                DICTIONARIES.with(|all| all.borrow_mut().insert(code, messages));
                Ok(JsValue::UNDEFINED)
            });
            PENDING.with(|all| all.borrow_mut().insert(locale.into(), promise.clone()));
            promise
        });
    let result = JsFuture::from(pending.clone()).await;
    PENDING.with(|all| {
        let mut all = all.borrow_mut();
        if all
            .get(locale)
            .is_some_and(|current| js_sys::Object::is(current.as_ref(), pending.as_ref()))
        {
            all.remove(locale);
        }
    });
    result?;
    DICTIONARIES
        .with(|all| all.borrow().get(locale).cloned())
        .ok_or_else(|| JsValue::from_str("Invalid language"))
}
async fn translated_catalog(locale: &str) -> Option<Rc<Value>> {
    let needs = [
        "ja", "ko", "zh-Hans", "zh-Hant", "fr", "de", "es", "es-419", "it",
    ]
    .contains(&locale);
    let (mut data, kana) = futures_util::join!(
        async { if needs { catalog(locale).await } else { None } },
        async {
            if locale == "ja" {
                catalog("ja-Hrkt").await
            } else {
                None
            }
        }
    );
    if locale == "ja" {
        match (&data, &kana) {
            (None, Some(kana)) => data = Some(kana.clone()),
            (Some(primary), Some(kana)) => {
                if let Some(merged) = locales::supplement_catalog(primary, kana) {
                    data = Some(Rc::new(merged));
                }
            }
            _ => (),
        }
    }
    data
}
pub async fn prepare(locale: &str) -> Result<Language, JsValue> {
    prepare_language(locale, false).await
}
pub(super) async fn prepare_initial(locale: &str) -> Result<Language, JsValue> {
    prepare_language(locale, true).await
}
async fn prepare_language(locale: &str, initial: bool) -> Result<Language, JsValue> {
    let (messages, data) = futures_util::try_join!(
        async {
            let messages = dictionary(locale).await?;
            if initial {
                let _ = super::preload::initial_model();
            }
            Ok::<_, JsValue>(messages)
        },
        async { Ok::<_, JsValue>(translated_catalog(locale).await) }
    )?;
    let needs = [
        "ja", "ko", "zh-Hans", "zh-Hant", "fr", "de", "es", "es-419", "it",
    ]
    .contains(&locale);
    Ok(Language {
        locale: locale.into(),
        messages,
        catalog_status: if needs && data.is_none() {
            "failed".into()
        } else {
            "ready".into()
        },
        catalog: data,
    })
}
#[hook]
pub fn use_language() -> Language {
    use_context::<Language>().expect("Language context")
}
