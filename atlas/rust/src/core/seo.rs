use super::{
    routes::{
        AtlasPage, SEO_LOCALES, SITE_ORIGIN, asset_path, atlas_path, canonical_url, seo_locale,
    },
    types::Pokemon,
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{collections::BTreeMap, sync::OnceLock};

#[derive(Clone, Debug, Deserialize)]
pub struct SeoWords {
    pub home: String,
    pub catalog: String,
    pub models: String,
    pub generation: String,
    pub types: String,
    pub forms: String,
    pub mega: String,
    pub regional: String,
    pub help: String,
    pub about: String,
    pub page: String,
    pub open: String,
    pub details: String,
    pub index: String,
    pub standard: String,
}

pub fn seo_words(locale: &str) -> &'static SeoWords {
    static WORDS: OnceLock<BTreeMap<String, SeoWords>> = OnceLock::new();
    &WORDS.get_or_init(|| {
        serde_json::from_str(include_str!("seo_words.json")).expect("valid SEO translations")
    })[seo_locale(locale)]
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Breadcrumb {
    pub name: String,
    pub href: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Alternate {
    pub lang: String,
    pub href: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageSeo {
    pub language: String,
    pub title: String,
    pub description: String,
    pub canonical: String,
    pub alternates: Vec<Alternate>,
    pub og_locale: String,
    pub image: String,
    pub image_alt: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub primary_image: Option<String>,
    pub breadcrumbs: Vec<Breadcrumb>,
    pub json_ld: Value,
}

fn absolute(path: &str) -> String {
    if path.starts_with("http://") || path.starts_with("https://") {
        path.into()
    } else {
        format!("{SITE_ORIGIN}{}", asset_path(path))
    }
}

fn page_seo(
    page: &AtlasPage,
    locale: &str,
    title: String,
    description: String,
    breadcrumbs: Vec<Breadcrumb>,
    image: Option<&str>,
    primary_image: Option<&str>,
) -> PageSeo {
    let language = seo_locale(locale);
    let canonical = canonical_url(page, language);
    let localized_pages: &[&str] = if matches!(page, AtlasPage::Help | AtlasPage::About) {
        &["en", "ja"]
    } else {
        &SEO_LOCALES
    };
    let mut alternates: Vec<Alternate> = localized_pages
        .iter()
        .map(|lang| Alternate {
            lang: (*lang).into(),
            href: canonical_url(page, lang),
        })
        .collect();
    alternates.push(Alternate {
        lang: "x-default".into(),
        href: canonical_url(page, "en"),
    });
    let home_url = canonical_url(&AtlasPage::Home, "en");
    let mut page_data = json!({
        "@type": "WebPage", "@id": format!("{canonical}#webpage"), "name": title,
        "description": description, "url": canonical, "inLanguage": language,
        "isPartOf": { "@type": "WebApplication", "@id": format!("{home_url}#app"), "name": "Pokémon Atlas", "url": home_url },
    });
    if let Some(image) = primary_image {
        page_data["primaryImageOfPage"] = json!({"@type": "ImageObject", "url": absolute(image)});
    }
    let mut graph = vec![];
    if breadcrumbs.len() > 1 {
        page_data["breadcrumb"] = json!({"@id": format!("{canonical}#breadcrumb")});
        graph.push(page_data);
        let items: Vec<Value> = breadcrumbs.iter().enumerate().map(|(index, crumb)| json!({"@type": "ListItem", "position": index + 1, "name": crumb.name, "item": format!("{SITE_ORIGIN}{}", crumb.href)})).collect();
        graph.push(json!({"@type": "BreadcrumbList", "@id": format!("{canonical}#breadcrumb"), "itemListElement": items}));
    } else {
        graph.push(page_data);
    }
    if matches!(page, AtlasPage::Home) {
        graph.push(json!({
            "@type": "WebApplication", "@id": format!("{home_url}#app"), "name": "Pokémon Atlas", "url": home_url,
            "applicationCategory": "EntertainmentApplication", "operatingSystem": "Web browser", "description": description,
            "inLanguage": SEO_LOCALES, "isAccessibleForFree": true, "browserRequirements": "WebGL 2 or WebGPU", "softwareHelp": canonical_url(&AtlasPage::Help, language),
        }));
    }
    PageSeo {
        language: language.into(),
        title: title.clone(),
        description,
        canonical,
        alternates,
        og_locale: match language {
            "ja" => "ja_JP",
            "fr" => "fr_FR",
            "de" => "de_DE",
            "es" => "es_ES",
            "it" => "it_IT",
            "ko" => "ko_KR",
            "zh-Hans" => "zh_CN",
            "zh-Hant" => "zh_TW",
            _ => "en_US",
        }
        .into(),
        image: absolute(
            image
                .filter(|s| !s.is_empty())
                .unwrap_or("/social-atlas.jpg"),
        ),
        image_alt: title,
        primary_image: primary_image.map(absolute),
        breadcrumbs,
        json_ld: json!({"@context": "https://schema.org", "@graph": graph}),
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SeoPokemon {
    pub id: u16,
    pub name: String,
    pub height: f64,
    pub weight: f64,
    pub types: Vec<String>,
}
impl From<&Pokemon> for SeoPokemon {
    fn from(p: &Pokemon) -> Self {
        Self {
            id: p.id,
            name: p.name.clone(),
            height: p.height,
            weight: p.weight,
            types: p.types.clone(),
        }
    }
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct SeoLocalized {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SeoForm {
    pub id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PokemonSeoInput {
    pub pokemon: SeoPokemon,
    pub localized: SeoLocalized,
    pub locale: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub form: Option<SeoForm>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub base_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub type_names: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub image: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub og_image: Option<String>,
}

impl PokemonSeoInput {
    pub fn new(
        pokemon: &Pokemon,
        localized_name: impl Into<String>,
        locale: impl Into<String>,
    ) -> Self {
        Self {
            pokemon: pokemon.into(),
            localized: SeoLocalized {
                name: localized_name.into(),
                description: None,
            },
            locale: locale.into(),
            form: None,
            base_name: None,
            type_names: None,
            image: None,
            og_image: None,
        }
    }
}

pub fn build_pokemon_seo(input: &PokemonSeoInput) -> PageSeo {
    let pokemon = &input.pokemon;
    let language = seo_locale(&input.locale);
    let text = seo_words(language);
    let translated_content =
        SEO_LOCALES.contains(&input.locale.as_str()) || input.locale == "es-419";
    let name = if translated_content {
        input.localized.name.as_str()
    } else {
        input
            .form
            .as_ref()
            .and_then(|form| form.name.as_deref())
            .filter(|name| !name.is_empty())
            .unwrap_or(&pokemon.name)
    };
    let types = if language != "en" && translated_content && input.type_names.is_some() {
        input.type_names.clone().unwrap_or_default()
    } else {
        pokemon
            .types
            .iter()
            .map(|kind| {
                let mut chars = kind.chars();
                chars
                    .next()
                    .map(|first| {
                        format!(
                            "{}{}",
                            super::case::upper(&first.to_string()),
                            chars.as_str()
                        )
                    })
                    .unwrap_or_default()
            })
            .collect()
    };
    let page = AtlasPage::Pokemon {
        id: pokemon.id,
        form_id: input.form.as_ref().map(|form| form.id.clone()),
    };
    let title = format!(
        "{name} (No.{:04}) · {} | Pokémon Atlas",
        pokemon.id, text.models
    );
    let description = format!(
        "{name} · {} · {} m · {} kg. {}",
        types.join(" / "),
        pokemon.height,
        pokemon.weight,
        text.details
    );
    let mut crumbs = vec![
        Breadcrumb {
            name: "Pokémon Atlas".into(),
            href: atlas_path(&AtlasPage::Home, language),
        },
        Breadcrumb {
            name: text.catalog.clone(),
            href: atlas_path(&AtlasPage::Catalog { page: None }, language),
        },
    ];
    let base_name = input
        .base_name
        .as_deref()
        .filter(|value| !value.is_empty())
        .unwrap_or(&pokemon.name);
    if input.form.is_some() {
        crumbs.push(Breadcrumb {
            name: base_name.into(),
            href: atlas_path(
                &AtlasPage::Pokemon {
                    id: pokemon.id,
                    form_id: None,
                },
                language,
            ),
        });
    }
    crumbs.push(Breadcrumb {
        name: name.into(),
        href: atlas_path(&page, language),
    });
    let artwork = format!("/artwork/{}.webp", pokemon.id);
    let image = input.image.as_deref().filter(|value| !value.is_empty());
    let mut result = page_seo(
        &page,
        language,
        title,
        description,
        crumbs,
        Some(
            input
                .og_image
                .as_deref()
                .filter(|value| !value.is_empty())
                .or(image)
                .unwrap_or(&artwork),
        ),
        Some(image.unwrap_or(&artwork)),
    );
    result.json_ld["@graph"][0]["about"] = json!({"@type": "Thing", "name": name, "identifier": input.form.as_ref().map(|form| form.id.clone()).unwrap_or_else(|| pokemon.id.to_string())});
    let reference = input.form.is_some()
        && !input
            .image
            .as_deref()
            .unwrap_or("")
            .contains("/previews/forms/");
    result.image_alt = if reference {
        format!("{base_name} · {}", text.standard)
    } else {
        name.into()
    };
    result.json_ld["@graph"][0]["primaryImageOfPage"]["caption"] =
        Value::String(result.image_alt.clone());
    result
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct IndexSeoOptions {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub count: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

pub fn build_index_seo(page: &AtlasPage, locale: &str, options: &IndexSeoOptions) -> PageSeo {
    let language = if matches!(page, AtlasPage::Help | AtlasPage::About) && locale != "ja" {
        "en"
    } else {
        seo_locale(locale)
    };
    let text = seo_words(language);
    let label = options
        .label
        .as_ref()
        .filter(|value| !value.is_empty())
        .cloned()
        .unwrap_or_else(|| match page {
            AtlasPage::Home => text.home.clone(),
            AtlasPage::Catalog { page: Some(page) } if *page > 1 => {
                format!("{} · {} {page}", text.catalog, text.page)
            }
            AtlasPage::Catalog { .. } => text.catalog.clone(),
            AtlasPage::Type { pokemon_type } => format!("{pokemon_type} · {}", text.types),
            AtlasPage::Generation { generation } => format!("{} {generation}", text.generation),
            AtlasPage::Forms { form_kind } => match form_kind.as_deref() {
                Some("mega") => text.mega.clone(),
                Some("regional") => text.regional.clone(),
                _ => text.forms.clone(),
            },
            AtlasPage::Help => text.help.clone(),
            _ => text.about.clone(),
        });
    let mut crumbs = vec![Breadcrumb {
        name: "Pokémon Atlas".into(),
        href: atlas_path(&AtlasPage::Home, language),
    }];
    if !matches!(page, AtlasPage::Home) {
        crumbs.push(Breadcrumb {
            name: label.clone(),
            href: atlas_path(page, language),
        });
    }
    let description = options
        .description
        .as_ref()
        .filter(|value| !value.is_empty())
        .cloned()
        .unwrap_or_else(|| {
            if matches!(page, AtlasPage::Home) {
                text.open.clone()
            } else {
                format!(
                    "{label}{}. {}",
                    options
                        .count
                        .map(|count| format!(" · {count}"))
                        .unwrap_or_default(),
                    text.index
                )
            }
        });
    page_seo(
        page,
        language,
        format!("{label} | Pokémon Atlas"),
        description,
        crumbs,
        None,
        None,
    )
}
