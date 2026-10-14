use super::js::*;
use wasm_bindgen::{JsCast, prelude::*};

pub struct LoadedModel {
    pub key: String,
    pub url: String,
    pub points: Vec<f64>,
    pub normalization: J,
    pub base_scale: f64,
    pub stencil_bit: u32,
    pub group: J,
    pub scene: J,
    pub mixer: J,
    pub clips: Vec<J>,
    pub active_clip: usize,
    pub elapsed: f64,
    pub flames: Vec<J>,
}

pub fn dispose_object(root: &J) {
    let mut geometries = Vec::new();
    let mut materials_all = Vec::new();
    let mut textures = Vec::new();
    let mut skeletons = Vec::new();
    walk(root, false, &mut |mesh| {
        let geometry = mesh.get("geometry");
        if geometry.exists() && !geometries.contains(&geometry) {
            geometries.push(geometry)
        }
        for material in materials(&mesh) {
            if !materials_all.contains(&material) {
                for value in js_sys::Object::values(material.0.unchecked_ref())
                    .iter()
                    .map(J)
                {
                    if value.exists() && value.get("isTexture").yes() && !textures.contains(&value)
                    {
                        textures.push(value)
                    }
                }
                materials_all.push(material);
            }
        }
        if mesh.get("isSkinnedMesh").yes() {
            let s = mesh.get("skeleton");
            if !skeletons.contains(&s) {
                skeletons.push(s)
            }
        }
        if mesh.get("isInstancedMesh").yes() {
            mesh.call("dispose", &[]);
        }
    });
    for resource in geometries.into_iter().chain(materials_all).chain(skeletons) {
        resource.call("dispose", &[]);
    }
    for texture in textures {
        let image = texture.get("source").get("data");
        if image.exists() && image.get("close").0.is_function() {
            image.call("close", &[]);
        }
        texture.call("dispose", &[]);
    }
}

