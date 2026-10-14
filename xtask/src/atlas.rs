//! Native Atlas generation. The WASM viewer and static pages use the same Rust metadata rules.
use crate::{Result, copy_file, fresh_dir, write};
use atlas_app::core::{
    catalog::{models, pokemon, pokemon_by_id},
    forms::{PokemonForm, form_label, form_pokemon, forms, forms_for},
    locales::{LOCALES, Messages, is_rtl, trim},
    previews::preview_image,
    routes::{
        AtlasPage, CATALOG_PAGE_SIZE, POKEMON_TYPES, SEO_LOCALES, SITE_ORIGIN, asset_path,
        atlas_path, parse_atlas_route,
    },
    seo::{
        IndexSeoOptions, PageSeo, PokemonSeoInput, SeoForm, build_index_seo, build_pokemon_seo,
        seo_words,
    },
    types::{ModelEntry, Pokemon},
};
use regex::Regex;
use serde::{Deserialize, Serialize, de::DeserializeOwned};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, BTreeSet, HashMap},
    fs,
    path::{Path, PathBuf},
    sync::OnceLock,
    time::{SystemTime, UNIX_EPOCH},
};
use url::Url;

fn load<T: DeserializeOwned>(path: impl AsRef<Path>) -> Result<T> {
    Ok(serde_json::from_slice(&fs::read(path)?)?)
}
fn html(value: impl AsRef<str>) -> String {
    value
        .as_ref()
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}
fn encoded(value: impl Serialize) -> String {
    serde_json::to_string(&value)
        .expect("serializable page data")
        .replace('<', "\\u003c")
        .replace('\u{2028}', "\\u2028")
        .replace('\u{2029}', "\\u2029")
}
fn output() -> PathBuf {
    std::env::var_os("ATLAS_SEO_DIR")
        .map(PathBuf::from)
        .map(|path| {
            if path.is_absolute() {
                path
            } else {
                Path::new("atlas").join(path)
            }
        })
        .unwrap_or_else(|| PathBuf::from("atlas/dist"))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PageCopy {
    no_script: BTreeMap<String, String>,
    credits: BTreeMap<String, Vec<String>>,
    names: BTreeMap<String, String>,
}
fn copy() -> &'static PageCopy {
    static DATA: OnceLock<PageCopy> = OnceLock::new();
    DATA.get_or_init(|| {
        serde_json::from_str(include_str!("atlas_copy.json")).expect("valid static page copy")
    })
}

struct Context {
    translations: BTreeMap<String, Value>,
    messages: BTreeMap<String, Messages>,
}

