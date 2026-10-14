use js_sys::{Array, Function, Reflect};
use wasm_bindgen::{JsCast, prelude::*};

#[wasm_bindgen(module = "/src/viewer/three-bridge.js")]
extern "C" {
    #[wasm_bindgen(thread_local_v2)]
    static THREE: JsValue;
    #[wasm_bindgen(thread_local_v2, js_name = OrbitControls)]
    static ORBIT_CONTROLS: JsValue;
    #[wasm_bindgen(thread_local_v2, js_name = RoomEnvironment)]
    static ROOM_ENVIRONMENT: JsValue;
    #[wasm_bindgen(thread_local_v2, js_name = DRACOLoader)]
    static DRACO_LOADER: JsValue;
    #[wasm_bindgen(thread_local_v2, js_name = GLTFLoader)]
    static GLTF_LOADER: JsValue;
}

// Structural dispatch preserves SkinnedMesh's getVertexPosition override.
// These bindings only remove dynamic property names and argument arrays.
#[wasm_bindgen]
extern "C" {
    pub type PositionMesh;
    pub type PositionVector;

    #[wasm_bindgen(method, structural, catch, js_name = getVertexPosition)]
    pub fn get_vertex_position(
        this: &PositionMesh,
        index: usize,
        target: &PositionVector,
    ) -> Result<PositionVector, JsValue>;

    #[wasm_bindgen(method, structural, catch, js_name = applyMatrix4)]
    pub fn apply_matrix4(
        this: &PositionVector,
        matrix: &JsValue,
    ) -> Result<PositionVector, JsValue>;

    #[wasm_bindgen(method, structural, getter)]
    pub fn x(this: &PositionVector) -> f64;
    #[wasm_bindgen(method, structural, getter)]
    pub fn y(this: &PositionVector) -> f64;
    #[wasm_bindgen(method, structural, getter)]
    pub fn z(this: &PositionVector) -> f64;
}

#[derive(Clone, PartialEq, Debug)]
pub struct J(pub JsValue);
impl From<f64> for J {
    fn from(v: f64) -> Self {
        Self(v.into())
    }
}
impl From<usize> for J {
    fn from(v: usize) -> Self {
        Self((v as f64).into())
    }
}
impl From<u32> for J {
    fn from(v: u32) -> Self {
        Self(v.into())
    }
}
impl From<i32> for J {
    fn from(v: i32) -> Self {
        Self(v.into())
    }
}
impl From<bool> for J {
    fn from(v: bool) -> Self {
        Self(v.into())
    }
}
impl From<&str> for J {
    fn from(v: &str) -> Self {
        Self(v.into())
    }
}
impl From<String> for J {
    fn from(v: String) -> Self {
        Self(v.into())
    }
}
impl J {
    pub fn get(&self, key: &str) -> Self {
        Self(Reflect::get(&self.0, &key.into()).unwrap_or(JsValue::UNDEFINED))
    }
    pub fn set(&self, key: &str, value: impl Into<J>) {
        Reflect::set(&self.0, &key.into(), &value.into().0).unwrap_throw();
    }
    pub fn call(&self, key: &str, args: &[J]) -> Self {
        self.try_call(key, args).unwrap_throw()
    }
    pub fn try_call(&self, key: &str, args: &[J]) -> Result<Self, JsValue> {
        let f: Function = self.get(key).0.dyn_into()?;
        match args {
            [] => f.call0(&self.0),
            [a] => f.call1(&self.0, &a.0),
            [a, b] => f.call2(&self.0, &a.0, &b.0),
            [a, b, c] => f.call3(&self.0, &a.0, &b.0, &c.0),
            _ => f.apply(&self.0, &arr(args)),
        }
        .map(Self)
    }
    pub fn num(&self) -> f64 {
        self.0.as_f64().unwrap_or(0.0)
    }
    pub fn text(&self) -> String {
        self.0.as_string().unwrap_or_default()
    }
    pub fn yes(&self) -> bool {
        self.0.as_bool().unwrap_or(false)
    }
    pub fn exists(&self) -> bool {
        !self.0.is_null() && !self.0.is_undefined()
    }
    pub fn list(&self) -> Vec<J> {
        Array::from(&self.0).iter().map(Self).collect()
    }
    pub fn xyz(&self) -> [f64; 3] {
        [
            self.get("x").num(),
            self.get("y").num(),
            self.get("z").num(),
        ]
    }
}
pub fn arr(args: &[J]) -> Array {
    args.iter().map(|v| v.0.clone()).collect()
}
pub fn nums(values: &[f64]) -> J {
    J(values
        .iter()
        .map(|v| JsValue::from_f64(*v))
        .collect::<Array>()
        .into())
}
pub fn object(values: &[(&str, J)]) -> J {
    let o = J(js_sys::Object::new().into());
    for (k, v) in values {
        o.set(k, v.clone())
    }
    o
}
pub fn constant(key: &str) -> J {
    THREE.with(|v| J(v.clone()).get(key))
}
pub fn new(name: &str, args: &[J]) -> J {
    let ctor = match name {
        "OrbitControls" => ORBIT_CONTROLS.with(Clone::clone),
        "RoomEnvironment" => ROOM_ENVIRONMENT.with(Clone::clone),
        "DRACOLoader" => DRACO_LOADER.with(Clone::clone),
        "GLTFLoader" => GLTF_LOADER.with(Clone::clone),
        _ => constant(name).0,
    };
    J(Reflect::construct::<fn() -> JsValue>(ctor.unchecked_ref(), &arr(args)).unwrap_throw())
}
pub fn vector(x: f64, y: f64, z: f64) -> J {
    new("Vector3", &[x.into(), y.into(), z.into()])
}
pub fn color(value: &str) -> J {
    new("Color", &[value.into()])
}
pub fn walk(root: &J, visible: bool, callback: &mut dyn FnMut(J)) {
    if visible && !root.get("visible").yes() {
        return;
    }
    callback(root.clone());
    for child in root.get("children").list() {
        walk(&child, visible, callback)
    }
}
pub fn materials(mesh: &J) -> Vec<J> {
    let m = mesh.get("material");
    if Array::is_array(&m.0) {
        m.list()
    } else if m.exists() {
        vec![m]
    } else {
        vec![]
    }
}
pub fn copy(v: &J) -> J {
    v.call("clone", &[])
}
pub fn set_xyz(v: &J, x: f64, y: f64, z: f64) {
    v.call("set", &[x.into(), y.into(), z.into()]);
}
pub async fn promise(value: J) -> Result<J, JsValue> {
    wasm_bindgen_futures::JsFuture::from(js_sys::Promise::resolve(&value.0))
        .await
        .map(J)
}
