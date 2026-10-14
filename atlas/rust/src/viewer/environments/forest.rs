use super::*;

fn ground_height(x: f64, z: f64) -> f64 {
    let radius = x.hypot(z);
    if radius <= 7.4 || radius >= 24. {
        return 0.;
    }
    let angle = z.atan2(x);
    let edge = ((radius - 7.4) / 2.7).min(1.) * ((24. - radius) / 4.).min(1.);
    let rise =
        0.5 + (angle * 3. + radius * 0.5).sin() * 0.27 + (angle * 5. - radius * 0.8).cos() * 0.18;
    edge * (0.08 + rise * 0.42)
}
fn placement(rng: &Random, position: J, scale: J, color: J, rotation: Option<J>) -> Instance {
    let rotation = rotation.unwrap_or_else(|| {
        new("Quaternion", &[]).call(
            "setFromEuler",
            &[new(
                "Euler",
                &[0.into(), rng.range(0., TAU).into(), 0.into()],
            )],
        )
    });
    Instance {
        position,
        scale,
        color,
        rotation,
        phase: rng.range(0., TAU),
    }
}
fn weathered(geometry: J, stone: bool) -> J {
    let vertices = geometry.call("getAttribute", &["position".into()]);
    let position = vector(0., 0., 0.);
    let mut colors = Vec::new();
    for index in 0..vertices.get("count").num() as usize {
        position.call("fromBufferAttribute", &[vertices.clone(), index.into()]);
        let [x, y, z] = position.xyz();
        let ridges = (z.atan2(x) * 9. + y * 0.7).sin();
        if stone {
            position.call(
                "multiplyScalar",
                &[(0.9 + 0.12 * (x * 7. + z * 9.).sin()).into()],
            );
        } else {
            position.set("x", x * (1. + ridges * 0.065));
            position.set("z", z * (1. + ridges * 0.065));
        }
        let [x, y, z] = position.xyz();
        vertices.call("setXYZ", &[index.into(), x.into(), y.into(), z.into()]);
        let shade = if stone {
            0.75 + (y + 1.) * 0.11
        } else {
            0.82 + ridges * 0.12
        };
        colors.extend([shade; 3]);
    }
    geometry.call(
        "setAttribute",
        &[
            "color".into(),
            new("Float32BufferAttribute", &[nums(&colors), 3.into()]),
        ],
    );
    geometry.call("computeVertexNormals", &[]);
    geometry
}
// Keep geometry buffers and the original procedural parameters explicit for the migration oracle.
#[allow(clippy::too_many_arguments)]
fn append_leaf(
    rng: &Random,
    positions: &mut Vec<f64>,
    colors: &mut Vec<f64>,
    indices: &mut Vec<usize>,
    origin: &J,
    orientation: &J,
    length: f64,
    width: f64,
) {
    let start = positions.len() / 3;
    let shade = rng.range(0.76, 1.);
    let position = vector(0., 0., 0.);
    for [x, y, z] in [
        [0., 0., 0.],
        [0.45, 0.025, width],
        [1., 0.055, 0.],
        [0.45, 0.025, -width],
        [0.45, 0.1, 0.],
    ] {
        set_xyz(&position, (x - 0.45) * length, y * length, z * length);
        position
            .call("applyQuaternion", std::slice::from_ref(orientation))
            .call("add", std::slice::from_ref(origin));
        positions.extend(position.xyz());
        colors.extend([shade; 3]);
    }
    for edge in 0..4 {
        indices.extend([start + edge, start + (edge + 1) % 4, start + 4]);
    }
}
fn stems(rng: &Random, items: &mut Vec<Instance>, from: J, to: J, radius: f64, color: J) {
    let direction = vector(0., 0., 0.).call("subVectors", &[to.clone(), from.clone()]);
    let position = vector(0., 0., 0.)
        .call("addVectors", &[from, to])
        .call("multiplyScalar", &[0.5.into()]);
    let scale = vector(radius, direction.call("length", &[]).num() + 0.035, radius);
    let rotation = new("Quaternion", &[]).call(
        "setFromUnitVectors",
        &[vector(0., 1., 0.), direction.call("normalize", &[])],
    );
    items.push(placement(rng, position, scale, color, Some(rotation)));
}
fn keep_clearing(point: &J, size: f64) {
    let [x, _, z] = point.xyz();
    let radius = x.hypot(z);
    let minimum = 7.45 + size * 1.5;
    if radius < minimum {
        point.set("x", x * minimum / radius);
        point.set("z", z * minimum / radius);
    }
}
fn crown(
    rng: &Random,
    crowns: &mut Vec<Instance>,
    point: J,
    size: f64,
    squash: f64,
    palette: &[&str],
) {
    keep_clearing(&point, size);
    let scale = vector(
        size,
        size * rng.range(0.7, 1.) * squash,
        size * rng.range(0.85, 1.1),
    );
    let shade = color(rng.shade(palette));
    crowns.push(placement(rng, point, scale, shade, None));
}

