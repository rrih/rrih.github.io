mod environments;
mod js;
mod models;
#[cfg(feature = "renderer-qa")]
mod qa;

use self::{js::*, models::*};
use crate::core::{
    scene_studio::{CameraPose, SceneMember},
    types::ViewerSettings,
};
use std::{
    cell::{Cell, RefCell},
    rc::Rc,
};
use wasm_bindgen::{JsCast, prelude::*};
use yew::prelude::*;

const RENDERER_UNAVAILABLE: &str = "3D viewing is unavailable in this browser. Try updating your browser or enabling graphics acceleration.";

/// Test-only geometry oracle; omitted from production WASM.
#[cfg(feature = "renderer-qa")]
#[wasm_bindgen]
pub fn renderer_environment_snapshot(kind: &str, elapsed: Option<f64>) -> JsValue {
    let mut environments = environments::Environments::new();
    environments.set_habitat(kind);
    if let Some(time) = elapsed {
        environments.update(time);
    }
    let mut meshes = Vec::new();
    walk(&environments.group, false, &mut |mesh| {
        if !mesh.get("isMesh").yes() {
            return;
        }
        let geometry = mesh.get("geometry");
        let position = geometry
            .call("getAttribute", &["position".into()])
            .get("array");
        let normals = geometry
            .call("getAttribute", &["normal".into()])
            .get("array");
        let colors = geometry
            .call("getAttribute", &["color".into()])
            .get("array");
        let array = |value: J| {
            if value.exists() {
                J(js_sys::Array::from(&value.0).into())
            } else {
                J(js_sys::Array::new().into())
            }
        };
        meshes.push(object(&[
            ("name", mesh.get("name")),
            ("positions", array(position)),
            ("normals", array(normals)),
            ("colors", array(colors)),
            ("matrix", array(mesh.get("instanceMatrix").get("array"))),
            (
                "instanceColors",
                array(mesh.get("instanceColor").get("array")),
            ),
            ("indices", array(geometry.get("index").get("array"))),
            ("castShadow", mesh.get("castShadow")),
            ("receiveShadow", mesh.get("receiveShadow")),
        ]));
    });
    let result = arr(&meshes).into();
    environments.dispose();
    result
}
#[derive(Clone, PartialEq, Debug)]
pub struct ModelRequest {
    pub key: String,
    pub species_id: u16,
    pub url: Option<String>,
}
#[derive(Properties, Clone, PartialEq)]
pub struct ViewerProps {
    pub label: String,
    pub slug: String,
    pub entries: Vec<ModelRequest>,
    pub settings: ViewerSettings,
    #[prop_or_default]
    pub members: Option<Vec<SceneMember>>,
    #[prop_or_default]
    pub background_url: Option<String>,
    pub on_load: Callback<Vec<String>>,
    pub on_error: Callback<String>,
    pub on_loading: Callback<bool>,
    #[prop_or_default]
    pub on_camera_change: Callback<CameraPose>,
    #[prop_or_default]
    pub on_background_error: Callback<()>,
    pub handle: Rc<RefCell<Option<ViewerHandle>>>,
}
type Shared = Rc<RefCell<Option<Runtime>>>;
#[derive(Clone)]
pub struct ViewerHandle {
    shared: Shared,
    latest: Rc<RefCell<ViewerProps>>,
}
impl PartialEq for ViewerHandle {
    fn eq(&self, other: &Self) -> bool {
        Rc::ptr_eq(&self.shared, &other.shared)
    }
}
impl ViewerHandle {
    pub fn view(&self, angle: &str) {
        let pose = {
            let mut state = self.shared.borrow_mut();
            let Some(r) = state.as_mut() else { return };
            let offset = match angle {
                "front" => [0., 0.45, 1.],
                "side" => [1., 0.23, 0.],
                "back" => [0., 0.3, -1.],
                "top" => [0., 1., 0.001],
                _ => [0.65, 0.34, 1.],
            };
            let direction = vector(offset[0], offset[1], offset[2]);
            direction.call("normalize", &[]);
            let distance = r.fitted_distance(&direction);
            r.distance = distance;
            r.controls
                .get("target")
                .call("copy", std::slice::from_ref(&r.target));
            r.camera
                .get("position")
                .call("copy", std::slice::from_ref(&r.target))
                .call(
                    "add",
                    &[direction.call("multiplyScalar", &[distance.into()])],
                );
            r.controls.call("update", &[]);
            r.dirty.set(true);
            r.camera_pose()
        };
        self.latest.borrow().on_camera_change.emit(pose);
    }
    pub fn zoom(&self, direction: f64) {
        let pose = {
            let mut state = self.shared.borrow_mut();
            let Some(r) = state.as_mut() else { return };
            let offset = copy(&r.camera.get("position")).call("sub", &[r.controls.get("target")]);
            let distance = (offset.call("length", &[]).num()
                * if direction > 0. { 0.82 } else { 1.22 })
            .clamp(
                r.controls.get("minDistance").num(),
                r.controls.get("maxDistance").num(),
            );
            r.camera
                .get("position")
                .call("copy", &[r.controls.get("target")])
                .call("add", &[offset.call("setLength", &[distance.into()])]);
            r.controls.call("update", &[]);
            r.dirty.set(true);
            r.camera_pose()
        };
        self.latest.borrow().on_camera_change.emit(pose);
    }
    pub fn get_camera(&self) -> Option<CameraPose> {
        self.shared.borrow().as_ref().map(Runtime::camera_pose)
    }
    pub fn restore_camera(&self, pose: CameraPose) {
        if let Some(r) = self.shared.borrow_mut().as_mut() {
            r.camera
                .get("position")
                .call("fromArray", &[nums(&pose.position)]);
            r.controls
                .get("target")
                .call("fromArray", &[nums(&pose.target)]);
            r.distance = r
                .camera
                .get("position")
                .call("distanceTo", &[r.controls.get("target")])
                .num();
            r.controls.call("update", &[]);
            r.dirty.set(true);
        }
    }
    pub async fn capture(&self) -> Result<(), JsValue> {
        let canvas = {
            let state = self.shared.borrow();
            let Some(r) = state.as_ref() else {
                return Err("The model is not ready for capture.".into());
            };
            if r.contents.is_empty() {
                return Err("The model is not ready for capture.".into());
            }
            r.renderer
                .try_call("render", &[r.scene.clone(), r.camera.clone()])?;
            r.renderer.get("domElement")
        };
        let capture_promise = js_sys::Promise::new(&mut |resolve, _| {
            canvas.call("toBlob", &[J(resolve.into()), "image/png".into()]);
        });
        let blob = promise(J(capture_promise.into())).await?;
        if !blob.exists() {
            return Err("Your image could not be saved. Please try again.".into());
        }
        let url = web_sys::Url::create_object_url_with_blob(blob.0.unchecked_ref())?;
        let document = web_sys::window().unwrap().document().unwrap();
        let link: web_sys::HtmlAnchorElement = document.create_element("a")?.dyn_into()?;
        link.set_href(&url);
        link.set_download(&format!("pokemon-atlas-{}.png", self.latest.borrow().slug));
        link.click();
        wasm_bindgen_futures::spawn_local(async move {
            gloo_timers::future::TimeoutFuture::new(1000).await;
            let _ = web_sys::Url::revoke_object_url(&url);
        });
        Ok(())
    }
}
struct Runtime {
    renderer: J,
    scene: J,
    camera: J,
    controls: J,
    loader: J,
    draco: J,
    environment: J,
    contents: Vec<LoadedModel>,
    target: J,
    distance: f64,
    framing_positions: Vec<f64>,
    dirty: Rc<Cell<bool>>,
    host: web_sys::HtmlElement,
    hemisphere: J,
    key: J,
    ground: J,
    ground_material: J,
    stars: J,
    habitats: environments::Environments,
    appearance: environments::Appearance,
    background_texture: Option<J>,
    background_request: u64,
    last_background_url: Option<String>,
    last_settings: Option<ViewerSettings>,
    last_background: Option<String>,
    last_quality: String,
    last_habitat: String,
    last_wireframe: Option<bool>,
    previous_time: f64,
    landscape_time: f64,
    failed: bool,
}
impl Runtime {
    fn camera_pose(&self) -> CameraPose {
        CameraPose {
            position: self.camera.get("position").xyz(),
            target: self.controls.get("target").xyz(),
        }
    }
    fn fitted_distance(&self, direction: &J) -> f64 {
        let viewport = self.renderer.call("getSize", &[new("Vector2", &[])]);
        let height = viewport.get("y").num();
        let reserved = 85_f64.min(height * 0.25);
        let available = height - reserved;
        let top = 1. - 2. * available * 0.125 / height - reserved / height;
        let bottom = 1. - 2. * available * 0.875 / height - reserved / height;
        let half_fov = (self.camera.get("fov").num().to_radians() / 2.).tan();
        let dir = direction.xyz();
        let right = vector(dir[2], 0., -dir[0]).call("normalize", &[]);
        let up = vector(0., 0., 0.).call("crossVectors", &[direction.clone(), right.clone()]);
        let right = right.xyz();
        let up = up.xyz();
        let target = self.target.xyz();
        let mut distance = 2.6_f64;
        for point in self.framing_positions.as_chunks::<3>().0 {
            let x = point[0] - target[0];
            let y = point[1] - target[1];
            let z = point[2] - target[2];
            let depth = x * dir[0] + y * dir[1] + z * dir[2];
            let horizontal = (x * right[0] + y * right[1] + z * right[2]).abs()
                / (half_fov * self.camera.get("aspect").num() * 0.8);
            let vertical = x * up[0] + y * up[1] + z * up[2];
            distance = distance
                .max(depth + horizontal)
                .max(depth + vertical / (half_fov * if vertical >= 0. { top } else { bottom }));
        }
        distance
    }
    fn frame_contents(&mut self, move_camera: bool) {
        self.dirty.set(true);
        let mut points = Vec::new();
        let mut bounds = Bounds::new();
        let point = vector(0., 0., 0.);
        for model in &self.contents {
            model.group.call("updateMatrix", &[]);
            let matrix = model.group.get("matrix");
            for xyz in model.points.as_chunks::<3>().0 {
                set_xyz(&point, xyz[0], xyz[1], xyz[2]);
                point.call("applyMatrix4", std::slice::from_ref(&matrix));
                let xyz = point.xyz();
                points.extend(xyz);
                bounds.add(xyz);
            }
        }
        if points.is_empty() {
            return;
        }
        let center = bounds.center();
        set_xyz(&self.target, center[0], center[1], center[2]);
        self.framing_positions = points.into_iter().map(|n| n as f32 as f64).collect();
        if move_camera {
            let direction = copy(&self.camera.get("position"))
                .call("sub", &[self.controls.get("target")])
                .call("normalize", &[]);
            self.distance = self.fitted_distance(&direction);
            self.controls
                .get("target")
                .call("copy", std::slice::from_ref(&self.target));
            self.camera
                .get("position")
                .call("copy", std::slice::from_ref(&self.target))
                .call(
                    "add",
                    &[direction.call("multiplyScalar", &[self.distance.into()])],
                );
            self.controls.call("update", &[]);
        }
    }
    fn apply_layout(&mut self, members: Option<&[SceneMember]>) {
        self.dirty.set(true);
        for content in &mut self.contents {
            let member = members.and_then(|ms| ms.iter().find(|m| m.key == content.key));
            set_xyz(
                &content.group.get("position"),
                member.map_or(0., |m| m.x),
                0.,
                member.map_or(0., |m| m.z),
            );
            content
                .group
                .get("rotation")
                .set("y", member.map_or(0., |m| m.rotation).to_radians());
            content.base_scale = member.map_or(1., |m| m.scale);
            content
                .group
                .get("scale")
                .call("setScalar", &[content.base_scale.into()]);
        }
    }
    fn remove_content(&mut self, index: usize) {
        let model = self.contents.remove(index);
        model.mixer.call("stopAllAction", &[]);
        model
            .mixer
            .call("uncacheRoot", std::slice::from_ref(&model.scene));
        self.scene
            .call("remove", std::slice::from_ref(&model.group));
        dispose_object(&model.group);
    }
    fn cover_background(&self) {
        if let Some(texture) = &self.background_texture {
            let image = texture.get("image");
            let aspect =
                self.host.client_width() as f64 / (self.host.client_height().max(1) as f64);
            let image_aspect = image.get("width").num() / image.get("height").num();
            let x = (aspect / image_aspect).min(1.);
            let y = (image_aspect / aspect).min(1.);
            texture.get("repeat").call("set", &[x.into(), y.into()]);
            texture
                .get("offset")
                .call("set", &[((1. - x) / 2.).into(), ((1. - y) / 2.).into()]);
            texture.call("updateMatrix", &[]);
        }
    }
    fn resize(&mut self) {
        let host = J(self.host.clone().into());
        let rect = host.call("getBoundingClientRect", &[]);
        let width = rect.get("width").num();
        let height = rect.get("height").num();
        if width == 0. || height == 0. {
            return;
        }
        self.dirty.set(true);
        self.renderer
            .call("setSize", &[width.into(), height.into(), false.into()]);
        self.camera.set("aspect", width / height);
        self.camera.call(
            "setViewOffset",
            &[
                width.into(),
                height.into(),
                0.into(),
                (85_f64.min(height * 0.25) / 2.).into(),
                width.into(),
                height.into(),
            ],
        );
        self.camera.call("updateProjectionMatrix", &[]);
        self.cover_background();
        if !self.contents.is_empty() {
            let offset =
                copy(&self.camera.get("position")).call("sub", &[self.controls.get("target")]);
            let distance = self.fitted_distance(&copy(&offset).call("normalize", &[]));
            self.camera
                .get("position")
                .call("copy", &[self.controls.get("target")])
                .call(
                    "add",
                    &[offset.call("multiplyScalar", &[(distance / self.distance).into()])],
                );
            self.distance = distance;
            self.controls.call("update", &[]);
        }
    }
    fn dispose(&mut self) {
        self.controls.call("dispose", &[]);
        while !self.contents.is_empty() {
            self.remove_content(0)
        }
        self.draco.call("dispose", &[]);
        self.habitats.dispose();
        self.background_request += 1;
        if let Some(texture) = self.background_texture.take() {
            texture.call("dispose", &[]);
        }
        dispose_object(&self.scene);
        self.environment.call("dispose", &[]);
        self.renderer.get("domElement").call("remove", &[]);
        if self.renderer.call("hasInitialized", &[]).yes() {
            self.renderer.call("dispose", &[]);
        }
    }
}

