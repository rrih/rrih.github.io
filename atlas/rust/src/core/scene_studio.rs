use super::{
    catalog::{models, pokemon_by_id},
    forms::{find_form, model_for},
    locales::trim,
    types::{ViewerSettings, is_habitat},
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;

pub const MAX_MEMBERS: usize = 6;
pub const MAX_SCENES: usize = 12;
pub const STORAGE_KEY: &str = "atlas-scenes-v1";

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneMember {
    pub key: String,
    pub species_id: u16,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub form_id: Option<String>,
    pub shiny: bool,
    pub x: f64,
    pub z: f64,
    pub rotation: f64,
    pub scale: f64,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct CameraPose {
    pub position: [f64; 3],
    pub target: [f64; 3],
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct SavedScene {
    pub id: String,
    pub name: String,
    pub members: Vec<SceneMember>,
    pub settings: ViewerSettings,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub camera: Option<CameraPose>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct StudioState {
    pub version: u8,
    pub active: bool,
    pub draft: Option<SavedScene>,
    pub saved: Vec<SavedScene>,
}

impl Default for StudioState {
    fn default() -> Self {
        Self {
            version: 1,
            active: false,
            draft: None,
            saved: Vec::new(),
        }
    }
}

fn number(value: &Value, minimum: f64, maximum: f64) -> Option<f64> {
    value
        .as_f64()
        .filter(|n| n.is_finite() && *n >= minimum && *n <= maximum)
}
fn integer(value: &Value, minimum: f64, maximum: f64) -> Option<u16> {
    number(value, minimum, maximum)
        .filter(|v| v.fract() == 0.0)
        .map(|v| v as u16)
}
fn identifier(value: &Value) -> Option<String> {
    value
        .as_str()
        .filter(|s| s.encode_utf16().count() <= 128 && !trim(s).is_empty())
        .map(str::to_owned)
}

pub fn valid_background_id(id: &str) -> bool {
    let bytes = id.as_bytes();
    bytes.len() == 36
        && bytes.iter().enumerate().all(|(index, c)| {
            if [8, 13, 18, 23].contains(&index) {
                *c == b'-'
            } else {
                c.is_ascii_hexdigit()
            }
        })
        && bytes[14] == b'4'
        && b"89abAB".contains(&bytes[19])
}

pub fn parse_member(value: &Value) -> Option<SceneMember> {
    let object = value.as_object()?;
    let species_id = integer(object.get("speciesId")?, 1.0, 1025.0)?;
    pokemon_by_id(species_id)?;
    models().get(&species_id)?;
    let form_id = match object.get("formId") {
        Some(value) => {
            let form = value.as_str()?;
            find_form(species_id, Some(form))?;
            Some(form.into())
        }
        None => None,
    };
    let shiny = object.get("shiny")?.as_bool()?;
    if shiny
        && model_for(species_id, form_id.as_deref())?
            .shiny
            .as_deref()
            .is_none_or(str::is_empty)
    {
        return None;
    }
    Some(SceneMember {
        key: identifier(object.get("key")?)?,
        species_id,
        form_id,
        shiny,
        x: number(object.get("x")?, -4.0, 4.0)?,
        z: number(object.get("z")?, -4.0, 4.0)?,
        rotation: number(object.get("rotation")?, -180.0, 180.0)?,
        scale: number(object.get("scale")?, 0.4, 1.6)?,
    })
}

pub fn parse_settings(value: &Value) -> Option<ViewerSettings> {
    let object = value.as_object()?;
    let habitat = object.get("habitat")?.as_str()?;
    if !is_habitat(habitat) {
        return None;
    }
    let quality = object.get("quality")?.as_str()?;
    if quality != "standard" && quality != "high" {
        return None;
    }
    let background_id = match object.get("backgroundId") {
        Some(value) => {
            let id = value.as_str()?;
            if !valid_background_id(id) {
                return None;
            }
            Some(id.into())
        }
        None => None,
    };
    Some(ViewerSettings {
        playing: object.get("playing")?.as_bool()?,
        rotate: object.get("rotate")?.as_bool()?,
        speed: number(object.get("speed")?, 0.25, 2.0)?,
        light: number(object.get("light")?, 0.5, 1.8)?,
        habitat: habitat.into(),
        background_id,
        wireframe: object.get("wireframe")?.as_bool()?,
        shiny: object.get("shiny")?.as_bool()?,
        quality: quality.into(),
        animation: integer(object.get("animation")?, 0.0, 255.0)? as u8,
    })
}

pub fn parse_camera(value: &Value) -> Option<CameraPose> {
    let object = value.as_object()?;
    let vector = |value: &Value| -> Option<[f64; 3]> {
        let array = value.as_array()?;
        if array.len() != 3 {
            return None;
        }
        Some([
            number(&array[0], -100.0, 100.0)?,
            number(&array[1], -100.0, 100.0)?,
            number(&array[2], -100.0, 100.0)?,
        ])
    };
    let position = vector(object.get("position")?)?;
    let target = vector(object.get("target")?)?;
    let distance = (position[0] - target[0])
        .hypot(position[1] - target[1])
        .hypot(position[2] - target[2]);
    if !(0.1..=100.0).contains(&distance) {
        return None;
    }
    Some(CameraPose { position, target })
}

/// Reconstruct only the schema's known fields. Imported URLs and extra fields are discarded.
pub fn parse_scene(value: &Value) -> Option<SavedScene> {
    let object = value.as_object()?;
    let name = trim(object.get("name")?.as_str()?);
    if name.is_empty() || name.chars().count() > 60 {
        return None;
    }
    let raw_members = object.get("members")?.as_array()?;
    if raw_members.is_empty() || raw_members.len() > MAX_MEMBERS {
        return None;
    }
    let members = raw_members
        .iter()
        .map(parse_member)
        .collect::<Option<Vec<_>>>()?;
    let mut keys = HashSet::new();
    if members.iter().any(|member| !keys.insert(&member.key)) {
        return None;
    }
    let camera = match object.get("camera") {
        Some(value) => Some(parse_camera(value)?),
        None => None,
    };
    Some(SavedScene {
        id: identifier(object.get("id")?)?,
        name: name.into(),
        members,
        settings: parse_settings(object.get("settings")?)?,
        camera,
    })
}

pub fn parse_state(value: &Value) -> Option<StudioState> {
    let object = value.as_object()?;
    number(object.get("version")?, 1.0, 1.0)?;
    let active = object.get("active")?.as_bool()?;
    let draft = match object.get("draft")? {
        Value::Null => None,
        value => Some(parse_scene(value)?),
    };
    if active && draft.is_none() {
        return None;
    }
    let saved = object.get("saved")?.as_array()?;
    if saved.len() > MAX_SCENES {
        return None;
    }
    let saved = saved.iter().map(parse_scene).collect::<Option<Vec<_>>>()?;
    let mut ids = HashSet::new();
    if saved.iter().any(|scene| !ids.insert(&scene.id)) {
        return None;
    }
    Some(StudioState {
        version: 1,
        active,
        draft,
        saved,
    })
}

pub fn read_studio(raw: Option<&str>) -> StudioState {
    raw.and_then(|raw| serde_json::from_str::<Value>(raw).ok())
        .as_ref()
        .and_then(parse_state)
        .unwrap_or_default()
}

/// Returns a write only if both candidate and existing storage are supported and valid.
/// The browser adapter performs storage access and handles quota/denial failures.
pub fn studio_write(existing: Option<&str>, state: &StudioState) -> Option<String> {
    let state = parse_state(&serde_json::to_value(state).ok()?)?;
    if let Some(raw) = existing {
        parse_state(&serde_json::from_str::<Value>(raw).ok()?)?;
    }
    serde_json::to_string(&state).ok()
}
