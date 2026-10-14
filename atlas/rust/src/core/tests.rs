use super::{
    catalog::*, forms::*, locales::*, previews::*, routes::*, scene_files::*, scene_link::*,
    scene_studio::*, seo::*, types::*,
};
use serde_json::{Value, json};
use std::collections::{BTreeMap, HashSet};

fn scene() -> SavedScene {
    SavedScene {
        id: "scene-1".into(),
        name: "A quiet afternoon".into(),
        members: vec![SceneMember {
            key: "member-1".into(),
            species_id: 6,
            form_id: None,
            shiny: false,
            x: 0.0,
            z: 0.0,
            rotation: 0.0,
            scale: 1.0,
        }],
        settings: ViewerSettings::default(),
        camera: Some(CameraPose {
            position: [4.0, 3.0, 7.0],
            target: [0.0, 1.0, 0.0],
        }),
    }
}

#[test]
fn complete_sourced_catalog_and_form_inventory() {
    assert_eq!(pokemon().len(), 1025);
    assert_eq!(models().len(), 1025);
    for (index, entry) in pokemon().iter().enumerate() {
        assert_eq!(usize::from(entry.id), index + 1);
        assert!(!entry.name.is_empty() && !entry.ja.is_empty() && !entry.description.is_empty());
        assert_eq!(entry.stats.len(), 6);
        assert!(entry.stats.iter().all(|v| (1..=255).contains(v)));
        assert!((1..=9).contains(&entry.generation));
        assert!(entry.height > 0.0 && entry.weight > 0.0);
        if let Some(parent) = entry.evolves_from {
            assert!(pokemon_by_id(parent).is_some());
        }
        assert!(models()[&entry.id].url.starts_with("/atlas/models/"));
        assert!(models()[&entry.id].url.ends_with(".glb"));
        assert!(entry.source_url.is_some() && entry.verified_at.is_some());
    }
    assert_eq!(forms().len(), 120);
    assert_eq!(
        forms().iter().filter(|form| form.kind == "mega").count(),
        62
    );
    assert_eq!(
        forms()
            .iter()
            .filter(|form| form.kind == "regional")
            .count(),
        58
    );
    let unique: HashSet<_> = forms().iter().map(|form| &form.id).collect();
    assert_eq!(unique.len(), forms().len());
    for form in forms() {
        assert!(pokemon_by_id(form.species_id).is_some());
        assert_eq!(form.stats.len(), 6);
        assert!(form.stats.iter().all(|v| (1..=255).contains(v)));
        assert_eq!(
            model_for(form.species_id, Some(&form.id)),
            Some(&form.model)
        );
        assert!(form.model.url.starts_with("/atlas/models/forms/"));
    }
    for entry in pokemon() {
        let labels: HashSet<_> = forms_for(entry.id)
            .iter()
            .map(|form| form_label(form, str::to_owned))
            .collect();
        assert_eq!(labels.len(), forms_for(entry.id).len());
    }
}

#[test]
fn search_preserves_all_scripts_and_combined_filters() {
    for (query, id) in [
        ("ピカチュウ", 25),
        ("  CHARIZARD ", 6),
        ("#0025", 25),
        ("Dracaufeu", 6),
        ("Glurak", 6),
        ("リザードン", 6),
        ("りざーどん", 6),
        ("ﾘｻﾞｰﾄﾞﾝ", 6),
        ("喷火龙", 6),
        ("噴火龍", 6),
        ("리자몽", 6),
        ("Pêchaminus", 1025),
        ("Pechaminus", 1025),
        ("＃００２５", 25),
        ("#٠٠٢٥", 25),
        ("००२५", 25),
        ("০০২৫", 25),
        ("๒๕", 25),
    ] {
        assert_eq!(
            filter_pokemon(query, 0, "", None)
                .iter()
                .map(|p| p.id)
                .collect::<Vec<_>>(),
            vec![id],
            "{query}"
        );
    }
    assert!(filter_pokemon("Pikachu", 9, "", None).is_empty());
    assert!(filter_pokemon("no-such-pokemon", 0, "", None).is_empty());
    assert!(filter_pokemon("", 0, "", Some(&HashSet::new())).is_empty());
    assert_eq!(
        filter_pokemon("", 1, "fire", Some(&HashSet::from([4, 6, 25])))
            .iter()
            .map(|p| p.id)
            .collect::<Vec<_>>(),
        vec![4, 6]
    );
    let number_search: Vec<Vec<u16>> =
        serde_json::from_str(include_str!("legacy_number_search.json")).unwrap();
    for id in 1_u16..=1025 {
        assert_eq!(
            filter_pokemon(&format!("#{id:04}"), 0, "", None)
                .iter()
                .map(|p| p.id)
                .collect::<Vec<_>>(),
            number_search[usize::from(id) - 1]
        );
    }
    assert_eq!(
        parse_favorites(Some("[6,25,25,0,1026,2.5,\"6\",null]")),
        HashSet::from([6, 25])
    );
    assert!(parse_favorites(Some("{broken")).is_empty());
}

