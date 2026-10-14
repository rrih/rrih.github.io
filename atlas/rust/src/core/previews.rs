use super::routes::asset_path;
use serde::Deserialize;
use std::{collections::HashSet, sync::OnceLock};

#[derive(Deserialize)]
struct Inventory {
    species: HashSet<u16>,
    forms: HashSet<String>,
}

pub fn preview_path(id: u16, form_id: Option<&str>) -> Option<String> {
    static DATA: OnceLock<Inventory> = OnceLock::new();
    let inventory = DATA.get_or_init(|| {
        serde_json::from_str(include_str!("../../../src/data/previews.json"))
            .expect("valid checked-in preview inventory")
    });
    match form_id.filter(|form| !form.is_empty()) {
        Some(form) => inventory
            .forms
            .contains(form)
            .then(|| asset_path(&format!("/previews/forms/{form}.webp"))),
        None => inventory
            .species
            .contains(&id)
            .then(|| asset_path(&format!("/previews/{id}.webp"))),
    }
}

pub fn preview_image(id: u16, form_id: Option<&str>) -> String {
    preview_path(id, form_id).unwrap_or_else(|| asset_path(&format!("/artwork/{id}.webp")))
}