#[function_component(Viewer)]
pub fn viewer(props: &ViewerProps) -> Html {
    let host = use_node_ref();
    let latest = use_mut_ref(|| props.clone());
    *latest.borrow_mut() = props.clone();
    let shared: Shared = use_mut_ref(|| None);
    let cancelled = use_mut_ref(|| false);
    let load_sequence = use_mut_ref(|| 0u64);
    let renderer_failed = use_mut_ref(|| false);
    {
        let host = host.clone();
        let shared = shared.clone();
        let latest = latest.clone();
        let cancelled = cancelled.clone();
        let renderer_failed = renderer_failed.clone();
        let handle = props.handle.clone();
        use_effect_with((), move |_| {
            *cancelled.borrow_mut() = false;
            *handle.borrow_mut() = Some(ViewerHandle {
                shared: shared.clone(),
                latest: latest.clone(),
            });
            let resources = Rc::new(RefCell::new(Lifecycle::default()));
            if let Some(element) = host.cast::<web_sys::HtmlElement>() {
                let shared = shared.clone();
                let latest = latest.clone();
                let cancelled = cancelled.clone();
                let renderer_failed = renderer_failed.clone();
                let resources = resources.clone();
                wasm_bindgen_futures::spawn_local(async move {
                    latest.borrow().on_loading.emit(true);
                    if let Err(error) = initialize(
                        element,
                        shared.clone(),
                        latest.clone(),
                        cancelled.clone(),
                        renderer_failed.clone(),
                        resources,
                    )
                    .await
                    {
                        web_sys::console::error_1(&error);
                        if !*cancelled.borrow() {
                            *renderer_failed.borrow_mut() = true;
                            latest.borrow().on_loading.emit(false);
                            latest.borrow().on_error.emit(RENDERER_UNAVAILABLE.into());
                        }
                    }
                });
            }
            move || {
                *cancelled.borrow_mut() = true;
                *handle.borrow_mut() = None;
                resources.borrow_mut().dispose();
                if let Some(mut runtime) = shared.borrow_mut().take() {
                    runtime.dispose();
                }
            }
        });
    }
    {
        let shared = shared.clone();
        let latest = latest.clone();
        let cancelled = cancelled.clone();
        let sequence = load_sequence.clone();
        let failed = renderer_failed.clone();
        use_effect_with(props.entries.clone(), move |entries| {
            *sequence.borrow_mut() += 1;
            let generation = *sequence.borrow();
            let entries = entries.clone();
            let abort = web_sys::AbortController::new().unwrap();
            let task_abort = abort.clone();
            let sequence = sequence.clone();
            wasm_bindgen_futures::spawn_local(async move {
                load_models(
                    entries, shared, latest, cancelled, sequence, generation, failed, task_abort,
                )
                .await;
            });
            move || abort.abort()
        });
    }
    {
        let shared = shared.clone();
        use_effect_with(props.members.clone(), move |members| {
            if let Some(runtime) = shared.borrow_mut().as_mut() {
                runtime.apply_layout(members.as_deref());
                runtime.frame_contents(false);
            }
        });
    }
    html! {<div ref={host} class="viewer-canvas" style="position: absolute; inset: 0"/>}
}

