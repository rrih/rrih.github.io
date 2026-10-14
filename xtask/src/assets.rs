//! Asset acquisition, publication validation, and conversion preservation checks.
//! JavaScript is used only as an adapter to Sharp and glTF Transform/Draco.
use crate::Result;
use atlas_app::core::catalog;
use serde::Serialize;
use serde_json::{Value, json};
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
    sync::{
        Mutex,
        atomic::{AtomicU16, Ordering},
    },
};

fn require(condition: bool, message: impl Into<String>) -> Result {
    if condition {
        Ok(())
    } else {
        Err(message.into().into())
    }
}

fn document(data: &[u8]) -> Result<Value> {
    require(data.len() >= 20, "Truncated GLB header")?;
    let word = |offset| u32::from_le_bytes(data[offset..offset + 4].try_into().unwrap());
    require(
        &data[..4] == b"glTF" && word(4) == 2 && word(8) as usize == data.len(),
        "Invalid GLB header",
    )?;
    let length = word(12) as usize;
    require(word(16) == 0x4e4f534a, "Missing GLB JSON chunk")?;
    let end = 20_usize.checked_add(length).ok_or("GLB chunk overflow")?;
    require(end <= data.len(), "Truncated GLB JSON chunk")?;
    Ok(serde_json::from_slice(&data[20..end])?)
}

fn nonempty(value: &Value) -> bool {
    value.as_array().is_some_and(|items| !items.is_empty())
}

fn validate_model(data: &[u8]) -> Result {
    let document = document(data)?;
    require(
        nonempty(&document["meshes"]) && nonempty(&document["nodes"]),
        "Empty model",
    )?;
    let colored = document["materials"].as_array().is_some_and(|materials| {
        materials.iter().any(|material| {
            material["pbrMetallicRoughness"]["baseColorFactor"]
                .as_array()
                .is_some_and(|color| {
                    color
                        .iter()
                        .take(3)
                        .any(|value| value.as_f64().is_some_and(|value| value < 1.0))
                })
        })
    });
    require(
        nonempty(&document["images"]) || colored,
        "Missing surface colors",
    )?;
    let animations = document["animations"]
        .as_array()
        .ok_or("Missing character motion")?;
    require(
        animations
            .iter()
            .any(|animation| nonempty(&animation["channels"])),
        "Missing character motion",
    )?;
    require(
        animations.len() == 1 && animations[0]["name"] == "HOME Idle",
        "Missing native HOME idle",
    )?;
    for kind in ["buffers", "images"] {
        if let Some(resources) = document[kind].as_array() {
            for resource in resources {
                if let Some(uri) = resource["uri"].as_str() {
                    require(
                        uri.is_empty() || uri.starts_with("data:"),
                        format!("Unbundled {kind}"),
                    )?;
                }
            }
        }
    }
    let nodes = document["nodes"].as_array().ok_or("Missing nodes")?;
    for animation in animations {
        let samplers = animation["samplers"]
            .as_array()
            .ok_or("Missing animation samplers")?;
        for channel in animation["channels"]
            .as_array()
            .ok_or("Missing animation channels")?
        {
            require(
                channel["target"]["node"]
                    .as_u64()
                    .is_some_and(|index| index < nodes.len() as u64)
                    && channel["sampler"]
                        .as_u64()
                        .is_some_and(|index| index < samplers.len() as u64),
                "Invalid motion",
            )?;
        }
    }
    Ok(())
}

fn asset_path(url: &str, shiny: bool) -> Result<PathBuf> {
    let prefix = if shiny {
        "/atlas/models/shiny-home/"
    } else {
        "/atlas/models/home/"
    };
    let name = url.strip_prefix(prefix).ok_or("Unbundled model URL")?;
    let stem = name.strip_suffix(".glb").ok_or("Invalid model suffix")?;
    require(
        !stem.is_empty() && stem.bytes().all(|byte| byte.is_ascii_digit()),
        "Invalid model filename",
    )?;
    Ok(Path::new("atlas/public").join(url.strip_prefix("/atlas/").unwrap()))
}