#[test]
fn locale_selection_aliases_and_interpolation() {
    assert_eq!(LOCALES.len(), 49);
    for (code, _, _) in LOCALES {
        assert_eq!(resolve_locale(code), Some(code));
    }
    for (tag, expected) in [
        ("ZH_hant_HK", "zh-Hant"),
        ("zh-CN", "zh-Hans"),
        ("zh-Hans-TW", "zh-Hans"),
        ("zh-Hant-CN", "zh-Hant"),
        ("pt-BR", "pt-BR"),
        ("pt-PT", "pt"),
        ("es-MX", "es-419"),
        ("es-ES", "es"),
        ("no-NO", "nb"),
        ("tl-PH", "fil"),
        ("iw-IL", "he"),
        ("in-ID", "id"),
    ] {
        assert_eq!(resolve_locale(tag), Some(expected));
    }
    assert_eq!(
        preferred_locale(Some("fr-CA"), Some("ja"), &["ko-KR".into()]),
        "fr"
    );
    assert_eq!(
        preferred_locale(Some("unsupported"), Some("ar"), &["ja".into()]),
        "ar"
    );
    assert_eq!(
        preferred_locale(None, Some("unsupported"), &["xx".into(), "zh-TW".into()]),
        "zh-Hant"
    );
    assert_eq!(preferred_locale(None, None, &[]), "en");
    assert_eq!(resolve_locale("<script>"), None);
    assert_eq!(
        LOCALES
            .iter()
            .filter(|(code, _, _)| is_rtl(code))
            .map(|(code, _, _)| *code)
            .collect::<Vec<_>>(),
        vec!["ar", "he", "fa", "ur"]
    );
    let dictionary = BTreeMap::from([
        ("View {name}".into(), "{name} ansehen".into()),
        ("{count} saved".into(), "{count} gespeichert".into()),
    ]);
    assert_eq!(
        translate(&dictionary, "View {name}", &[("name", "$&".into())]),
        "$& ansehen"
    );
    assert_eq!(
        translate(&dictionary, "{count} saved", &[("count", "0".into())]),
        "0 gespeichert"
    );
    assert_eq!(translate(&dictionary, "View {name}", &[]), "{name} ansehen");
    assert_eq!(normalize_search("  POKÉMON  "), "pokemon");
}

#[test]
fn complete_japanese_catalog_reuses_primary_without_an_overlay() {
    let primary: Value =
        serde_json::from_str(include_str!("../../../public/locales/catalog/ja.json")).unwrap();
    let fallback: Value =
        serde_json::from_str(include_str!("../../../public/locales/catalog/ja-Hrkt.json")).unwrap();
    assert_eq!(primary["species"].as_object().unwrap().len(), 1025);
    assert_eq!(fallback["species"].as_object().unwrap().len(), 1025);
    assert!(supplement_catalog(&primary, &fallback).is_none());
}

