use super::{
    locales::normalize_search,
    routes::asset_path,
    types::{ModelEntry, Pokemon},
};
use serde_json::Value;
use std::{
    collections::{BTreeMap, HashMap, HashSet},
    sync::OnceLock,
};

pub const GENERATIONS: [&str; 10] = [
    "All generations",
    "Generation I",
    "Generation II",
    "Generation III",
    "Generation IV",
    "Generation V",
    "Generation VI",
    "Generation VII",
    "Generation VIII",
    "Generation IX",
];

pub fn pokemon() -> &'static [Pokemon] {
    static DATA: OnceLock<Vec<Pokemon>> = OnceLock::new();
    DATA.get_or_init(|| {
        serde_json::from_str(include_str!("../../../src/data/catalog.json"))
            .expect("valid checked-in species catalog")
    })
}

pub fn pokemon_by_id(id: u16) -> Option<&'static Pokemon> {
    pokemon()
        .get(usize::from(id).checked_sub(1)?)
        .filter(|entry| entry.id == id)
}

pub fn models() -> &'static BTreeMap<u16, ModelEntry> {
    static DATA: OnceLock<BTreeMap<u16, ModelEntry>> = OnceLock::new();
    DATA.get_or_init(|| {
        let mut data: BTreeMap<u16, ModelEntry> =
            serde_json::from_str(include_str!("../../../src/data/models.json"))
                .expect("valid checked-in model inventory");
        for entry in data.values_mut() {
            entry.url = asset_path(&entry.url);
            entry.shiny = entry.shiny.as_deref().map(asset_path);
        }
        data
    })
}

fn search_index() -> &'static HashMap<u16, String> {
    static INDEX: OnceLock<HashMap<u16, String>> = OnceLock::new();
    INDEX.get_or_init(|| {
        let names: HashMap<String, Vec<String>> =
            serde_json::from_str(include_str!("../../../public/locales/search.json"))
                .expect("valid checked-in search names");
        pokemon()
            .iter()
            .map(|p| {
                let mut joined = format!("{} {} {}", p.slug, p.name, p.ja);
                if let Some(translations) = names.get(&p.id.to_string()) {
                    for name in translations {
                        joined.push(' ');
                        joined.push_str(name);
                    }
                }
                (p.id, normalize_search(&joined))
            })
            .collect()
    })
}

pub fn filter_pokemon(
    query: &str,
    generation: u8,
    pokemon_type: &str,
    favorites: Option<&HashSet<u16>>,
) -> Vec<&'static Pokemon> {
    let normalized = normalize_search(query);
    let q = normalized
        .strip_prefix('#')
        .unwrap_or(&normalized)
        .trim_start_matches('0');
    pokemon()
        .iter()
        .filter(|p| {
            (generation == 0 || p.generation == generation)
                && (pokemon_type.is_empty() || p.types.iter().any(|kind| kind == pokemon_type))
                && favorites.is_none_or(|ids| ids.contains(&p.id))
                && (q.is_empty()
                    || p.id.to_string() == q
                    || search_index()
                        .get(&p.id)
                        .is_some_and(|name| name.contains(q)))
        })
        .collect()
}

pub fn art(id: u16) -> String {
    asset_path(&format!("/artwork/{id}.webp"))
}

pub fn parse_favorites(raw: Option<&str>) -> HashSet<u16> {
    raw.and_then(|text| serde_json::from_str::<Value>(text).ok())
        .and_then(|v| v.as_array().cloned())
        .unwrap_or_default()
        .iter()
        .filter_map(|value| {
            value
                .as_f64()
                .filter(|v| v.is_finite() && v.fract() == 0.0 && *v >= 1.0 && *v <= 1025.0)
                .map(|v| v as u16)
        })
        .filter(|id| pokemon_by_id(*id).is_some())
        .collect()
}

pub fn type_color(kind: &str) -> &str {
    match kind {
        "normal" => "#9da59a",
        "fire" => "#e89b72",
        "water" => "#86b0df",
        "electric" => "#e0ca68",
        "grass" => "#a6c87b",
        "ice" => "#8bcfc4",
        "fighting" => "#d39783",
        "poison" => "#bc96cb",
        "ground" => "#c4aa7d",
        "flying" => "#afaddc",
        "psychic" => "#d994b0",
        "bug" => "#bfca73",
        "rock" => "#c5b187",
        "ghost" => "#a29ac8",
        "dragon" => "#9b9ad7",
        "dark" => "#aa9f96",
        "steel" => "#a1bdc0",
        "fairy" => "#dab0ce",
        _ => "#9da59a",
    }
}
