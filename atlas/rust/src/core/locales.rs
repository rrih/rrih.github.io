use super::types::Pokemon;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{collections::BTreeMap, sync::OnceLock};
#[cfg(not(target_arch = "wasm32"))]
use unicode_normalization::UnicodeNormalization;

pub type Messages = BTreeMap<String, String>;
pub const LOCALES: [(&str, &str, &str); 49] = [
    ("en", "English", "English"),
    ("ja", "日本語", "Japanese"),
    ("ko", "한국어", "Korean"),
    ("zh-Hans", "简体中文", "Chinese (Simplified)"),
    ("zh-Hant", "繁體中文", "Chinese (Traditional)"),
    ("fr", "Français", "French"),
    ("de", "Deutsch", "German"),
    ("es", "Español", "Spanish (Spain)"),
    (
        "es-419",
        "Español latinoamericano",
        "Spanish (Latin America)",
    ),
    ("it", "Italiano", "Italian"),
    ("pt-BR", "Português do Brasil", "Portuguese (Brazil)"),
    ("pt", "Português", "Portuguese (Portugal)"),
    ("nl", "Nederlands", "Dutch"),
    ("sv", "Svenska", "Swedish"),
    ("da", "Dansk", "Danish"),
    ("nb", "Norsk bokmål", "Norwegian Bokmål"),
    ("fi", "Suomi", "Finnish"),
    ("is", "Íslenska", "Icelandic"),
    ("pl", "Polski", "Polish"),
    ("cs", "Čeština", "Czech"),
    ("sk", "Slovenčina", "Slovak"),
    ("hu", "Magyar", "Hungarian"),
    ("ro", "Română", "Romanian"),
    ("bg", "Български", "Bulgarian"),
    ("uk", "Українська", "Ukrainian"),
    ("ru", "Русский", "Russian"),
    ("el", "Ελληνικά", "Greek"),
    ("tr", "Türkçe", "Turkish"),
    ("ar", "العربية", "Arabic"),
    ("he", "עברית", "Hebrew"),
    ("fa", "فارسی", "Persian"),
    ("ur", "اردو", "Urdu"),
    ("hi", "हिन्दी", "Hindi"),
    ("bn", "বাংলা", "Bengali"),
    ("ta", "தமிழ்", "Tamil"),
    ("te", "తెలుగు", "Telugu"),
    ("mr", "मराठी", "Marathi"),
    ("ne", "नेपाली", "Nepali"),
    ("th", "ไทย", "Thai"),
    ("vi", "Tiếng Việt", "Vietnamese"),
    ("id", "Bahasa Indonesia", "Indonesian"),
    ("ms", "Bahasa Melayu", "Malay"),
    ("fil", "Filipino", "Filipino"),
    ("sw", "Kiswahili", "Swahili"),
    ("af", "Afrikaans", "Afrikaans"),
    ("ca", "Català", "Catalan"),
    ("hr", "Hrvatski", "Croatian"),
    ("sr", "Српски", "Serbian"),
    ("sl", "Slovenščina", "Slovenian"),
];

pub fn is_rtl(locale: &str) -> bool {
    ["ar", "he", "fa", "ur"].contains(&locale)
}

/// Match ECMAScript whitespace so old stored identifiers and names retain their meaning.
pub fn trim(value: &str) -> &str {
    value.trim_matches(|c: char| matches!(c, '\u{0009}'..='\u{000d}' | '\u{0020}' | '\u{00a0}' | '\u{1680}' | '\u{2000}'..='\u{200a}' | '\u{2028}' | '\u{2029}' | '\u{202f}' | '\u{205f}' | '\u{3000}' | '\u{feff}'))
}

pub fn resolve_locale(value: &str) -> Option<&'static str> {
    let tag = super::case::lower(&trim(value).replace('_', "-"));
    if tag.is_empty() {
        return None;
    }
    if let Some((code, _, _)) = LOCALES
        .iter()
        .find(|(code, _, _)| super::case::lower(code) == tag)
    {
        return Some(code);
    }
    let parts: Vec<&str> = tag.split('-').collect();
    let language = parts[0];
    match language {
        "zh" => Some(if parts.contains(&"hans") {
            "zh-Hans"
        } else if parts.contains(&"hant") || parts.iter().any(|p| ["tw", "hk", "mo"].contains(p)) {
            "zh-Hant"
        } else {
            "zh-Hans"
        }),
        "pt" => Some(if parts.contains(&"br") { "pt-BR" } else { "pt" }),
        "es" => Some(
            if parts.iter().any(|p| {
                [
                    "419", "mx", "ar", "bo", "cl", "co", "cr", "cu", "do", "ec", "gt", "hn", "ni",
                    "pa", "pe", "pr", "py", "sv", "uy", "ve",
                ]
                .contains(p)
            }) {
                "es-419"
            } else {
                "es"
            },
        ),
        "no" | "nn" => Some("nb"),
        "tl" => Some("fil"),
        "iw" => Some("he"),
        "in" => Some("id"),
        _ => LOCALES
            .iter()
            .find(|(code, _, _)| super::case::lower(code) == language)
            .map(|(code, _, _)| *code),
    }
}

pub fn preferred_locale(
    shared: Option<&str>,
    saved: Option<&str>,
    browser: &[String],
) -> &'static str {
    shared
        .and_then(resolve_locale)
        .or_else(|| saved.and_then(resolve_locale))
        .or_else(|| browser.iter().find_map(|language| resolve_locale(language)))
        .unwrap_or("en")
}

