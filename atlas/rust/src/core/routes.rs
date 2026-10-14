use serde::{Deserialize, Serialize};

pub const ATLAS_BASE: &str = "/atlas";
pub const SITE_ORIGIN: &str = "https://rrih.github.io";
pub const SEO_LOCALES: [&str; 9] = [
    "en", "ja", "fr", "de", "es", "it", "ko", "zh-Hans", "zh-Hant",
];
pub const CATALOG_PAGE_SIZE: u16 = 60;
pub const POKEMON_TYPES: [&str; 18] = [
    "normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison", "ground",
    "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel", "fairy",
];

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum AtlasPage {
    #[default]
    Home,
    Catalog {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        page: Option<u16>,
    },
    Pokemon {
        id: u16,
        #[serde(rename = "formId", default, skip_serializing_if = "Option::is_none")]
        form_id: Option<String>,
    },
    Type {
        #[serde(rename = "type")]
        pokemon_type: String,
    },
    Generation {
        generation: u8,
    },
    Forms {
        #[serde(rename = "formKind", default, skip_serializing_if = "Option::is_none")]
        form_kind: Option<String>,
    },
    Help,
    About,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct AtlasRoute {
    #[serde(flatten)]
    pub page: AtlasPage,
    pub locale: String,
}

pub fn seo_locale(value: &str) -> &'static str {
    let tag = super::case::lower(&value.replace('_', "-"));
    if tag.starts_with("zh") {
        return if ["hant", "tw", "hk", "mo"]
            .iter()
            .any(|part| tag.contains(part))
        {
            "zh-Hant"
        } else {
            "zh-Hans"
        };
    }
    let language = tag.split('-').next().unwrap_or("en");
    SEO_LOCALES
        .into_iter()
        .find(|locale| *locale == language)
        .unwrap_or("en")
}

pub fn asset_path(path: &str) -> String {
    let has_scheme = path.split_once(':').is_some_and(|(scheme, _)| {
        !scheme.is_empty()
            && scheme.as_bytes()[0].is_ascii_alphabetic()
            && scheme
                .bytes()
                .all(|c| c.is_ascii_alphanumeric() || b"+.-".contains(&c))
    });
    if has_scheme || path.starts_with("//") || path.starts_with('#') {
        return path.into();
    }
    let absolute = format!("/{}", path.trim_start_matches('/'));
    if absolute == ATLAS_BASE || absolute.starts_with("/atlas/") {
        absolute
    } else {
        format!("{ATLAS_BASE}{absolute}")
    }
}

/// JavaScript encodeURIComponent-compatible path segment encoding.
pub fn encode_component(value: &str) -> String {
    let mut result = String::with_capacity(value.len());
    for byte in value.bytes() {
        if byte.is_ascii_alphanumeric() || b"-_.!~*'()".contains(&byte) {
            result.push(byte as char);
        } else {
            use std::fmt::Write;
            let _ = write!(result, "%{byte:02X}");
        }
    }
    result
}

pub fn atlas_path(page: &AtlasPage, language: &str) -> String {
    let mut locale = seo_locale(language);
    if matches!(page, AtlasPage::Help | AtlasPage::About) && locale != "ja" {
        locale = "en";
    }
    let prefix = if locale == "en" {
        ATLAS_BASE.into()
    } else {
        format!("{ATLAS_BASE}/{locale}")
    };
    match page {
        AtlasPage::Home => format!("{prefix}/"),
        AtlasPage::Catalog { page: Some(page) } if *page > 1 => {
            format!("{prefix}/pokemon/page/{page}/")
        }
        AtlasPage::Catalog { .. } => format!("{prefix}/pokemon/"),
        AtlasPage::Pokemon { id, form_id } => match form_id.as_deref().filter(|v| !v.is_empty()) {
            Some(form) => format!("{prefix}/pokemon/{id}/forms/{}/", encode_component(form)),
            None => format!("{prefix}/pokemon/{id}/"),
        },
        AtlasPage::Type { pokemon_type } => format!("{prefix}/types/{pokemon_type}/"),
        AtlasPage::Generation { generation } => format!("{prefix}/generations/{generation}/"),
        AtlasPage::Forms { form_kind } => match form_kind.as_deref().filter(|v| !v.is_empty()) {
            Some(kind) => format!("{prefix}/forms/{kind}/"),
            None => format!("{prefix}/forms/"),
        },
        AtlasPage::Help => format!("{prefix}/help/"),
        AtlasPage::About => format!("{prefix}/about/"),
    }
}

pub fn canonical_url(page: &AtlasPage, locale: &str) -> String {
    format!("{SITE_ORIGIN}{}", atlas_path(page, locale))
}

pub fn ui_href(page: &AtlasPage, locale: &str) -> String {
    let path = atlas_path(page, locale);
    if seo_locale(locale) == locale {
        path
    } else {
        format!("{path}?lang={}", encode_component(locale))
    }
}

pub fn parse_atlas_route(pathname: &str) -> Option<AtlasRoute> {
    let path = pathname
        .strip_suffix("/index.html")
        .map(|p| format!("{p}/"))
        .unwrap_or_else(|| pathname.into());
    let path = path.trim_end_matches('/');
    if path != ATLAS_BASE && !path.starts_with("/atlas/") {
        return None;
    }
    let mut parts: Vec<&str> = path[ATLAS_BASE.len()..]
        .split('/')
        .filter(|p| !p.is_empty())
        .collect();
    let locale = parts
        .first()
        .copied()
        .filter(|p| *p != "en" && SEO_LOCALES.contains(p))
        .unwrap_or("en");
    if locale != "en" {
        parts.remove(0);
    }
    let digits = |value: &str| !value.is_empty() && value.bytes().all(|c| c.is_ascii_digit());
    let species = |value: &str| {
        value
            .parse::<u16>()
            .ok()
            .filter(|v| (1..=1025).contains(v) && digits(value))
    };
    let page = match parts.as_slice() {
        [] => AtlasPage::Home,
        ["pokemon"] => AtlasPage::Catalog { page: Some(1) },
        ["pokemon", "page", number] if digits(number) => AtlasPage::Catalog {
            page: Some(
                number
                    .parse::<u16>()
                    .ok()
                    .filter(|v| (1..=1025u16.div_ceil(CATALOG_PAGE_SIZE)).contains(v))?,
            ),
        },
        ["pokemon", id] => AtlasPage::Pokemon {
            id: species(id)?,
            form_id: None,
        },
        ["pokemon", id, "forms", form]
            if !form.is_empty()
                && form
                    .bytes()
                    .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == b'-') =>
        {
            AtlasPage::Pokemon {
                id: species(id)?,
                form_id: Some((*form).into()),
            }
        }
        ["types", kind] if POKEMON_TYPES.contains(kind) => AtlasPage::Type {
            pokemon_type: (*kind).into(),
        },
        ["generations", generation] if generation.len() == 1 => AtlasPage::Generation {
            generation: generation
                .parse::<u8>()
                .ok()
                .filter(|v| (1..=9).contains(v))?,
        },
        ["forms"] => AtlasPage::Forms { form_kind: None },
        ["forms", kind @ ("mega" | "regional")] => AtlasPage::Forms {
            form_kind: Some((*kind).into()),
        },
        ["help"] if locale == "en" || locale == "ja" => AtlasPage::Help,
        ["about"] if locale == "en" || locale == "ja" => AtlasPage::About,
        _ => return None,
    };
    Some(AtlasRoute {
        page,
        locale: locale.into(),
    })
}