#[derive(Default, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Inventory {
    count: usize,
    shiny_count: usize,
    bytes: u64,
}

fn verify_inventory() -> Result<Inventory> {
    let mut result = Inventory::default();
    for (id, model) in catalog::models() {
        for (url, shiny) in
            std::iter::once((&model.url, false)).chain(model.shiny.iter().map(|url| (url, true)))
        {
            let checked = || -> Result<usize> {
                let data = fs::read(asset_path(url, shiny)?)?;
                validate_model(&data)?;
                Ok(data.len())
            };
            result.bytes += checked().map_err(|error| {
                format!("Model {id}{}: {error}", if shiny { " shiny" } else { "" })
            })? as u64;
            if shiny {
                result.shiny_count += 1;
            } else {
                result.count += 1;
            }
        }
    }
    require(
        result.count == 1025 && result.shiny_count == 150 && result.bytes > 1_000_000,
        "Incomplete bundled model inventory",
    )?;
    Ok(result)
}

pub fn verify() -> Result {
    println!("{}", serde_json::to_string(&verify_inventory()?)?);
    Ok(())
}

fn convert(request: Value) -> Result {
    let status = Command::new("node")
        .arg("atlas/scripts/asset-library-bridge.mjs")
        .arg(serde_json::to_string(&request)?)
        .status()?;
    require(
        status.success(),
        format!("Asset library conversion failed ({status})"),
    )
}

pub fn prepare_artwork() -> Result {
    let output = Path::new("atlas/public/artwork");
    fs::create_dir_all(output)?;
    let next = AtomicU16::new(1);
    let completed = AtomicU16::new(0);
    let failures = Mutex::new(Vec::new());
    std::thread::scope(|scope| {
        for _ in 0..12 {
            scope.spawn(|| loop {
                let id = next.fetch_add(1, Ordering::Relaxed);
                if id > 1025 { break; }
                let path = output.join(format!("{id}.webp"));
                if path.exists() { continue; }
                let input = output.join(format!(".{id}.source.png"));
                let temporary = output.join(format!(".{id}.webp.tmp"));
                let convert_one = || -> Result {
                    let url = format!("https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/{id}.png");
                    let mut fetched = false;
                    for _ in 0..3 {
                        if Command::new("curl").args(["--fail", "--silent", "--show-error", "--location", "--max-time", "45", "--output"]).arg(&input).arg(&url).status()?.success() {
                            fetched = true;
                            break;
                        }
                    }
                    require(fetched, format!("Unavailable {id}"))?;
                    convert(json!({"operation":"artwork", "input":input, "output":temporary, "resize":{"width":192,"height":192,"fit":"inside"}, "webp":{"quality":78,"effort":5}}))?;
                    fs::rename(&temporary, &path)?;
                    Ok(())
                };
                match convert_one() {
                    Ok(()) => {
                        let count = completed.fetch_add(1, Ordering::Relaxed) + 1;
                        if count.is_multiple_of(100) { println!("Artwork: {count}"); }
                    }
                    Err(error) => failures.lock().unwrap().push(json!({"id":id,"error":error.to_string()})),
                }
                let _ = fs::remove_file(input);
                let _ = fs::remove_file(temporary);
            });
        }
    });
    let failures = failures.into_inner().unwrap();
    println!(
        "{}",
        json!({"completed":completed.load(Ordering::Relaxed),"failures":failures})
    );
    require(failures.is_empty(), "Artwork preparation failed")
}

#[derive(Debug, PartialEq)]
struct ModelSnapshot {
    animation_metadata: Vec<Value>,
    channels: usize,
    visibility: Vec<Value>,
    materials: Vec<Value>,
}

