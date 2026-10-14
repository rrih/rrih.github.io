use super::scene_studio::{SavedScene, parse_scene};
use base64::{
    Engine, alphabet,
    engine::{
        DecodePaddingMode,
        general_purpose::{GeneralPurpose, GeneralPurposeConfig},
    },
};
use serde_json::{Value, json};
use std::fmt;

pub const MAX_SCENE_FILE_BYTES: usize = 6 * 1024 * 1024;
pub const MAX_EMBEDDED_BACKGROUND_BYTES: usize = 4 * 1024 * 1024;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SceneFileError {
    OversizedScene,
    InvalidScene,
    InvalidBackground,
    OversizedBackground,
    MissingBackground,
}

impl fmt::Display for SceneFileError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::OversizedScene => "Oversized scene",
            Self::InvalidScene => "Invalid scene",
            Self::InvalidBackground => "Invalid background",
            Self::OversizedBackground => "Oversized background",
            Self::MissingBackground => "Missing background",
        })
    }
}
impl std::error::Error for SceneFileError {}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct EmbeddedBackground {
    pub mime: String,
    pub bytes: Vec<u8>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct ImportedScene {
    pub scene: SavedScene,
    pub background: Option<EmbeddedBackground>,
}

pub fn decode_background(value: &str) -> Result<EmbeddedBackground, SceneFileError> {
    let (header, encoded) = value
        .split_once(',')
        .ok_or(SceneFileError::InvalidBackground)?;
    let mime = match header {
        "data:image/png;base64" => "image/png",
        "data:image/jpeg;base64" => "image/jpeg",
        "data:image/webp;base64" => "image/webp",
        _ => return Err(SceneFileError::InvalidBackground),
    };
    let unpadded = encoded.trim_end_matches('=');
    if unpadded.is_empty()
        || encoded.len() - unpadded.len() > 2
        || !unpadded
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || c == b'+' || c == b'/')
    {
        return Err(SceneFileError::InvalidBackground);
    }
    let decoder = GeneralPurpose::new(
        &alphabet::STANDARD,
        GeneralPurposeConfig::new()
            .with_decode_padding_mode(DecodePaddingMode::Indifferent)
            .with_decode_allow_trailing_bits(true),
    );
    let bytes = decoder
        .decode(encoded)
        .map_err(|_| SceneFileError::InvalidBackground)?;
    if bytes.len() > MAX_EMBEDDED_BACKGROUND_BYTES {
        return Err(SceneFileError::OversizedBackground);
    }
    Ok(EmbeddedBackground {
        mime: mime.into(),
        bytes,
    })
}

/// The caller saves the validated raster locally, replaces its background ID, and gives the
/// imported scene a new random ID. This function never fetches a URL or accesses device storage.
pub fn read_scene_file(bytes: &[u8]) -> Result<ImportedScene, SceneFileError> {
    if bytes.len() > MAX_SCENE_FILE_BYTES {
        return Err(SceneFileError::OversizedScene);
    }
    let data: Value = serde_json::from_slice(bytes).map_err(|_| SceneFileError::InvalidScene)?;
    if data.get("version").and_then(Value::as_f64) != Some(1.0) {
        return Err(SceneFileError::InvalidScene);
    }
    let scene = data
        .get("scene")
        .and_then(parse_scene)
        .ok_or(SceneFileError::InvalidScene)?;
    let background = data
        .get("background")
        .map(|value| decode_background(value.as_str().ok_or(SceneFileError::InvalidBackground)?))
        .transpose()?;
    Ok(ImportedScene { scene, background })
}

/// The adapter supplies the data URL of the displayed local image, if one is required.
pub fn export_scene(
    scene: &SavedScene,
    background: Option<&str>,
) -> Result<String, SceneFileError> {
    let mut exported = scene.clone();
    if exported.settings.habitat != "custom" {
        exported.settings.background_id = None;
    }
    let mut document = json!({"version": 1, "scene": exported});
    if exported.settings.background_id.is_some() {
        let background = background
            .filter(|value| !value.is_empty())
            .ok_or(SceneFileError::MissingBackground)?;
        document["background"] = Value::String(background.into());
    }
    serde_json::to_string_pretty(&document).map_err(|_| SceneFileError::InvalidScene)
}