#[derive(Clone)]
pub struct Bounds {
    pub min: [f64; 3],
    pub max: [f64; 3],
}
impl Bounds {
    pub fn new() -> Self {
        Self {
            min: [f64::INFINITY; 3],
            max: [f64::NEG_INFINITY; 3],
        }
    }
    pub fn add(&mut self, p: [f64; 3]) {
        for (i, value) in p.into_iter().enumerate() {
            self.min[i] = self.min[i].min(value);
            self.max[i] = self.max[i].max(value);
        }
    }
    pub fn center(&self) -> [f64; 3] {
        std::array::from_fn(|i| (self.min[i] + self.max[i]) / 2.0)
    }
    pub fn longest(&self) -> f64 {
        (0..3)
            .map(|i| self.max[i] - self.min[i])
            .fold(0.0, f64::max)
    }
}
pub fn measure_motion(scene: &J, mixer: &J, clips: &[J]) -> (Bounds, Vec<f64>) {
    let mut bounds = Bounds::new();
    let mut points = Vec::new();
    let vertex = vector(0., 0., 0.);
    let position: &PositionVector = vertex.0.unchecked_ref();
    let inverse = new("Matrix4", &[]);
    let mut directions = Vec::new();
    for x in [-1., 0., 1.] {
        for y in [-1., 0., 1.] {
            for z in [-1., 0., 1.] {
                if x != 0. || y != 0. || z != 0. {
                    directions.push([x, y, z])
                }
            }
        }
    }
    let mut record = || {
        scene.call("updateWorldMatrix", &[true.into(), true.into()]);
        let parent = scene.get("parent");
        if parent.exists() {
            inverse
                .call("copy", &[parent.get("matrixWorld")])
                .call("invert", &[]);
        } else {
            inverse.call("identity", &[]);
        }
        let mut scores = [f64::NEG_INFINITY; 26];
        let mut extrema = [0.; 78];
        let mut found = false;
        walk(scene, true, &mut |mesh| {
            if !mesh.get("isMesh").yes() {
                return;
            }
            if materials(&mesh).iter().all(|m| {
                !m.get("visible").yes()
                    || m.get("opacity").num() <= 0.
                    || m.get("userData").get("homeStencil").0.is_truthy()
            }) {
                return;
            }
            let positions = mesh
                .get("geometry")
                .call("getAttribute", &["position".into()]);
            if !positions.exists() {
                return;
            }
            let world = mesh.get("matrixWorld");
            let positioned_mesh: &PositionMesh = mesh.0.unchecked_ref();
            for index in 0..positions.get("count").num() as usize {
                positioned_mesh
                    .get_vertex_position(index, position)
                    .unwrap_throw()
                    .apply_matrix4(&world.0)
                    .unwrap_throw()
                    .apply_matrix4(&inverse.0)
                    .unwrap_throw();
                let xyz = [position.x(), position.y(), position.z()];
                bounds.add(xyz);
                found = true;
                for (i, d) in directions.iter().enumerate() {
                    let score = xyz[0] * d[0] + xyz[1] * d[1] + xyz[2] * d[2];
                    if score > scores[i] {
                        scores[i] = score;
                        extrema[i * 3..i * 3 + 3].copy_from_slice(&xyz.map(|n| n as f32 as f64));
                    }
                }
            }
        });
        if found {
            points.extend_from_slice(&extrema)
        }
    };
    if clips.is_empty() {
        record()
    }
    for clip in clips {
        mixer.call("stopAllAction", &[]);
        mixer
            .call("clipAction", std::slice::from_ref(clip))
            .call("reset", &[])
            .call("play", &[]);
        let duration = clip.get("duration").num();
        let samples = (duration * 4.).ceil().clamp(8., 12.) as usize;
        for sample in 0..=samples {
            mixer.call(
                "setTime",
                &[(duration * sample as f64 / (samples + 1) as f64).into()],
            );
            record();
        }
    }
    mixer.call("stopAllAction", &[]);
    (bounds, points)
}
pub fn normalized_points(points: &[f64], normalization: &J) -> Vec<f64> {
    normalization.call("updateMatrix", &[]);
    let matrix = normalization.get("matrix");
    let point = vector(0., 0., 0.);
    let mut result = Vec::with_capacity(points.len());
    for xyz in points.as_chunks::<3>().0 {
        set_xyz(&point, xyz[0], xyz[1], xyz[2]);
        point.call("applyMatrix4", std::slice::from_ref(&matrix));
        result.extend(point.xyz().map(|n| n as f32 as f64));
    }
    result
}
pub fn contact_shadow() -> J {
    let document = web_sys::window().unwrap().document().unwrap();
    let canvas = J(document.create_element("canvas").unwrap().into());
    canvas.set("width", 128);
    canvas.set("height", 128);
    let context = canvas.call("getContext", &["2d".into()]);
    if context.exists() {
        let gradient = context.call(
            "createRadialGradient",
            &[
                64.into(),
                64.into(),
                4.into(),
                64.into(),
                64.into(),
                64.into(),
            ],
        );
        for (n, c) in [
            (0., "rgba(32, 43, 28, 0.3)"),
            (0.35, "rgba(32, 43, 28, 0.14)"),
            (1., "rgba(32, 43, 28, 0)"),
        ] {
            gradient.call("addColorStop", &[n.into(), c.into()]);
        }
        context.set("fillStyle", gradient);
        context.call("fillRect", &[0.into(), 0.into(), 128.into(), 128.into()]);
    }
    let texture = new("CanvasTexture", &[canvas]);
    let material = new(
        "MeshBasicMaterial",
        &[object(&[
            ("map", texture),
            ("transparent", true.into()),
            ("depthWrite", false.into()),
        ])],
    );
    let shadow = new(
        "Mesh",
        &[new("PlaneGeometry", &[4.3.into(), 3.3.into()]), material],
    );
    shadow
        .get("rotation")
        .set("x", -std::f64::consts::FRAC_PI_2);
    shadow.get("position").set("y", 0.008);
    shadow
}
fn surface_texture(roughness: bool) -> J {
    let mut pixels = vec![0u8; 128 * 128 * 4];
    for i in 0..128 * 128 {
        let noise = (((i + 1) as u32).wrapping_mul(1597334677)
            ^ ((i + 37) as u32).wrapping_mul(3812015801))
            % 23;
        let v = if roughness { 232 } else { 117 } + noise as u8;
        pixels[i * 4..i * 4 + 4].copy_from_slice(&[v, v, v, 255]);
    }
    let texture = new(
        "DataTexture",
        &[
            J(js_sys::Uint8Array::from(pixels.as_slice()).into()),
            128.into(),
            128.into(),
        ],
    );
    texture.set("wrapS", constant("RepeatWrapping"));
    texture.set("wrapT", constant("RepeatWrapping"));
    texture.get("repeat").call("set", &[12.into(), 12.into()]);
    texture.set("magFilter", constant("LinearFilter"));
    texture.set("minFilter", constant("LinearMipmapLinearFilter"));
    texture.set("generateMipmaps", true);
    texture.set("anisotropy", 4);
    texture.set("needsUpdate", true);
    texture
}
pub fn prepare_content(
    gltf: J,
    id: u16,
    key: String,
    url: String,
    animation: u8,
    wireframe: bool,
    stencil_bit: u32,
) -> Result<LoadedModel, JsValue> {
    let scene = gltf.get("scene");
    let clips = gltf.get("animations").list();
    if let Some(home) = clips.iter().find(|c| c.get("name").text() == "HOME Idle") {
        let animations = gltf.get("parser").get("json").get("animations");
        if animations.exists()
            && let Some(a) = animations
                .list()
                .iter()
                .find(|a| a.get("name").text() == "HOME Idle")
        {
            let duration = a.get("extras").get("homeDuration").num();
            if duration.is_finite() && duration > 0. && duration <= home.get("duration").num() {
                home.set("duration", duration);
            }
        }
        walk(&scene, false, &mut |object| {
            let visibility = object.get("userData").get("homeVisibility");
            if !visibility.exists() {
                return;
            }
            let times = visibility.get("times");
            let values = visibility.get("values");
            if !js_sys::Array::is_array(&times.0) || !js_sys::Array::is_array(&values.0) {
                return;
            }
            let ts = times.list();
            let vs = values.list();
            if ts.is_empty() || ts.len() != vs.len() {
                return;
            }
            let mut previous = 0.;
            for time in &ts {
                let Some(n) = time.0.as_f64() else { return };
                if !n.is_finite() || n < 0. || n < previous {
                    return;
                }
                previous = n;
            }
            if vs.iter().any(|v| v.0.as_bool().is_none()) {
                return;
            }
            home.get("tracks").call(
                "push",
                &[new(
                    "BooleanKeyframeTrack",
                    &[
                        format!("{}.visible", object.get("uuid").text()).into(),
                        times,
                        values,
                    ],
                )],
            );
        });
    }
    let mixer = new("AnimationMixer", std::slice::from_ref(&scene));
    let active = (animation as usize).min(clips.len().saturating_sub(1));
    let (bounds, points) = measure_motion(
        &scene,
        &mixer,
        clips.get(active).map(std::slice::from_ref).unwrap_or(&[]),
    );
    if let Some(clip) = clips.get(active) {
        mixer
            .call("clipAction", std::slice::from_ref(clip))
            .call("reset", &[])
            .call("play", &[]);
        mixer.call("setTime", &[0.into()]);
    }
    scene.call("updateMatrixWorld", &[true.into()]);
    let longest = bounds.longest();
    if !longest.is_finite() || longest <= 0. {
        dispose_object(&scene);
        return Err("Empty model".into());
    }
    let center = bounds.center();
    let scale = 3. / longest;
    let normalization = new("Group", &[]);
    normalization.call("add", std::slice::from_ref(&scene));
    normalization
        .get("scale")
        .call("setScalar", &[scale.into()]);
    set_xyz(
        &normalization.get("position"),
        -center[0] * scale,
        -bounds.min[1] * scale,
        -center[2] * scale,
    );
    let group = new("Group", &[]);
    group.set("name", format!("pokemon-{id}"));
    group.call("add", &[normalization.clone(), contact_shadow()]);
    let mut flames = Vec::new();
    let mut fine_bump = None;
    let mut fine_roughness = None;
    walk(&scene, false, &mut |mesh| {
        if !mesh.get("isMesh").yes() {
            return;
        }
        mesh.set("castShadow", true);
        mesh.set("receiveShadow", true);
        for material in materials(&mesh) {
            if js_sys::Reflect::has(&material.0, &"wireframe".into()).unwrap_or(false) {
                material.set("wireframe", wireframe);
            }
            if !material.get("isMeshStandardMaterial").yes() {
                continue;
            }
            let role = material
                .get("userData")
                .get("homeStencil")
                .get("role")
                .text();
            if role == "mask" || role == "core" {
                let mask = role == "mask";
                material.set("colorWrite", !mask);
                material.set("depthWrite", false);
                material.set("stencilWrite", true);
                material.set("stencilRef", stencil_bit);
                material.set("stencilFuncMask", stencil_bit);
                material.set(
                    "stencilFunc",
                    constant(if mask {
                        "AlwaysStencilFunc"
                    } else {
                        "EqualStencilFunc"
                    }),
                );
                material.set(
                    "stencilZPass",
                    constant(if mask {
                        "ReplaceStencilOp"
                    } else {
                        "KeepStencilOp"
                    }),
                );
                material.set("stencilWriteMask", if mask { stencil_bit } else { 0 });
                mesh.set("renderOrder", if mask { 2 } else { 3 });
                mesh.set("castShadow", false);
                mesh.set("receiveShadow", false);
            }
            if material.get("userData").get("homeBlend").text() == "additive" {
                material.set("blending", constant("AdditiveBlending"));
                material.set("transparent", true);
                material.set("depthWrite", false);
                mesh.set("castShadow", false);
                mesh.set("receiveShadow", false);
            }
            material.set("envMapIntensity", 0.65);
            let name = material.get("name").text();
            let lower = crate::core::case::lower(&name);
            let opaque = ["body", "skin", "shell", "scales", "fur"]
                .iter()
                .any(|s| lower.contains(s))
                && ![
                    "eye",
                    "mouth",
                    "fire",
                    "flame",
                    "mask",
                    "bodytra",
                    "transparent",
                ]
                .iter()
                .any(|s| lower.contains(s))
                && !material.get("transparent").yes()
                && material.get("opacity").num() == 1.
                && material.get("alphaTest").num() == 0.;
            if opaque
                && mesh
                    .get("geometry")
                    .call("hasAttribute", &["uv".into()])
                    .yes()
            {
                if !material.get("normalMap").exists() && !material.get("bumpMap").exists() {
                    let texture = fine_bump.get_or_insert_with(|| surface_texture(false));
                    material.set("bumpMap", texture.clone());
                    material.set("bumpScale", 0.0006);
                }
                if !material.get("roughnessMap").exists() {
                    let texture = fine_roughness.get_or_insert_with(|| surface_texture(true));
                    material.set("roughnessMap", texture.clone());
                    material.set("roughness", material.get("roughness").num().max(0.62));
                }
            }
            if id == 6
                && (name == "Material_15" || name == "Material_16")
                && material.get("map").exists()
            {
                material.get("color").call(
                    "set",
                    &[if name == "Material_15" {
                        "#ffca38"
                    } else {
                        "#ff731d"
                    }
                    .into()],
                );
                material.get("emissive").call(
                    "set",
                    &[if name == "Material_15" {
                        "#ffb526"
                    } else {
                        "#ff4d0d"
                    }
                    .into()],
                );
                material.set("emissiveMap", material.get("map"));
                material.set("alphaMap", material.get("map"));
                material.set("emissiveIntensity", 1.2);
                material.set("transparent", true);
                material.set("depthWrite", false);
                material.set("alphaTest", 0.08);
                mesh.set("castShadow", false);
                mesh.set("receiveShadow", false);
                flames.push(material);
            }
        }
    });
    Ok(LoadedModel {
        key,
        url,
        points: normalized_points(&points, &normalization),
        normalization,
        base_scale: 1.,
        stencil_bit,
        group,
        scene,
        mixer,
        clips,
        active_clip: active,
        elapsed: 0.,
        flames,
    })
}