pub fn english_messages() -> &'static Messages {
    static DATA: OnceLock<Messages> = OnceLock::new();
    DATA.get_or_init(|| {
        serde_json::from_str(include_str!("../../../src/locales/ui/en.json"))
            .expect("valid checked-in English dictionary")
    })
}

pub fn parse_dictionary(value: Value) -> Option<Messages> {
    let object = value.as_object()?;
    if !object.contains_key("Choose your language")
        || !object
            .values()
            .all(|v| v.as_str().is_some_and(|s| !trim(s).is_empty()))
    {
        return None;
    }
    serde_json::from_value(value).ok()
}

pub fn translate(messages: &Messages, key: &str, values: &[(&str, String)]) -> String {
    let template = messages
        .get(key)
        .filter(|v| !v.is_empty())
        .or_else(|| english_messages().get(key).filter(|v| !v.is_empty()))
        .map(String::as_str)
        .unwrap_or(key);
    let mut result = String::with_capacity(template.len());
    let mut remainder = template;
    while let Some(open) = remainder.find('{') {
        result.push_str(&remainder[..open]);
        remainder = &remainder[open..];
        if let Some(close) = remainder.find('}') {
            let name = &remainder[1..close];
            if !name.is_empty() && name.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'_') {
                result.push_str(
                    values
                        .iter()
                        .find(|(key, _)| *key == name)
                        .map(|(_, value)| value.as_str())
                        .unwrap_or(&remainder[..=close]),
                );
                remainder = &remainder[close + 1..];
                continue;
            }
        }
        result.push('{');
        remainder = &remainder[1..];
    }
    result.push_str(remainder);
    result
}

pub fn normalize_search(value: &str) -> String {
    let zeroes = [
        0x660, 0x6f0, 0x966, 0x9e6, 0xae6, 0xb66, 0xbe6, 0xc66, 0xce6, 0xd66, 0xe50, 0xed0,
    ];
    // The browser's standard normalization API matches the original JavaScript
    // and avoids embedding a second copy of its Unicode normalization tables.
    #[cfg(target_arch = "wasm32")]
    let canonical = String::from(
        js_sys::JsString::from(value)
            .normalize("NFKC")
            .normalize("NFD"),
    );
    #[cfg(target_arch = "wasm32")]
    let characters = canonical.chars();
    #[cfg(not(target_arch = "wasm32"))]
    let characters = value.nfkc().nfd();
    let normalized: String = characters
        .filter(|c| !('\u{0300}'..='\u{036f}').contains(c))
        .map(|c| {
            let point = c as u32;
            if ('ァ'..='ヶ').contains(&c) {
                char::from_u32(point - 0x60).unwrap_or(c)
            } else if let Some(zero) = zeroes
                .iter()
                .find(|&&start| point >= start && point <= start + 9)
            {
                char::from_u32(48 + point - zero).unwrap_or(c)
            } else {
                c
            }
        })
        .collect();
    #[cfg(target_arch = "wasm32")]
    let normalized = String::from(js_sys::JsString::from(normalized.as_str()).to_lower_case());
    #[cfg(not(target_arch = "wasm32"))]
    let normalized = normalized.to_lowercase();
    trim(&normalized).to_owned()
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpeciesTranslation {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub genus: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(rename = "sourceURL", default, skip_serializing_if = "Option::is_none")]
    pub source_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_label: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description_kind: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub verified_at: Option<String>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct CatalogTranslation {
    #[serde(default)]
    pub locale: String,
    pub species: BTreeMap<u16, SpeciesTranslation>,
    #[serde(default)]
    pub types: Messages,
    #[serde(default)]
    pub stats: Vec<String>,
}

/// Return an owned overlay only when kana contributes a missing species field.
/// Primary values, including empty strings and null, retain their precedence.
pub fn supplement_catalog(primary: &Value, fallback: &Value) -> Option<Value> {
    let species = primary.get("species")?.as_object()?;
    let needs_overlay = species.iter().any(|(id, fields)| {
        fields.as_object().is_none_or(|fields| {
            fallback["species"][id]
                .as_object()
                .is_some_and(|extra| extra.keys().any(|key| !fields.contains_key(key)))
        })
    });
    if !needs_overlay {
        return None;
    }
    let mut merged = primary.clone();
    for (id, fields) in merged["species"].as_object_mut()? {
        if let Some(fields) = fields.as_object_mut() {
            if let Some(extra) = fallback["species"][id].as_object() {
                for (key, value) in extra {
                    if !fields.contains_key(key) {
                        fields.insert(key.clone(), value.clone());
                    }
                }
            }
        } else {
            *fields = Value::Object(
                fallback["species"][id]
                    .as_object()
                    .cloned()
                    .unwrap_or_default(),
            );
        }
    }
    Some(merged)
}

/// Field-by-field catalog overlay; a missing translated field retains its original source.
pub fn localize_pokemon(entry: &Pokemon, translated: Option<&SpeciesTranslation>) -> Pokemon {
    let mut result = entry.clone();
    if let Some(value) = translated {
        if let Some(name) = &value.name {
            result.name.clone_from(name);
        }
        if let Some(genus) = &value.genus {
            result.genus.clone_from(genus);
        }
        if let Some(description) = &value.description {
            result.description.clone_from(description);
        }
        if value.source_url.is_some() {
            result.source_url.clone_from(&value.source_url);
        }
        if value.source_label.is_some() {
            result.source_label.clone_from(&value.source_label);
        }
        if value.source_version.is_some() {
            result.source_version.clone_from(&value.source_version);
        }
        if value.description_kind.is_some() {
            result.description_kind.clone_from(&value.description_kind);
        }
        if value.verified_at.is_some() {
            result.verified_at.clone_from(&value.verified_at);
        }
    }
    result
}