pub(super) fn create_forest(blossoms: bool) -> Landscape {
    let mut scene = Landscape::new(
        if blossoms {
            "Cherry blossom garden"
        } else {
            "Forest clearing"
        },
        30.,
    );
    let rng = Random::new(73129);
    let up = vector(0., 1., 0.);
    let quaternion = new("Quaternion", &[]);
    let bark_colors = ["#655441", "#736049", "#574b3d", "#796851"];
    let leaf_colors: &[&str] = if blossoms {
        &["#e6b8c5", "#f0cbd2", "#db9bae", "#f3d7da", "#c993ab"]
    } else {
        &["#5e7946", "#6b824c", "#4d6b40", "#72874f", "#537345"]
    };
    let rock_colors = ["#6e7464", "#818273", "#616c60", "#777465"];
    let bark_geometry = weathered(
        new(
            "CylinderGeometry",
            &[0.66.into(), 1.into(), 1.into(), 9.into(), 2.into()],
        ),
        false,
    );
    let rock_geometry = weathered(new("IcosahedronGeometry", &[1.into(), 1.into()]), true);
    let options = |double: bool| {
        vec![
            ("color", 0xffffff.into()),
            ("roughness", 0.98.into()),
            ("metalness", 0.into()),
            ("vertexColors", true.into()),
            (
                "side",
                constant(if double { "DoubleSide" } else { "FrontSide" }),
            ),
            ("envMapIntensity", 0.35.into()),
        ]
    };
    let bark_material = scene.surface(&options(false));
    let vegetation_material = scene.surface(&options(true));
    let stone_material = scene.surface(&options(false));
    let mut leaves = Vec::new();
    let mut leaf_colors_attribute = Vec::new();
    let mut leaf_indices = Vec::new();
    let leaf_normal = vector(0., 0., 0.);
    for index in 0..72 {
        let y = 1. - 2. * (index as f64 + 0.5) / 72.;
        let angle = index as f64 * 2.399963229728653;
        let ring = (1. - y * y).sqrt();
        let origin = vector(angle.cos() * ring, y * 0.62, angle.sin() * ring)
            .call("multiplyScalar", &[rng.range(0.6, 1.05).into()]);
        leaf_normal
            .call("copy", std::slice::from_ref(&origin))
            .call("normalize", &[])
            .call("lerp", &[up.clone(), 0.45.into()])
            .call("normalize", &[]);
        quaternion.call("setFromUnitVectors", &[up.clone(), leaf_normal.clone()]);
        quaternion.call(
            "multiply",
            &[new("Quaternion", &[])
                .call("setFromAxisAngle", &[up.clone(), rng.range(0., TAU).into()])],
        );
        let length = rng.range(0.35, 0.62);
        append_leaf(
            &rng,
            &mut leaves,
            &mut leaf_colors_attribute,
            &mut leaf_indices,
            &origin,
            &quaternion,
            length,
            0.24,
        );
    }
    let foliage_geometry = geometry_from(&leaves, &leaf_colors_attribute, &leaf_indices);
    let mut timber = Vec::new();
    let mut shadow_timber = Vec::new();
    let mut crowns = Vec::new();
    let mut rocks = Vec::new();
    for tree in 0..16 {
        let angle = tree as f64 / 16. * TAU + rng.range(-0.075, 0.075);
        let base = at(
            10.8 + (tree % 3) as f64 * 2.1 + rng.range(0., 0.9),
            angle,
            0.,
        );
        base.set("y", ground_height(base.get("x").num(), base.get("z").num()));
        let young = tree % 4 == 1;
        let height = if young {
            rng.range(4.5, 5.8)
        } else {
            rng.range(6.8, 8.8)
        };
        let radius = if young {
            rng.range(0.23, 0.35)
        } else {
            rng.range(0.31, 0.53)
        };
        let shade = color(rng.shade(&bark_colors));
        let wood = if tree % 5 == 2 {
            &mut shadow_timber
        } else {
            &mut timber
        };
        let lean = at(rng.range(0.2, 0.7), angle, 0.);
        let joints: Vec<J> = [0., 0.35, 0.69, 1.]
            .into_iter()
            .map(|fraction| {
                copy(&base)
                    .call("addScaledVector", &[lean.clone(), fraction.into()])
                    .call("setY", &[(base.get("y").num() + height * fraction).into()])
            })
            .collect();
        for segment in 0..3 {
            stems(
                &rng,
                wood,
                joints[segment].clone(),
                joints[segment + 1].clone(),
                radius * 0.67_f64.powi(segment as i32),
                shade.clone(),
            );
        }
        for root in 0..4 {
            let direction = angle + root as f64 / 4. * TAU + rng.range(-0.3, 0.3);
            let from = copy(&base).call("setY", &[(base.get("y").num() + 0.28).into()]);
            let to = copy(&base).call("add", &[at(rng.range(0.9, 1.7), direction, 0.015)]);
            stems(&rng, wood, from, to, radius * 0.3, shade.clone());
        }
        let point = copy(&joints[3]).call("setY", &[(base.get("y").num() + height - 0.25).into()]);
        let size = rng.range(1.45, 1.95);
        crown(&rng, &mut crowns, point, size, 1., leaf_colors);
        for branch in 0..4 {
            let low = branch < 2;
            let branch_angle = angle + branch as f64 * 2.399963229728653 + rng.range(-0.3, 0.3);
            let from = copy(&base)
                .call("addScaledVector", &[lean.clone(), 0.5.into()])
                .call(
                    "setY",
                    &[(base.get("y").num()
                        + if low {
                            rng.range(1.3, 1.8)
                        } else {
                            height * rng.range(0.42, 0.62)
                        })
                    .into()],
                );
            let elbow = copy(&base)
                .call("add", &[at(rng.range(1.1, 1.7), branch_angle, 0.)])
                .call(
                    "setY",
                    &[(base.get("y").num()
                        + if low {
                            rng.range(1.9, 2.5)
                        } else {
                            height * rng.range(0.66, 0.79)
                        })
                    .into()],
                );
            let tip = copy(&base)
                .call("add", &[at(rng.range(2.1, 3.), branch_angle, 0.)])
                .call(
                    "setY",
                    &[(base.get("y").num()
                        + if low {
                            rng.range(2.5, 3.2)
                        } else {
                            height * rng.range(0.8, 0.96)
                        })
                    .into()],
                );
            let size = rng.range(1.3, 1.85);
            keep_clearing(&tip, size);
            stems(
                &rng,
                wood,
                from,
                elbow.clone(),
                radius * 0.42,
                shade.clone(),
            );
            stems(&rng, wood, elbow, tip.clone(), radius * 0.24, shade.clone());
            crown(&rng, &mut crowns, tip.clone(), size, 1., leaf_colors);
            if !low {
                let point = copy(&tip)
                    .call("lerp", &[joints[3].clone(), 0.45.into()])
                    .call("add", &[vector(0., 0.35, 0.)]);
                let size = rng.range(1.4, 1.9);
                crown(&rng, &mut crowns, point, size, 1., leaf_colors);
            }
        }
        let shrub = at(rng.range(9.1, 10.2), angle + 0.13, 0.);
        shrub.set(
            "y",
            ground_height(shrub.get("x").num(), shrub.get("z").num()),
        );
        let lower = copy(&shrub).call("add", &[vector(0., 0.95, 0.)]);
        let upper = copy(&shrub).call("add", &[at(0.4, angle + 0.5, 1.65)]);
        let size = rng.range(0.95, 1.12);
        crown(&rng, &mut crowns, lower.clone(), size, 0.85, leaf_colors);
        let size = rng.range(0.85, 1.05);
        crown(&rng, &mut crowns, upper.clone(), size, 0.85, leaf_colors);
        stems(&rng, &mut timber, shrub, lower.clone(), 0.06, shade.clone());
        stems(&rng, &mut timber, lower, upper, 0.035, shade);
        let position = copy(&base).call("add", &[at(rng.range(0.7, 1.4), angle + 1., 0.1)]);
        let shade = color(rng.shade(&rock_colors));
        rocks.push(placement(
            &rng,
            position,
            vector(0.7, 0.34, 0.6),
            shade,
            None,
        ));
    }
    for _ in 0..3 {
        let center = at(rng.range(10., 15.), rng.range(0., TAU), 0.13);
        center.set(
            "y",
            center.get("y").num() + ground_height(center.get("x").num(), center.get("z").num()),
        );
        let offset = at(rng.range(1.1, 1.6), rng.range(0., TAU), 0.);
        let from = copy(&center).call("sub", std::slice::from_ref(&offset));
        let to = copy(&center)
            .call("add", &[offset])
            .call("setY", &[(center.get("y").num() + 0.11).into()]);
        let shade = color(rng.shade(&bark_colors));
        stems(&rng, &mut timber, from, to, 0.22, shade);
    }
    for _ in 0..46 {
        let size = rng.range(0.18, 0.66);
        let point = at(rng.range(8.2, 19.), rng.range(0., TAU), size * 0.16);
        point.set(
            "y",
            point.get("y").num() + ground_height(point.get("x").num(), point.get("z").num()),
        );
        let scale = vector(size * rng.range(1., 1.6), size * rng.range(0.45, 0.8), size);
        let shade = color(rng.shade(&rock_colors));
        rocks.push(placement(&rng, point, scale, shade, None));
    }
    let mut fern_positions = Vec::new();
    let mut fern_colors = Vec::new();
    let mut fern_indices = Vec::new();
    for frond in 0..6 {
        let angle = frond as f64 / 6. * TAU;
        for pair in 0..7 {
            let t = (pair + 1) as f64 / 8.;
            let origin = at(t * 0.65, angle, (t * PI * 0.7).sin() * 0.62);
            for side in [-1., 1.] {
                quaternion.call(
                    "setFromEuler",
                    &[new(
                        "Euler",
                        &[
                            (-0.2).into(),
                            (-angle + side * 0.9).into(),
                            (side * 0.13).into(),
                        ],
                    )],
                );
                append_leaf(
                    &rng,
                    &mut fern_positions,
                    &mut fern_colors,
                    &mut fern_indices,
                    &origin,
                    &quaternion,
                    0.34 * (1. - t * 0.72),
                    0.2,
                );
            }
        }
    }
    let fern_geometry = geometry_from(&fern_positions, &fern_colors, &fern_indices);
    let mut grass_positions = Vec::new();
    let mut grass_colors = Vec::new();
    let mut grass_indices = Vec::new();
    for _ in 0..12 {
        let angle = rng.range(0., TAU);
        let center = at(rng.range(0., 0.26), angle, 0.);
        let height = rng.range(0.18, 0.55);
        let width = rng.range(0.013, 0.029);
        let start = grass_positions.len() / 3;
        for [y, taper, bend] in [[0., 1., 0.], [0.55, 0.7, 0.04], [1., 0., 0.17]] {
            for side in [-1., 1.] {
                grass_positions.extend([
                    center.get("x").num() + angle.cos() * width * taper * side + angle.sin() * bend,
                    y * height,
                    center.get("z").num() - angle.sin() * width * taper * side + angle.cos() * bend,
                ]);
                grass_colors.extend([0.65 + y * 0.3; 3]);
            }
        }
        grass_indices.extend([
            start,
            start + 1,
            start + 2,
            start + 1,
            start + 3,
            start + 2,
            start + 2,
            start + 3,
            start + 4,
        ]);
    }
    let grass_geometry = geometry_from(&grass_positions, &grass_colors, &grass_indices);
    let mut ferns = Vec::new();
    let mut grasses = Vec::new();
    for clump in 0..260 {
        let point = at(rng.range(8., 20.), rng.range(0., TAU), 0.008);
        point.set(
            "y",
            point.get("y").num() + ground_height(point.get("x").num(), point.get("z").num()),
        );
        let size = rng.range(0.65, 1.35);
        let undergrowth = if blossoms {
            &["#65764e", "#76855a", "#566f46"][..]
        } else {
            leaf_colors
        };
        let shade = color(rng.shade(undergrowth));
        grasses.push(placement(
            &rng,
            point.clone(),
            vector(size, size, size),
            shade,
            None,
        ));
        if clump < 34 {
            let shade = color(rng.shade(undergrowth));
            ferns.push(placement(
                &rng,
                copy(&point),
                vector(size, size, size),
                shade,
                None,
            ));
        }
    }
    scene.batch(
        "Trunks, roots and fallen wood",
        bark_geometry.clone(),
        bark_material.clone(),
        timber,
        0.,
    );
    if let Some(mesh) = scene.batch(
        "Three shadow-casting trees",
        bark_geometry,
        bark_material,
        shadow_timber,
        0.,
    ) {
        mesh.set("castShadow", true);
    }
    if let Some(mesh) = scene.batch(
        "Individual canopy leaves",
        foliage_geometry,
        vegetation_material.clone(),
        crowns.clone(),
        0.,
    ) {
        mesh.get("instanceMatrix")
            .call("setUsage", &[constant("DynamicDrawUsage")]);
        let sphere = mesh.get("boundingSphere");
        sphere.set("radius", sphere.get("radius").num() + 0.3);
        scene.animations.push(Animation::Forest {
            mesh,
            items: crowns,
        });
    }
    scene.batch(
        "Weathered rocks",
        rock_geometry,
        stone_material.clone(),
        rocks,
        0.,
    );
    scene.batch(
        "Fern fronds",
        fern_geometry,
        vegetation_material.clone(),
        ferns,
        0.,
    );
    scene.batch(
        "Meadow grasses",
        grass_geometry,
        vegetation_material,
        grasses,
        0.,
    );
    let mut earth_positions = Vec::new();
    let mut earth_colors = Vec::new();
    let mut earth_indices = Vec::new();
    let edge_color = color("#40503a");
    let moss_color = color("#374e30");
    let soil_color = color("#4b4b32");
    let ground_color = new("Color", &[]);
    let rings = 16;
    let segments = 96;
    for ring in 0..=rings {
        let radius = 7.4 + ring as f64 / rings as f64 * 16.6;
        for segment in 0..=segments {
            let angle = segment as f64 / segments as f64 * TAU;
            let x = angle.cos() * radius;
            let z = angle.sin() * radius;
            earth_positions.extend([x, ground_height(x, z) - 0.006, z]);
            ground_color
                .call("copy", std::slice::from_ref(&moss_color))
                .call(
                    "lerp",
                    &[
                        soil_color.clone(),
                        (0.3 + 0.3 * (angle * 4. + radius).sin()).into(),
                    ],
                );
            ground_color.call(
                "lerp",
                &[
                    edge_color.clone(),
                    if ring == 0 || ring == rings { 1. } else { 0.15 }.into(),
                ],
            );
            earth_colors.extend([
                ground_color.get("r").num(),
                ground_color.get("g").num(),
                ground_color.get("b").num(),
            ]);
            if ring < rings && segment < segments {
                let current = ring * (segments + 1) + segment;
                let next = current + segments + 1;
                earth_indices.extend([current, current + 1, next, current + 1, next + 1, next]);
            }
        }
    }
    scene.batch(
        "Low earth banks around the clearing",
        geometry_from(&earth_positions, &earth_colors, &earth_indices),
        stone_material,
        vec![placement(
            &rng,
            vector(0., 0., 0.),
            vector(1., 1., 1.),
            new("Color", &[0xffffff.into()]),
            Some(new("Quaternion", &[])),
        )],
        0.,
    );
    scene
}