#[test]
fn japanese_catalog_supplements_only_missing_primary_fields() {
    let primary = json!({
        "locale": "ja",
        "species": {
            "1": {"name": "", "genus": null, "sourceLabel": "primary"},
            "2": null,
            "3": false,
            "4": {"name": "primary only"}
        },
        "types": {"grass": "primary grass"}
    });
    let fallback = json!({
        "locale": "ja-Hrkt",
        "species": {
            "1": {"name": "kana", "genus": "kana genus", "description": "kana text", "sourceLabel": "kana"},
            "2": {"name": "kana two"},
            "3": [],
            "5": {"name": "fallback only"}
        },
        "types": {"grass": "kana grass", "fire": "kana fire"}
    });
    let original = primary.clone();
    let merged = supplement_catalog(&primary, &fallback).unwrap();
    assert_eq!(
        merged,
        json!({
            "locale": "ja",
            "species": {
                "1": {"name": "", "genus": null, "sourceLabel": "primary", "description": "kana text"},
                "2": {"name": "kana two"},
                "3": {},
                "4": {"name": "primary only"}
            },
            "types": {"grass": "primary grass"}
        })
    );
    assert_eq!(primary, original);
    assert!(supplement_catalog(&merged, &fallback).is_none());
}

#[test]
fn routes_round_trip_all_species_forms_and_supported_locales() {
    assert!(parse_atlas_route("/").is_none());
    for locale in SEO_LOCALES {
        let home = AtlasPage::Home;
        assert_eq!(
            parse_atlas_route(&atlas_path(&home, locale)),
            Some(AtlasRoute {
                page: home,
                locale: locale.into()
            })
        );
        for entry in pokemon() {
            let page = AtlasPage::Pokemon {
                id: entry.id,
                form_id: None,
            };
            assert_eq!(
                parse_atlas_route(&atlas_path(&page, locale)),
                Some(AtlasRoute {
                    page,
                    locale: locale.into()
                })
            );
        }
        for form in forms() {
            let page = AtlasPage::Pokemon {
                id: form.species_id,
                form_id: Some(form.id.clone()),
            };
            assert_eq!(
                parse_atlas_route(&atlas_path(&page, locale)),
                Some(AtlasRoute {
                    page,
                    locale: locale.into()
                })
            );
        }
    }
    for path in [
        "/atlas/no-such-page/",
        "/atlas/pokemon/0/",
        "/atlas/pokemon/1026/",
        "/atlas/pokemon/page/0/",
        "/atlas/pokemon/page/19/",
        "/atlas/types/invalid/",
        "/atlas/generations/10/",
        "/atlas/fr/help/",
        "/atlas/en/",
        "/atlass/",
    ] {
        assert!(parse_atlas_route(path).is_none(), "{path}");
    }
    assert_eq!(seo_locale("es-419"), "es");
    assert_eq!(seo_locale("fa"), "en");
    assert_eq!(seo_locale("zh-TW"), "zh-Hant");
    assert_eq!(atlas_path(&AtlasPage::Help, "fr"), "/atlas/help/");
    assert_eq!(asset_path("/models/home/6.glb"), "/atlas/models/home/6.glb");
    assert_eq!(
        asset_path("/atlas/models/home/6.glb"),
        "/atlas/models/home/6.glb"
    );
    for path in [
        "blob:https://rrih.github.io/background",
        "data:image/png;base64,a",
        "https://example.com/x",
        "//example.com/x",
        "#viewer",
    ] {
        assert_eq!(asset_path(path), path);
    }
    assert_eq!(
        parse_atlas_route("/atlas/ja/pokemon/6/index.html")
            .unwrap()
            .locale,
        "ja"
    );
}

