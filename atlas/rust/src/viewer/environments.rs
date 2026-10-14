use super::{js::*, models::dispose_object};
use std::{
    cell::Cell,
    f64::consts::{PI, TAU},
};
mod forest;

#[derive(Clone)]
pub struct Appearance {
    pub background: &'static str,
    pub ground: &'static str,
    pub fog_near: f64,
    pub fog_far: f64,
    pub exposure: f64,
    pub key_color: &'static str,
    pub key_intensity: f64,
    pub ground_light: &'static str,
    pub environment_intensity: f64,
}
pub fn appearance(kind: &str) -> Appearance {
    let mut a = Appearance {
        background: "#1b241c",
        ground: "#1c251d",
        fog_near: 20.,
        fog_far: 65.,
        exposure: 1.,
        key_color: "#ffffff",
        key_intensity: 3.1,
        ground_light: "#99a087",
        environment_intensity: 0.4,
    };
    match kind {
        "studio" => {
            a.fog_near = 16.;
            a.fog_far = 42.;
            a.key_intensity = 3.4;
            a.environment_intensity = 0.45;
        }
        "forest" => {
            a.background = "#243022";
            a.ground = "#40503a";
            a.fog_near = 16.;
            a.fog_far = 42.;
            a.key_color = "#fff5e5";
            a.key_intensity = 2.6;
            a.ground_light = "#7f9a66";
            a.environment_intensity = 0.3;
        }
        "night" => {
            a.background = "#17252c";
            a.ground = "#1f3034";
            a.fog_near = 16.;
            a.fog_far = 42.;
            a.exposure = 0.82;
            a.key_color = "#b6d5ff";
            a.ground_light = "#233d45";
            a.environment_intensity = 0.22;
        }
        "coast" => {
            a.background = "#8bb8c4";
            a.ground = "#c5b28d";
            a.ground_light = "#aaa995";
        }
        "snow" => {
            a.background = "#a3b8c6";
            a.ground = "#d1dce0";
            a.exposure = 0.9;
            a.ground_light = "#b8c9d4";
        }
        "desert" => {
            a.background = "#c5a885";
            a.ground = "#bd965f";
            a.key_color = "#fff4df";
            a.ground_light = "#ab8d61";
        }
        "meadow" => {
            a.background = "#91ada6";
            a.ground = "#6c8050";
            a.ground_light = "#92a06d";
        }
        "mountain" => {
            a.background = "#8da0b2";
            a.ground = "#686f65";
            a.fog_near = 28.;
            a.fog_far = 90.;
        }
        "cave" => {
            a.background = "#202631";
            a.ground = "#414649";
            a.fog_near = 14.;
            a.fog_far = 45.;
            a.exposure = 0.88;
            a.key_intensity = 2.7;
            a.environment_intensity = 0.28;
        }
        "underwater" => {
            a.background = "#245b67";
            a.ground = "#6f9990";
            a.fog_near = 9.;
            a.fog_far = 44.;
            a.key_color = "#def8ff";
            a.ground_light = "#42767a";
            a.key_intensity = 2.6;
        }
        "volcano" => {
            a.background = "#493c3c";
            a.ground = "#49423d";
            a.fog_far = 64.;
            a.ground_light = "#876b55";
            a.exposure = 0.92;
        }
        "wetland" => {
            a.background = "#79958b";
            a.ground = "#57674e";
            a.fog_near = 16.;
            a.fog_far = 53.;
            a.ground_light = "#819a71";
        }
        "sakura" => {
            a.background = "#acb2ae";
            a.ground = "#40503a";
            a.key_color = "#fff4f0";
            a.ground_light = "#8e9d78";
            a.key_intensity = 2.7;
        }
        "custom" => {
            a.ground = "#303730";
            a.fog_near = 28.;
            a.key_intensity = 3.4;
            a.environment_intensity = 0.45;
        }
        _ => {}
    }
    a
}
pub struct Environments {
    pub group: J,
    current: Option<Landscape>,
    key: String,
}
impl Environments {
    pub fn new() -> Self {
        let group = new("Group", &[]);
        group.set("name", "Surrounding landscape");
        Self {
            group,
            current: None,
            key: String::new(),
        }
    }
    pub fn set_habitat(&mut self, key: &str) -> Appearance {
        if self.key != key {
            if let Some(mut old) = self.current.take() {
                old.dispose();
            }
            self.key = key.into();
            self.current = match key {
                "forest" | "sakura" => Some(forest::create_forest(key == "sakura")),
                "studio" | "night" | "custom" => None,
                _ => Some(make_landscape(key)),
            };
            if let Some(current) = &self.current {
                self.group.call("add", std::slice::from_ref(&current.group));
            }
        }
        appearance(key)
    }
    pub fn update(&mut self, time: f64) {
        if let Some(current) = self.current.as_mut() {
            current.update(time)
        }
    }
    pub fn dispose(&mut self) {
        if let Some(mut current) = self.current.take() {
            current.dispose()
        }
        self.group.call("removeFromParent", &[]);
        self.group.call("clear", &[]);
    }
}
pub(super) struct Random(Cell<u32>);
impl Random {
    pub fn new(seed: u32) -> Self {
        Self(Cell::new(seed))
    }
    pub fn next(&self) -> f64 {
        let n = self.0.get().wrapping_mul(1664525).wrapping_add(1013904223);
        self.0.set(n);
        n as f64 / 4294967296.
    }
    pub fn range(&self, min: f64, max: f64) -> f64 {
        min + self.next() * (max - min)
    }
    pub fn shade<'a>(&self, palette: &[&'a str]) -> &'a str {
        palette[(self.next() * palette.len() as f64).floor() as usize]
    }
}
#[derive(Clone)]
pub(super) struct Instance {
    position: J,
    scale: J,
    rotation: J,
    color: J,
    phase: f64,
}
pub(super) fn at(radius: f64, angle: f64, y: f64) -> J {
    vector(angle.cos() * radius, y, angle.sin() * radius)
}
pub(super) fn place(r: &Random, position: J, scale: J, shade: &str, yaw: Option<f64>) -> Instance {
    let yaw = yaw.unwrap_or_else(|| r.range(0., TAU));
    Instance {
        position,
        scale,
        color: color(shade),
        rotation: new("Quaternion", &[])
            .call("setFromAxisAngle", &[vector(0., 1., 0.), yaw.into()]),
        phase: r.range(0., TAU),
    }
}
pub(super) enum Animation {
    Sway {
        mesh: J,
        items: Vec<Instance>,
        sway: f64,
    },
    Particles {
        mesh: J,
        items: Vec<Instance>,
        speed: f64,
    },
    Wave {
        geometry: J,
        original: Vec<f64>,
    },
    Forest {
        mesh: J,
        items: Vec<Instance>,
    },
}
pub(super) struct Landscape {
    pub group: J,
    geometries: Vec<J>,
    materials: Vec<J>,
    animations: Vec<Animation>,
    last_update: f64,
    fps: f64,
}
impl Landscape {
    pub fn new(name: &str, fps: f64) -> Self {
        let group = new("Group", &[]);
        group.set("name", name);
        Self {
            group,
            geometries: Vec::new(),
            materials: Vec::new(),
            animations: Vec::new(),
            last_update: f64::NEG_INFINITY,
            fps,
        }
    }
    pub fn surface(&mut self, extra: &[(&str, J)]) -> J {
        let options = object(&[
            ("color", "#ffffff".into()),
            ("roughness", 0.94.into()),
            ("metalness", 0.into()),
        ]);
        for (key, value) in extra {
            options.set(key, value.clone());
        }
        let material = new("MeshStandardMaterial", &[options]);
        self.materials.push(material.clone());
        material
    }
    pub fn batch(
        &mut self,
        name: &str,
        geometry: J,
        material: J,
        items: Vec<Instance>,
        sway: f64,
    ) -> Option<J> {
        if !self.geometries.contains(&geometry) {
            self.geometries.push(geometry.clone());
        }
        if items.is_empty() {
            return None;
        }
        let mesh = new("InstancedMesh", &[geometry, material, items.len().into()]);
        mesh.set("name", name);
        mesh.set("receiveShadow", true);
        if sway != 0. {
            mesh.get("instanceMatrix")
                .call("setUsage", &[constant("DynamicDrawUsage")]);
        }
        let matrix = new("Matrix4", &[]);
        for (index, item) in items.iter().enumerate() {
            mesh.call(
                "setMatrixAt",
                &[
                    index.into(),
                    matrix.call(
                        "compose",
                        &[
                            item.position.clone(),
                            item.rotation.clone(),
                            item.scale.clone(),
                        ],
                    ),
                ],
            );
            mesh.call("setColorAt", &[index.into(), item.color.clone()]);
        }
        mesh.get("instanceMatrix").set("needsUpdate", true);
        if mesh.get("instanceColor").exists() {
            mesh.get("instanceColor").set("needsUpdate", true);
        }
        mesh.call("computeBoundingSphere", &[]);
        if mesh.get("boundingSphere").exists() {
            let sphere = mesh.get("boundingSphere");
            sphere.set("radius", sphere.get("radius").num() + sway.abs() * 2.);
        }
        if sway != 0. {
            self.animations.push(Animation::Sway {
                mesh: mesh.clone(),
                items,
                sway,
            });
        }
        self.group.call("add", std::slice::from_ref(&mesh));
        Some(mesh)
    }
    // Mirrors the audited procedural ring recipe; keep its parameters visible at each call site.
    #[allow(clippy::too_many_arguments)]
    fn ring(
        &mut self,
        rng: &Random,
        name: &str,
        inner: f64,
        outer: f64,
        shade: &str,
        height: impl Fn(f64, f64) -> f64,
        material: &J,
        animated: bool,
    ) {
        let mut vertices = Vec::new();
        let mut indices = Vec::new();
        let mut colors = Vec::new();
        let rings = 18;
        let segments = 112;
        for row in 0..=rings {
            let radius = inner + (outer - inner) * row as f64 / rings as f64;
            for segment in 0..=segments {
                let angle = segment as f64 / segments as f64 * TAU;
                vertices.extend([
                    angle.cos() * radius,
                    height(radius, angle),
                    angle.sin() * radius,
                ]);
                let value = 0.88 + 0.1 * (radius * 0.9 + angle * 4.).sin();
                colors.extend([value; 3]);
                if row < rings && segment < segments {
                    let n = row * (segments + 1) + segment;
                    indices.extend([
                        n,
                        n + 1,
                        n + segments + 1,
                        n + 1,
                        n + segments + 2,
                        n + segments + 1,
                    ]);
                }
            }
        }
        let geometry = geometry_from(&vertices, &colors, &indices);
        let ring_material = copy(material);
        ring_material.set("vertexColors", true);
        self.materials.push(ring_material.clone());
        self.batch(
            name,
            geometry.clone(),
            ring_material,
            vec![place(
                rng,
                vector(0., 0., 0.),
                vector(1., 1., 1.),
                shade,
                Some(0.),
            )],
            0.,
        );
        if animated {
            self.animations.push(Animation::Wave {
                geometry,
                original: vertices.iter().map(|v| *v as f32 as f64).collect(),
            });
        }
    }
    fn update(&mut self, time: f64) {
        if !time.is_finite()
            || (time >= self.last_update && time - self.last_update < 1. / self.fps)
        {
            return;
        }
        self.last_update = time;
        let matrix = new("Matrix4", &[]);
        let point = vector(0., 0., 0.);
        let quaternion = new("Quaternion", &[]);
        let breeze = new("Quaternion", &[]);
        let euler = new("Euler", &[]);
        for animation in &self.animations {
            match animation {
                Animation::Sway { mesh, items, sway } => {
                    for (i, item) in items.iter().enumerate() {
                        point.call("copy", std::slice::from_ref(&item.position));
                        point.set(
                            "x",
                            point.get("x").num() + (time * 0.75 + item.phase).sin() * sway,
                        );
                        point.set(
                            "z",
                            point.get("z").num() + (time * 0.6 + item.phase).cos() * sway * 0.4,
                        );
                        mesh.call(
                            "setMatrixAt",
                            &[
                                i.into(),
                                matrix.call(
                                    "compose",
                                    &[point.clone(), item.rotation.clone(), item.scale.clone()],
                                ),
                            ],
                        );
                    }
                    mesh.get("instanceMatrix").set("needsUpdate", true);
                }
                Animation::Particles { mesh, items, speed } => {
                    for (i, item) in items.iter().enumerate() {
                        point.call("copy", std::slice::from_ref(&item.position));
                        point.set(
                            "y",
                            (item.position.get("y").num() + time * speed).rem_euclid(7.) + 0.1,
                        );
                        point.set(
                            "x",
                            point.get("x").num() + (time * 0.4 + item.phase).sin() * 0.15,
                        );
                        mesh.call(
                            "setMatrixAt",
                            &[
                                i.into(),
                                matrix.call(
                                    "compose",
                                    &[point.clone(), item.rotation.clone(), item.scale.clone()],
                                ),
                            ],
                        );
                    }
                    mesh.get("instanceMatrix").set("needsUpdate", true);
                }
                Animation::Wave { geometry, original } => {
                    let attribute = geometry.call("getAttribute", &["position".into()]);
                    for (i, xyz) in original.as_chunks::<3>().0.iter().enumerate() {
                        attribute.call(
                            "setY",
                            &[
                                i.into(),
                                (xyz[1] + (xyz[0].hypot(xyz[2]) * 1.9 - time * 1.2).sin() * 0.045)
                                    .into(),
                            ],
                        );
                    }
                    attribute.set("needsUpdate", true);
                    geometry.call("computeVertexNormals", &[]);
                }
                Animation::Forest { mesh, items } => {
                    for (i, item) in items.iter().enumerate() {
                        let wave = (time * 0.68 + item.phase).sin();
                        let ripple = (time * 1.17 + item.phase * 1.7).sin();
                        let xyz = item.position.xyz();
                        set_xyz(
                            &point,
                            xyz[0] + wave * 0.035,
                            xyz[1] + ripple * 0.012,
                            xyz[2] + ripple * 0.025,
                        );
                        breeze.call(
                            "setFromEuler",
                            &[euler.call(
                                "set",
                                &[(ripple * 0.013).into(), 0.into(), (wave * 0.019).into()],
                            )],
                        );
                        quaternion
                            .call("copy", std::slice::from_ref(&item.rotation))
                            .call("multiply", std::slice::from_ref(&breeze));
                        mesh.call(
                            "setMatrixAt",
                            &[
                                i.into(),
                                matrix.call(
                                    "compose",
                                    &[point.clone(), quaternion.clone(), item.scale.clone()],
                                ),
                            ],
                        );
                    }
                    mesh.get("instanceMatrix").set("needsUpdate", true);
                }
            }
        }
    }
    fn dispose(&mut self) {
        self.group.call("removeFromParent", &[]);
        dispose_object(&self.group);
        for geometry in &self.geometries {
            geometry.call("dispose", &[]);
        }
        for material in &self.materials {
            material.call("dispose", &[]);
        }
        self.group.call("clear", &[]);
        self.animations.clear();
    }
}
pub(super) fn geometry_from(positions: &[f64], colors: &[f64], indices: &[usize]) -> J {
    let geometry = new("BufferGeometry", &[]);
    geometry.call(
        "setAttribute",
        &[
            "position".into(),
            new("Float32BufferAttribute", &[nums(positions), 3.into()]),
        ],
    );
    if !colors.is_empty() {
        geometry.call(
            "setAttribute",
            &[
                "color".into(),
                new("Float32BufferAttribute", &[nums(colors), 3.into()]),
            ],
        );
    }
    geometry.call(
        "setIndex",
        &[J(arr(&indices
            .iter()
            .map(|i| (*i).into())
            .collect::<Vec<_>>())
        .into())],
    );
    geometry.call("computeVertexNormals", &[]);
    geometry
}
fn blade(width: f64, bend: f64) -> J {
    let mut vertices = Vec::new();
    let mut indices = Vec::new();
    for step in 0..=6 {
        let t = step as f64 / 6.;
        let half = width * (PI * (t * 0.94 + 0.03)).sin();
        vertices.extend([-half, t, bend * t * t, half, t, bend * t * t]);
        if step < 6 {
            let n = step * 2;
            indices.extend([n, n + 1, n + 2, n + 1, n + 3, n + 2]);
        }
    }
    geometry_from(&vertices, &[], &indices)
}
fn rod(rng: &Random, items: &mut Vec<Instance>, from: J, to: J, radius: f64, shade: &str) {
    let offset = vector(0., 0., 0.).call("subVectors", &[to.clone(), from.clone()]);
    let item = place(
        rng,
        copy(&from)
            .call("add", &[to])
            .call("multiplyScalar", &[0.5.into()]),
        vector(radius, offset.call("length", &[]).num(), radius),
        shade,
        None,
    );
    item.rotation.call(
        "setFromUnitVectors",
        &[vector(0., 1., 0.), offset.call("normalize", &[])],
    );
    items.push(item);
}

