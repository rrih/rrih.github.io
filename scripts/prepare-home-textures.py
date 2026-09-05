#!/usr/bin/env python3
"""Rebuild self-contained HOME GLBs from pinned source assets.

Requires Python 3, Pillow, NumPy and curl. Run this before prepare-home-animations.py.
Unity's custom animated shaders are represented by static PBR materials. Runtime
metadata preserves additive blending and the two-pass flame stencil.
"""
import argparse
import concurrent.futures
import io
import json
import pathlib
import struct
import subprocess
import urllib.parse

import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCES = json.loads((ROOT / "scripts/data/home-sources.json").read_text())


def download(repository, revision, remote, destination):
    if destination.exists() and destination.stat().st_size:
        return destination
    destination.parent.mkdir(parents=True, exist_ok=True)
    url = f"https://raw.githubusercontent.com/{repository}/{revision}/" + urllib.parse.quote(remote)
    subprocess.run(["curl", "-fsSL", "--retry", "2", "--max-time", "90", url,
                    "-o", str(destination)], check=True)
    return destination


def read_glb(path):
    raw = path.read_bytes()
    magic, version, total = struct.unpack_from("<III", raw)
    if magic != 0x46546C67 or version != 2 or total != len(raw):
        raise ValueError(f"Invalid GLB: {path}")
    json_length, json_type = struct.unpack_from("<II", raw, 12)
    if json_type != 0x4E4F534A:
        raise ValueError("Missing GLB JSON chunk")
    document = json.loads(raw[20:20 + json_length])
    offset = 20 + json_length
    bin_length, bin_type = struct.unpack_from("<II", raw, offset)
    if bin_type != 0x004E4942:
        raise ValueError("Missing GLB binary chunk")
    return document, bytearray(raw[offset + 8:offset + 8 + bin_length])


def write_glb(path, document, binary):
    document["buffers"] = [{"byteLength": len(binary)}]
    data = json.dumps(document, separators=(",", ":")).encode()
    data += b" " * (-len(data) % 4)
    binary += b"\0" * (-len(binary) % 4)
    raw = struct.pack("<III", 0x46546C67, 2, 28 + len(data) + len(binary))
    raw += struct.pack("<II", len(data), 0x4E4F534A) + data
    raw += struct.pack("<II", len(binary), 0x004E4942) + binary
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(raw)


def sample_texture(texture, floats, cache, size, layer=False):
    pixels = np.asarray(Image.open(cache / texture["path"]).convert("RGBA"), dtype=np.float32) / 255
    height, width = pixels.shape[:2]
    # UnityGLTF reflects V. Sample PNGs in their exported top-down orientation.
    u, v = np.meshgrid((np.arange(size) + 0.5) / size, (np.arange(size) + 0.5) / size)
    prefix = "_Layer1Base" if layer else "_ColorBase"
    repeat, offset = texture["repeat"], texture["offset"]
    def wrap(values, mode):
        if mode == 1:
            return np.clip(values, 0, 1)
        if mode == 2:
            return 1 - np.abs(np.mod(values, 2) - 1)
        if mode == 3:
            return np.clip(np.abs(values), 0, 1)
        return np.mod(values, 1)

    wrapping = texture.get("wrap", [0, 0])
    x = wrap(u * repeat[0] + offset[0] + floats.get(prefix + "U", 0), wrapping[0])
    y = wrap(1 - ((1 - v) * repeat[1] + offset[1] + floats.get(prefix + "V", 0)), wrapping[1])
    return pixels[np.minimum((y * height).astype(int), height - 1),
                  np.minimum((x * width).astype(int), width - 1)]


