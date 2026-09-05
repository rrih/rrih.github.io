# Pokémon model preparation

The local HOME models combine geometry, textures and skeletal idle animation from
the same Pokémon HOME model family. They are game-style character assets, not
photorealistic scans. The viewer supplies lighting and camera controls.

All 1,025 National Pokédex species have local normal-color models with an idle
clip. The catalog also includes 150 shiny variants loaded from pinned external
Pokémon 3D API assets. The HOME animation conversion and local asset guarantees
apply to the normal-color models.

## Sources

- Geometry: [Lilothestitch16/Pokemon-HOME-GLB-Models](https://github.com/Lilothestitch16/Pokemon-HOME-GLB-Models), revision `27703273836f38f0e185976d955b1fbfb15448af`.
- Materials, textures and animation: [Lilothestitch16/Pokemon-HOME-Unity-Models](https://github.com/Lilothestitch16/Pokemon-HOME-Unity-Models), revision `7b18d1a3e22df48329220ea99c4d2a6617d72345`.
- Shader reference: [Pokémon HOME Unity Project](https://github.com/Lilothestitch16/Pokemon-HOME-Unity-Project/tree/9ec0fc731f2eafbd13add5fb1e4bdfc017fbb809/Assets/Shader), revision `9ec0fc731f2eafbd13add5fb1e4bdfc017fbb809`. The recovered Standard1st shader confirms packed mask channels and opacity modes; the FireCore/FireMask shader declarations preserve the stencil pass structure.
- Additional variants: [Pokémon 3D API assets](https://github.com/Pokemon-3D-api/assets), revision `429de1288cea0d43f5b4f56305d2276e94239d65`.
- Coordinate conversion: [Khronos UnityGLTF](https://github.com/KhronosGroup/UnityGLTF/blob/main/Runtime/Plugins/GLTFSerialization/Schema/SchemaExtensions.cs).
- Euler rotation order: [Unity Transform reference source](https://github.com/Unity-Technologies/UnityCsReference/blob/master/Runtime/Transform/ScriptBindings/Transform.bindings.cs).
- Texture wrapping: [Unity TextureWrapMode](https://docs.unity3d.com/ScriptReference/TextureWrapMode.html).
- Compression: [glTF Transform](https://gltf-transform.dev/).

These repositories do not transfer rights to Pokémon intellectual property.
Pokémon, character models and related assets belong to their respective rights
holders. The Pokémon 3D API's [copyright notice](https://github.com/Pokemon-3D-api/api-server/blob/main/docs/COPYRIGHT.md)
explicitly distinguishes its MIT-licensed code from Pokémon assets.

## Rebuild

Install project development dependencies with Bun. The preparation scripts also
need Python 3, Pillow, NumPy, PyYAML and curl. Sources stay in the repository's
ignored `work/home-textures`, `work/home-geometry`, and `work/home-animations`
folders; the scripts accept cache-path overrides. Source manifests are pinned in
`scripts/data/home-sources.json` and `scripts/data/home-companion-paths.json`.
`home-discovery.json` records the original paths and verified cross-material references.

```sh
python3 scripts/prepare-home-sources.py
python3 scripts/prepare-home-textures.py \
  --cache work/home-textures --geometry-cache work/home-geometry
python3 scripts/prepare-home-animations.py --cache work/home-animations --workers 16
bun scripts/optimize-home-models.mjs
bun scripts/verify-home-models.mjs
python3 scripts/sync-home-models.py
```

Rebuilding textures restores the original uncompressed geometry. Run animation
preparation and compression afterward, in that order. `--ids` limits a texture
rebuild to selected species. Animation preparation's `--replace` can replace an
existing idle clip; compression removes any resulting unused buffer data.

## Conversion details

- Exact material names are resolved to Unity material files. Texture GUIDs are
  resolved through their corresponding PNG metadata, including texture scale,
  offset, expression-atlas offsets and mirror/repeat/clamp behavior. Source
  materials for species 995 and 1006 have cross-prefixed names; their original
  prefab GUID references verify these assignments. Names are not guessed or
  rewritten. The source mirror mode is essential: using repeat instead creates
  incorrect bands and patches.
- Base color textures are embedded. Transparent eye apertures are composited
  with their iris layers. Source blend modes determine opaque, translucent,
  additive and alpha-cutout behavior. In opaque materials, source texture alpha
  is auxiliary shader data, so baked alpha is set to one; this also prevents
  lossless WebP from discarding visible RGB beneath zero alpha. Treating every
  texture with alpha as a cutout incorrectly removes metallic bodies.
- Additive reflection layers carry `material.extras.homeBlend = "additive"`.
  The viewer uses additive blending with depth writes and shadows disabled.
  Their extra PBR specular reflection is disabled to avoid rendering black
  helper volumes as gray spheres. Texture regeneration writes
  `KHR_materials_specular.specularFactor = 0` and a zero metallic factor for
  these layers, preserving this behavior through compression.
  Ordinary transparent shells retain their source alpha and remain translucent.
- The packed emission mask's red channel controls emission; green is reflected
  light. The converter samples it with the source color UV transformation and
  bakes a color-multiplied emissive texture. This is a standard PBR approximation
  of the original lighting interpolation. It does not interpret the packed RGB
  mask as an emission color. Differing shader-specific emission UV modes remain
  approximations, as do layered materials requiring a separate layer UV channel.
- Fire and smoke masks combine the original mask textures and cutoff. Fire cores use a
  static blend of the original noise/gradient textures and source colors.
  `material.extras.homeStencil` links mask and core passes: the viewer enables
  stencil buffers, writes the mask without color, then draws cores only
  where stencil values match. Fire cores are emissive; smoke cores use the same stencil clipping with
  source smoke colors. Their depth writes and shadows are disabled.
  This restores the flame silhouettes; shader-driven UV scrolling, turbulence,
  rim-light effects and the original complete lighting system are not recreated.
  Billboard expansion and volumetric smoke remain approximations; Torkoal's
  smoke can have a faceted, umbrella-like silhouette. Cosmog's untextured smoke
  core helper is omitted because the missing billboard shader otherwise draws
  a white sphere over its existing blue cloud meshes. Only that helper is
  omitted; the body, colored clouds and their skeletal animation remain.
  Base materials use the requested
  UV channel when exported geometry provides it; missing channels use UV0 and
  are recorded in the texture audit.
- Eight species use auxiliary vertex masks on textured surfaces: 902, 911, 935,
  936, 937, 954, 971 and 1002. The converter omits their 35 `COLOR_0` bindings
  after checking source color-map references and per-species primitive counts. Multiplying
  these masks into standard PBR albedo incorrectly blackens armor, changes
  Basculegion's color, and turns Chien-Pao's white body black and tail red.
  The original texture pixels, geometry and bone animation remain unchanged.
  Vertex data on the separate FireMask/SmokeMask billboard models is retained.
- Idle curves use the original `ba10_waitA01.anim` bone paths. Translation is
  converted from Unity to glTF as `(-x, y, z)`, rotation as `(x, -y, -z, w)` and
  scale is unchanged. Quaternion, translation and scale curves retain finite
  values and derivatives using glTF CUBICSPLINE. Euler rotation curves use the
  serialized `m_RotationOrder` from Unity's Transform enum, rather than assuming
  the default order. All 13,311 skeletal Euler tracks in these sources use
  order 0 (XYZ); their original Hermite curves are sampled at at least 60 Hz,
  with adaptive subdivision until midpoint angular error is below 0.01 degrees.
  glTF LINEAR quaternion interpolation plays those samples. Near-identical
  sample times are deduplicated at float32 precision. Quaternion and Euler
  tracks never target the same bone in this corpus. The source `m_StopTime`
  is stored as animation metadata `homeDuration`; the viewer and verification
  mixer use it as the loop length, excluding the extra guard frame serialized
  in many source curves. Unhandled curve sections,
  rotation orders, nonfinite values or unsupported weighted curves fail the build.
- Unity encodes some constant quaternion components with infinite outgoing
  tangents. The converter checks that each segment is constant within `1e-7`
  before replacing that tangent with zero. It fails on unsupported nonconstant
  stepped or weighted bone curves instead of generating replacement motion.
- `CusAnimVis_` controls are respected: negative X (-0.01 after Unity
  import) shows a mesh, while zero hides it. Constant hidden meshes are removed. Animated visibility
  is preserved in node metadata and restored as Three.js BooleanKeyframeTracks.
  Zero-scale visibility is deliberately avoided because it makes skinned-mesh
  inverse transforms singular.
- Draco compresses geometry, while lossless WebP preserves prepared texture
  pixels. Uniform textures may be folded losslessly into material colors. The optimizer verifies animation and channel counts after decoding
  the result and enforces a 900 MB model payload budget.

## Verification

The audit files in `scripts/data/` record material mapping, simplified effects,
UV fallbacks, skeletal channels, hidden meshes, file sizes and runtime checks.
Texture preparation was checked across all 1,025 models: every embedded image
decoded, binary views stayed in bounds, and every textured primitive referenced
an available UV channel. Charizard's atlas conversion was checked visually
against six transform alternatives to verify the source mirror behavior.
`home-pixel-provenance.json` records final model hashes and source-derived pixel
comparisons for every retained base-color texture after compression. Invisible
RGB beneath zero alpha is normalized for lossless WebP; uniform textures folded
into factors and emissive-only textures are outside that pixel comparison.

`verify-home-models.mjs` decodes every model and embedded texture, loads its
geometry through Three.js, and evaluates five poses through the actual
AnimationMixer. It rejects nonfinite or empty geometry, duplicate animation targets,
nonmonotonic timestamps, nonfinite samples and unusually large deformations.
Explicit Gengar, Armarouge and Pecharunt visibility anchors also reject reversed
helper semantics that numeric geometry checks alone would miss. The source
format audit covers all runtime curve sections for all 1,025 idle sources. Browser image review is still necessary for appearance and
custom shader approximations.
