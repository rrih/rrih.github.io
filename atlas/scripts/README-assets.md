# Pokémon model preparation

The local HOME models combine geometry, textures and skeletal idle animation from
the same Pokémon HOME model family. They are game-style character assets, not
photorealistic scans. The viewer supplies lighting and camera controls.

All 1,025 National Pokédex species have local normal-color models with an idle
clip. The catalog also includes 150 local shiny variants made from the matching
HOME rare materials. Each shiny variant preserves its normal model's geometry,
rig, visibility controls and native HOME idle animation. This covers the same
150 catalog species, not every shiny species or every form.

## Sources

- Geometry: [Lilothestitch16/Pokemon-HOME-GLB-Models](https://github.com/Lilothestitch16/Pokemon-HOME-GLB-Models), revision `27703273836f38f0e185976d955b1fbfb15448af`.
- Materials, textures and animation: [Lilothestitch16/Pokemon-HOME-Unity-Models](https://github.com/Lilothestitch16/Pokemon-HOME-Unity-Models), revision `7b18d1a3e22df48329220ea99c4d2a6617d72345`.
- Shader reference: [Pokémon HOME Unity Project](https://github.com/Lilothestitch16/Pokemon-HOME-Unity-Project/tree/9ec0fc731f2eafbd13add5fb1e4bdfc017fbb809/Assets/Shader), revision `9ec0fc731f2eafbd13add5fb1e4bdfc017fbb809`. The recovered Standard1st shader confirms packed mask channels and opacity modes; the FireCore/FireMask shader declarations preserve the stencil pass structure.
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

## Shiny variants

After the normal models are prepared, rebuild the matching local shiny models:

```sh
python3 scripts/prepare-shiny-home.py --sync
bun scripts/verify-home-models.mjs public/models/shiny-home scripts/data/shiny-home-runtime-audit.json
```

`--ids` limits preparation to selected species. The default source cache is
`work/shiny-home/source`. `shiny-home-sources.json` records pinned rare material
paths, source hashes, resolved texture GUIDs, texture transforms and the original
renderer/primitive material bindings. The normal and rare prefabs are compared
by renderer and material slot, including their mesh references. Their material
GUIDs resolve through the original `.mat.meta` files; duplicate Unity filenames
are not resolved by a guessed suffix.

The converter restores source material bindings that normal-color optimization
merged, then applies the actual rare textures and color factors with the same
material conversion as normal models. It retains the prepared Draco geometry and
all animation bytes without recompression or retargeting. Already removed
auxiliary vertex masks stay removed. Only materials and their embedded PNG
images change; unused normal texture bytes are discarded losslessly. The source
material and texture hashes are checked on every rebuild. New shiny model URLs
use `/models/shiny-home/`, so existing cached normal models remain usable.

`shiny-home-audit.json` records each normal/final SHA-256, exact geometry/rig/idle
preservation and source-derived RGBA comparisons for every retained base-color
texture. `shiny-home-runtime-audit.json` records all 150 decoded models, their
931 embedded images and 750 evaluated poses. Every species has measurable
vertex movement in its original idle clip; no static model is described as
animated and no substitute motion is added. The same special-shader
approximations described below apply to both colors.

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
It also records actual vertex displacement across the five evaluated poses.
Explicit Gengar, Armarouge and Pecharunt visibility anchors also reject reversed
helper semantics that numeric geometry checks alone would miss. The source
format audit covers all runtime curve sections for all 1,025 idle sources. Browser image review is still necessary for appearance and
custom shader approximations.

## Mega and regional forms

`src/data/forms.json` adds 120 forms: 62 Mega forms (including Mega Garchomp Z
and Mega Lucario Z) and 58 regional forms. Regional coverage is 18 Alolan,
20 Galarian, 16 Hisuian and four Paldean forms. Both Galarian Darmanitan modes
and all three Paldean Tauros breeds are included. Caps, Totem duplicates,
Gigantamax and other unrelated form categories are outside this selection.

The 48 earlier Mega forms and all 58 regional forms use the pinned HOME
repositories above. All 106 have normal and rare materials resolved through
their exact prefab GUIDs, matching mesh references, renderer slots and complete
local transform hierarchies. Their original `ba10_waitA01` idle is converted with
the same tested Euler and visibility handling as ordinary species. Rare models
retain their optimized normal geometry, rig, visibility and animation bytes.
Hisuian Typhlosion, Zorua, Zoroark and Braviary export 20 auxiliary vertex-mask
bindings on textured surfaces; those bindings are omitted so they do not tint
the original texture colors. Galarian Weezing's separate SmokeMask attributes
remain present. Fire, smoke, layered UVs and special lighting retain the PBR
approximation limits described above.

Fourteen additional animated Mega models come from
[`Pokemon-3D-api/assets`](https://github.com/Pokemon-3D-api/assets/tree/429de1288cea0d43f5b4f56305d2276e94239d65),
revision `429de1288cea0d43f5b4f56305d2276e94239d65`. Their embedded attribution
identifies [Mariokart07](https://sketchfab.com/Mariokart07), the individual
Sketchfab works and [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
`form-external-sources.json` retains those exact attribution records and pinned
Git blob hashes. Each model retains its actual `battlewait01_loop`, with the
source clip name unchanged; other clips and their unused buffer data are
discarded. Canonical geometry, skin, idle, material and image hashes are compared
before and after this lossless compaction. These 14 forms have no verified rare
material source in this selection, so their metadata does not offer shiny.
All 40 materials across these 14 models retain the source `KHR_materials_unlit` setting, so exposure adjustments work but directional lighting and PBR shading do not apply to their surfaces.
Attribution does not establish a license to the underlying Pokémon IP.

Metadata comes from pinned
[PokéAPI CSV](https://github.com/PokeAPI/pokeapi/tree/d4f9a4af58ade123fbc0558f68b1c69daa97d9e4/data/v2/csv)
at revision `d4f9a4af58ade123fbc0558f68b1c69daa97d9e4`. Pokémon identifiers are
distinct from form identifiers; localized names are joined through the actual
default form record. Dimensions, types and six stats come from that form's
Pokémon record. Source names are retained; untranslated names fall back in the
UI. The Japanese Tauros breed qualifiers are supplemented from
[Pokémon's Japanese catalogue](https://www.pokemon.co.jp/goods/2023/05/230512_go01.html).
`form-coverage.json` explicitly lists 35 other current Mega forms for which no
matching animated model was found in the inspected pinned repositories.
Mega Starmie's candidate was static and is excluded. This is an availability
statement about those inspected sources, not a claim that no model exists
elsewhere or that every Mega form is included.

The 226 new local files use `/models/forms/` and total 71,433,248 bytes.
No existing normal or shiny model bytes change. Rebuild in this order:

```sh
python3 scripts/prepare-form-sources.py
python3 scripts/prepare-home-forms.py normal
bun scripts/optimize-home-models.mjs work/forms/normal scripts/data/form-optimization-audit.json
python3 scripts/prepare-home-forms.py rare
python3 scripts/prepare-home-forms.py publish
python3 scripts/prepare-external-forms.py
python3 scripts/generate-form-catalog.py
bun scripts/verify-form-models.mjs
python3 scripts/verify-form-materials.py
```

`publish` here only copies prepared files into the local `public` directory; it
does not commit, push or deploy. Sources and intermediate files stay in ignored
`work/forms` and `work/shiny-home/source` directories. Every rebuild verifies
pinned source hashes. No source images are recolored by guessed palettes.

The form audit files record source bindings, prefab hierarchies, original and
final SHA-256, compression, native channels and material approximations.
`form-runtime-audit.json` covers 226 decoded models, 1,114 embedded textures and
1,130 actual animated poses, including positive vertex movement in every model.
`form-material-verification.json` compares final HOME colors with their source
bake, including uniform textures folded into linear color factors. Alpha and all
visible RGB must match exactly; discarded RGB beneath fully transparent pixels
is counted separately. External models preserve their original image bytes.
`form-existing-assets-audit.json` records the unchanged Git blob comparison for
all 1,175 existing models. Numeric checks do not replace browser appearance
review, especially for new source models and approximated special shaders.