#[test]
fn scene_parser_accepts_every_actual_species_form_and_habitat() {
    for entry in pokemon() {
        let mut candidate = scene();
        candidate.members[0].species_id = entry.id;
        assert!(parse_scene(&serde_json::to_value(&candidate).unwrap()).is_some());
        candidate.members[0].shiny = true;
        assert_eq!(
            parse_scene(&serde_json::to_value(&candidate).unwrap()).is_some(),
            models()[&entry.id].shiny.is_some()
        );
    }
    for form in forms() {
        for habitat in HABITATS {
            let mut candidate = scene();
            candidate.members[0].species_id = form.species_id;
            candidate.members[0].form_id = Some(form.id.clone());
            candidate.members[0].shiny = form.model.shiny.is_some();
            candidate.settings.habitat = habitat.into();
            candidate.settings.background_id = Some("caaf9e76-66de-47ec-b630-2cad2c0cfe70".into());
            assert_eq!(
                parse_scene(&serde_json::to_value(&candidate).unwrap()),
                Some(candidate.clone())
            );
            candidate.members[0].species_id = if form.species_id == 1 { 2 } else { 1 };
            assert!(parse_scene(&serde_json::to_value(&candidate).unwrap()).is_none());
        }
    }
}

#[test]
fn scene_parser_rejects_malformed_unsafe_and_out_of_bounds_values() {
    let original = serde_json::to_value(scene()).unwrap();
    for (field, values) in [
        (
            "speciesId",
            vec![json!(0), json!(-1), json!(1026), json!(1.5), json!("6")],
        ),
        ("x", vec![json!(-4.01), json!(4.01), json!("0")]),
        ("z", vec![json!(-4.01), json!(4.01), Value::Null]),
        ("rotation", vec![json!(-181), json!(181)]),
        ("scale", vec![json!(0), json!(0.39), json!(1.61)]),
        ("shiny", vec![json!(0), json!("false"), Value::Null]),
        ("key", vec![json!(""), json!("   "), json!("k".repeat(129))]),
        (
            "formId",
            vec![
                json!("unknown"),
                json!("https://example.com/model.glb"),
                Value::Null,
            ],
        ),
    ] {
        for value in values {
            let mut candidate = original.clone();
            candidate["members"][0][field] = value;
            assert!(parse_scene(&candidate).is_none(), "{field}");
        }
    }
    for (field, value) in [
        ("playing", json!("true")),
        ("rotate", json!(1)),
        ("speed", json!(0)),
        ("light", json!(2)),
        ("habitat", json!("space")),
        ("wireframe", Value::Null),
        ("shiny", json!("false")),
        ("quality", json!("ultra")),
        ("animation", json!(256)),
        ("animation", json!(0.5)),
        ("backgroundId", json!("https://example.com/private.png")),
    ] {
        let mut candidate = original.clone();
        candidate["settings"][field] = value;
        assert!(parse_scene(&candidate).is_none(), "{field}");
    }
    for name in ["".into(), "   ".into(), "あ".repeat(61), "🦊".repeat(61)] {
        let mut candidate = original.clone();
        candidate["name"] = json!(name);
        assert!(parse_scene(&candidate).is_none());
    }
    for camera in [
        Value::Null,
        json!({}),
        json!({"position":[0,0],"target":[0,0,0]}),
        json!({"position":[0,0,0],"target":[0,0,0]}),
        json!({"position":[101,0,0],"target":[100,0,0]}),
        json!({"position":[100,0,0],"target":[-100,0,0]}),
    ] {
        let mut candidate = original.clone();
        candidate["camera"] = camera;
        assert!(parse_scene(&candidate).is_none());
    }
    let mut injected = original.clone();
    injected["modelUrl"] = json!("https://untrusted.invalid/model.glb");
    injected["members"][0]["url"] = json!("https://untrusted.invalid/model.glb");
    injected["settings"]["secret"] = json!("private");
    assert_eq!(parse_scene(&injected), Some(scene()));
    let mut numeric = original.clone();
    numeric["members"][0]["speciesId"] = json!(6.0);
    numeric["settings"]["animation"] = json!(0.0);
    assert!(parse_scene(&numeric).is_some());
}

