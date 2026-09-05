#!/usr/bin/env python3
"""Resolve Unity material texture GUIDs from the pinned asset discovery index.

Requires Python 3, PyYAML, and curl. Output is the portable input manifest for
prepare-home-textures.py. The index includes every regular national species.
"""
import argparse
import concurrent.futures
import json
import pathlib
import re
import subprocess
import urllib.parse

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[1]
FLOATS = {
    "_ColorBaseU", "_ColorBaseV", "_Layer1BaseU", "_Layer1BaseV", "_LayerCalcMulti",
    "_Layer1OverLerpValue", "_Layer1Enable", "_BlendMode", "_ConstantAlpha", "_CullMode",
    "_Metallic", "_Glossiness", "_ColorMapUvIndex", "_Layer1UvIndex", "_EmissionMaskUse", "_EmissionMaskVal", "_SwitchEmissionMaskTexUV",
    "_SrcBlend", "_DstBlend", "_ZWrite", "_DiscardValue", "_Cutoff",
    "_Stencil", "MASK_CALC_MODE", "MASK_FIRST_UV", "MASK_SECOND_UV",
    "_Blend0UVScaleU", "_Blend0UVScaleV", "_Blend0UVTranslateU", "_Blend0UVTranslateV",
    "_Blend1UVScaleU", "_Blend1UVScaleV", "_Blend1UVTranslateU", "_Blend1UVTranslateV",
    "_Mask0UVScaleU", "_Mask0UVScaleV", "_Mask0UVTranslateU", "_Mask0UVTranslateV",
    "_Mask1UVScaleU", "_Mask1UVScaleV", "_Mask1UVTranslateU", "_Mask1UVTranslateV",
}
COLORS = {"_ConstantColor0", "_ConstantColor", "_L1ConstantColor0", "_EmissionColor", "_BaseColor", "_LayerColor"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=pathlib.Path, default=ROOT / "work/home-textures")
    args = parser.parse_args()
    discovery = json.loads((ROOT / "scripts/data/home-discovery.json").read_text())
    source_models = discovery["models"]
    paths = {p for r in source_models.values() for p in r["materials"]}
    paths |= {p + ".meta" for r in source_models.values() for p in r["textures"]}
    base = f'https://raw.githubusercontent.com/{discovery["textureRepository"]}/{discovery["textureRevision"]}/'

    def download(remote):
        destination = args.cache / remote
        if destination.exists() and destination.stat().st_size:
            return
        destination.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["curl", "-fsSL", "--max-time", "90", "--retry", "2",
                        base + urllib.parse.quote(remote), "-o", str(destination)], check=True)

    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
        list(pool.map(download, sorted(paths)))

    textures, wrapping = {}, {}
    for remote in paths:
        if remote.endswith(".png.meta"):
            meta = (args.cache / remote).read_text()
            match = re.search(r"^guid: (\w+)", meta, re.M)
            if match:
                textures[match[1]] = remote[:-5]
                wrapping[match[1]] = [int(re.search(r"wrap" + axis + r": (\d+)", meta)[1]) for axis in "UV"]

    errors, models = [], {}
    for identifier, source in source_models.items():
        materials = {}
        for remote in source["materials"]:
            raw = (args.cache / remote).read_text()
            # Remove Unity's type tag; the remaining content is ordinary YAML.
            loader = getattr(yaml, "CSafeLoader", yaml.SafeLoader)
            material = yaml.load("\n".join(raw.splitlines()[3:]), Loader=loader)["Material"]
            properties = material["m_SavedProperties"]
            record = {}
            for field, key in (("_Col0Tex", "map"), ("_MainTex", "map"),
                               ("_L1Col0Tex", "layer"), ("_EmissionMaskTex", "emissiveMap"),
                               ("_Blend0Tex", "blend0"), ("_Blend1Tex", "blend1"),
                               ("_LerpTex", "lerp"), ("_Mask0Tex", "mask0"), ("_Mask1Tex", "mask1")):
                texture = properties.get("m_TexEnvs", {}).get(field)
                guid = texture.get("m_Texture", {}).get("guid") if texture else None
                if not guid:
                    continue
                if guid not in textures:
                    errors.append({"species": identifier, "material": remote, "field": field, "guid": guid})
                    continue
                record[key] = {"path": textures[guid], "wrap": wrapping[guid],
                               "repeat": [texture["m_Scale"]["x"], texture["m_Scale"]["y"]],
                               "offset": [texture["m_Offset"]["x"], texture["m_Offset"]["y"]]}
            record["floats"] = {k: v for k, v in properties.get("m_Floats", {}).items() if k in FLOATS}
            record["colors"] = {k: v for k, v in properties.get("m_Colors", {}).items() if k in COLORS}
            materials[material["m_Name"]] = record
        models[identifier] = {"geometry": source["geometry"], "materials": materials}

    if errors:
        raise ValueError("Unresolved source textures: " + json.dumps(errors))
    output = {k: v for k, v in discovery.items() if k != "models"}
    output["models"] = models
    (ROOT / "scripts/data/home-sources.json").write_text(json.dumps(output, separators=(",", ":")) + "\n")
    print(f"Resolved {len(models)} species and {sum(len(r['materials']) for r in models.values())} materials")


if __name__ == "__main__":
    main()