def bake_material(source, cache):
    floats = source.get("floats", {})
    texture = source["map"]
    dimensions = Image.open(cache / texture["path"]).size
    # Keep expression atlases sharp when their UV coordinates repeat.
    size = min(1024, max(512, *dimensions))
    pixels = sample_texture(texture, floats, cache, size)
    if source.get("layer") and floats.get("_Layer1Enable", 1):
        layer = sample_texture(source["layer"], floats, cache, size, layer=True)
        # Transparent eye apertures expose the iris layer underneath.
        alpha = pixels[:, :, 3:4]
        pixels[:, :, :3] = pixels[:, :, :3] * alpha + layer[:, :, :3] * (1 - alpha)
        pixels[:, :, 3:4] = alpha + layer[:, :, 3:4] * (1 - alpha)
    rgba = np.clip(np.rint(pixels * 255), 0, 255).astype(np.uint8)
    if floats.get("_BlendMode") == 0:
        # Opaque shader alpha is auxiliary data. Keeping alpha=0 here lets WebP
        # discard visible RGB even though an opaque glTF material ignores alpha.
        rgba[:, :, 3] = 255
    output = io.BytesIO()
    Image.fromarray(rgba, "RGBA").save(output, format="PNG", optimize=True)
    return output.getvalue(), bool(np.any(rgba[:, :, 3] < 128))


def encode_texture(pixels):
    output = io.BytesIO()
    Image.fromarray(np.clip(np.rint(pixels * 255), 0, 255).astype(np.uint8), "RGBA").save(
        output, format="PNG", optimize=True)
    return output.getvalue()


def append_texture(document, binary, image_data, name, texture):
    binary.extend(b"\0" * (-len(binary) % 4))
    view = len(document["bufferViews"])
    document["bufferViews"].append({"buffer": 0, "byteOffset": len(binary), "byteLength": len(image_data)})
    binary.extend(image_data)
    image_index = len(document["images"])
    document["images"].append({"bufferView": view, "mimeType": "image/png", "name": name})
    sampler = {"magFilter": 9729, "minFilter": 9987}
    for axis, field in enumerate(("wrapS", "wrapT")):
        mode = texture.get("wrap", [0, 0])[axis]
        repetitions = abs(texture["repeat"][axis])
        sampler[field] = 33071 if mode in (1, 3) else 33648 if mode == 2 and repetitions % 2 == 1 else 10497
    if sampler not in document["samplers"]:
        document["samplers"].append(sampler)
    texture_index = len(document["textures"])
    document["textures"].append({"sampler": document["samplers"].index(sampler), "source": image_index})
    return texture_index


def sample_effect(source, key, cache, size=512):
    texture = dict(source[key])
    prefix = "_" + key[0].upper() + key[1:]
    floats = source.get("floats", {})
    texture["repeat"] = [texture["repeat"][axis] * floats.get(prefix + "UVScale" + uv, 1)
                         for axis, uv in enumerate("UV")]
    texture["offset"] = [texture["offset"][axis] + floats.get(prefix + "UVTranslate" + uv, 0)
                         for axis, uv in enumerate("UV")]
    return sample_texture(texture, {}, cache, size)


def apply_effect_material(document, binary, material, source, cache):
    name = material["name"]
    floats = source.get("floats", {})
    material.pop("alphaMode", None)
    material.pop("alphaCutoff", None)
    pbr = material["pbrMetallicRoughness"]
    pbr.update(metallicFactor=0, roughnessFactor=1)
    if ("FireMask" in name or "SmokeMask" in name) and "mask0" in source:
        first = sample_effect(source, "mask0", cache)[:, :, :1]
        second = sample_effect(source, "mask1", cache)[:, :, :1] if "mask1" in source else 0
        mask = first * second if floats.get("MASK_CALC_MODE", 0) else first + second
        pixels = np.ones((512, 512, 4), dtype=np.float32)
        pixels[:, :, 3:4] = np.clip(mask, 0, 1)
        index = append_texture(document, binary, encode_texture(pixels), name, source["mask0"])
        pbr.update(baseColorFactor=[1, 1, 1, 1], baseColorTexture={"index": index})
        material.update(alphaMode="MASK", alphaCutoff=floats.get("_DiscardValue", 0.5), doubleSided=True)
        material.setdefault("extras", {})["homeStencil"] = {"role": "mask", "ref": int(floats.get("_Stencil", 1))}
    elif ("FireCore" in name or "SmokeCore" in name) and "blend0" in source:
        blend = sample_effect(source, "blend0", cache)[:, :, :1]
        if "blend1" in source:
            blend = blend + sample_effect(source, "blend1", cache)[:, :, :1]
        if "lerp" in source:
            blend = blend + sample_effect(source, "lerp", cache)[:, :, :1]
        blend = np.clip(blend, 0, 1)
        base = np.array([source["colors"]["_BaseColor"][c] for c in "rgb"])
        layer = np.array([source["colors"]["_LayerColor"][c] for c in "rgb"])
        pixels = np.ones((512, 512, 4), dtype=np.float32)
        pixels[:, :, :3] = base * (1 - blend) + layer * blend
        index = append_texture(document, binary, encode_texture(pixels), name, source["blend0"])
        if "FireCore" in name:
            pbr["baseColorFactor"] = [0, 0, 0, 1]
            material.update(emissiveTexture={"index": index}, emissiveFactor=[1, 1, 1])
        else:
            pbr.update(baseColorFactor=[1, 1, 1, 1], baseColorTexture={"index": index})
        material.setdefault("extras", {})["homeStencil"] = {"role": "core", "ref": int(floats.get("_Stencil", 1))}