type AnimationFrame = Rc<RefCell<Option<Closure<dyn FnMut(f64)>>>>;

#[derive(Default)]
struct Lifecycle {
    observers: Vec<J>,
    listeners: Vec<gloo_events::EventListener>,
    closures: Vec<Closure<dyn FnMut(JsValue)>>,
    preloads: Vec<web_sys::Element>,
    frame: i32,
    tick: Option<AnimationFrame>,
}
impl Lifecycle {
    fn dispose(&mut self) {
        if let Some(window) = web_sys::window() {
            let _ = window.cancel_animation_frame(self.frame);
        }
        for observer in self.observers.drain(..) {
            observer.call("disconnect", &[]);
        }
        self.listeners.clear();
        self.closures.clear();
        for link in self.preloads.drain(..) {
            link.remove();
        }
        if let Some(tick) = self.tick.take() {
            tick.borrow_mut().take();
        }
    }
}

fn night_sky() -> J {
    let mut points = Vec::<f32>::new();
    for i in 0..120 {
        let angle = i as f64 * 2.39996;
        points.extend([
            (angle.sin() * 29.) as f32,
            (2 + (i * 17) % 29) as f32,
            (angle.cos() * 29.) as f32,
        ]);
    }
    let geometry = new("BufferGeometry", &[]);
    geometry.call(
        "setAttribute",
        &[
            "position".into(),
            new(
                "BufferAttribute",
                &[
                    J(js_sys::Float32Array::from(points.as_slice()).into()),
                    3.into(),
                ],
            ),
        ],
    );
    new(
        "Points",
        &[
            geometry,
            new(
                "PointsMaterial",
                &[object(&[
                    ("color", "#dce7ff".into()),
                    ("size", 0.035.into()),
                    ("transparent", true.into()),
                    ("opacity", 0.85.into()),
                ])],
            ),
        ],
    )
}

