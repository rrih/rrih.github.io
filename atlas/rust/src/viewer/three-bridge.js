// External library exports only. Application rendering and animation live in Rust.
import {
  ACESFilmicToneMapping, AdditiveBlending, AlwaysStencilFunc, AnimationMixer,
  BooleanKeyframeTrack, BufferAttribute, BufferGeometry, CanvasTexture, Color,
  ConeGeometry, CylinderGeometry, DataTexture, DirectionalLight, DoubleSide,
  DynamicDrawUsage, EqualStencilFunc, Euler, Float32BufferAttribute, Fog,
  FrontSide, Group, HemisphereLight, IcosahedronGeometry, InstancedMesh,
  KeepStencilOp, LinearFilter, LinearMipmapLinearFilter, Matrix4, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, OctahedronGeometry, PCFSoftShadowMap,
  PMREMGenerator, PerspectiveCamera, PlaneGeometry, Points, PointsMaterial,
  Quaternion, RepeatWrapping, ReplaceStencilOp, SRGBColorSpace, Scene,
  TextureLoader, UVMapping, Vector2, Vector3, WebGPURenderer,
} from 'three/webgpu'

export const THREE = {
  ACESFilmicToneMapping, AdditiveBlending, AlwaysStencilFunc, AnimationMixer,
  BooleanKeyframeTrack, BufferAttribute, BufferGeometry, CanvasTexture, Color,
  ConeGeometry, CylinderGeometry, DataTexture, DirectionalLight, DoubleSide,
  DynamicDrawUsage, EqualStencilFunc, Euler, Float32BufferAttribute, Fog,
  FrontSide, Group, HemisphereLight, IcosahedronGeometry, InstancedMesh,
  KeepStencilOp, LinearFilter, LinearMipmapLinearFilter, Matrix4, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, OctahedronGeometry, PCFSoftShadowMap,
  PMREMGenerator, PerspectiveCamera, PlaneGeometry, Points, PointsMaterial,
  Quaternion, RepeatWrapping, ReplaceStencilOp, SRGBColorSpace, Scene,
  TextureLoader, UVMapping, Vector2, Vector3, WebGPURenderer,
}
export { OrbitControls } from 'three/addons/controls/OrbitControls.js'
export { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
export { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
export { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
