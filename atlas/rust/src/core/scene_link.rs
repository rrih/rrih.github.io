use super::scene_studio::{SavedScene, parse_scene};
use base64::{
    Engine, alphabet,
    engine::{
        DecodePaddingMode,
        general_purpose::{GeneralPurpose, GeneralPurposeConfig, URL_SAFE_NO_PAD},
    },
};
use serde_json::{Value, json};

pub const MAX_TOKEN_LENGTH: usize = 4096;

/// Compare the public scene, not JSON formatting used by a particular release.
/// Local names, identifiers and photographs are deliberately absent from links.
pub fn matches_shared_scene(local: &SavedScene, shared: &SavedScene) -> bool {
    encode_scene_link(local)
        .and_then(|token| decode_scene_link(Some(&token)))
        .as_ref()
        == Some(shared)
}

/// Share only a bounded layout: names, local identifiers, and photographs remain private.
pub fn encode_scene_link(scene: &SavedScene) -> Option<String> {
    let mut parsed = parse_scene(&serde_json::to_value(scene).ok()?)?;
    parsed.settings.background_id = None;
    if parsed.settings.habitat == "custom" {
        parsed.settings.habitat = "studio".into();
    }
    let members: Vec<Value> = parsed
        .members
        .iter()
        .map(|member| {
            json!([
                member.species_id,
                member.form_id.as_deref().unwrap_or(""),
                member.shiny,
                member.x,
                member.z,
                member.rotation,
                member.scale
            ])
        })
        .collect();
    let mut payload = json!({"v": 1, "m": members, "s": parsed.settings});
    if let Some(camera) = parsed.camera {
        payload["c"] = serde_json::to_value(camera).ok()?;
    }
    let token = URL_SAFE_NO_PAD.encode(serde_json::to_vec(&payload).ok()?);
    (token.len() <= MAX_TOKEN_LENGTH).then_some(token)
}

pub fn decode_scene_link(token: Option<&str>) -> Option<SavedScene> {
    let token = token.filter(|token| {
        !token.is_empty()
            && token.len() <= MAX_TOKEN_LENGTH
            && token
                .bytes()
                .all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-')
    })?;
    // atob accepts unpadded input and nonzero unused trailing bits in old shared URLs.
    let decoder = GeneralPurpose::new(
        &alphabet::URL_SAFE,
        GeneralPurposeConfig::new()
            .with_decode_padding_mode(DecodePaddingMode::Indifferent)
            .with_decode_allow_trailing_bits(true),
    );
    let decoded = decoder.decode(token).ok()?;
    // The previous decoder interprets atob bytes as Latin-1, not UTF-8.
    let text: String = decoded.iter().map(|byte| char::from(*byte)).collect();
    let payload: Value = serde_json::from_str(&text).ok()?;
    let object = payload.as_object()?;
    if object.get("v")?.as_f64()? != 1.0 {
        return None;
    }
    let members = object.get("m")?.as_array()?;
    let settings = object.get("s")?.as_object()?;
    if members.is_empty()
        || members.len() > 6
        || settings.contains_key("backgroundId")
        || settings.get("habitat").and_then(Value::as_str) == Some("custom")
    {
        return None;
    }
    let members: Option<Vec<Value>> = members.iter().enumerate().map(|(index, member)| {
        let member = member.as_array()?;
        if member.len() != 7 { return None; }
        let mut value = json!({"key": format!("shared-{index}"), "speciesId": member[0], "shiny": member[2], "x": member[3], "z": member[4], "rotation": member[5], "scale": member[6]});
        if member[1].as_str() != Some("") { value["formId"] = member[1].clone(); }
        Some(value)
    }).collect();
    let mut scene = json!({"id": "shared-scene", "name": "Shared scene", "members": members?, "settings": settings});
    if let Some(camera) = object.get("c") {
        scene["camera"] = camera.clone();
    }
    parse_scene(&scene)
}