fn snapshot(document: &Value) -> Result<ModelSnapshot> {
    let animations = document["animations"]
        .as_array()
        .ok_or("Missing prepared animation")?;
    require(!animations.is_empty(), "Missing prepared animation")?;
    let animation_metadata = animations
        .iter()
        .map(|animation| {
            json!([
                animation["name"].as_str().unwrap_or(""),
                animation.get("extras").cloned().unwrap_or(json!({}))
            ])
        })
        .collect();
    let channels = animations
        .iter()
        .map(|animation| animation["channels"].as_array().map_or(0, Vec::len))
        .sum();
    let mut visibility = Vec::new();
    let mut materials = Vec::new();
    if let Some(nodes) = document["nodes"].as_array() {
        for node in nodes {
            let name = node["name"].as_str().unwrap_or("");
            if let Some(value) = node["extras"].get("homeVisibility")
                && !value.is_null()
                && value != false
                && value != 0
                && value != ""
            {
                visibility.push(json!([name, value]));
            }
            if let Some(mesh) = node["mesh"]
                .as_u64()
                .and_then(|index| document["meshes"].get(index as usize))
                && let Some(primitives) = mesh["primitives"].as_array()
            {
                for (index, primitive) in primitives.iter().enumerate() {
                    if let Some(extras) = primitive["material"]
                        .as_u64()
                        .and_then(|index| document["materials"].get(index as usize))
                        .and_then(|material| material["extras"].as_object())
                        && !extras.is_empty()
                    {
                        materials.push(json!([name, index, extras]));
                    }
                }
            }
        }
    }
    visibility.sort_by_key(Value::to_string);
    materials.sort_by_key(Value::to_string);
    Ok(ModelSnapshot {
        animation_metadata,
        channels,
        visibility,
        materials,
    })
}