impl Context {
    fn load() -> Result<Self> {
        let mut translations = BTreeMap::new();
        for locale in SEO_LOCALES.into_iter().chain(["ja-Hrkt"]) {
            translations.insert(
                locale.into(),
                load(format!("atlas/public/locales/catalog/{locale}.json"))?,
            );
        }
        let mut messages = BTreeMap::new();
        for locale in SEO_LOCALES {
            messages.insert(
                locale.into(),
                load(format!("atlas/src/locales/ui/{locale}.json"))?,
            );
        }
        Ok(Self {
            translations,
            messages,
        })
    }
    fn t<'a>(&'a self, locale: &str, key: &'a str) -> &'a str {
        self.messages
            .get(locale)
            .and_then(|m| m.get(key))
            .filter(|s| !s.is_empty())
            .or_else(|| self.messages["en"].get(key).filter(|s| !s.is_empty()))
            .map(String::as_str)
            .unwrap_or(key)
    }
    fn localized(&self, entry: &Pokemon, locale: &str) -> Pokemon {
        let mut translated = serde_json::Map::new();
        if let (true, Some(data)) = (
            locale == "ja",
            self.translations["ja-Hrkt"]["species"][entry.id.to_string()].as_object(),
        ) {
            translated.extend(data.clone());
        }
        if let Some(data) = self.translations[locale]["species"][entry.id.to_string()].as_object() {
            translated.extend(data.clone());
        }
        let mut result = serde_json::to_value(entry).expect("species serialization");
        result.as_object_mut().unwrap().extend(translated.clone());
        result["name"] = json!(
            translated
                .get("name")
                .and_then(Value::as_str)
                .filter(|s| !s.is_empty())
                .unwrap_or(&entry.name)
        );
        result["genus"] = json!(
            translated
                .get("genus")
                .and_then(Value::as_str)
                .filter(|s| !s.is_empty())
                .unwrap_or(if locale == "en" { &entry.genus } else { "" })
        );
        result["description"] = json!(
            translated
                .get("description")
                .and_then(Value::as_str)
                .filter(|s| !s.is_empty())
                .unwrap_or(&entry.description)
        );
        serde_json::from_value(result).expect("valid source translation")
    }
    fn type_name<'a>(&'a self, kind: &'a str, locale: &str) -> &'a str {
        self.translations[locale]["types"][kind]
            .as_str()
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| self.t(locale, kind))
    }
    fn name(&self, entry: &Pokemon, locale: &str) -> String {
        self.localized(entry, locale).name
    }
    fn form_name(&self, form: &PokemonForm, locale: &str) -> String {
        form.names
            .get(locale)
            .filter(|s| !s.is_empty())
            .cloned()
            .unwrap_or_else(|| {
                format!(
                    "{} ({})",
                    self.name(
                        pokemon_by_id(form.species_id).expect("known form species"),
                        locale
                    ),
                    form_label(form, |key| self.t(locale, key).into())
                )
            })
    }
    fn metadata(&self, entry: &Pokemon, locale: &str, form: Option<&PokemonForm>) -> PageSeo {
        let details = self.localized(entry, locale);
        let mut shown = form_pokemon(entry, form);
        if let Some(form) = form {
            shown.name = form.name.clone();
        }
        let mut input = PokemonSeoInput::new(
            &shown,
            form.map(|f| self.form_name(f, locale))
                .unwrap_or_else(|| details.name.clone()),
            locale,
        );
        input.localized.description = Some(details.description);
        input.form = form.map(|f| SeoForm {
            id: f.id.clone(),
            name: Some(f.name.clone()),
        });
        input.base_name = Some(details.name);
        input.type_names = Some(
            shown
                .types
                .iter()
                .map(|kind| self.type_name(kind, locale).into())
                .collect(),
        );
        input.image = Some(preview_image(entry.id, form.map(|f| f.id.as_str())));
        build_pokemon_seo(&input)
    }
    fn languages(&self, page: &AtlasPage, locale: &str) -> String {
        let locales: &[&str] = if matches!(page, AtlasPage::About | AtlasPage::Help) {
            &["en", "ja"]
        } else {
            &SEO_LOCALES
        };
        let links = locales
            .iter()
            .map(|language| {
                format!(
                    "<a href=\"{}\" lang=\"{language}\" hreflang=\"{language}\"{}>{}</a>",
                    atlas_path(page, language),
                    if *language == locale {
                        " aria-current=\"page\""
                    } else {
                        ""
                    },
                    copy().names[*language]
                )
            })
            .collect::<String>();
        format!(
            "<nav class=\"languages\" aria-label=\"{}\">{links}</nav>",
            html(self.t(locale, "Choose your language"))
        )
    }
    fn footer(&self, locale: &str) -> String {
        let legal = if locale == "ja" { "ja" } else { "en" };
        format!(
            "<footer><a href=\"{}\">Pokémon Atlas</a><a href=\"{}\">{}</a><a href=\"{}\">{}</a><a href=\"{}\">{}</a><a href=\"/atlas/legal/{legal}/rights.html\">{}</a><a href=\"/atlas/legal/{legal}/terms.html\">{}</a><a href=\"/atlas/legal/{legal}/privacy.html\">{}</a></footer>",
            atlas_path(&AtlasPage::Home, locale),
            atlas_path(&AtlasPage::Catalog { page: None }, locale),
            html(&seo_words(locale).catalog),
            atlas_path(&AtlasPage::Help, locale),
            html(self.t(locale, "How to explore")),
            atlas_path(&AtlasPage::About, locale),
            html(self.t(locale, "About Atlas & credits")),
            html(self.t(locale, "Rights & credits")),
            html(self.t(locale, "Terms of use")),
            html(self.t(locale, "Privacy policy"))
        )
    }
    fn card(&self, entry: &Pokemon, locale: &str, form: Option<&PokemonForm>) -> String {
        let page = AtlasPage::Pokemon {
            id: entry.id,
            form_id: form.map(|form| form.id.clone()),
        };
        let name = form
            .map(|form| self.form_name(form, locale))
            .unwrap_or_else(|| self.name(entry, locale));
        let kinds = form
            .map(|form| &form.types)
            .unwrap_or(&entry.types)
            .iter()
            .map(|kind| self.type_name(kind, locale))
            .collect::<Vec<_>>()
            .join(" / ");
        format!(
            "<li><a class=\"entry-card\" href=\"{}\"><img src=\"{}\" alt=\"\" width=\"96\" height=\"96\" loading=\"lazy\"><span><small>No.{:04}</small><strong>{}</strong><span>{}</span></span></a></li>",
            atlas_path(&page, locale),
            asset_path(&preview_image(entry.id, form.map(|f| f.id.as_str()))),
            entry.id,
            html(name),
            html(kinds)
        )
    }
    fn index_links(&self, locale: &str) -> String {
        let types = POKEMON_TYPES
            .iter()
            .map(|kind| {
                format!(
                    "<a href=\"{}\">{}</a>",
                    atlas_path(
                        &AtlasPage::Type {
                            pokemon_type: (*kind).into()
                        },
                        locale
                    ),
                    html(self.type_name(kind, locale))
                )
            })
            .collect::<String>();
        let generations = (1..=9)
            .map(|generation| {
                format!(
                    "<a href=\"{}\">{} {generation}</a>",
                    atlas_path(&AtlasPage::Generation { generation }, locale),
                    html(&seo_words(locale).generation)
                )
            })
            .collect::<String>();
        format!(
            "<nav class=\"index-links\" aria-label=\"{}\"><a href=\"{}\">{}</a><a href=\"{}\">{}</a><a href=\"{}\">{}</a></nav><details><summary>{}</summary><nav class=\"index-links\">{types}</nav></details><details><summary>{}</summary><nav class=\"index-links\">{generations}</nav></details>",
            html(&seo_words(locale).catalog),
            atlas_path(&AtlasPage::Catalog { page: None }, locale),
            html(&seo_words(locale).catalog),
            atlas_path(
                &AtlasPage::Forms {
                    form_kind: Some("mega".into())
                },
                locale
            ),
            html(&seo_words(locale).mega),
            atlas_path(
                &AtlasPage::Forms {
                    form_kind: Some("regional".into())
                },
                locale
            ),
            html(&seo_words(locale).regional),
            html(&copy().credits[locale][7]),
            html(&copy().credits[locale][8])
        )
    }
    fn home_body(&self, locale: &str) -> String {
        let page = AtlasPage::Home;
        let meta = build_index_seo(&page, locale, &IndexSeoOptions::default());
        let cards = [1, 6, 25, 133, 151, 1025]
            .iter()
            .map(|id| self.card(pokemon_by_id(*id).unwrap(), locale, None))
            .collect::<String>();
        format!(
            "<main id=\"main\" class=\"seo-static\"><p>Pokémon Atlas</p><h1>{}</h1><p>{}</p><div id=\"viewer\" tabindex=\"-1\"><img class=\"entry-image\" src=\"{}\" alt=\"{}\" width=\"320\" height=\"320\" fetchpriority=\"high\"></div>{}<ul class=\"entry-list\">{cards}</ul>{}{}</main>",
            html(&seo_words(locale).home),
            html(&meta.description),
            asset_path(&preview_image(6, None)),
            html(self.name(pokemon_by_id(6).unwrap(), locale)),
            self.index_links(locale),
            self.languages(&page, locale),
            self.footer(locale)
        )
    }
    fn index_body(&self, page: &AtlasPage, locale: &str) -> (PageSeo, String) {
        let selected: Vec<&Pokemon> = match page {
            AtlasPage::Catalog { page } => {
                let start =
                    usize::from(page.unwrap_or(1).max(1) - 1) * usize::from(CATALOG_PAGE_SIZE);
                pokemon()
                    .iter()
                    .skip(start)
                    .take(usize::from(CATALOG_PAGE_SIZE))
                    .collect()
            }
            AtlasPage::Type { pokemon_type } => pokemon()
                .iter()
                .filter(|p| p.types.contains(pokemon_type))
                .collect(),
            AtlasPage::Generation { generation } => pokemon()
                .iter()
                .filter(|p| p.generation == *generation)
                .collect(),
            _ => pokemon().iter().collect(),
        };
        let selected_forms = if let AtlasPage::Forms { form_kind } = page {
            Some(
                forms()
                    .iter()
                    .filter(|form| form_kind.as_ref().is_none_or(|kind| &form.kind == kind))
                    .collect::<Vec<_>>(),
            )
        } else {
            None
        };
        let label = if let AtlasPage::Type { pokemon_type } = page {
            Some(format!(
                "{} · {}",
                self.type_name(pokemon_type, locale),
                seo_words(locale).types
            ))
        } else {
            None
        };
        let meta = build_index_seo(
            page,
            locale,
            &IndexSeoOptions {
                label,
                count: Some(
                    selected_forms
                        .as_ref()
                        .map(Vec::len)
                        .unwrap_or(selected.len()),
                ),
                description: None,
            },
        );
        let pagination = if let AtlasPage::Catalog { page } = page {
            let links = (1..=1025_u16.div_ceil(CATALOG_PAGE_SIZE))
                .map(|index| {
                    format!(
                        "<a href=\"{}\"{}>{index}</a>",
                        atlas_path(&AtlasPage::Catalog { page: Some(index) }, locale),
                        if page.unwrap_or(1).max(1) == index {
                            " aria-current=\"page\""
                        } else {
                            ""
                        }
                    )
                })
                .collect::<String>();
            format!(
                "<nav class=\"pagination\" aria-label=\"{}\">{links}</nav>",
                html(&seo_words(locale).page)
            )
        } else {
            String::new()
        };
        let cards = if let Some(forms) = selected_forms {
            forms
                .iter()
                .map(|form| self.card(pokemon_by_id(form.species_id).unwrap(), locale, Some(form)))
                .collect::<String>()
        } else {
            selected
                .iter()
                .map(|entry| self.card(entry, locale, None))
                .collect::<String>()
        };
        let body = format!(
            "<main id=\"main\" class=\"seo-static\">{}<h1>{}</h1><p>{}</p>{}{pagination}<ul class=\"entry-list\">{cards}</ul>{pagination}{}{}</main>",
            breadcrumb(&meta),
            html(
                meta.breadcrumbs
                    .last()
                    .map(|b| b.name.as_str())
                    .unwrap_or("undefined")
            ),
            html(&meta.description),
            self.index_links(locale),
            self.languages(page, locale),
            self.footer(locale)
        );
        (meta, body)
    }
    fn static_document(&self, meta: &PageSeo, content: &str) -> String {
        format!(
            "<!doctype html><html lang=\"{}\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"theme-color\" content=\"#101311\">{}<link rel=\"icon\" href=\"/atlas/icon.svg\"><link rel=\"stylesheet\" href=\"/atlas/seo-static.css\"></head><body><a class=\"seo-skip\" href=\"#main\">{}</a>{content}</body></html>\n",
            meta.language,
            head(meta),
            html(self.t(&meta.language, "Skip to viewer"))
        )
    }
}

