#!/usr/bin/env python3
"""Synchronize the published catalog with verified, locally prepared HOME GLBs."""
import json
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[1]
REVISION = "429de1288cea0d43f5b4f56305d2276e94239d65"
catalog_path = ROOT / "src/data/models.json"
catalog = json.loads(catalog_path.read_text())
expected = {str(identifier) for identifier in range(1, 1026)}
if set(catalog) != expected:
    raise ValueError("The model catalog must contain exactly species 1 through 1025")
for identifier in sorted(expected, key=int):
    file = ROOT / f"public/models/home/{identifier}.glb"
    content = file.read_bytes()
    if content[:4] != b"glTF":
        raise ValueError(f"Invalid GLB: {identifier}")
    document = json.loads(content[20:20 + struct.unpack_from("<I", content, 12)[0]])
    animations = document.get("animations", [])
    if not animations or not document.get("materials") or not document.get("meshes"):
        raise ValueError(f"Incomplete model: {identifier}")
    entry = {"url": f"/models/home/{identifier}.glb", "bytes": len(content),
             "source": "pokemon-home", "animations": len(animations),
             "textured": bool(document.get("images")), "colored": True}
    shiny = catalog[identifier].get("shiny")
    if shiny:
        entry["shiny"] = shiny.replace("/Pokemon-3D-api/assets/main/", f"/Pokemon-3D-api/assets/{REVISION}/")
    catalog[identifier] = entry
catalog_path.write_text(json.dumps(catalog, separators=(",", ":")) + "\n")
print(f"Synchronized {len(catalog)} local animated models; {sum(bool(item.get('shiny')) for item in catalog.values())} variants")
