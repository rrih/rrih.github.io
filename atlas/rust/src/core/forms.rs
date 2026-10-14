use super::{
    catalog::models,
    routes::asset_path,
    types::{ModelEntry, Pokemon},
};
use serde::{Deserialize, Serialize};
use std::{collections::BTreeMap, sync::OnceLock};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PokemonForm {
    pub id: String,
    pub species_id: u16,
    pub kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub region: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub variant: Option<String>,
    pub name: String,
    pub names: BTreeMap<String, String>,
    pub model: ModelEntry,
    pub pokemon_id: u16,
    pub types: Vec<String>,
    pub height: f64,
    pub weight: f64,
    pub stats: Vec<u16>,
}

pub fn forms() -> &'static [PokemonForm] {
    static DATA: OnceLock<Vec<PokemonForm>> = OnceLock::new();
    DATA.get_or_init(|| {
        let mut forms: Vec<PokemonForm> =
            serde_json::from_str(include_str!("../../../src/data/forms.json"))
                .expect("valid checked-in form inventory");
        for form in &mut forms {
            form.model.url = asset_path(&form.model.url);
            form.model.shiny = form.model.shiny.as_deref().map(asset_path);
        }
        forms
    })
}

pub fn forms_for(id: u16) -> Vec<&'static PokemonForm> {
    forms()
        .iter()
        .filter(|form| form.species_id == id)
        .collect()
}
pub fn find_form(id: u16, form_id: Option<&str>) -> Option<&'static PokemonForm> {
    form_id.and_then(|form_id| {
        forms()
            .iter()
            .find(|form| form.species_id == id && form.id == form_id)
    })
}
pub fn model_for(id: u16, form_id: Option<&str>) -> Option<&'static ModelEntry> {
    find_form(id, form_id)
        .map(|form| &form.model)
        .or_else(|| models().get(&id))
}

pub fn form_label(form: &PokemonForm, translate: impl Fn(&str) -> String) -> String {
    if form.kind == "mega" {
        return format!(
            "{}{}",
            translate("Mega Evolution"),
            form.variant
                .as_ref()
                .map(|variant| format!(" {}", super::case::upper(variant)))
                .unwrap_or_default()
        );
    }
    let region = translate(match form.region.as_deref().unwrap_or("alola") {
        "galar" => "Galarian form",
        "hisui" => "Hisuian form",
        "paldea" => "Paldean form",
        _ => "Alolan form",
    });
    let extra = [
        ("-zen", "Zen Mode"),
        ("-combat-breed", "Combat Breed"),
        ("-blaze-breed", "Blaze Breed"),
        ("-aqua-breed", "Aqua Breed"),
    ]
    .into_iter()
    .find(|(suffix, _)| form.id.ends_with(suffix));
    extra
        .map(|(_, label)| format!("{region} · {}", translate(label)))
        .unwrap_or(region)
}

pub fn form_pokemon(entry: &Pokemon, form: Option<&PokemonForm>) -> Pokemon {
    let mut result = entry.clone();
    if let Some(form) = form {
        result.types.clone_from(&form.types);
        result.height = form.height;
        result.weight = form.weight;
        result.stats.clone_from(&form.stats);
    }
    result
}