def build_one(identifier, source, args):
    geometry = download(SOURCES["geometryRepository"], SOURCES["geometryRevision"],
                        source["geometry"], args.geometry_cache / f"{identifier}.glb")
    document, binary = read_glb(geometry)
    document["images"], document["textures"] = [], []
    document["samplers"] = [{"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 10497}]
    missing, textured, effects, uv_fallbacks, layer_uv_approximations = [], 0, [], [], []
    for material_index, material in enumerate(document.get("materials", [])):
        name = material.get("name", "")
        original = source["materials"].get(name)
        if original is None:
            missing.append(name)
            continue
        floats = original.get("floats", {})
        color = original.get("colors", {}).get("_ConstantColor0", {"r": 1, "g": 1, "b": 1, "a": 1})
        factor = [min(1, max(0, color.get(c, 1))) for c in "rgba"]
        factor[3] *= floats.get("_ConstantAlpha", 1)
        if floats.get("_BlendMode") == 0:
            factor[3] = 1
        pbr = {"baseColorFactor": factor, "metallicFactor": 0.05, "roughnessFactor": 0.55}
        material["pbrMetallicRoughness"] = pbr
        material["doubleSided"] = floats.get("_CullMode", 2) == 0
        if "map" in original:
            for key in ("map", "layer"):
                if key in original:
                    remote = original[key]["path"]
                    download(SOURCES["textureRepository"], SOURCES["textureRevision"],
                             remote, args.cache / remote)
            image_data, has_alpha = bake_material(original, args.cache)
            texture_index = append_texture(document, binary, image_data, name, original["map"])
            requested_uv = int(floats.get("_ColorMapUvIndex", 0))
            primitives = [primitive for mesh in document["meshes"] for primitive in mesh["primitives"]
                          if primitive.get("material") == material_index]
            has_requested_uv = all(f"TEXCOORD_{requested_uv}" in primitive["attributes"] for primitive in primitives)
            if not has_requested_uv:
                uv_fallbacks.append(name)
            if "layer" in original and int(floats.get("_Layer1UvIndex", 0)) != requested_uv:
                layer_uv_approximations.append(name)
            pbr["baseColorTexture"] = {"index": texture_index, "texCoord": requested_uv if has_requested_uv else 0}
            blend_mode = int(floats.get("_BlendMode", 0))
            material.pop("alphaMode", None)
            material.pop("alphaCutoff", None)
            # Source opaque shaders also use alpha for reflection masks.
            # Inferring cutouts from PNG alpha erased metal bodies such as #462.
            if "_BlendMode" not in floats and has_alpha:
                material.update(alphaMode="MASK", alphaCutoff=0.3)
            if ("_BlendMode" not in floats and factor[3] < 1) or blend_mode in (1, 2, 3):
                material["alphaMode"] = "BLEND"
                material.pop("alphaCutoff", None)
            if blend_mode == 4:
                material.update(alphaMode="MASK", alphaCutoff=floats.get("_DiscardValue", 0.5))
            if blend_mode == 2:
                material.setdefault("extras", {})["homeBlend"] = "additive"
            emission_strength = float(floats.get("_EmissionMaskVal", 1)) if floats.get("_EmissionMaskUse", 0) else 0
            if emission_strength > 0 and "emissiveMap" in original:
                remote = original["emissiveMap"]["path"]
                download(SOURCES["textureRepository"], SOURCES["textureRevision"], remote, args.cache / remote)
                # The original shader samples the packed mask with color UVs.
                # Red controls emission; green controls reflected light.
                emission_source = dict(original["emissiveMap"], repeat=original["map"]["repeat"],
                                       offset=original["map"]["offset"])
                rgba = np.asarray(Image.open(io.BytesIO(image_data)).convert("RGBA"), dtype=np.float32) / 255
                mask = sample_texture(emission_source, floats, args.cache, rgba.shape[0])[:, :, :1]
                if np.any(mask > 0):
                    emission = np.ones_like(rgba)
                    emission[:, :, :3] = rgba[:, :, :3] * mask
                    index = append_texture(document, binary, encode_texture(emission), name + " emission", original["map"])
                    material["emissiveTexture"] = {"index": index, "texCoord": requested_uv if has_requested_uv else 0}
                    material["emissiveFactor"] = [min(1, emission_strength)] * 3
                    if emission_strength > 1:
                        document.setdefault("extensionsUsed", [])
                        if "KHR_materials_emissive_strength" not in document["extensionsUsed"]:
                            document["extensionsUsed"].append("KHR_materials_emissive_strength")
                        material.setdefault("extensions", {})["KHR_materials_emissive_strength"] = {"emissiveStrength": emission_strength}
            textured += 1
        else:
            effects.append(name)
            if (("FireCore" in name or "SmokeCore" in name) and "blend0" in original) or (("FireMask" in name or "SmokeMask" in name) and "mask0" in original):
                for key in ("blend0", "blend1", "lerp", "mask0", "mask1"):
                    if key in original:
                        remote = original[key]["path"]
                        download(SOURCES["textureRepository"], SOURCES["textureRevision"], remote, args.cache / remote)
                apply_effect_material(document, binary, material, original, args.cache)
            elif "FireCore" in name:
                pbr["baseColorFactor"] = [1, 0.36, 0.035, 1]
                material["emissiveFactor"] = [1, 0.22, 0.015]
            elif "SmokeCore" in name:
                base = original.get("colors", {}).get("_BaseColor", color)
                pbr["baseColorFactor"] = [min(1, max(0, base.get(c, 1))) for c in "rgb"] + [0.45]
                material["alphaMode"] = "BLEND"
                material.setdefault("extras", {})["homeStencil"] = {"role": "core", "ref": int(floats.get("_Stencil", 1))}
            elif "Mask" in name or sum(factor[:3]) == 0:
                # Masks write only stencil in the original shader. Additive black
                # layers contribute no base color and must not occlude the mesh.
                pbr["baseColorFactor"] = [0, 0, 0, 0]
                material["alphaMode"] = "BLEND"
        # Blending also applies to untextured reflection-only materials.
        if floats.get("_BlendMode") in (1, 2, 3):
            material["alphaMode"] = "BLEND"
            material.pop("alphaCutoff", None)
        if floats.get("_BlendMode") == 2:
            material.setdefault("extras", {})["homeBlend"] = "additive"
            # Additive glow/reflection layers must not acquire an extra PBR
            # highlight; otherwise their black helper spheres become visible.
            pbr["metallicFactor"] = 0
            material.setdefault("extensions", {})["KHR_materials_specular"] = {"specularFactor": 0}
            document.setdefault("extensionsUsed", [])
            if "KHR_materials_specular" not in document["extensionsUsed"]:
                document["extensionsUsed"].append("KHR_materials_specular")
    if missing:
        raise ValueError(f"{identifier}: materials without source mapping: {missing}")
    if not textured:
        raise ValueError(f"{identifier}: no textured materials")
    omitted_effects = []
    if int(identifier) == 789:
        # The original Cosmog smoke core depends on the billboard shader.
        # Rendering its untextured helper spheres with PBR covers the existing
        # blue cloud geometry. Keep that body geometry and omit only the core.
        for node in document["nodes"]:
            if node.get("name") != "pm0789_00_00_SmokeCoreSkin":
                continue
            primitives = document["meshes"][node["mesh"]]["primitives"]
            names = {document["materials"][p["material"]]["name"] for p in primitives}
            if names != {"pm0789_00_00-SmokeCoreAVco", "pm0789_00_00-SmokeCoreBVco"}:
                raise ValueError("789: unexpected smoke core material assignment")
            node.pop("mesh")
            node.pop("skin", None)
            omitted_effects.append(node["name"])
        if len(omitted_effects) != 1:
            raise ValueError("789: expected exactly one smoke core helper node")
    ignored_vertex_colors = 0
    vertex_mask_counts = {902: 3, 911: 1, 935: 9, 936: 5, 937: 9, 954: 1, 971: 1, 1002: 6}
    if int(identifier) in vertex_mask_counts:
        # These textured Standard/Gen9 surfaces export auxiliary vertex masks,
        # not albedo. Multiplying them into PBR color can blacken armor or turn
        # white fur red. Preserve the original color maps; leave the separate
        # FireMask/SmokeMask billboard geometry in other species untouched.
        for mesh in document["meshes"]:
            for primitive in mesh["primitives"]:
                if "COLOR_0" not in primitive["attributes"]:
                    continue
                material_name = document["materials"][primitive["material"]]["name"]
                if "map" not in source["materials"][material_name] or "Mask" in material_name:
                    raise ValueError(f"{identifier}: unexpected vertex-mask material {material_name}")
                primitive["attributes"].pop("COLOR_0")
                ignored_vertex_colors += 1
        if ignored_vertex_colors != vertex_mask_counts[int(identifier)]:
            raise ValueError(f"{identifier}: unexpected count of auxiliary vertex-mask primitives")
    destination = args.output / f"{identifier}.glb"
    write_glb(destination, document, binary)
    return {"id": int(identifier), "materials": len(document["materials"]),
            "texturedMaterials": textured, "simplifiedEffects": effects,
            "uvFallbacks": uv_fallbacks, "layerUvApproximations": layer_uv_approximations,
            "omittedEffects": omitted_effects,
            "ignoredVertexColorPrimitives": ignored_vertex_colors,
            "additiveMaterials": [m["name"] for m in document["materials"] if m.get("extras", {}).get("homeBlend")],
            "stencilMaterials": [m["name"] for m in document["materials"] if m.get("extras", {}).get("homeStencil")],
            "emissiveMaterials": [m["name"] for m in document["materials"] if m.get("emissiveTexture")],
            "effectUvApproximations": [n for n, m in source["materials"].items()
                                       if m.get("floats", {}).get("MASK_SECOND_UV", 0) != m.get("floats", {}).get("MASK_FIRST_UV", 0)
                                       or m.get("floats", {}).get("_SwitchEmissionMaskTexUV", 0)],
            "bytes": destination.stat().st_size}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=pathlib.Path, default=ROOT / "work/home-textures")
    parser.add_argument("--geometry-cache", type=pathlib.Path, default=ROOT / "work/home-geometry")
    parser.add_argument("--output", type=pathlib.Path, default=ROOT / "public/models/home")
    parser.add_argument("--ids", nargs="*", help="Optional species numbers for a partial rebuild")
    args = parser.parse_args()
    selected = [(key, value) for key, value in SOURCES["models"].items() if not args.ids or key in args.ids]
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(lambda item: build_one(*item, args), selected))
    audit = ROOT / "scripts/data/home-texture-audit.json"
    previous = json.loads(audit.read_text()) if audit.exists() and args.ids else []
    merged = {item["id"]: item for item in previous}
    merged.update({item["id"]: item for item in results})
    audit.write_text(json.dumps(sorted(merged.values(), key=lambda item: item["id"]), indent=2) + "\n")
    print(f"Prepared {len(results)} models; {sum(item['bytes'] for item in results):,} bytes")


if __name__ == "__main__":
    main()