fn head(meta: &PageSeo) -> String {
    let alternates = meta
        .alternates
        .iter()
        .map(|alternate| {
            format!(
                "<link rel=\"alternate\" hreflang=\"{}\" href=\"{}\">",
                alternate.lang, alternate.href
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    format!(
        "<title>{}</title>\n<meta name=\"description\" content=\"{}\">\n<link rel=\"canonical\" href=\"{}\">\n{alternates}\n<meta property=\"og:site_name\" content=\"Pokémon Atlas\"><meta property=\"og:type\" content=\"website\">\n<meta property=\"og:title\" content=\"{}\"><meta property=\"og:description\" content=\"{}\">\n<meta property=\"og:url\" content=\"{}\"><meta property=\"og:locale\" content=\"{}\">\n<meta property=\"og:image\" content=\"{}\"><meta property=\"og:image:alt\" content=\"{}\">\n<meta name=\"twitter:card\" content=\"summary_large_image\">\n<script type=\"application/ld+json\">{}</script>",
        html(&meta.title),
        html(&meta.description),
        meta.canonical,
        html(&meta.title),
        html(&meta.description),
        meta.canonical,
        meta.og_locale,
        meta.image,
        html(&meta.image_alt),
        encoded(&meta.json_ld)
    )
}

fn breadcrumb(meta: &PageSeo) -> String {
    let crumbs = meta
        .breadcrumbs
        .iter()
        .enumerate()
        .map(|(index, crumb)| {
            format!(
                "<li><a href=\"{}\"{}>{}</a></li>",
                crumb.href,
                if index == meta.breadcrumbs.len() - 1 {
                    " aria-current=\"page\""
                } else {
                    ""
                },
                html(&crumb.name)
            )
        })
        .collect::<String>();
    format!(
        "<nav class=\"breadcrumbs\" aria-label=\"{}\"><ol>{crumbs}</ol></nav>",
        if meta.language == "ja" {
            "現在の位置"
        } else {
            "Breadcrumb"
        }
    )
}

fn initial_model_hint(path: &str) -> Option<Value> {
    let route = parse_atlas_route(path)?;
    let AtlasPage::Pokemon { id, form_id } = route.page else {
        return None;
    };
    let model = match form_id.as_deref() {
        Some(form) => {
            &forms()
                .iter()
                .find(|f| f.species_id == id && f.id == form)?
                .model
        }
        None => models().get(&id)?,
    };
    Some(json!({"path":path,"formId":form_id,"url":model.url,"shiny":model.shiny}))
}

fn inject(template: &str, meta: &PageSeo, content: &str) -> Result<String> {
    // Inert route data lets the browser choose the exact model before parsing the
    // full catalog. The browser still checks the live hash and translation state.
    let model_hint = meta
        .canonical
        .strip_prefix(SITE_ORIGIN)
        .and_then(initial_model_hint)
        .map(|hint| {
            format!(
                "<script id=\"atlas-initial-model\" type=\"application/json\">{}</script>",
                encoded(hint)
            )
        })
        .unwrap_or_default();
    let mut preload_paths = vec![];
    if meta.language != "en" {
        preload_paths.push(format!("/locales/ui/{}.json", meta.language));
        preload_paths.push(format!("/locales/catalog/{}.json", meta.language));
        if meta.language == "ja" {
            preload_paths.push("/locales/catalog/ja-Hrkt.json".into());
        }
    }
    let preloads = preload_paths
        .iter()
        .map(|path| {
            format!(
                "<link rel=\"preload\" href=\"{}\" as=\"fetch\" crossorigin=\"anonymous\">",
                asset_path(path)
            )
        })
        .collect::<String>();
    static HTML_LANGUAGE: OnceLock<Regex> = OnceLock::new();
    let mut document = HTML_LANGUAGE
        .get_or_init(|| Regex::new(r#"<html lang="[^"]+">"#).unwrap())
        .replace(template, format!("<html lang=\"{}\">", meta.language))
        .into_owned();
    for (name, value) in [
        (
            "ATLAS-PAGE-METADATA",
            format!("{}{preloads}{model_hint}", head(meta)),
        ),
        ("ATLAS-STATIC-CONTENT", content.into()),
    ] {
        let open = format!("<!-- {name} -->");
        let close = format!("<!-- /{name} -->");
        let start = document
            .find(&open)
            .ok_or_else(|| format!("Missing SEO template marker {name}"))?;
        let end = document[start + open.len()..]
            .find(&close)
            .ok_or_else(|| format!("Missing closing SEO marker {name}"))?
            + start
            + open.len()
            + close.len();
        document.replace_range(start..end, &format!("{open}{value}{close}"));
    }
    static NO_SCRIPT: OnceLock<Regex> = OnceLock::new();
    document = NO_SCRIPT
        .get_or_init(|| Regex::new(r"(?s)<noscript>.*?</noscript>").unwrap())
        .replace(&document, |_: &regex::Captures| {
            format!(
                "<noscript>{}</noscript>",
                html(&copy().no_script[&meta.language])
            )
        })
        .into_owned();
    Ok(document)
}

fn indexes() -> Vec<AtlasPage> {
    let mut pages: Vec<_> = (1..=1025_u16.div_ceil(CATALOG_PAGE_SIZE))
        .map(|page| AtlasPage::Catalog { page: Some(page) })
        .collect();
    pages.extend(POKEMON_TYPES.iter().map(|kind| AtlasPage::Type {
        pokemon_type: (*kind).into(),
    }));
    pages.extend((1..=9).map(|generation| AtlasPage::Generation { generation }));
    pages.extend([
        AtlasPage::Forms { form_kind: None },
        AtlasPage::Forms {
            form_kind: Some("mega".into()),
        },
        AtlasPage::Forms {
            form_kind: Some("regional".into()),
        },
    ]);
    pages
}

fn editorial_meta(kind: &str, locale: &str) -> PageSeo {
    let page = if kind == "help" {
        AtlasPage::Help
    } else {
        AtlasPage::About
    };
    let description = match (locale, kind) {
        ("ja", "help") => "Pokémon Atlasの3D操作、複数配置、端末内保存、オフライン利用の使い方。",
        ("ja", _) => "Pokémon Atlasの運営者、非公式ファンサイトとしての権利表示とお問い合わせ。",
        (_, "help") => {
            "How to use Pokémon Atlas: 3D controls, shared scenes, local saves and offline viewing."
        }
        _ => "About Pokémon Atlas, its independent operator, credits and contact details.",
    };
    build_index_seo(
        &page,
        locale,
        &IndexSeoOptions {
            description: Some(description.into()),
            ..Default::default()
        },
    )
}

impl Context {
    fn pokemon_body(&self, entry: &Pokemon, locale: &str, form: Option<&PokemonForm>) -> String {
        let details = self.localized(entry, locale);
        let meta = self.metadata(entry, locale, form);
        let page = AtlasPage::Pokemon {
            id: entry.id,
            form_id: form.map(|f| f.id.clone()),
        };
        let shown = form_pokemon(entry, form);
        let name = form
            .map(|f| self.form_name(f, locale))
            .unwrap_or_else(|| details.name.clone());
        let stats = self.translations[locale]["stats"]
            .as_array()
            .map(|v| {
                v.iter()
                    .map(|s| s.as_str().unwrap_or("").to_owned())
                    .collect::<Vec<_>>()
            })
            .unwrap_or_else(|| {
                [
                    "HP",
                    "Attack",
                    "Defense",
                    "Special Attack",
                    "Special Defense",
                    "Speed",
                ]
                .map(str::to_owned)
                .to_vec()
            });
        let source_url = details
            .source_url
            .clone()
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| format!("https://pokeapi.co/api/v2/pokemon-species/{}/", entry.id));
        let image = preview_image(entry.id, form.map(|f| f.id.as_str()));
        let reference = form.is_some() && !image.contains("/previews/forms/");
        let available = forms_for(entry.id);
        let has_shiny = form
            .map(|f| &f.model)
            .or_else(|| models().get(&entry.id))
            .and_then(|m| m.shiny.as_deref())
            .is_some_and(|s| !s.is_empty());
        let breadcrumbs = breadcrumb(&meta);
        let number = format!("{:04}", entry.id);
        let name_html = html(&name);
        let image_path = asset_path(&image);
        let image_alt = html(if reference { &details.name } else { &name });
        let caption = if reference {
            format!(
                "<figcaption>{}: {}</figcaption>",
                html(&copy().credits[locale][3]),
                html(&details.name)
            )
        } else {
            String::new()
        };
        let viewer_label = html(&copy().credits[locale][6]);
        let description = html(&meta.description);
        let species_heading = if form.is_some() {
            format!("<h2>{}</h2>", html(&copy().credits[locale][4]))
        } else {
            String::new()
        };
        let genus = if details.genus.is_empty() {
            String::new()
        } else {
            format!("<p>{}</p>", html(&details.genus))
        };
        let species_description = html(&details.description);
        let type_label = html(self.t(locale, "Type"));
        let type_links = shown
            .types
            .iter()
            .map(|kind| {
                format!(
                    "<a href=\"{}\">{}</a>",
                    atlas_path(
                        &AtlasPage::Type {
                            pokemon_type: kind.clone()
                        },
                        locale
                    ),
                    html(self.type_name(kind, locale))
                )
            })
            .collect::<Vec<_>>()
            .join(" / ");
        let height_label = html(self.t(locale, "HEIGHT"));
        let height = shown.height;
        let weight_label = html(self.t(locale, "WEIGHT"));
        let weight = shown.weight;
        let generation_label = html(&seo_words(locale).generation);
        let generation = entry.generation;
        let generation_path = atlas_path(&AtlasPage::Generation { generation }, locale);
        let stats_label = html(self.t(locale, "Base stats"));
        let stats_rows = shown
            .stats
            .iter()
            .enumerate()
            .map(|(i, value)| {
                format!(
                    "<tr><th scope=\"row\">{}</th><td>{value}</td></tr>",
                    html(stats.get(i).map(String::as_str).unwrap_or("undefined"))
                )
            })
            .collect::<String>();
        let shiny_description = html(self.t(
            locale,
            if has_shiny {
                "Shiny appearance"
            } else {
                "A shiny model isn’t available for this Pokémon."
            },
        ));
        let shiny_link = if has_shiny {
            format!(
                ": <a href=\"{}#shiny=1\">{}</a>",
                atlas_path(&page, locale),
                html(self.t(locale, "Shiny appearance"))
            )
        } else {
            String::new()
        };
        let form_links = if available.is_empty() {
            String::new()
        } else {
            let alternatives = available
                .iter()
                .map(|variant| {
                    format!(
                        "<li><a href=\"{}\">{}</a></li>",
                        atlas_path(
                            &AtlasPage::Pokemon {
                                id: entry.id,
                                form_id: Some(variant.id.clone())
                            },
                            locale
                        ),
                        html(self.form_name(variant, locale))
                    )
                })
                .collect::<String>();
            format!(
                "<h2>{}</h2><ul class=\"text-links\"><li><a href=\"{}\">{} · {}</a></li>{alternatives}</ul>",
                html(&copy().credits[locale][5]),
                atlas_path(
                    &AtlasPage::Pokemon {
                        id: entry.id,
                        form_id: None
                    },
                    locale
                ),
                html(&details.name),
                html(&seo_words(locale).standard)
            )
        };
        let evolution: Vec<_> = pokemon()
            .iter()
            .filter(|candidate| {
                Some(candidate.id) == entry.evolves_from || candidate.evolves_from == Some(entry.id)
            })
            .collect();
        let evolution_links = if evolution.is_empty() {
            String::new()
        } else {
            format!(
                "<h2>{}</h2><ul class=\"entry-list\">{}</ul>",
                html(self.t(locale, "Connected by evolution")),
                evolution
                    .iter()
                    .map(|candidate| self.card(candidate, locale, None))
                    .collect::<String>()
            )
        };
        let source_label = html(&copy().credits[locale][0]);
        let source_url = html(source_url);
        let source_name = html(
            details
                .source_label
                .as_deref()
                .filter(|s| !s.is_empty())
                .unwrap_or("PokéAPI"),
        );
        let verified = details
            .verified_at
            .as_deref()
            .filter(|s| !s.is_empty())
            .map(|date| {
                format!(
                    " · {}: <time datetime=\"{}\">{}</time>",
                    html(&copy().credits[locale][1]),
                    html(date),
                    html(date)
                )
            })
            .unwrap_or_default();
        let form_source=form.map(|form|format!("<p><a href=\"https://pokeapi.co/api/v2/pokemon/{}/\" target=\"_blank\" rel=\"noreferrer\">{} · PokéAPI</a></p>",form.pokemon_id,html(&copy().credits[locale][2]))).unwrap_or_default();
        let legal_locale = if locale == "ja" { "ja" } else { "en" };
        let rights_label = html(self.t(locale, "Rights & credits"));
        let adjacent = pokemon()
            .iter()
            .filter(|candidate| {
                candidate.id.checked_add(1) == Some(entry.id)
                    || entry.id.checked_add(1) == Some(candidate.id)
            })
            .map(|target| {
                format!(
                    "<a href=\"{}\">{}</a>",
                    atlas_path(
                        &AtlasPage::Pokemon {
                            id: target.id,
                            form_id: None
                        },
                        locale
                    ),
                    html(self.name(target, locale))
                )
            })
            .collect::<String>();
        let languages = self.languages(&page, locale);
        let footer = self.footer(locale);
        format!(
            r##"<main id="main" class="seo-static">{breadcrumbs}
<article><p class="entry-number">No.{number}</p><h1>{name_html}</h1>
<figure><img class="entry-image" src="{image_path}" alt="{image_alt}" width="320" height="320" fetchpriority="high">{caption}</figure>
<a class="viewer-link" href="#viewer">{viewer_label}</a><div id="viewer" tabindex="-1"><p>{description}</p></div>
{species_heading}{genus}<p>{species_description}</p>
<dl class="facts"><div><dt>{type_label}</dt><dd>{type_links}</dd></div><div><dt>{height_label}</dt><dd>{height} m</dd></div><div><dt>{weight_label}</dt><dd>{weight} kg</dd></div><div><dt>{generation_label}</dt><dd><a href="{generation_path}">{generation}</a></dd></div></dl>
<h2>{stats_label}</h2><table><tbody>{stats_rows}</tbody></table>
<p>{shiny_description}{shiny_link}</p>
{form_links}
{evolution_links}
<details class="source"><summary>{source_label}</summary><p><a href="{source_url}" target="_blank" rel="noreferrer">{source_name}</a>{verified}</p>{form_source}<p><a href="/atlas/legal/{legal_locale}/rights.html">{rights_label}</a></p></details></article>
<nav class="adjacent">{adjacent}</nav>{languages}{footer}</main>"##
        )
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
struct ContentRevision {
    hash: String,
    modified: String,
}

fn content_revision(
    hash: String,
    previous: Option<&ContentRevision>,
    today: &str,
) -> ContentRevision {
    let modified = previous
        .filter(|p| p.hash == hash)
        .map(|p| p.modified.clone())
        .unwrap_or_else(|| today.into());
    ContentRevision { hash, modified }
}

struct Fingerprint {
    public_directory: PathBuf,
    assets: HashMap<PathBuf, String>,
}

impl Default for Fingerprint {
    fn default() -> Self {
        Self::new("atlas/public")
    }
}

impl Fingerprint {
    fn new(public_directory: impl Into<PathBuf>) -> Self {
        Self {
            public_directory: public_directory.into(),
            assets: HashMap::new(),
        }
    }
    fn content(&mut self, content: &str, asset_paths: &[String]) -> Result<String> {
        let origin = Url::parse(SITE_ORIGIN)?;
        let mut paths = BTreeSet::new();
        for asset in asset_paths {
            let url = origin.join(asset)?;
            if url.origin() != origin.origin() {
                return Err(format!("Nonlocal SEO asset: {asset}").into());
            }
            let relative = url
                .path()
                .strip_prefix("/atlas/")
                .unwrap_or(url.path())
                .trim_start_matches('/');
            paths.insert(std::path::absolute(self.public_directory.join(relative))?);
        }
        let mut hashes = Vec::new();
        for path in paths {
            if !self.assets.contains_key(&path) {
                let hash = format!("{:x}", Sha256::digest(fs::read(&path)?));
                self.assets.insert(path.clone(), hash);
            }
            hashes.push(self.assets[&path].clone());
        }
        Ok(format!(
            "{:x}",
            Sha256::digest(serde_json::to_vec(&json!([content, hashes]))?)
        ))
    }
}

fn today() -> String {
    let days = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock after Unix epoch")
        .as_secs()
        / 86_400;
    civil_date(days as i64)
}

pub(crate) fn civil_date(days: i64) -> String {
    let z = days + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let mut year = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = mp + if mp < 10 { 3 } else { -9 };
    year += i64::from(month <= 2);
    format!("{year:04}-{month:02}-{day:02}")
}

fn model_paths(model: &ModelEntry) -> Vec<String> {
    let mut paths = vec![model.url.clone()];
    if let Some(shiny) = &model.shiny {
        paths.push(shiny.clone());
    }
    paths
}

pub fn prepare() -> Result {
    generate_locales()?;
    let context = Context::load()?;
    let template = fs::read_to_string("atlas/index.html")?;
    let updated = inject(
        &template,
        &build_index_seo(&AtlasPage::Home, "en", &IndexSeoOptions::default()),
        &context.home_body("en"),
    )?;
    write("atlas/index.html", updated)?;
    println!("Prepared Atlas home metadata and accessible HTML with shared Rust SEO.");
    Ok(())
}

pub fn generate_locales() -> Result {
    let english: Value = load("atlas/src/locales/ui/en.json")?;
    let keys: BTreeSet<_> = english
        .as_object()
        .ok_or("Invalid English dictionary")?
        .keys()
        .cloned()
        .collect();
    let placeholder = Regex::new(r"\{[A-Za-z0-9_]+\}")?;
    let mut messages = serde_json::Map::new();
    for (locale, _, _) in LOCALES {
        let dictionary: Value = load(format!("atlas/src/locales/ui/{locale}.json"))?;
        let object = dictionary
            .as_object()
            .ok_or_else(|| format!("Invalid UI: {locale}"))?;
        if object.keys().cloned().collect::<BTreeSet<_>>() != keys {
            return Err(format!("Incomplete UI: {locale}").into());
        }
        for key in &keys {
            let value = object[key]
                .as_str()
                .filter(|value| !trim(value).is_empty())
                .ok_or_else(|| format!("Empty translation: {locale}/{key}"))?;
            let placeholders = |text: &str| {
                let mut values = placeholder
                    .find_iter(text)
                    .map(|v| v.as_str().to_owned())
                    .collect::<Vec<_>>();
                values.sort();
                values
            };
            if placeholders(key) != placeholders(value) {
                return Err(format!("Invalid placeholders: {locale}/{key}").into());
            }
        }
        write(
            format!("atlas/public/locales/ui/{locale}.json"),
            format!("{}\n", serde_json::to_string(&dictionary)?),
        )?;
        let manifest = json!({"name":"Pokémon Atlas","short_name":"Atlas","description":format!("Pokémon Atlas — {}",dictionary["3D models"].as_str().unwrap_or("")),"lang":locale,"dir":if is_rtl(locale){"rtl"}else{"ltr"},"id":"/atlas/","start_url":format!("{}?lang={locale}",atlas_path(&AtlasPage::Home,locale)),"scope":"/atlas/","display":"standalone","background_color":"#101311","theme_color":"#101311","icons":[{"src":asset_path("/icon-192.png"),"sizes":"192x192","type":"image/png"},{"src":asset_path("/icon-512.png"),"sizes":"512x512","type":"image/png"},{"src":asset_path("/icon-maskable.png"),"sizes":"512x512","type":"image/png","purpose":"maskable"}]});
        write(
            format!("atlas/public/locales/manifests/{locale}.webmanifest"),
            format!("{}\n", serde_json::to_string(&manifest)?),
        )?;
        messages.insert(locale.into(),json!({"title":dictionary["Page not found"],"text":dictionary["This page has moved. Explore Pokémon Atlas from its new home."],"link":dictionary["Open Pokémon Atlas"]}));
    }
    write(
        "atlas/public/404.html",
        include_str!("atlas_404.html").replace("{{WORDS}}", &encoded(Value::Object(messages))),
    )?;
    println!(
        "Verified {} locale dictionaries; generated localized manifests and WASM 404 data.",
        LOCALES.len()
    );
    Ok(())
}

pub fn seo() -> Result {
    let context = Context::load()?;
    if pokemon().len() != 1025
        || pokemon()
            .iter()
            .enumerate()
            .any(|(i, p)| usize::from(p.id) != i + 1 || p.stats.len() != 6)
    {
        return Err("Invalid ordered Pokémon catalog".into());
    }
    let output = output();
    let template = fs::read_to_string(output.join("index.html"))?;
    // The public 404 is copied before Vite knows the entry hash. Bind it to the
    // emitted entry, then update Workbox's revision to its final served bytes.
    let entry = app_module(&template)?;
    let not_found = fs::read_to_string(output.join("404.html"))?
        .replace("src=\"/atlas/bootstrap.js\"", &format!("src=\"{entry}\""));
    require(
        app_module(&not_found)? == entry,
        "404 uses the current Atlas entry",
    )?;
    let worker = fs::read_to_string(output.join("sw.js"))?;
    let record = Regex::new(r#"\{url:"404\.html",revision:"[a-f0-9]{32}"\}"#)?;
    require(record.is_match(&worker), "Atlas 404 precache entry")?;
    let replacement = format!(
        r#"{{url:"404.html",revision:"{:x}"}}"#,
        md5::Md5::digest(not_found.as_bytes())
    );
    write(output.join("404.html"), &not_found)?;
    write(
        output.join("sw.js"),
        record.replace(&worker, replacement).as_ref(),
    )?;
    let state_path = Path::new("atlas/scripts/seo-content-state.json");
    let previous: BTreeMap<String, ContentRevision> = if state_path.exists() {
        load(state_path)?
    } else {
        BTreeMap::new()
    };
    let mut state = serde_json::Map::new();
    let mut urls = Vec::new();
    let date = today();
    let mut fingerprint = Fingerprint::default();
    let image_regex = Regex::new(r#"<img\b[^>]*\bsrc="([^"]+)""#)?;
    let og_regex = Regex::new(r#"<meta property="og:image" content="([^"]+)""#)?;
    let mut write_page = |path: String,
                          document: String,
                          content: String,
                          keep: bool,
                          models: Vec<String>|
     -> Result {
        let mut assets = image_regex
            .captures_iter(&document)
            .map(|m| m[1].to_owned())
            .collect::<Vec<_>>();
        if let Some(image) = og_regex.captures(&document) {
            assets.push(image[1].into());
        }
        assets.extend(models);
        let revision = content_revision(
            fingerprint.content(&content, &assets)?,
            previous.get(&path),
            &date,
        );
        urls.push((path.clone(), revision.modified.clone()));
        state.insert(path.clone(), serde_json::to_value(revision)?);
        if !keep {
            write(
                output
                    .join(path.trim_start_matches("/atlas/"))
                    .join("index.html"),
                document,
            )?;
        }
        Ok(())
    };
    for locale in SEO_LOCALES {
        let home = build_index_seo(&AtlasPage::Home, locale, &IndexSeoOptions::default());
        let content = context.home_body(locale);
        write_page(
            atlas_path(&AtlasPage::Home, locale),
            inject(&template, &home, &content)?,
            encoded(json!({"home":home,"content":content})),
            locale == "en",
            model_paths(&models()[&6]),
        )?;
        for entry in pokemon() {
            for form in std::iter::once(None).chain(forms_for(entry.id).into_iter().map(Some)) {
                let meta = context.metadata(entry, locale, form);
                let content = context.pokemon_body(entry, locale, form);
                write_page(
                    atlas_path(
                        &AtlasPage::Pokemon {
                            id: entry.id,
                            form_id: form.map(|f| f.id.clone()),
                        },
                        locale,
                    ),
                    inject(&template, &meta, &content)?,
                    encoded(json!({"meta":meta,"content":content})),
                    false,
                    model_paths(form.map(|f| &f.model).unwrap_or(&models()[&entry.id])),
                )?;
            }
        }
        for page in indexes() {
            let (meta, body) = context.index_body(&page, locale);
            write_page(
                atlas_path(&page, locale),
                context.static_document(&meta, &body),
                encoded(json!({"meta":meta,"body":body})),
                false,
                vec![],
            )?;
        }
    }
    for locale in ["en", "ja"] {
        for page in ["rights", "terms", "privacy"] {
            let path = format!("/atlas/legal/{locale}/{page}.html");
            let document = fs::read_to_string(format!("atlas/public/legal/{locale}/{page}.html"))?;
            let revision = content_revision(
                fingerprint.content(&document, &[])?,
                previous.get(&path),
                &date,
            );
            urls.push((path.clone(), revision.modified.clone()));
            state.insert(path, serde_json::to_value(revision)?);
        }
        for kind in ["help", "about"] {
            let page = if kind == "help" {
                AtlasPage::Help
            } else {
                AtlasPage::About
            };
            let meta = editorial_meta(kind, locale);
            let text = fs::read_to_string(format!("atlas/scripts/content/{locale}/{kind}.html"))?;
            let content = format!(
                "<main id=\"main\" class=\"seo-static\">{}{}{}{}</main>",
                breadcrumb(&meta),
                text,
                context.languages(&page, locale),
                context.footer(locale)
            );
            let document = context.static_document(&meta, &content);
            let path = atlas_path(&page, locale);
            let mut assets = image_regex
                .captures_iter(&document)
                .map(|m| m[1].to_owned())
                .collect::<Vec<_>>();
            if let Some(image) = og_regex.captures(&document) {
                assets.push(image[1].into());
            }
            let revision = content_revision(
                fingerprint.content(&encoded(json!({"meta":meta,"content":content})), &assets)?,
                previous.get(&path),
                &date,
            );
            urls.push((path.clone(), revision.modified.clone()));
            state.insert(path.clone(), serde_json::to_value(revision)?);
            write(
                output
                    .join(path.trim_start_matches("/atlas/"))
                    .join("index.html"),
                document,
            )?;
        }
    }
    write(
        state_path,
        format!("{}\n", serde_json::to_string_pretty(&state)?),
    )?;
    let entries = urls
        .iter()
        .map(|(path, modified)| {
            format!("  <url><loc>{SITE_ORIGIN}{path}</loc><lastmod>{modified}</lastmod></url>")
        })
        .collect::<Vec<_>>()
        .join("\n");
    let sitemap = format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n{entries}\n</urlset>\n"
    );
    write(output.join("sitemap.xml"), &sitemap)?;
    write("atlas/public/sitemap.xml", sitemap)?;
    println!(
        "Generated {} Atlas URLs in {} languages, including {} distinct forms.",
        urls.len(),
        SEO_LOCALES.len(),
        forms().len()
    );
    Ok(())
}

pub fn legacy() -> Result {
    let output = Path::new("atlas/hosting");
    fresh_dir(output)?;
    copy_file("atlas/public/ads.txt", output.join("ads.txt"))?;
    let redirect = |path: &str| {
        format!(
            r#"<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pokémon Atlas</title><link rel="canonical" href="https://rrih.github.io/atlas{path}"><meta http-equiv="refresh" content="0;url=/atlas{path}"></head><body><a href="/atlas{path}">Open Pokémon Atlas</a><script>const target=new URL({},location.origin);target.search=location.search;target.hash=location.hash;location.replace(target.href)</script></body></html>"#,
            encoded(format!("/atlas{path}"))
        )
    };
    for prefix in ["", "/ja"] {
        for id in 1..=1025 {
            let path = format!("{prefix}/pokemon/{id}/");
            write(
                output.join(path.trim_start_matches('/')).join("index.html"),
                redirect(&path),
            )?;
        }
    }
    for language in ["en", "ja"] {
        for name in ["rights", "terms", "privacy"] {
            let path = format!("/legal/{language}/{name}.html");
            write(output.join(path.trim_start_matches('/')), redirect(&path))?;
        }
    }
    write(
        output.join("terms/index.html"),
        redirect("/legal/en/terms.html"),
    )?;
    println!("Generated legacy Atlas redirects with preserved query strings and shared fragments.");
    Ok(())
}

fn require(condition: bool, message: impl Into<String>) -> Result {
    if condition {
        Ok(())
    } else {
        Err(message.into().into())
    }
}

fn decode_entities(value: &str) -> String {
    if !value.contains('&') {
        return value.into();
    }
    static ENTITY: OnceLock<Regex> = OnceLock::new();
    ENTITY
        .get_or_init(|| {
            Regex::new(r"(?i)&(?:#([0-9]+)|#x([a-f0-9]+)|(amp|lt|gt|quot|apos));").unwrap()
        })
        .replace_all(value, |captures: &regex::Captures| {
            if let Some(decimal) = captures.get(1) {
                return decimal
                    .as_str()
                    .parse::<u32>()
                    .ok()
                    .and_then(char::from_u32)
                    .map(|c| c.to_string())
                    .unwrap_or_default();
            }
            if let Some(hex) = captures.get(2) {
                return u32::from_str_radix(hex.as_str(), 16)
                    .ok()
                    .and_then(char::from_u32)
                    .map(|c| c.to_string())
                    .unwrap_or_default();
            }
            match captures[3].to_ascii_lowercase().as_str() {
                "amp" => "&",
                "lt" => "<",
                "gt" => ">",
                "quot" => "\"",
                "apos" => "'",
                _ => "",
            }
            .to_owned()
        })
        .into_owned()
}

fn tags(document: &str, name: &str) -> Vec<BTreeMap<String, String>> {
    static TAG: OnceLock<Regex> = OnceLock::new();
    static ATTRIBUTE: OnceLock<Regex> = OnceLock::new();
    let tags = TAG.get_or_init(|| Regex::new(r"(?i)<([a-z][a-z0-9]*)\b[^>]*>").unwrap());
    let attributes = ATTRIBUTE.get_or_init(|| Regex::new(r#"([\w:-]+)\s*=\s*"([^"]*)""#).unwrap());
    tags.captures_iter(document)
        .filter(|capture| name == "*" || capture[1].eq_ignore_ascii_case(name))
        .map(|capture| {
            attributes
                .captures_iter(&capture[0])
                .map(|attribute| (attribute[1].to_owned(), decode_entities(&attribute[2])))
                .collect()
        })
        .collect()
}

fn module_scripts(document: &str) -> Vec<String> {
    tags(document, "script")
        .iter()
        .filter(|tag| tag.get("type").map(String::as_str) == Some("module"))
        .map(|tag| tag.get("src").cloned().unwrap_or_default())
        .collect()
}

pub(crate) fn app_module(document: &str) -> Result<String> {
    let entries = module_scripts(document);
    require(entries.len() == 1, "One Atlas application module")?;
    let path = entries[0].clone();
    require(
        Regex::new(r"^/atlas/assets/[A-Za-z0-9_-]+-[A-Za-z0-9_-]{8}\.js$")?.is_match(&path),
        "Atlas application entry must be content-addressed",
    )?;
    Ok(path)
}

pub(crate) fn app_wasm(bindings: &str) -> Result<String> {
    let paths = Regex::new(r"/atlas/assets/atlas_bg-[A-Za-z0-9_-]{8}\.wasm")?
        .find_iter(bindings)
        .map(|value| value.as_str().to_owned())
        .collect::<BTreeSet<_>>();
    require(
        paths.len() == 1,
        "Atlas bindings pin exactly one WASM module",
    )?;
    Ok(paths.into_iter().next().unwrap())
}

pub(crate) fn app_precache(worker: &str, path: &str, bytes: &[u8]) -> Result {
    let relative = path.strip_prefix("/atlas/").ok_or("Atlas asset scope")?;
    let record = Regex::new(&format!(
        r#"\{{url:"{}",revision:(null|"[a-f0-9]{{32}}")\}}"#,
        regex::escape(relative)
    ))?;
    let revision = record
        .captures(worker)
        .ok_or_else(|| format!("Atlas worker does not precache {path}"))?[1]
        .to_owned();
    // Workbox uses null for content-addressed URLs; otherwise its MD5 revision
    // must match the exact bytes that the paired production module will load.
    let immutable =
        Regex::new(r"^/atlas/assets/[^/]+-[A-Za-z0-9_-]{8}\.(?:js|wasm)$")?.is_match(path);
    require(
        (revision == "null" && immutable)
            || revision == format!("\"{:x}\"", md5::Md5::digest(bytes)),
        format!("Atlas precache revision differs from {path}"),
    )
}
fn path_file(output: &Path, path: &str) -> PathBuf {
    let file = output.join(path.trim_start_matches("/atlas/"));
    if path.ends_with('/') {
        file.join("index.html")
    } else {
        file
    }
}

struct Verifier {
    output: PathBuf,
    app_scripts: Vec<String>,
    expected: BTreeSet<String>,
    adjacency: BTreeMap<String, BTreeSet<String>>,
    revisions: BTreeMap<String, ContentRevision>,
    body_links: usize,
}

impl Verifier {
    fn check(&mut self, path: &str, meta: &PageSeo, app: bool) -> Result<(String, String)> {
        require(
            self.expected.insert(path.into()),
            format!("Duplicate generated path {path}"),
        )?;
        let document = fs::read_to_string(path_file(&self.output, path))?;
        require(
            tags(&document, "html")
                .first()
                .and_then(|tag| tag.get("lang"))
                == Some(&meta.language),
            format!("{path}: document language"),
        )?;
        static H1: OnceLock<Regex> = OnceLock::new();
        let headings = H1
            .get_or_init(|| Regex::new(r"(?s)<h1\b[^>]*>(.*?)</h1>").unwrap())
            .captures_iter(&document)
            .map(|capture| decode_entities(&capture[1]))
            .collect::<Vec<_>>();
        require(
            headings.len() == 1,
            format!("{path}: one visible main heading"),
        )?;
        require(
            tags(&document, "main").len() == 1,
            format!("{path}: one main landmark"),
        )?;
        static TITLE: OnceLock<Regex> = OnceLock::new();
        let title = TITLE
            .get_or_init(|| Regex::new(r"(?s)<title>(.*?)</title>").unwrap())
            .captures(&document)
            .map(|capture| decode_entities(&capture[1]))
            .unwrap_or_default();
        require(title == meta.title, format!("{path}: shared title differs"))?;
        let metadata = tags(&document, "meta");
        let links = tags(&document, "link");
        let canonicals = links
            .iter()
            .filter(|link| link.get("rel").map(String::as_str) == Some("canonical"))
            .filter_map(|link| link.get("href"))
            .collect::<Vec<_>>();
        require(
            canonicals == vec![&meta.canonical],
            format!("{path}: canonical"),
        )?;
        let alternates = links
            .iter()
            .filter(|link| link.get("rel").map(String::as_str) == Some("alternate"))
            .map(|link| {
                (
                    link.get("hreflang").cloned().unwrap_or_default(),
                    link.get("href").cloned().unwrap_or_default(),
                )
            })
            .collect::<BTreeMap<_, _>>();
        require(
            alternates
                == meta
                    .alternates
                    .iter()
                    .map(|a| (a.lang.clone(), a.href.clone()))
                    .collect(),
            format!("{path}: reciprocal alternates"),
        )?;
        for (key, value) in [
            ("description", &meta.description),
            ("og:title", &meta.title),
            ("og:description", &meta.description),
            ("og:url", &meta.canonical),
            ("og:locale", &meta.og_locale),
            ("og:image", &meta.image),
        ] {
            let actual = metadata
                .iter()
                .find(|tag| {
                    tag.get("name").map(String::as_str) == Some(key)
                        || tag.get("property").map(String::as_str) == Some(key)
                })
                .and_then(|tag| tag.get("content"));
            require(actual == Some(value), format!("{path}: {key}"))?;
        }
        static JSON_LD: OnceLock<Regex> = OnceLock::new();
        let blocks = JSON_LD
            .get_or_init(|| {
                Regex::new(r#"(?s)<script\b[^>]*type="application/ld\+json"[^>]*>(.*?)</script>"#)
                    .unwrap()
            })
            .captures_iter(&document)
            .map(|capture| capture[1].to_owned())
            .collect::<Vec<_>>();
        require(blocks.len() == 1, format!("{path}: one JSON-LD block"))?;
        require(
            serde_json::from_str::<Value>(&blocks[0])? == meta.json_ld,
            format!("{path}: shared JSON-LD"),
        )?;
        let expected_scripts = if app {
            self.app_scripts.clone()
        } else {
            vec![]
        };
        require(
            module_scripts(&document) == expected_scripts,
            format!("{path}: only viewer pages load the app"),
        )?;
        require(
            !document.contains("pagead2.googlesyndication") && !document.contains("adsbygoogle"),
            format!("{path}: advertising loaded before consent"),
        )?;
        require(
            !metadata.iter().any(|tag| {
                tag.get("name").map(String::as_str) == Some("robots")
                    && tag
                        .get("content")
                        .is_some_and(|content| content.contains("noindex"))
            }),
            format!("{path}: unexpected noindex"),
        )?;
        let mut outgoing = BTreeSet::new();
        let origin = Url::parse(SITE_ORIGIN)?;
        let base = origin.join(path)?;
        for tag in tags(&document, "a") {
            let Some(href) = tag.get("href") else {
                continue;
            };
            let url = base.join(href)?;
            if url.origin() != origin.origin() || url.path() == "/" {
                continue;
            }
            require(
                url.path().starts_with("/atlas/"),
                format!("{path}: obsolete internal path {}", url.path()),
            )?;
            require(
                path_file(&self.output, url.path()).exists(),
                format!("{path}: missing linked page {href}"),
            )?;
            if let Some(fragment) = url
                .fragment()
                .filter(|value| !value.is_empty() && !value.contains('='))
            {
                let target = if url.path() == path {
                    document.clone()
                } else {
                    fs::read_to_string(path_file(&self.output, url.path()))?
                };
                let fragment = percent_encoding::percent_decode_str(fragment).decode_utf8()?;
                require(
                    tags(&target, "*")
                        .iter()
                        .any(|tag| tag.get("id").map(String::as_str) == Some(fragment.as_ref())),
                    format!("{path}: missing anchor {href}"),
                )?;
            }
            outgoing.insert(url.path().to_owned());
            self.body_links += 1;
        }
        self.adjacency.insert(path.into(), outgoing);
        for image in tags(&document, "img") {
            let source = image.get("src").map(String::as_str).unwrap_or("");
            require(
                source.starts_with("/atlas/"),
                format!("{path}: image base path"),
            )?;
            require(
                self.output
                    .join(source.trim_start_matches("/atlas/"))
                    .exists(),
                format!("{path}: missing image {source}"),
            )?;
            require(
                ["width", "height"].iter().all(|key| {
                    image
                        .get(*key)
                        .and_then(|value| value.parse::<u32>().ok())
                        .is_some_and(|value| value > 0)
                }),
                format!("{path}: image dimensions"),
            )?;
        }
        static DATE: OnceLock<Regex> = OnceLock::new();
        let date = DATE.get_or_init(|| Regex::new(r"^\d{4}-\d{2}-\d{2}$").unwrap());
        require(
            self.revisions
                .get(path)
                .is_some_and(|revision| date.is_match(&revision.modified)),
            format!("{path}: real modification date"),
        )?;
        Ok((document, headings[0].clone()))
    }
}

pub fn verify() -> Result {
    let output = output();
    let root = fs::read_to_string(output.join("index.html"))?;
    let entry = app_module(&root)?;
    let bindings = fs::read_to_string(path_file(&output, &entry))?;
    let wasm = app_wasm(&bindings)?;
    let wasm_bytes = fs::read(path_file(&output, &wasm))?;
    require(
        wasm_bytes.starts_with(b"\0asm\x01\0\0\0"),
        "Atlas application WASM",
    )?;
    let worker = fs::read_to_string(output.join("sw.js"))?;
    app_precache(&worker, &entry, bindings.as_bytes())?;
    app_precache(&worker, &wasm, &wasm_bytes)?;
    let not_found = fs::read_to_string(output.join("404.html"))?;
    require(
        app_module(&not_found)? == entry,
        "404 application module pair",
    )?;
    app_precache(&worker, "/atlas/404.html", not_found.as_bytes())?;
    let app_scripts = module_scripts(&root);
    require(
        !app_scripts.is_empty() && app_scripts.iter().all(|path| path.starts_with("/atlas/")),
        "Atlas app module path",
    )?;
    for path in &app_scripts {
        require(
            output.join(path.trim_start_matches("/atlas/")).exists(),
            format!("Missing app module {path}"),
        )?;
    }
    let mut verifier = Verifier {
        output: output.clone(),
        app_scripts,
        expected: BTreeSet::new(),
        adjacency: BTreeMap::new(),
        revisions: load("atlas/scripts/seo-content-state.json")?,
        body_links: 0,
    };
    let context = Context::load()?;
    let (mut species, mut variants, mut index_pages) = (0, 0, 0);
    let stat = Regex::new(r"<td>(\d+)</td>")?;
    for locale in SEO_LOCALES {
        let (_, name) = verifier.check(
            &atlas_path(&AtlasPage::Home, locale),
            &build_index_seo(&AtlasPage::Home, locale, &IndexSeoOptions::default()),
            true,
        )?;
        require(
            name == seo_words(locale).home,
            format!("{locale}: home heading"),
        )?;
        for entry in pokemon() {
            for form in std::iter::once(None).chain(forms_for(entry.id).into_iter().map(Some)) {
                let meta = context.metadata(entry, locale, form);
                let path = atlas_path(
                    &AtlasPage::Pokemon {
                        id: entry.id,
                        form_id: form.map(|f| f.id.clone()),
                    },
                    locale,
                );
                let (document, name) = verifier.check(&path, &meta, true)?;
                let expected_name = form
                    .map(|form| context.form_name(form, locale))
                    .unwrap_or_else(|| context.name(entry, locale));
                require(name == expected_name, format!("{path}: species/form name"))?;
                let actual = stat
                    .captures_iter(&document)
                    .map(|capture| capture[1].parse::<u16>())
                    .collect::<std::result::Result<Vec<_>, _>>()?;
                require(
                    actual
                        == form
                            .map(|f| f.stats.clone())
                            .unwrap_or_else(|| entry.stats.clone()),
                    format!("{path}: correct form stats"),
                )?;
                require(
                    document.contains("id=\"viewer\""),
                    format!("{path}: usable viewer anchor"),
                )?;
                require(
                    document.contains(&format!("/{}/", entry.id)),
                    format!("{path}: species identity"),
                )?;
                if let Some(form) = form {
                    require(
                        document.contains(&format!(
                            "https://pokeapi.co/api/v2/pokemon/{}/",
                            form.pokemon_id
                        )),
                        format!("{path}: form source"),
                    )?;
                    variants += 1;
                } else {
                    species += 1;
                }
            }
        }
        for page in indexes() {
            let (meta, _) = context.index_body(&page, locale);
            verifier.check(&atlas_path(&page, locale), &meta, false)?;
            index_pages += 1;
        }
    }
    for locale in ["en", "ja"] {
        for kind in ["help", "about"] {
            let page = if kind == "help" {
                AtlasPage::Help
            } else {
                AtlasPage::About
            };
            verifier.check(
                &atlas_path(&page, locale),
                &editorial_meta(kind, locale),
                false,
            )?;
        }
        for kind in ["rights", "terms", "privacy"] {
            let path = format!("/atlas/legal/{locale}/{kind}.html");
            let document = fs::read_to_string(path_file(&output, &path))?;
            verifier.expected.insert(path.clone());
            require(
                tags(&document, "link")
                    .iter()
                    .find(|tag| tag.get("rel").map(String::as_str) == Some("canonical"))
                    .and_then(|tag| tag.get("href"))
                    == Some(&format!("{SITE_ORIGIN}{path}")),
                format!("{path}: legal canonical"),
            )?;
            require(
                !document.contains("href=\"/legal/"),
                format!("{path}: obsolete legal link"),
            )?;
        }
    }
    let sitemap = fs::read_to_string(output.join("sitemap.xml"))?;
    let urls = Regex::new(r"<loc>(.*?)</loc>")?
        .captures_iter(&sitemap)
        .map(|capture| decode_entities(&capture[1]))
        .collect::<Vec<_>>();
    require(urls.len() == verifier.expected.len(), "Sitemap URL count")?;
    require(
        urls.iter().cloned().collect::<BTreeSet<_>>()
            == verifier
                .expected
                .iter()
                .map(|path| format!("{SITE_ORIGIN}{path}"))
                .collect(),
        "Sitemap coverage",
    )?;
    require(
        Regex::new(r"<lastmod>\d{4}-\d{2}-\d{2}</lastmod>")?
            .find_iter(&sitemap)
            .count()
            == verifier.expected.len(),
        "Sitemap modification dates",
    )?;
    let mut depth = BTreeMap::from([(atlas_path(&AtlasPage::Home, "en"), 0)]);
    let mut queue = vec![atlas_path(&AtlasPage::Home, "en")];
    let mut index = 0;
    while index < queue.len() {
        if let Some(outgoing) = verifier.adjacency.get(&queue[index]) {
            for target in outgoing {
                if !depth.contains_key(target) {
                    depth.insert(target.clone(), depth[&queue[index]] + 1);
                    queue.push(target.clone());
                }
            }
        }
        index += 1;
    }
    for path in &verifier.expected {
        require(depth.contains_key(path), format!("Unreachable page {path}"))?;
    }
    let max_depth = depth.values().copied().max().unwrap_or(0);
    require(max_depth <= 5, format!("Index graph too deep: {max_depth}"))?;
    let worker = fs::read_to_string(output.join("sw.js"))?;
    let revision = Regex::new(
        r#"(?:\burl|"url")\s*:\s*"index\.html"\s*,\s*(?:revision|"revision")\s*:\s*"([a-f\d]{32})"#,
    )?
    .captures(&worker)
    .map(|capture| capture[1].to_owned());
    require(
        revision == Some(format!("{:x}", md5::Md5::digest(root.as_bytes()))),
        "Postbuild must preserve the precached home",
    )?;
    require(
        !Regex::new(r#"\burl:"(?:ja/)?pokemon/"#)?.is_match(&worker),
        "Generated catalog pages must not all be precached",
    )?;
    require(
        fs::read_to_string(output.join("robots.txt"))?.contains("Sitemap: https://rrih.github.io/"),
        "Robots sitemap",
    )?;
    require(
        fs::read_to_string(output.join("ads.txt"))?.trim()
            == "google.com, pub-6426570202991325, DIRECT, f08c47fec0942fa0",
        "Advertising ownership record",
    )?;
    for locale in ["en", "ja", "es-419", "fa"] {
        let manifest: Value = load(output.join(format!("locales/manifests/{locale}.webmanifest")))?;
        require(
            manifest["id"] == "/atlas/"
                && manifest["scope"] == "/atlas/"
                && manifest["start_url"]
                    .as_str()
                    .is_some_and(|url| url.starts_with("/atlas/")),
            format!("{locale}: PWA identity"),
        )?;
        require(
            manifest["icons"].as_array().is_some_and(|icons| {
                icons.iter().all(|icon| {
                    icon["src"]
                        .as_str()
                        .is_some_and(|url| url.starts_with("/atlas/"))
                })
            }),
            format!("{locale}: icon paths"),
        )?;
        require(
            output.join(format!("locales/ui/{locale}.json")).exists(),
            format!("{locale}: offline dictionary"),
        )?;
    }
    println!(
        "{}",
        serde_json::to_string(
            &json!({"speciesPages":species,"formPages":variants,"languages":SEO_LOCALES,"staticIndexes":index_pages,"sitemapUrls":urls.len(),"bodyLinks":verifier.body_links,"maxInternalLinkDepth":max_depth,"sharedMetadataMatches":true,"appShellRevisionMatches":true})
        )?
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn initial_model_hints_only_describe_exact_species_and_form_routes() {
        let normal = initial_model_hint("/atlas/ja/pokemon/6/").unwrap();
        assert_eq!(normal["path"], "/atlas/ja/pokemon/6/");
        assert_eq!(normal["url"], models()[&6].url);
        assert_eq!(normal["shiny"], models()[&6].shiny.as_deref().unwrap());
        assert!(normal["formId"].is_null());
        let form = forms().iter().find(|f| f.id == "charizard-mega-x").unwrap();
        let hint = initial_model_hint("/atlas/pokemon/6/forms/charizard-mega-x/").unwrap();
        assert_eq!(hint["formId"], form.id);
        assert_eq!(hint["url"], form.model.url);
        assert_eq!(hint["shiny"], form.model.shiny.as_deref().unwrap());
        for path in [
            "/atlas/",
            "/atlas/pokemon/",
            "/atlas/types/fire/",
            "/atlas/pokemon/6/forms/missing/",
            "/atlas/pokemon/25/forms/charizard-mega-x/",
        ] {
            assert!(initial_model_hint(path).is_none(), "{path}");
        }
    }

    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let directory = std::env::temp_dir().join(format!(
                "atlas-rust-fingerprint-{}-{}",
                std::process::id(),
                SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_nanos()
            ));
            write(directory.join("models/6.glb"), "model A").unwrap();
            write(directory.join("previews/6.webp"), "preview A").unwrap();
            Self(directory)
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn model_or_preview_updates_change_the_date_at_the_same_url() {
        let fixture = Fixture::new();
        let paths = vec![
            "/atlas/models/6.glb".into(),
            "/atlas/previews/6.webp".into(),
        ];
        let original = content_revision(
            Fingerprint::new(&fixture.0)
                .content("Charizard", &paths)
                .unwrap(),
            None,
            "2026-09-06",
        );
        let rebuilt = Fingerprint::new(&fixture.0)
            .content("Charizard", &paths)
            .unwrap();
        assert_eq!(
            content_revision(rebuilt, Some(&original), "2026-09-07"),
            original
        );
        write(fixture.0.join("previews/25.webp"), "Unrelated image").unwrap();
        assert_eq!(
            Fingerprint::new(&fixture.0)
                .content("Charizard", &paths)
                .unwrap(),
            original.hash
        );
        write(fixture.0.join("models/6.glb"), "model B").unwrap();
        let model = content_revision(
            Fingerprint::new(&fixture.0)
                .content("Charizard", &paths)
                .unwrap(),
            Some(&original),
            "2026-09-07",
        );
        assert_ne!(model.hash, original.hash);
        assert_eq!(model.modified, "2026-09-07");
        write(fixture.0.join("previews/6.webp"), "preview B").unwrap();
        let preview = content_revision(
            Fingerprint::new(&fixture.0)
                .content("Charizard", &paths)
                .unwrap(),
            Some(&model),
            "2026-09-08",
        );
        assert_ne!(preview.hash, model.hash);
        assert_eq!(preview.modified, "2026-09-08");
    }

    #[test]
    fn fingerprints_cache_assets_once_and_normalize_legacy_aliases() {
        let fixture = Fixture::new();
        let mut fingerprint = Fingerprint::new(&fixture.0);
        let first = fingerprint
            .content(
                "Charizard",
                &["/models/6.glb".into(), "/atlas/previews/6.webp".into()],
            )
            .unwrap();
        fs::remove_file(fixture.0.join("models/6.glb")).unwrap();
        assert_eq!(
            fingerprint
                .content(
                    "Charizard",
                    &[
                        "https://rrih.github.io/atlas/models/6.glb".into(),
                        "/previews/6.webp".into(),
                        "/atlas/previews/6.webp".into()
                    ]
                )
                .unwrap(),
            first
        );
        assert!(
            Fingerprint::new(&fixture.0)
                .content("Charizard", &["/models/6.glb".into()])
                .is_err()
        );
        assert!(
            fingerprint
                .content("Charizard", &["https://example.com/model.glb".into()])
                .is_err()
        );
    }

    #[test]
    fn revision_changes_only_with_content() {
        let previous = ContentRevision {
            hash: "same".into(),
            modified: "2026-09-06".into(),
        };
        assert_eq!(
            content_revision("same".into(), Some(&previous), "2026-09-27"),
            previous
        );
        assert_eq!(
            content_revision("different".into(), Some(&previous), "2026-09-27").modified,
            "2026-09-27"
        );
    }
    #[test]
    fn utc_calendar_is_stable() {
        assert_eq!(civil_date(0), "1970-01-01");
        assert_eq!(civil_date(20723), "2026-09-27");
    }
    #[test]
    fn html_entities_are_not_double_decoded() {
        assert_eq!(
            decode_entities("&amp;lt; &lt; &#39; &#x1f98a;"),
            "&lt; < ' 🦊"
        );
        assert_eq!(html("<&\"'"), "&lt;&amp;&quot;&#39;");
    }

    #[test]
    fn application_pair_rejects_fixed_entries_missing_cache_and_mixed_revisions() {
        let entry = "/atlas/assets/index-Abc_1234.js";
        let wasm = "/atlas/assets/atlas_bg-Xyz_5678.wasm";
        let document = format!(r#"<script type="module" crossorigin src="{entry}"></script>"#);
        assert_eq!(app_module(&document).unwrap(), entry);
        assert!(app_module(&document.replace(entry, "/atlas/bootstrap.js")).is_err());
        let bindings = format!(r#"new URL("{wasm}",import.meta.url)"#);
        assert_eq!(app_wasm(&bindings).unwrap(), wasm);
        assert!(app_wasm(&(bindings.clone() + &bindings.replace("Xyz_5678", "Other123"))).is_err());
        let record = r#"{url:"assets/index-Abc_1234.js",revision:null}"#;
        assert!(app_precache(record, entry, bindings.as_bytes()).is_ok());
        assert!(app_precache(record, wasm, b"\0asm").is_err());
        assert!(
            app_precache(
                r#"{url:"404.html",revision:null}"#,
                "/atlas/404.html",
                b"404"
            )
            .is_err()
        );
        let revision = format!("{:x}", md5::Md5::digest(bindings.as_bytes()));
        let revised = record.replace("null", &format!("\"{revision}\""));
        assert!(app_precache(&revised, entry, bindings.as_bytes()).is_ok());
        assert!(app_precache(&revised, entry, b"different release").is_err());
    }
}
