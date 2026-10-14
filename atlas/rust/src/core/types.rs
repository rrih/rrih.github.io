use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Pokemon {
    pub id: u16,
    pub slug: String,
    pub name: String,
    pub ja: String,
    #[serde(rename = "gen")]
    pub generation: u8,
    pub types: Vec<String>,
    pub height: f64,
    pub weight: f64,
    pub stats: Vec<u16>,
    pub description: String,
    pub genus: String,
    pub evolves_from: Option<u16>,
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

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ModelEntry {
    pub url: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub shiny: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub animations: Option<u16>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub textured: Option<bool>,
    /// Retain source and conversion evidence present in the asset inventory.
    #[serde(flatten)]
    pub metadata: BTreeMap<String, Value>,
}

pub const HABITATS: [&str; 14] = [
    "studio",
    "forest",
    "night",
    "coast",
    "snow",
    "desert",
    "meadow",
    "mountain",
    "cave",
    "underwater",
    "volcano",
    "wetland",
    "sakura",
    "custom",
];

pub fn is_habitat(value: &str) -> bool {
    HABITATS.contains(&value)
}

pub fn habitat_name(value: &str) -> &str {
    match value {
        "studio" => "Studio",
        "forest" => "Forest",
        "night" => "Midnight",
        "coast" => "Coast",
        "snow" => "Snowfield",
        "desert" => "Desert",
        "meadow" => "Meadow",
        "mountain" => "Mountains",
        "cave" => "Cave",
        "underwater" => "Underwater",
        "volcano" => "Volcano",
        "wetland" => "Wetland",
        "sakura" => "Cherry blossoms",
        "custom" => "Custom background",
        _ => value,
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewerSettings {
    pub playing: bool,
    pub rotate: bool,
    pub speed: f64,
    pub light: f64,
    pub habitat: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub background_id: Option<String>,
    pub wireframe: bool,
    pub shiny: bool,
    pub quality: String,
    pub animation: u8,
}

impl Default for ViewerSettings {
    fn default() -> Self {
        Self {
            playing: true,
            rotate: false,
            speed: 1.0,
            light: 1.0,
            habitat: "studio".into(),
            background_id: None,
            wireframe: false,
            shiny: false,
            quality: "high".into(),
            animation: 0,
        }
    }
}