#[test]
fn scene_limits_and_corrupt_storage_are_preserved() {
    let mut full = scene();
    full.members = (0..6)
        .map(|i| SceneMember {
            key: format!("member-{i}"),
            ..full.members[0].clone()
        })
        .collect();
    assert!(parse_scene(&serde_json::to_value(&full).unwrap()).is_some());
    full.members[1].key = full.members[0].key.clone();
    assert!(parse_scene(&serde_json::to_value(&full).unwrap()).is_none());
    full.members[1].key = "other".into();
    full.members.push(SceneMember {
        key: "seventh".into(),
        ..full.members[0].clone()
    });
    assert!(parse_scene(&serde_json::to_value(&full).unwrap()).is_none());
    let state = StudioState {
        version: 1,
        active: true,
        draft: Some(scene()),
        saved: (0..12)
            .map(|i| SavedScene {
                id: format!("scene-{i}"),
                ..scene()
            })
            .collect(),
    };
    let written = studio_write(None, &state).unwrap();
    assert_eq!(read_studio(Some(&written)), state);
    for raw in [
        "{broken",
        "null",
        "[]",
        "{\"version\":2,\"active\":false,\"draft\":null,\"saved\":[]}",
        "{\"version\":1,\"active\":true,\"draft\":null,\"saved\":[]}",
    ] {
        assert_eq!(read_studio(Some(raw)), StudioState::default());
        assert!(studio_write(Some(raw), &StudioState::default()).is_none());
    }
    let mut invalid = state.clone();
    invalid.saved.push(scene());
    assert!(studio_write(Some(&written), &invalid).is_none());
    invalid = state.clone();
    invalid.saved[1].id = invalid.saved[0].id.clone();
    assert!(studio_write(Some(&written), &invalid).is_none());
}

#[test]
fn shared_scene_round_trip_excludes_private_data() {
    let mut source = scene();
    source.id = "private-local-id".into();
    source.name = "Private scene name".into();
    source.members = (0..6)
        .map(|index| SceneMember {
            key: format!("private-{index}"),
            species_id: if index % 2 == 0 { 6 } else { 1 },
            form_id: if index == 0 {
                Some("charizard-mega-x".into())
            } else {
                None
            },
            shiny: index == 0,
            x: -4.0 + index as f64,
            z: 4.0 - index as f64,
            rotation: -180.0 + index as f64 * 60.0,
            scale: 0.4 + index as f64 * 0.2,
        })
        .collect();
    let token = encode_scene_link(&source).unwrap();
    assert!(token.len() < 2048);
    let restored = decode_scene_link(Some(&token)).unwrap();
    for (a, b) in restored.members.iter().zip(source.members.iter()) {
        let mut b = b.clone();
        b.key = a.key.clone();
        assert_eq!(a, &b);
    }
    assert_eq!(restored.settings, source.settings);
    assert_eq!(restored.camera, source.camera);
    assert_eq!(restored.id, "shared-scene");
    source.settings.habitat = "custom".into();
    source.settings.background_id = Some("550e8400-e29b-41d4-a716-446655440000".into());
    let restored = decode_scene_link(encode_scene_link(&source).as_deref()).unwrap();
    assert_eq!(restored.settings.habitat, "studio");
    assert_eq!(restored.settings.background_id, None);
    for token in [None, Some(""), Some("?"), Some("a"), Some("eyJ2IjoyfQ")] {
        assert!(decode_scene_link(token).is_none());
    }
    assert!(decode_scene_link(Some(&"x".repeat(4097))).is_none());
}

#[test]
fn saved_camera_survives_json_storage_without_numeric_drift() {
    let mut original = scene();
    original.camera.as_mut().unwrap().position = [10.369606382515679, 7.0, 13.0];
    let text = serde_json::to_string(&original).unwrap();
    let restored = parse_scene(&serde_json::from_str(&text).unwrap()).unwrap();
    assert_eq!(restored.camera, original.camera);
    assert_eq!(
        encode_scene_link(&restored),
        encode_scene_link(&original),
        "Reloading storage must not manufacture a different shared scene"
    );
}

