#!/usr/bin/env python3
"""Apply pinned HOME rare materials without changing prepared geometry or motion.

Requires the normal public/models/home GLBs, Python 3, Pillow, NumPy and curl.
The source manifest preserves each original renderer/primitive material binding,
including bindings merged by normal-color optimization. No rig is retargeted and
no animation or geometric data is synthesized, recompressed, or replaced.
"""
import argparse
import copy
import hashlib
import importlib.util
import io
import json
import pathlib
import tempfile
import types

import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("home_textures", ROOT / "scripts/prepare-home-textures.py")
home = importlib.util.module_from_spec(spec)
spec.loader.exec_module(home)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def view_bytes(document, binary, index):
    view = document["bufferViews"][index]
    if view.get("buffer", 0) != 0:
        raise ValueError("Expected a self-contained, single-buffer GLB")
    start, size = view.get("byteOffset", 0), view["byteLength"]
    if start < 0 or size < 0 or start + size > len(binary):
        raise ValueError("Out-of-bounds buffer view")
    return bytes(binary[start:start + size])


def replace_views(value, mapping):
    if isinstance(value, dict):
        return {key: mapping[item] if key == "bufferView" else replace_views(item, mapping)
                for key, item in value.items()}
    if isinstance(value, list):
        return [replace_views(item, mapping) for item in value]
    return value


def view_references(value):
    if isinstance(value, dict):
        for key, item in value.items():
            if key == "bufferView":
                yield item
            else:
                yield from view_references(item)
    elif isinstance(value, list):
        for item in value:
            yield from view_references(item)


def compact(document, binary):
    """Drop unused image bytes and remap views, retaining every used byte exactly."""
    result, mapping, views = bytearray(), {}, []
    for old in sorted(set(view_references(document))):
        data = view_bytes(document, binary, old)
        result.extend(b"\0" * (-len(result) % 4))
        mapping[old] = len(views)
        views.append(dict(document["bufferViews"][old], byteOffset=len(result)))
        result.extend(data)
    document = replace_views(document, mapping)
    document["bufferViews"] = views
    # The normal material optimizer used WebP. All replacement images are PNG.
    for key in ("extensionsUsed", "extensionsRequired"):
        if key in document:
            document[key] = [name for name in document[key] if name != "EXT_texture_webp"]
            if not document[key]:
                document.pop(key)
    return document, result


def geometry_signature(document, binary):
    """Compare data by its bytes, independently of changed buffer-view offsets."""
    hashes = {i: digest(view_bytes(document, binary, i)) for i in range(len(document["bufferViews"]))}
    nodes = []
    for node in document["nodes"]:
        node = copy.deepcopy(node)
        if "mesh" in node:
            mesh = copy.deepcopy(document["meshes"][node.pop("mesh")])
            for primitive in mesh["primitives"]:
                primitive.pop("material", None)
            node["geometry"] = replace_views(mesh, hashes)
        nodes.append(node)
    return {
        "nodes": nodes,
        "skins": document.get("skins"),
        "animations": document.get("animations"),
        "accessors": replace_views(document.get("accessors"), hashes),
        "scenes": document.get("scenes"),
        "scene": document.get("scene"),
    }


def restore_bindings(document, source):
    names, mesh_bindings = [], {}
    for node in document["nodes"]:
        if "mesh" not in node:
            continue
        bindings = source["bindings"].get(node.get("name"))
        mesh_index = node["mesh"]
        mesh = document["meshes"][mesh_index]
        if bindings is None or len(bindings) != len(mesh["primitives"]):
            raise ValueError(f"Unknown renderer/primitive binding: {node.get('name')}")
        if mesh_index in mesh_bindings and mesh_bindings[mesh_index] != bindings:
            mesh = copy.deepcopy(mesh)
            node["mesh"] = len(document["meshes"])
            document["meshes"].append(mesh)
        mesh_bindings[node["mesh"]] = bindings
        for primitive, name in zip(mesh["primitives"], bindings):
            if name not in source["materials"]:
                raise ValueError(f"Missing exact rare material mapping: {name}")
            if name not in names:
                names.append(name)
            primitive["material"] = names.index(name)
    # Fresh dictionaries prevent references to normal textures surviving a rebuild.
    document["materials"] = [{"name": name} for name in names]