async fn initialize(
    host: web_sys::HtmlElement,
    shared: Shared,
    latest: Rc<RefCell<ViewerProps>>,
    cancelled: Rc<RefCell<bool>>,
    renderer_failed: Rc<RefCell<bool>>,
    resources: Rc<RefCell<Lifecycle>>,
) -> Result<(), JsValue> {
    let window = web_sys::window().unwrap();
    let document = window.document().unwrap();
    for file in ["draco_wasm_wrapper.js", "draco_decoder.wasm"] {
        let href = format!("/atlas/draco/{file}");
        if document
            .query_selector(&format!(
                "link[rel='preload'][as='fetch'][crossorigin='anonymous'][href='{href}']"
            ))?
            .is_some()
        {
            continue;
        }
        let link = document.create_element("link")?;
        for (key, value) in [
            ("rel", "preload"),
            ("as", "fetch"),
            ("crossorigin", "anonymous"),
            ("href", &href),
        ] {
            link.set_attribute(key, value)?;
        }
        document.head().unwrap().append_child(&link)?;
        resources.borrow_mut().preloads.push(link);
    }
    let options = object(&[
        ("antialias", true.into()),
        ("alpha", false.into()),
        ("stencil", true.into()),
    ]);
    let mut renderer = new("WebGPURenderer", std::slice::from_ref(&options));
    if promise(renderer.call("init", &[])).await.is_err() {
        if renderer.call("hasInitialized", &[]).yes() {
            renderer.call("dispose", &[]);
        }
        if *cancelled.borrow() {
            return Ok(());
        }
        options.set("forceWebGL", true);
        renderer = new("WebGPURenderer", &[options]);
        promise(renderer.call("init", &[])).await?;
    }
    if *cancelled.borrow() {
        renderer.call("dispose", &[]);
        return Ok(());
    }
    renderer.set("toneMapping", constant("ACESFilmicToneMapping"));
    renderer.set("outputColorSpace", constant("SRGBColorSpace"));
    renderer.get("shadowMap").set("enabled", true);
    renderer
        .get("shadowMap")
        .set("type", constant("PCFSoftShadowMap"));
    let canvas = renderer.get("domElement");
    canvas.call(
        "setAttribute",
        &["aria-label".into(), latest.borrow().label.clone().into()],
    );
    canvas.call("setAttribute", &["role".into(), "img".into()]);
    for (key, value) in [
        ("width", "100%"),
        ("height", "100%"),
        ("display", "block"),
        ("touchAction", "none"),
    ] {
        canvas.get("style").set(key, value);
    }
    host.append_child(canvas.0.unchecked_ref())?;
    let scene = new("Scene", &[]);
    scene.set("background", color("#1b241c"));
    scene.set("fog", new("Fog", &["#1b241c".into(), 16.into(), 42.into()]));
    let camera = new(
        "PerspectiveCamera",
        &[35.into(), 1.into(), 0.05.into(), 120.into()],
    );
    set_xyz(&camera.get("position"), 4.3, 3.6, 6.6);
    let controls = new("OrbitControls", &[camera.clone(), canvas]);
    for (key, value) in [
        ("enableDamping", J::from(true)),
        ("dampingFactor", 0.075.into()),
        ("minDistance", 2.1.into()),
        ("maxDistance", 55.into()),
        ("maxPolarAngle", (std::f64::consts::PI * 0.49).into()),
        ("autoRotateSpeed", 0.65.into()),
    ] {
        controls.set(key, value);
    }
    set_xyz(&controls.get("target"), 0., 1.3, 0.);
    controls.call("update", &[]);
    let dirty = Rc::new(Cell::new(true));
    {
        let dirty = dirty.clone();
        let callback = Closure::<dyn FnMut(JsValue)>::new(move |_| dirty.set(true));
        controls.call(
            "addEventListener",
            &["change".into(), J(callback.as_ref().clone())],
        );
        resources.borrow_mut().closures.push(callback);
        let camera = camera.clone();
        let controls_copy = controls.clone();
        let latest = latest.clone();
        let callback = Closure::<dyn FnMut(JsValue)>::new(move |_| {
            latest.borrow().on_camera_change.emit(CameraPose {
                position: camera.get("position").xyz(),
                target: controls_copy.get("target").xyz(),
            })
        });
        controls.call(
            "addEventListener",
            &["end".into(), J(callback.as_ref().clone())],
        );
        resources.borrow_mut().closures.push(callback);
    }
    let hemisphere = new(
        "HemisphereLight",
        &["#ffffff".into(), "#99a087".into(), 1.5.into()],
    );
    let key = new("DirectionalLight", &["#ffffff".into(), 3.4.into()]);
    set_xyz(&key.get("position"), -4., 7., 5.);
    key.set("castShadow", true);
    let shadow = key.get("shadow");
    shadow
        .get("mapSize")
        .call("set", &[1024.into(), 1024.into()]);
    for (name, value) in [
        ("left", -8.),
        ("bottom", -8.),
        ("right", 8.),
        ("top", 8.),
        ("near", 0.1),
        ("far", 25.),
    ] {
        shadow.get("camera").set(name, value);
    }
    shadow.set("bias", -0.00015);
    shadow.set("normalBias", 0.025);
    shadow.set("radius", 3);
    let rim = new("DirectionalLight", &["#e9f0ff".into(), 2.8.into()]);
    set_xyz(&rim.get("position"), 4., 4., -5.);
    let fill = new("DirectionalLight", &["#ffffff".into(), 0.7.into()]);
    set_xyz(&fill.get("position"), 4., 1., 5.);
    scene.call("add", &[hemisphere.clone(), key.clone(), rim, fill]);
    let ground_material = new(
        "MeshStandardMaterial",
        &[object(&[
            ("color", "#1c251d".into()),
            ("roughness", 1.into()),
            ("metalness", 0.into()),
        ])],
    );
    let ground = new(
        "Mesh",
        &[
            new("PlaneGeometry", &[200.into(), 200.into()]),
            ground_material.clone(),
        ],
    );
    ground
        .get("rotation")
        .set("x", -std::f64::consts::FRAC_PI_2);
    ground.get("position").set("y", -0.012);
    ground.set("receiveShadow", true);
    let stars = night_sky();
    stars.set("visible", false);
    scene.call("add", &[ground.clone(), stars.clone()]);
    let room = new("RoomEnvironment", &[]);
    let generator = new("PMREMGenerator", &[renderer.clone()]);
    let environment = generator.try_call(
        "fromScene",
        &[
            room.clone(),
            0.04.into(),
            0.1.into(),
            100.into(),
            object(&[("size", 128.into())]),
        ],
    );
    room.call("dispose", &[]);
    generator.call("dispose", &[]);
    let environment = environment?;
    scene.set("environment", environment.get("texture"));
    scene.set("environmentIntensity", 0.45);
    let draco = new("DRACOLoader", &[]).call("setDecoderPath", &["/atlas/draco/".into()]);
    draco.call("setWorkerLimit", &[2.into()]);
    let loader = new("GLTFLoader", &[]).call("setDRACOLoader", std::slice::from_ref(&draco));
    let habitats = environments::Environments::new();
    scene.call("add", std::slice::from_ref(&habitats.group));
    let mut runtime = Runtime {
        renderer,
        scene,
        camera,
        controls,
        loader,
        draco,
        environment,
        contents: Vec::new(),
        target: vector(0., 1.3, 0.),
        distance: 7.5,
        framing_positions: Vec::new(),
        dirty: dirty.clone(),
        host: host.clone(),
        hemisphere,
        key,
        ground,
        ground_material,
        stars,
        habitats,
        appearance: environments::appearance("studio"),
        background_texture: None,
        background_request: 0,
        last_background_url: None,
        last_settings: None,
        last_background: None,
        last_quality: String::new(),
        last_habitat: String::new(),
        last_wireframe: None,
        previous_time: js_sys::Date::now(),
        landscape_time: 0.,
        failed: false,
    };
    runtime.resize();
    *shared.borrow_mut() = Some(runtime);
    let in_viewport = Rc::new(Cell::new(true));
    let global = J(window.clone().into());
    {
        let shared = shared.clone();
        let callback = Closure::<dyn FnMut(JsValue)>::new(move |_| {
            if let Some(r) = shared.borrow_mut().as_mut() {
                r.resize();
            }
        });
        let ctor = global.get("ResizeObserver");
        if ctor.exists() {
            let observer = J(js_sys::Reflect::construct::<fn() -> JsValue>(
                ctor.0.unchecked_ref(),
                &arr(&[J(callback.as_ref().clone())]),
            )?);
            observer.call("observe", &[J(host.clone().into())]);
            resources.borrow_mut().observers.push(observer);
            resources.borrow_mut().closures.push(callback);
        }
    }
    {
        let visible = in_viewport.clone();
        let dirty = dirty.clone();
        let callback = Closure::<dyn FnMut(JsValue)>::new(move |entries| {
            let first = J(entries).list().into_iter().next();
            if let Some(first) = first {
                visible.set(first.get("isIntersecting").yes());
                if visible.get() {
                    dirty.set(true)
                }
            }
        });
        let ctor = global.get("IntersectionObserver");
        if ctor.exists() {
            let observer = J(js_sys::Reflect::construct::<fn() -> JsValue>(
                ctor.0.unchecked_ref(),
                &arr(&[J(callback.as_ref().clone())]),
            )?);
            observer.call("observe", &[J(host.into())]);
            resources.borrow_mut().observers.push(observer);
            resources.borrow_mut().closures.push(callback);
        }
    }
    let doc = document.clone();
    let d = dirty.clone();
    resources
        .borrow_mut()
        .listeners
        .push(gloo_events::EventListener::new(
            &document,
            "visibilitychange",
            move |_| {
                if !doc.hidden() {
                    d.set(true)
                }
            },
        ));
    let tick: AnimationFrame = Rc::new(RefCell::new(None));
    let loop_ref = tick.clone();
    let weak_resources = Rc::downgrade(&resources);
    *tick.borrow_mut() = Some(Closure::new(move |time: f64| {
        if *cancelled.borrow() {
            return;
        }
        let window = web_sys::window().unwrap();
        let Some(resources) = weak_resources.upgrade() else {
            return;
        };
        if let Some(callback) = loop_ref.borrow().as_ref() {
            resources.borrow_mut().frame = window
                .request_animation_frame(callback.as_ref().unchecked_ref())
                .unwrap_or(0);
        }
        let props = latest.borrow().clone();
        let mut state = shared.borrow_mut();
        let Some(runtime) = state.as_mut() else {
            return;
        };
        let delta = ((time - runtime.previous_time) / 1000.).clamp(0., 0.05);
        runtime.previous_time = time;
        if document.hidden() || runtime.failed || !in_viewport.get() {
            return;
        }
        if let Err(error) = tick_runtime(
            runtime,
            &props,
            delta,
            shared.clone(),
            latest.clone(),
            cancelled.clone(),
        ) {
            runtime.failed = true;
            *renderer_failed.borrow_mut() = true;
            while !runtime.contents.is_empty() {
                runtime.remove_content(0);
            }
            web_sys::console::error_1(&error);
            props.on_loading.emit(false);
            props.on_error.emit(RENDERER_UNAVAILABLE.into());
        }
    }));
    if let Some(callback) = tick.borrow().as_ref() {
        resources.borrow_mut().frame =
            window.request_animation_frame(callback.as_ref().unchecked_ref())?;
    }
    resources.borrow_mut().tick = Some(tick);
    Ok(())
}