#[test]
fn shared_reload_preserves_local_identity_across_json_encoders() {
    use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
    let mut local = scene();
    local.settings.habitat = "custom".into();
    local.settings.background_id = Some("550e8400-e29b-41d4-a716-446655440000".into());
    let token = encode_scene_link(&local).unwrap();
    let text = String::from_utf8(URL_SAFE_NO_PAD.decode(&token).unwrap()).unwrap();
    // JSON.stringify writes integral coordinates without Rust's `.0` suffix.
    let legacy_token = URL_SAFE_NO_PAD.encode(text.replace(".0", ""));
    assert_ne!(token, legacy_token);
    let shared = decode_scene_link(Some(&legacy_token)).unwrap();
    assert!(matches_shared_scene(&local, &shared));
    for changed in ["member", "camera", "settings"] {
        let mut different = shared.clone();
        match changed {
            "member" => different.members[0].x += 1.0,
            "camera" => different.camera.as_mut().unwrap().position[0] += 1.0,
            _ => different.settings.playing = !different.settings.playing,
        }
        assert!(!matches_shared_scene(&local, &different), "{changed}");
    }
}

#[test]
fn scene_files_avoid_unused_photos_and_refuse_untrusted_backgrounds() {
    let mut source = scene();
    source.settings.habitat = "forest".into();
    source.settings.background_id = Some("caaf9e76-66de-47ec-b630-2cad2c0cfe70".into());
    let exported = export_scene(&source, None).unwrap();
    let data: Value = serde_json::from_str(&exported).unwrap();
    assert!(data.get("background").is_none());
    assert!(data["scene"]["settings"].get("backgroundId").is_none());
    assert!(source.settings.background_id.is_some());
    for background in [
        json!("https://example.com/private.png"),
        json!("data:image/svg+xml;base64,PHN2Zy8+"),
        json!("javascript:alert(1)"),
        json!("data:image/png;base64,not base64"),
        json!(42),
    ] {
        assert!(
            read_scene_file(
                serde_json::to_string(&json!({"version":1,"scene":source,"background":background}))
                    .unwrap()
                    .as_bytes()
            )
            .is_err()
        );
    }
    assert_eq!(
        read_scene_file(&vec![0; MAX_SCENE_FILE_BYTES + 1]),
        Err(SceneFileError::OversizedScene)
    );
    assert_eq!(
        decode_background("data:image/png;base64,YQ==")
            .unwrap()
            .bytes,
        b"a"
    );
    assert!(
        read_scene_file(exported.as_bytes())
            .unwrap()
            .background
            .is_none()
    );
}

#[test]
fn seo_identity_and_translation_match_existing_contracts() {
    for locale in SEO_LOCALES {
        let seo = build_index_seo(&AtlasPage::Home, locale, &IndexSeoOptions::default());
        assert_eq!(
            seo.canonical,
            format!("{SITE_ORIGIN}{}", atlas_path(&AtlasPage::Home, locale))
        );
        assert!(!seo.title.contains("Charizard"));
        assert_eq!(seo.alternates.len(), SEO_LOCALES.len() + 1);
    }
    let entry = pokemon_by_id(6).unwrap();
    let mut input = PokemonSeoInput::new(entry, "Charizard", "en");
    input.type_names = Some(vec!["Fire".into(), "Flying".into()]);
    let baseline = build_pokemon_seo(&input);
    input.type_names = Some(vec!["fire".into(), "flying".into()]);
    assert_eq!(build_pokemon_seo(&input), baseline);
    input.locale = "fa".into();
    input.localized.name = "پوکمون".into();
    input.type_names = Some(vec!["آتش".into(), "پرواز".into()]);
    assert_eq!(build_pokemon_seo(&input), baseline);
    input = PokemonSeoInput::new(entry, "メガリザードンX", "ja");
    input.pokemon.types = vec!["fire".into(), "dragon".into()];
    input.pokemon.weight = 110.5;
    input.form = Some(SeoForm {
        id: "charizard-mega-x".into(),
        name: None,
    });
    input.base_name = Some("リザードン".into());
    input.type_names = Some(vec!["ほのお".into(), "ドラゴン".into()]);
    let seo = build_pokemon_seo(&input);
    assert_eq!(
        seo.canonical,
        "https://rrih.github.io/atlas/ja/pokemon/6/forms/charizard-mega-x/"
    );
    assert_eq!(seo.image_alt, "リザードン · 通常のすがた");
    assert!(seo.description.contains("ドラゴン"));
    assert_eq!(
        build_index_seo(&AtlasPage::Help, "fr", &IndexSeoOptions::default()).language,
        "en"
    );
    assert_eq!(
        build_index_seo(&AtlasPage::Help, "ja", &IndexSeoOptions::default())
            .alternates
            .len(),
        3
    );
}