def verify_pixels(document, binary, source, cache):
    checked = []
    for material in document["materials"]:
        original = source["materials"][material["name"]]
        texture = material["pbrMetallicRoughness"].get("baseColorTexture")
        if "map" not in original:
            continue
        if texture is None:
            raise ValueError(f"Missing sourced base color: {material['name']}")
        image = document["images"][document["textures"][texture["index"]]["source"]]
        actual = np.asarray(Image.open(io.BytesIO(view_bytes(document, binary, image["bufferView"]))).convert("RGBA"))
        expected = np.asarray(Image.open(io.BytesIO(home.bake_material(original, cache)[0])).convert("RGBA"))
        if not np.array_equal(actual, expected):
            raise ValueError(f"Source-derived color mismatch: {material['name']}")
        checked.append({"material": material["name"], "width": actual.shape[1], "height": actual.shape[0],
                        "rgbaSha256": digest(actual.tobytes())})
    for image in document["images"]:
        Image.open(io.BytesIO(view_bytes(document, binary, image["bufferView"]))).verify()
    return checked


def verify_source_files(source, cache):
    files = {item["path"]: item["sha256"] for item in source["materialSources"].values()}
    for material in source["materials"].values():
        for item in material.values():
            if isinstance(item, dict) and "path" in item:
                files[item["path"]] = item["sha256"]
    for remote, expected in files.items():
        local = home.download(home.SOURCES["textureRepository"], home.SOURCES["textureRevision"],
                              remote, cache / remote)
        if digest(local.read_bytes()) != expected:
            raise ValueError(f"Pinned rare source bytes changed: {remote}")


def build(identifier, source, args):
    verify_source_files(source, args.cache)
    normal = ROOT / "public/models/home" / f"{identifier}.glb"
    before = digest(normal.read_bytes())
    document, binary = home.read_glb(normal)
    signature = geometry_signature(document, binary)
    if len(document.get("animations", [])) != 1 or document["animations"][0].get("name") != "HOME Idle":
        raise ValueError(f"{identifier}: expected the verified native HOME idle clip")
    restore_bindings(document, source)
    # The texture builder reads this prepared input from its geometry cache.
    with tempfile.TemporaryDirectory(dir=args.cache, prefix="prepared-") as temporary:
        geometry = pathlib.Path(temporary)
        home.write_glb(geometry / f"{identifier}.glb", document, binary)
        options = types.SimpleNamespace(cache=args.cache, geometry_cache=geometry,
                                        output=args.output, preserve_geometry=True)
        audit = home.build_one(identifier, source, options)
    destination = args.output / f"{identifier}.glb"
    document, binary = home.read_glb(destination)
    document, binary = compact(document, binary)
    if geometry_signature(document, binary) != signature:
        raise ValueError(f"{identifier}: geometry, rig, visibility, or animation changed")
    pixels = verify_pixels(document, binary, source, args.cache)
    if digest(normal.read_bytes()) != before:
        raise ValueError(f"{identifier}: normal model changed during preparation")
    home.write_glb(destination, document, binary)
    final, final_bytes = home.read_glb(destination)
    if geometry_signature(final, final_bytes) != signature:
        raise ValueError(f"{identifier}: serialized model changed geometry or animation")
    audit.update(bytes=destination.stat().st_size, normalSha256=before,
                 sha256=digest(destination.read_bytes()), geometryAndAnimationUnchanged=True,
                 sourcePixelComparisons=pixels)
    print(f"Prepared shiny {identifier}: {audit['bytes']:,} bytes; geometry and HOME Idle unchanged", flush=True)
    return audit


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=pathlib.Path, default=ROOT / "work/shiny-home/source")
    parser.add_argument("--output", type=pathlib.Path, default=ROOT / "public/models/shiny-home")
    parser.add_argument("--ids", nargs="*")
    parser.add_argument("--sync", action="store_true", help="Switch verified entries to local shiny URLs")
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    sources = json.loads((ROOT / "scripts/data/shiny-home-sources.json").read_text())
    if any(sources[k] != home.SOURCES[k] for k in ("geometryRepository", "geometryRevision", "textureRepository", "textureRevision")):
        raise ValueError("Normal and shiny source revisions must match")
    results = [build(i, source, args) for i, source in sources["models"].items() if not args.ids or i in args.ids]
    report_file = ROOT / "scripts/data/shiny-home-audit.json"
    previous = json.loads(report_file.read_text()) if report_file.exists() and args.ids else []
    merged = {item["id"]: item for item in previous}
    merged.update({item["id"]: item for item in results})
    report_file.write_text(json.dumps(sorted(merged.values(), key=lambda item: item["id"]), indent=2) + "\n")
    if args.sync:
        models_file = ROOT / "src/data/models.json"
        models = json.loads(models_file.read_text())
        for item in results:
            models[str(item["id"])]["shiny"] = f"/models/shiny-home/{item['id']}.glb"
        models_file.write_text(json.dumps(models, separators=(",", ":")) + "\n")
    print(f"Prepared {len(results)} shiny models; {sum(item['bytes'] for item in results):,} bytes")


if __name__ == "__main__":
    main()