fn tick_runtime(
    r: &mut Runtime,
    props: &ViewerProps,
    delta: f64,
    shared: Shared,
    latest: Rc<RefCell<ViewerProps>>,
    cancelled: Rc<RefCell<bool>>,
) -> Result<(), JsValue> {
    let settings = &props.settings;
    if r.last_settings.as_ref() != Some(settings) || r.last_background != props.background_url {
        r.dirty.set(true);
    }
    r.last_settings = Some(settings.clone());
    r.last_background = props.background_url.clone();
    r.renderer.get("domElement").call(
        "setAttribute",
        &["aria-label".into(), props.label.clone().into()],
    );
    if r.last_quality != settings.quality {
        r.renderer.call(
            "setPixelRatio",
            &[web_sys::window()
                .unwrap()
                .device_pixel_ratio()
                .min(if settings.quality == "high" { 2. } else { 1.25 })
                .into()],
        );
        r.resize();
        r.last_quality = settings.quality.clone();
    }
    if r.last_habitat != settings.habitat {
        let night = settings.habitat == "night";
        let custom = settings.habitat == "custom";
        r.appearance = r.habitats.set_habitat(&settings.habitat);
        let a = &r.appearance;
        r.scene.set("background", color(a.background));
        r.scene.set(
            "fog",
            new(
                "Fog",
                &[a.background.into(), a.fog_near.into(), a.fog_far.into()],
            ),
        );
        r.ground_material
            .get("color")
            .call("set", &[a.ground.into()]);
        r.ground_material.set("transparent", custom);
        r.ground_material
            .set("opacity", if custom { 0.3 } else { 1. });
        r.ground_material.set("depthWrite", !custom);
        r.ground_material.set("needsUpdate", true);
        r.ground.set("visible", true);
        r.key.get("color").call("set", &[a.key_color.into()]);
        r.key.set("intensity", a.key_intensity);
        r.hemisphere
            .get("color")
            .call("set", &[if night { "#adc5de" } else { "#ffffff" }.into()]);
        r.hemisphere
            .get("groundColor")
            .call("set", &[a.ground_light.into()]);
        r.stars.set("visible", night);
        r.scene.set("environmentIntensity", a.environment_intensity);
        r.last_habitat = settings.habitat.clone();
        if custom && let Some(texture) = &r.background_texture {
            r.scene.set("background", texture.clone())
        }
    }
    let background = if settings.habitat == "custom" {
        props.background_url.clone()
    } else {
        None
    };
    if background != r.last_background_url {
        r.last_background_url = background.clone();
        r.background_request += 1;
        let request = r.background_request;
        r.scene.set("background", color(r.appearance.background));
        if let Some(old) = r.background_texture.take() {
            old.call("dispose", &[]);
        }
        if let Some(url) = background {
            if !url.starts_with("blob:") {
                props.on_background_error.emit(());
            } else {
                wasm_bindgen_futures::spawn_local(async move {
                    let loader = new("TextureLoader", &[]);
                    let result = promise(loader.call("loadAsync", &[url.into()])).await;
                    if let Ok(texture) = result {
                        let mut state = shared.borrow_mut();
                        if *cancelled.borrow()
                            || state
                                .as_ref()
                                .is_none_or(|r| r.background_request != request)
                        {
                            texture.call("dispose", &[]);
                            return;
                        }
                        let r = state.as_mut().unwrap();
                        texture.set("colorSpace", constant("SRGBColorSpace"));
                        texture.set("mapping", constant("UVMapping"));
                        r.background_texture = Some(texture.clone());
                        r.cover_background();
                        r.scene.set("background", texture);
                        r.dirty.set(true);
                    } else if !*cancelled.borrow()
                        && shared
                            .borrow()
                            .as_ref()
                            .is_some_and(|r| r.background_request == request)
                    {
                        latest.borrow().on_background_error.emit(());
                    }
                });
            }
        }
    }
    r.renderer.set(
        "toneMappingExposure",
        settings.light.clamp(0.2, 2.5) * r.appearance.exposure,
    );
    r.controls.set("autoRotate", settings.rotate);
    r.controls.call("update", &[delta.into()]);
    if !settings.playing && !settings.rotate && !r.dirty.get() {
        return Ok(());
    }
    if settings.playing {
        r.landscape_time += delta;
        r.habitats.update(r.landscape_time);
    }
    let changed_wireframe = r.last_wireframe != Some(settings.wireframe);
    let mut reframe = false;
    for content in &mut r.contents {
        if settings.playing {
            content.elapsed += delta * settings.speed;
            for material in &content.flames {
                material.set(
                    "emissiveIntensity",
                    1.2 + (content.elapsed * 11.).sin() * 0.12
                        + (content.elapsed * 17.).sin() * 0.06,
                );
            }
        }
        if changed_wireframe {
            walk(&content.scene, false, &mut |mesh| {
                if mesh.get("isMesh").yes() {
                    for material in materials(&mesh) {
                        if js_sys::Reflect::has(&material.0, &"wireframe".into()).unwrap_or(false) {
                            material.set("wireframe", settings.wireframe);
                        }
                    }
                }
            });
        }
        if !content.clips.is_empty() {
            let selection = (settings.animation as usize).min(content.clips.len() - 1);
            if content.active_clip != selection {
                let (_, points) = measure_motion(
                    &content.scene,
                    &content.mixer,
                    &[content.clips[selection].clone()],
                );
                content.points = normalized_points(&points, &content.normalization);
                content
                    .mixer
                    .call("clipAction", &[content.clips[selection].clone()])
                    .call("reset", &[])
                    .call("play", &[]);
                reframe = true;
                content.active_clip = selection;
            }
            if settings.playing {
                content
                    .mixer
                    .call("update", &[(delta * settings.speed).into()]);
            }
        } else if settings.playing {
            content.group.get("scale").set(
                "y",
                content.base_scale * (1. + (content.elapsed * 2.).sin() * 0.006),
            );
        }
    }
    if reframe {
        r.frame_contents(true)
    }
    r.last_wireframe = Some(settings.wireframe);
    r.renderer
        .try_call("render", &[r.scene.clone(), r.camera.clone()])?;
    r.dirty.set(false);
    Ok(())
}