#[test]
fn preview_inventory_uses_real_assets_and_correct_fallbacks() {
    for entry in pokemon() {
        assert_eq!(
            preview_path(entry.id, None),
            Some(format!("/atlas/previews/{}.webp", entry.id))
        );
    }
    assert_eq!(preview_path(6, Some("unknown-form")), None);
    assert_eq!(
        preview_image(6, Some("unknown-form")),
        "/atlas/artwork/6.webp"
    );
}

fn legacy_digest(values: impl IntoIterator<Item = Value>) -> String {
    fn stable(value: Value) -> Value {
        match value {
            Value::Array(values) => Value::Array(values.into_iter().map(stable).collect()),
            Value::Object(object) => {
                let sorted: BTreeMap<_, _> = object.into_iter().collect();
                Value::Object(
                    sorted
                        .into_iter()
                        .map(|(key, value)| (key, stable(value)))
                        .collect(),
                )
            }
            other => other,
        }
    }
    let mut hash = 14_695_981_039_346_656_037_u64;
    for value in values {
        let encoded = serde_json::to_string(&stable(value)).unwrap() + "\n";
        for byte in encoded.bytes() {
            hash = (hash ^ u64::from(byte)).wrapping_mul(1_099_511_628_211);
        }
    }
    format!("{hash:016x}")
}

#[test]
fn every_species_form_and_index_matches_the_original_typescript_seo() {
    let baseline: Value = serde_json::from_str(include_str!("legacy_seo_digests.json")).unwrap();
    for expected in baseline["results"].as_array().unwrap() {
        let locale = expected["locale"].as_str().unwrap();
        let species = pokemon().iter().map(|entry| {
            let mut input = PokemonSeoInput::new(entry, &entry.name, locale);
            input.image = Some(preview_image(entry.id, None));
            serde_json::to_value(build_pokemon_seo(&input)).unwrap()
        });
        assert_eq!(
            legacy_digest(species),
            expected["pokemon"].as_str().unwrap(),
            "species metadata: {locale}"
        );
        let forms = forms().iter().map(|form| {
            let entry = pokemon_by_id(form.species_id).unwrap();
            let effective = form_pokemon(entry, Some(form));
            let mut input = PokemonSeoInput::new(
                &effective,
                form.names.get(locale).unwrap_or(&form.name),
                locale,
            );
            input.form = Some(SeoForm {
                id: form.id.clone(),
                name: Some(form.name.clone()),
            });
            input.base_name = Some(entry.name.clone());
            input.image = Some(preview_image(entry.id, Some(&form.id)));
            serde_json::to_value(build_pokemon_seo(&input)).unwrap()
        });
        assert_eq!(
            legacy_digest(forms),
            expected["forms"].as_str().unwrap(),
            "form metadata: {locale}"
        );
        let mut pages = vec![AtlasPage::Home];
        pages.extend((1..=18).map(|page| AtlasPage::Catalog { page: Some(page) }));
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
            AtlasPage::Help,
            AtlasPage::About,
        ]);
        let indexes = pages.iter().map(|page| {
            serde_json::to_value(build_index_seo(page, locale, &IndexSeoOptions::default()))
                .unwrap()
        });
        assert_eq!(
            legacy_digest(indexes),
            expected["indexes"].as_str().unwrap(),
            "index metadata: {locale}"
        );
    }
}