fn make_landscape(kind: &str) -> Landscape {
    let index = crate::core::types::HABITATS
        .iter()
        .position(|k| *k == kind)
        .unwrap_or(0);
    let rng = Random::new(41731 + index as u32 * 907);
    let mut scene = Landscape::new(&format!("{kind} landscape"), 24.);
    let matte = scene.surface(&[]);
    let foliage = scene.surface(&[("side", constant("DoubleSide"))]);
    let stone = new("IcosahedronGeometry", &[1.into(), 1.into()]);
    let cylinder = new(
        "CylinderGeometry",
        &[0.65.into(), 1.into(), 1.into(), 7.into(), 1.into()],
    );
    let cone = new("ConeGeometry", &[1.into(), 1.into(), 9.into(), 2.into()]);
    scene
        .geometries
        .extend([stone.clone(), cylinder.clone(), cone.clone()]);
    let mut rocks = Vec::new();
    let mut stems = Vec::new();
    let mut leaves = Vec::new();
    let mut cones = Vec::new();
    let mut accents = Vec::new();
    let floor = appearance(kind).ground;
    let rolling = if kind == "desert" {
        1.8
    } else if kind == "snow" {
        0.7
    } else {
        0.5
    };
    let height = |radius: f64, angle: f64| {
        let edge = ((radius - 7.4) / 4.).min(1.) * ((32. - radius) / 5.).min(1.);
        edge.max(0.)
            * (0.25
                + rolling
                    * (0.55
                        + (angle * 4. + radius * 0.4).sin() * 0.3
                        + (angle * 7. - radius * 0.6).cos() * 0.15))
    };
    let land_height = |p: &J| {
        let [x, _, z] = p.xyz();
        height(x.hypot(z), z.atan2(x))
    };
    let wet = ["coast", "wetland", "volcano"].contains(&kind);
    if !wet {
        scene.ring(
            &rng,
            "Sculpted ground",
            7.4,
            32.,
            floor,
            height,
            &matte,
            false,
        );
    }
    for _ in 0..48 {
        let size = rng.range(0.15, 0.65);
        let position = at(rng.range(8.3, 24.), rng.range(0., TAU), 0.);
        position.set("y", if wet { 0.1 } else { land_height(&position) });
        rocks.push(place(
            &rng,
            position,
            vector(size * 1.4, size * 0.75, size),
            if kind == "snow" {
                "#a8bec9"
            } else if kind == "desert" {
                "#997348"
            } else {
                "#71756c"
            },
            None,
        ));
    }
    if kind == "coast" || kind == "wetland" {
        let coast = kind == "coast";
        let water = scene.surface(&[("roughness", 0.3.into()), ("metalness", 0.18.into())]);
        scene.ring(
            &rng,
            "Shallow water",
            if coast { 11.8 } else { 8.2 },
            58.,
            if coast { "#377f89" } else { "#486e67" },
            |_, _| 0.05,
            &water,
            true,
        );
        scene.ring(
            &rng,
            "Raised shoreline",
            7.4,
            if coast { 13. } else { 9.1 },
            floor,
            |r, a| {
                ((r - 7.4) / if coast { 5.6 } else { 1.7 } * PI).sin()
                    * (0.18 + (a * 7.).sin() * 0.04)
            },
            &matte,
            false,
        );
        if coast {
            let mut foam = Vec::new();
            for i in 0..100 {
                let angle = i as f64 / 100. * TAU;
                foam.push(place(
                    &rng,
                    at(12.7 + (angle * 9.).sin() * 0.15, angle, 0.15),
                    vector(0.6, 0.025, 0.06),
                    "#c6d9d0",
                    Some(-angle),
                ));
            }
            scene.batch("Shore foam", stone.clone(), matte.clone(), foam, 0.04);
            for tree in 0..8 {
                let angle = tree as f64 / 8. * TAU + 0.2;
                let base = at(10.1, angle, 0.);
                let tip = copy(&base).call("add", &[at(0.65, angle, rng.range(3.6, 5.2))]);
                let middle = copy(&base)
                    .call("lerp", &[tip.clone(), 0.5.into()])
                    .call("add", &[at(-0.2, angle, 0.)]);
                rod(&rng, &mut stems, base, middle.clone(), 0.18, "#7b684b");
                rod(&rng, &mut stems, middle, tip.clone(), 0.14, "#7b684b");
                for frond in 0..8 {
                    let tall = rng.range(1.6, 2.3);
                    let shade = rng.shade(&["#5f7945", "#758c50"]);
                    let item = place(&rng, copy(&tip), vector(1., tall, 1.), shade, None);
                    item.rotation.call(
                        "setFromEuler",
                        &[new(
                            "Euler",
                            &[
                                1.22.into(),
                                (frond as f64 / 8. * TAU).into(),
                                0.into(),
                                "YXZ".into(),
                            ],
                        )],
                    );
                    leaves.push(item);
                }
            }
            scene.batch(
                "Palm fronds",
                blade(0.24, 0.28),
                foliage.clone(),
                std::mem::take(&mut leaves),
                0.055,
            );
        } else {
            let mut seed_heads = Vec::new();
            for index in 0..150 {
                let position = at(rng.range(8.5, 19.), rng.range(0., TAU), 0.08);
                let tall = rng.range(0.7, 1.9);
                let shade = rng.shade(&["#6f8650", "#83975c", "#506a43"]);
                leaves.push(place(
                    &rng,
                    position.clone(),
                    vector(0.65, tall, 0.7),
                    shade,
                    None,
                ));
                if index % 3 == 0 {
                    let top = copy(&position).call("setY", &[tall.into()]);
                    rod(&rng, &mut stems, position, top.clone(), 0.023, "#748357");
                    seed_heads.push(place(&rng, top, vector(0.07, 0.24, 0.07), "#5b4535", None));
                }
            }
            scene.batch(
                "Reed leaves",
                blade(0.045, 0.2),
                foliage.clone(),
                std::mem::take(&mut leaves),
                0.04,
            );
            scene.batch(
                "Cattails",
                cylinder.clone(),
                matte.clone(),
                seed_heads,
                0.025,
            );
            let mut pads = Vec::new();
            for _ in 0..40 {
                pads.push(place(
                    &rng,
                    at(rng.range(9.4, 21.), rng.range(0., TAU), 0.15),
                    vector(0.33, 0.025, 0.3),
                    "#52724d",
                    None,
                ));
            }
            scene.batch(
                "Water lily leaves",
                stone.clone(),
                matte.clone(),
                pads,
                0.015,
            );
        }
    }
    if kind == "snow" {
        for tree in 0..18 {
            let angle = tree as f64 / 18. * TAU;
            let base = at(rng.range(11., 19.), angle, 0.);
            base.set("y", land_height(&base));
            let tall = rng.range(3.1, 6.);
            rod(
                &rng,
                &mut stems,
                base.clone(),
                copy(&base).call("setY", &[(base.get("y").num() + tall).into()]),
                0.2,
                "#625b4b",
            );
            for layer in 0..4 {
                let width = (1. - layer as f64 * 0.18) * 1.7;
                let p = copy(&base).call(
                    "setY",
                    &[(base.get("y").num() + 1.1 + layer as f64 * tall * 0.19).into()],
                );
                cones.push(place(
                    &rng,
                    p.clone(),
                    vector(width, tall * 0.48, width),
                    "#49685b",
                    None,
                ));
                accents.push(place(
                    &rng,
                    copy(&p).call("add", &[vector(0., tall * 0.055, 0.)]),
                    vector(width * 0.86, tall * 0.41, width * 0.86),
                    "#d6e1e3",
                    None,
                ));
            }
        }
        scene.batch(
            "Snow laden fir branches",
            cone.clone(),
            matte.clone(),
            std::mem::take(&mut cones),
            0.,
        );
        scene.batch(
            "Snow caps",
            cone.clone(),
            matte.clone(),
            std::mem::take(&mut accents),
            0.,
        );
    }
    if kind == "desert" {
        for index in 0..12 {
            let base = at(rng.range(10.2, 19.), index as f64 / 12. * TAU, 0.);
            base.set("y", land_height(&base));
            let tall = rng.range(1.5, 3.6);
            rod(
                &rng,
                &mut stems,
                base.clone(),
                copy(&base).call("setY", &[(base.get("y").num() + tall).into()]),
                0.2,
                "#5f7951",
            );
            for side in [-1., 1.] {
                let elbow = copy(&base).call("add", &[vector(side * 0.65, tall * 0.5, 0.)]);
                rod(
                    &rng,
                    &mut stems,
                    copy(&base).call("setY", &[(base.get("y").num() + tall * 0.5).into()]),
                    elbow.clone(),
                    0.13,
                    "#5f7951",
                );
                rod(
                    &rng,
                    &mut stems,
                    elbow.clone(),
                    copy(&elbow).call("add", &[vector(0., tall * 0.38, 0.)]),
                    0.13,
                    "#5f7951",
                );
            }
        }
        for index in 0..14 {
            let p = at(rng.range(20., 31.), index as f64 / 14. * TAU, 0.);
            p.set("y", rng.range(1., 2.2));
            let scale = vector(
                rng.range(1.5, 3.3),
                rng.range(2.3, 5.5),
                rng.range(1.3, 2.8),
            );
            let shade = rng.shade(&["#a9784c", "#bc8b5a", "#926947"]);
            accents.push(place(&rng, p, scale, shade, None));
        }
        scene.batch(
            "Sandstone outcrops",
            stone.clone(),
            matte.clone(),
            std::mem::take(&mut accents),
            0.,
        );
    }
    if kind == "meadow" {
        let mut blossoms = Vec::new();
        for index in 0..420 {
            let p = at(rng.range(7.9, 25.), rng.range(0., TAU), 0.);
            p.set("y", land_height(&p));
            let tall = rng.range(0.22, 0.65);
            let shade = rng.shade(&["#71814a", "#809153", "#5c7b45"]);
            leaves.push(place(&rng, p.clone(), vector(0.75, tall, 0.7), shade, None));
            if index % 3 == 0 {
                let shade = rng.shade(&["#dec569", "#d9d5ba", "#ac93b4", "#bd9cbd"]);
                blossoms.push(place(
                    &rng,
                    copy(&p).call("add", &[vector(0., tall, 0.)]),
                    vector(0.085, 0.035, 0.085),
                    shade,
                    None,
                ));
            }
        }
        scene.batch(
            "Meadow grass",
            blade(0.065, 0.22),
            foliage.clone(),
            std::mem::take(&mut leaves),
            0.035,
        );
        scene.batch(
            "Wildflowers",
            new("IcosahedronGeometry", &[1.into(), 0.into()]),
            matte.clone(),
            blossoms,
            0.035,
        );
    }
    if ["mountain", "volcano", "cave"].contains(&kind) {
        for index in 0..22 {
            let angle = index as f64 / 22. * TAU;
            let cave = kind == "cave";
            let radius = if cave {
                rng.range(16., 21.)
            } else {
                rng.range(22., 34.)
            };
            let tall = if cave {
                rng.range(5.5, 9.)
            } else {
                rng.range(4., 10.)
            };
            let position = at(radius, angle, tall * 0.43);
            let width = if cave {
                rng.range(2., 3.2)
            } else {
                rng.range(3.3, 5.5)
            };
            let shade = rng.shade(if kind == "volcano" {
                &["#504641", "#615044", "#443f3b"]
            } else {
                &["#737a79", "#677271", "#586364"]
            });
            accents.push(place(
                &rng,
                position.clone(),
                vector(width, tall * 0.65, width * 0.8),
                shade,
                None,
            ));
            if kind == "mountain" {
                cones.push(place(
                    &rng,
                    copy(&position).call("setY", &[(tall * 0.91).into()]),
                    vector(width * 0.49, tall * 0.36, width * 0.46),
                    "#c1ced0",
                    None,
                ));
            }
            if cave {
                let p = at(rng.range(11.5, 18.), angle, rng.range(6.5, 8.5));
                let scale = vector(0.65, rng.range(1.4, 3.), 0.65);
                let hanging = place(&rng, p, scale, "#657273", None);
                hanging
                    .rotation
                    .call("setFromAxisAngle", &[vector(1., 0., 0.), PI.into()]);
                cones.push(hanging);
                cones.push(place(
                    &rng,
                    at(rng.range(9., 14.), angle, 0.8),
                    vector(0.4, rng.range(0.8, 2.), 0.4),
                    "#778280",
                    None,
                ));
            }
        }
        scene.batch(
            "Layered stone ridges",
            stone.clone(),
            matte.clone(),
            std::mem::take(&mut accents),
            0.,
        );
        scene.batch(
            if kind == "cave" {
                "Stalactites and stalagmites"
            } else {
                "Distant snow peaks"
            },
            cone.clone(),
            matte.clone(),
            std::mem::take(&mut cones),
            0.,
        );
        if kind == "cave" {
            let surface = scene.surface(&[("side", constant("DoubleSide"))]);
            scene.ring(
                &rng,
                "Vaulted cave ceiling",
                8.5,
                28.,
                "#424f52",
                |r, a| 9. + (a * 5. + r * 0.3).sin() * 0.8,
                &surface,
                false,
            );
            let mut crystals = Vec::new();
            for _ in 0..40 {
                let position = at(rng.range(8.5, 14.), rng.range(0., TAU), 0.25);
                let scale = vector(rng.range(0.09, 0.2), rng.range(0.5, 1.2), 0.13);
                let shade = rng.shade(&["#6cabbd", "#8ba9c7", "#96b5af"]);
                crystals.push(place(&rng, position, scale, shade, None));
            }
            let surface = scene.surface(&[
                ("roughness", 0.4.into()),
                ("metalness", 0.15.into()),
                ("emissive", "#456378".into()),
                ("emissiveIntensity", 0.12.into()),
            ]);
            scene.batch(
                "Mineral crystals",
                new("OctahedronGeometry", &[1.into()]),
                surface,
                crystals,
                0.,
            );
        }
        if kind == "volcano" {
            let surface = scene.surface(&[
                ("roughness", 0.5.into()),
                ("emissive", "#ed641e".into()),
                ("emissiveIntensity", 0.75.into()),
            ]);
            scene.ring(
                &rng,
                "Molten lava beyond the rock island",
                10.,
                39.,
                "#b7481c",
                |r, a| 0.05 + (r * 3. + a * 9.).sin() * 0.03,
                &surface,
                true,
            );
            scene.ring(
                &rng,
                "Basalt island rim",
                7.4,
                11.,
                floor,
                |r, a| ((r - 7.4) / 3.6 * PI).sin() * (0.4 + (a * 13.).sin() * 0.2),
                &matte,
                false,
            );
            let mut crust = Vec::new();
            for _ in 0..130 {
                let position = at(rng.range(11., 35.), rng.range(0., TAU), 0.11);
                let scale = vector(rng.range(0.2, 1.2), 0.08, rng.range(0.4, 1.4));
                crust.push(place(&rng, position, scale, "#483d34", None));
            }
            scene.batch(
                "Drifting lava crust",
                stone.clone(),
                matte.clone(),
                crust,
                0.04,
            );
        }
    }
    if kind == "underwater" {
        for index in 0..36 {
            let base = at(rng.range(8.8, 20.), index as f64 / 36. * TAU, 0.);
            base.set("y", land_height(&base));
            let shade = rng.shade(&["#b57b75", "#ad8763", "#9c789b", "#7caaa2"]);
            let tip = copy(&base).call("add", &[vector(0., rng.range(0.9, 2.1), 0.)]);
            rod(&rng, &mut stems, base.clone(), tip.clone(), 0.085, shade);
            for branch in 0..4 {
                let fork = copy(&base).call("lerp", &[tip.clone(), rng.range(0.4, 0.9).into()]);
                let end = copy(&fork).call(
                    "add",
                    &[at(rng.range(0.35, 0.8), branch as f64 / 4. * TAU, 0.5)],
                );
                rod(&rng, &mut stems, fork, end.clone(), 0.065, shade);
                rod(
                    &rng,
                    &mut stems,
                    end.clone(),
                    copy(&end).call("add", &[vector(0.12, 0.25, 0.)]),
                    0.035,
                    shade,
                );
            }
            for index in 0..4 {
                let p = copy(&base).call("add", &[at(1.2, index as f64 / 4. * TAU, 0.)]);
                let scale = vector(1., rng.range(1.4, 3.5), 1.);
                let shade = rng.shade(&["#597f58", "#77986a", "#527d67"]);
                leaves.push(place(&rng, p, scale, shade, None));
            }
        }
        scene.batch(
            "Swaying kelp",
            blade(0.12, 0.15),
            foliage.clone(),
            std::mem::take(&mut leaves),
            0.085,
        );
    }
    if ["snow", "underwater", "volcano"].contains(&kind) {
        let mut particles = Vec::new();
        for _ in 0..64 {
            let size = if kind == "underwater" {
                rng.range(0.04, 0.085)
            } else {
                rng.range(0.018, 0.035)
            };
            let p = at(rng.range(8., 23.), rng.range(0., TAU), rng.range(0.3, 7.));
            particles.push(place(
                &rng,
                p,
                vector(size, size, size),
                if kind == "volcano" {
                    "#ed9b45"
                } else {
                    "#c4dce0"
                },
                None,
            ));
        }
        let surface = if kind == "volcano" {
            scene.surface(&[
                ("emissive", "#e99b45".into()),
                ("emissiveIntensity", 0.7.into()),
            ])
        } else {
            scene.surface(&[("roughness", 0.3.into()), ("metalness", 0.12.into())])
        };
        if let Some(mesh) = scene.batch(
            "Drifting particles",
            new("IcosahedronGeometry", &[1.into(), 0.into()]),
            surface,
            particles.clone(),
            0.,
        ) {
            mesh.get("instanceMatrix")
                .call("setUsage", &[constant("DynamicDrawUsage")]);
            mesh.set("frustumCulled", false);
            scene.animations.push(Animation::Particles {
                mesh,
                items: particles,
                speed: if kind == "snow" { -0.22 } else { 0.25 },
            });
        }
    }
    scene.batch("Scattered stones", stone, matte.clone(), rocks, 0.);
    scene.batch(
        if kind == "underwater" {
            "Branching coral"
        } else if kind == "desert" {
            "Cacti"
        } else {
            "Tree trunks and stems"
        },
        cylinder,
        matte,
        stems,
        0.,
    );
    scene
}