async fn fetch_model(
    url: &str,
    abort: &web_sys::AbortController,
) -> Result<js_sys::Promise, JsValue> {
    let options = web_sys::RequestInit::new();
    options.set_signal(Some(&abort.signal()));
    let request = web_sys::Request::new_with_str_and_init(url, &options)?;
    let promise = web_sys::window().unwrap().fetch_with_request(&request);
    // A fetch can reject while the renderer is still initializing. Its result remains
    // awaited below; attaching a rejection handler prevents an unhandled promise event.
    let handler = Closure::<dyn FnMut(JsValue)>::new(|_| {});
    J(promise.clone().into()).call("catch", &[J(handler.into_js_value())]);
    Ok(promise)
}
async fn response_data(response: js_sys::Promise) -> Result<J, JsValue> {
    let response = promise(J(response.into())).await?;
    if !response.get("ok").yes() {
        return Err("Model unavailable".into());
    }
    promise(response.call("arrayBuffer", &[])).await
}
async fn next_frame() {
    let promise = js_sys::Promise::new(&mut |resolve, _| {
        let _ = web_sys::window().unwrap().request_animation_frame(&resolve);
    });
    let _ = wasm_bindgen_futures::JsFuture::from(promise).await;
}
// Each shared lifecycle token has a distinct cancellation responsibility.
#[allow(clippy::too_many_arguments)]
async fn load_models(
    entries: Vec<ModelRequest>,
    shared: Shared,
    latest: Rc<RefCell<ViewerProps>>,
    cancelled: Rc<RefCell<bool>>,
    sequence: Rc<RefCell<u64>>,
    generation: u64,
    failed: Rc<RefCell<bool>>,
    abort: web_sys::AbortController,
) {
    #[cfg(not(feature = "renderer-qa"))]
    let finish =
        crate::platform::telemetry::begin_model_observation(if latest.borrow().members.is_some() {
            "together"
        } else {
            "solo"
        });
    #[cfg(feature = "renderer-qa")]
    let finish: Rc<dyn Fn(&str)> = Rc::new(|_| {});
    let stale =
        || *cancelled.borrow() || *sequence.borrow() != generation || abort.signal().aborted();
    // Start the first network request before awaiting renderer initialization.
    let first = entries.first();
    let mut prepared = None;
    if let Some(entry) = first
        && let Some(url) = &entry.url
    {
        let cached = shared.borrow().as_ref().is_some_and(|r| {
            r.contents
                .iter()
                .any(|c| c.key == entry.key && c.url == *url)
        });
        if !cached {
            prepared = fetch_model(url, &abort).await.ok();
        }
    }
    while shared.borrow().is_none() {
        if stale() {
            return;
        }
        if *failed.borrow() {
            abort.abort();
            finish("failed");
            latest.borrow().on_loading.emit(false);
            latest.borrow().on_error.emit(RENDERER_UNAVAILABLE.into());
            return;
        }
        gloo_timers::future::TimeoutFuture::new(20).await;
    }
    if stale() {
        return;
    }
    if *failed.borrow() {
        abort.abort();
        finish("failed");
        latest.borrow().on_loading.emit(false);
        latest.borrow().on_error.emit(RENDERER_UNAVAILABLE.into());
        return;
    }
    {
        let mut state = shared.borrow_mut();
        let r = state.as_mut().unwrap();
        for index in (0..r.contents.len()).rev() {
            if !entries.iter().any(|e| {
                e.key == r.contents[index].key && e.url.as_deref() == Some(&r.contents[index].url)
            }) {
                r.remove_content(index);
            }
        }
    }
    latest.borrow().on_load.emit(Vec::new());
    latest.borrow().on_loading.emit(true);
    let result: Result<(), JsValue> = async {
        for (index, entry) in entries.iter().enumerate() {
            if stale() {
                return Ok(());
            }
            if shared
                .borrow()
                .as_ref()
                .is_some_and(|r| r.contents.iter().any(|c| c.key == entry.key))
            {
                continue;
            }
            let url = entry
                .url
                .as_deref()
                .ok_or(JsValue::from_str("Unavailable model"))?;
            let response = if index == 0 {
                if let Some(promise) = prepared.take() {
                    promise
                } else {
                    fetch_model(url, &abort).await?
                }
            } else {
                fetch_model(url, &abort).await?
            };
            let data = response_data(response).await?;
            if stale() {
                return Ok(());
            }
            let href = web_sys::window().unwrap().location().href()?;
            let url_base = web_sys::Url::new_with_base(url, &href)?;
            let resource = web_sys::Url::new_with_base(".", &url_base.href())?;
            let loader = shared.borrow().as_ref().unwrap().loader.clone();
            let gltf = promise(loader.call("parseAsync", &[data, resource.href().into()])).await?;
            if stale() || *failed.borrow() {
                dispose_object(&gltf.get("scene"));
                return Ok(());
            }
            let props = latest.borrow().clone();
            {
                let mut state = shared.borrow_mut();
                let r = state.as_mut().unwrap();
                let stencil = [1, 2, 4, 8, 16, 32]
                    .into_iter()
                    .find(|bit| !r.contents.iter().any(|c| c.stencil_bit == *bit))
                    .unwrap_or(64);
                let content = prepare_content(
                    gltf,
                    entry.species_id,
                    entry.key.clone(),
                    url.into(),
                    props.settings.animation,
                    props.settings.wireframe,
                    stencil,
                )?;
                r.scene.call("add", std::slice::from_ref(&content.group));
                r.contents.push(content);
                r.apply_layout(props.members.as_deref());
                r.frame_contents(true);
            }
            next_frame().await;
        }
        Ok(())
    }
    .await;
    if stale() {
        return;
    }
    if *failed.borrow() {
        finish("failed");
        return;
    }
    match result {
        Ok(()) => {
            let names = shared
                .borrow()
                .as_ref()
                .and_then(|r| {
                    entries
                        .first()
                        .and_then(|entry| r.contents.iter().find(|c| c.key == entry.key))
                })
                .map(|c| {
                    c.clips
                        .iter()
                        .enumerate()
                        .map(|(i, c)| {
                            let name = c.get("name").text();
                            if name.is_empty() {
                                format!("Animation {}", i + 1)
                            } else {
                                name
                            }
                        })
                        .collect()
                })
                .unwrap_or_default();
            latest.borrow().on_load.emit(names);
            latest.borrow().on_loading.emit(false);
            finish("ready");
        }
        Err(error) => {
            finish("failed");
            web_sys::console::warn_1(&error);
            latest.borrow().on_loading.emit(false);
            latest.borrow().on_error.emit(if web_sys::window().unwrap().navigator().on_line(){"This 3D model could not be loaded. Check your connection and try another Pokémon."}else{"Connect to the internet to open this Pokémon for the first time."}.into());
        }
    }
}