pub fn optimize_home_models(args: &[String]) -> Result {
    require(
        args.len() <= 2,
        "atlas-optimize-models [directory] [report]",
    )?;
    let directory = Path::new(
        args.first()
            .map(String::as_str)
            .unwrap_or("atlas/public/models/home"),
    );
    let report_file = Path::new(
        args.get(1)
            .map(String::as_str)
            .unwrap_or("atlas/scripts/data/home-optimization-audit.json"),
    );
    let mut files = fs::read_dir(directory)?
        .map(|entry| entry.map(|entry| entry.path()))
        .collect::<std::io::Result<Vec<_>>>()?;
    files.retain(|file| file.extension().is_some_and(|extension| extension == "glb"));
    files.sort();
    let mut report = Vec::new();
    let mut total = 0_u64;
    for file in files {
        let data = fs::read(&file)?;
        let before = snapshot(&document(&data)?)?;
        let temporary = PathBuf::from(format!("{}.tmp", file.display()));
        let optimize_one = || -> Result<Vec<u8>> {
            convert(
                json!({"operation":"model", "input":file,"output":temporary,"draco":{"method":"edgebreaker","quantizePosition":14,"quantizeNormal":10,"quantizeTexcoord":12},"texture":{"targetFormat":"webp","lossless":true,"effort":50}}),
            )?;
            let output = fs::read(&temporary)?;
            let after = snapshot(&document(&output)?)?;
            require(
                after == before,
                format!(
                    "Animation, visibility or material metadata changed: {}",
                    file.display()
                ),
            )?;
            Ok(output)
        };
        let converted = match optimize_one() {
            Ok(data) => data,
            Err(error) => {
                let _ = fs::remove_file(&temporary);
                return Err(error);
            }
        };
        fs::rename(&temporary, &file)?;
        let id = file
            .file_stem()
            .and_then(|stem| stem.to_str())
            .and_then(|stem| {
                stem.split(|character: char| !character.is_ascii_digit())
                    .next()
            })
            .and_then(|number| number.parse::<u16>().ok());
        total += converted.len() as u64;
        report.push(json!({"id":id,"before":data.len(),"after":converted.len(),"animations":before.animation_metadata.len(),"channels":before.channels,"visibilityTracks":before.visibility.len()}));
        if report.len().is_multiple_of(25) {
            println!("Optimized {} models", report.len());
        }
    }
    require(
        total <= 900_000_000,
        format!("Model payload exceeds the 900 MB publication budget: {total}"),
    )?;
    if let Some(parent) = report_file.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(
        report_file,
        serde_json::to_string_pretty(&json!({"totalBytes":total,"models":report}))?,
    )?;
    println!(
        "Verified {} models: {:.1} MB",
        report.len(),
        total as f64 / 1e6
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fixture() -> Value {
        json!({"asset":{"version":"2.0"},"meshes":[{}],"nodes":[{}],"images":[{"bufferView":0}],"buffers":[{"byteLength":0}],"animations":[{"name":"HOME Idle","samplers":[{}],"channels":[{"target":{"node":0},"sampler":0}]}]})
    }
    fn glb(value: &Value) -> Vec<u8> {
        let mut json = serde_json::to_vec(value).unwrap();
        while !json.len().is_multiple_of(4) {
            json.push(b' ');
        }
        let mut data = b"glTF".to_vec();
        data.extend(2_u32.to_le_bytes());
        data.extend(((20 + json.len()) as u32).to_le_bytes());
        data.extend((json.len() as u32).to_le_bytes());
        data.extend(0x4e4f534a_u32.to_le_bytes());
        data.extend(json);
        data
    }
    #[test]
    fn bundled_models_are_complete() {
        let root = Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap();
        std::env::set_current_dir(root).unwrap();
        let result = verify_inventory().unwrap();
        assert_eq!((result.count, result.shiny_count), (1025, 150));
        assert!(result.bytes > 1_000_000);
    }
    #[test]
    fn glb_validation_rejects_corruption_external_data_and_invalid_motion() {
        let valid = glb(&fixture());
        validate_model(&valid).unwrap();
        for end in 0..valid.len() {
            assert!(validate_model(&valid[..end]).is_err());
        }
        for (pointer, invalid) in [
            ("/meshes", json!([])),
            ("/nodes", json!([])),
            ("/images", json!([])),
            ("/buffers/0/uri", json!("https://example.com/model.bin")),
            ("/images/0/uri", json!("../image.png")),
            ("/animations/0/name", json!("Synthetic walk")),
            ("/animations/0/channels/0/target/node", json!(1)),
            ("/animations/0/channels/0/sampler", json!(1)),
            ("/animations/0/channels", json!([])),
        ] {
            let mut value = fixture();
            let (parent, key) = pointer.rsplit_once('/').unwrap();
            if let Some(slot) = value.pointer_mut(pointer) {
                *slot = invalid;
            } else {
                value.pointer_mut(parent).unwrap()[key] = invalid;
            }
            assert!(validate_model(&glb(&value)).is_err(), "{pointer}");
        }
        let mut colored = fixture();
        colored["images"] = json!([]);
        colored["materials"] = json!([{"pbrMetallicRoughness":{"baseColorFactor":[1,0.5,1,1]}}]);
        validate_model(&glb(&colored)).unwrap();
        assert!(asset_path("/atlas/models/home/../1.glb", false).is_err());
        assert!(asset_path("https://example.com/1.glb", false).is_err());
        assert!(asset_path("/atlas/models/home/1.glb", true).is_err());
    }
    #[test]
    fn conversion_snapshot_detects_lost_animation_and_source_metadata() {
        let mut value = fixture();
        value["nodes"][0] = json!({"name":"body","mesh":0,"extras":{"homeVisibility":{"times":[0,1],"values":[true,false]}}});
        value["meshes"][0] = json!({"primitives":[{"material":0}]});
        value["materials"] = json!([{"extras":{"sourceMaterial":"body.mat"}}]);
        value["animations"][0]["extras"] = json!({"source":"HOME"});
        let expected = snapshot(&value).unwrap();
        assert_eq!(expected.channels, 1);
        assert_eq!(expected.visibility.len(), 1);
        assert_eq!(expected.materials.len(), 1);
        for pointer in [
            "/animations/0/extras",
            "/nodes/0/extras/homeVisibility",
            "/materials/0/extras",
        ] {
            let mut changed = value.clone();
            *changed.pointer_mut(pointer).unwrap() = json!({});
            assert_ne!(snapshot(&changed).unwrap(), expected);
        }
    }
}
