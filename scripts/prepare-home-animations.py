#!/usr/bin/env python3
"""Append HOME idle bone animation to the textured local GLBs.

Source curve values and derivatives are preserved with glTF
CUBICSPLINE interpolation. Coordinate conversion follows Khronos UnityGLTF:
translation (-x,y,z), quaternion (x,-y,-z,w), scale unchanged.
"""

import argparse
import bisect
import concurrent.futures
import json
import math
from pathlib import Path
import re
import struct
import subprocess
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
REVISION = "7b18d1a3e22df48329220ea99c4d2a6617d72345"
BASE = f"https://raw.githubusercontent.com/Lilothestitch16/Pokemon-HOME-Unity-Models/{REVISION}/"
SECTIONS = re.compile(
    r"^  (m_RotationCurves|m_EulerCurves|m_PositionCurves|m_ScaleCurves):([^\n]*)(.*?)(?=^  m_[A-Za-z]+:|\Z)",
    re.M | re.S,
)
KEYS = re.compile(
    r"^        time: ([^\n]+)\n        value: \{([^}]+)\}\n"
    r"        inSlope: \{([^}]+)\}\n        outSlope: \{([^}]+)\}", re.M,
)


def get_source(item, cache):
    species, sources = item
    paths = sources["animations"]
    path = next((path for path in paths if "ba10_waitA01" in path), None)
    if path is None:
        raise ValueError(f"No idle source for {species}")
    target = cache / f"{species}.anim"
    if not target.exists():
        temporary = target.with_suffix(".anim.tmp")
        subprocess.run(
            ["curl", "-fsSL", "--retry", "2", "--max-time", "90",
             BASE + quote(path), "-o", str(temporary)], check=True
        )
        temporary.replace(target)
    return species, target


def parse_clip(species, target):
    # Read the pinned Unity runtime curve format without expanding hundreds of
    # megabytes of unrelated YAML metadata. Key counts are checked per track.
    # Values were cross-checked against PyYAML across all nine generations.
    source = target.read_text()
    if not re.search(r"^  m_Compressed: 0$", source, re.M):
        raise ValueError(f"Compressed or unknown animation format: {species}")
    for field in ("m_CompressedRotationCurves", "m_FloatCurves", "m_PPtrCurves", "m_EditorCurves", "m_EulerEditorCurves"):
        if not re.search(r"^  " + field + r": \[\]$", source, re.M):
            raise ValueError(f"Unsupported nonempty curve section: {species} {field}")
    clip = {kind: [] for kind in ("m_RotationCurves", "m_EulerCurves", "m_PositionCurves", "m_ScaleCurves")}
    def vector(text):
        return {axis.strip(): float(value) for axis, value in
                (part.strip().split(":", 1) for part in text.split(","))}
    sections = list(SECTIONS.finditer(source))
    if len(sections) != 4:
        raise ValueError(f"Missing runtime curve sections: {species}")
    for section in sections:
        for block in section[3].split("\n  - curve:")[1:]:
            match = re.search(r"^    path: (.*)$", block, re.M)
            if not match:
                raise ValueError(f"Missing runtime curve path: {species}")
            path = match[1]
            if not path.startswith(("Origin", "CusAnimVis_")):
                continue
            if re.search(r"weightedMode: [1-9]", block):
                raise ValueError(f"Weighted curve unsupported: {species} {path}")
            keys = [{"time": float(key[1]), "value": vector(key[2]),
                     "inSlope": vector(key[3]), "outSlope": vector(key[4]), "weightedMode": 0}
                    for key in KEYS.finditer(block)]
            if len(keys) != len(re.findall(r"^        time:", block, re.M)):
                raise ValueError(f"Unrecognized runtime key format: {species} {path}")
            rotation_order = re.search(r"^      m_RotationOrder: ([0-5])$", block, re.M)
            if section[1] == "m_EulerCurves" and rotation_order is None:
                raise ValueError(f"Missing Euler rotation order: {species} {path}")
            clip[section[1]].append({"path": path, "curve": {"m_Curve": keys},
                                     "rotationOrder": int(rotation_order[1]) if rotation_order else 4})
    if not any(clip.values()):
        raise ValueError(f"No skeletal runtime curves: {species}")
    duration = re.search(r"^    m_StopTime: (\S+)$", source, re.M)
    if not duration or not math.isfinite(float(duration[1])) or float(duration[1]) <= 0:
        raise ValueError(f"Invalid source clip duration: {species}")
    clip["_duration"] = float(duration[1])
    return clip


def multiply_quaternion(a, b):
    x, y, z, w = a
    X, Y, Z, W = b
    return [w*X+x*W+y*Z-z*Y, w*Y-x*Z+y*W+z*X,
            w*Z+x*Y-y*X+z*W, w*W-x*X-y*Y-z*Z]


def euler_quaternion(angles, order):
    # Unity Transform.RotationOrder: XYZ, XZY, YZX, YXZ, ZXY, ZYX.
    # These are extrinsic rotations; premultiply in serialized order.
    quaternion = [0, 0, 0, 1]
    for axis in ("XYZ", "XZY", "YZX", "YXZ", "ZXY", "ZYX")[order]:
        angle = math.radians(angles["XYZ".index(axis)]) / 2
        rotation = [0, 0, 0, math.cos(angle)]
        rotation["XYZ".index(axis)] = math.sin(angle)
        quaternion = multiply_quaternion(rotation, quaternion)
    return [quaternion[0], -quaternion[1], -quaternion[2], quaternion[3]]


def sample_euler(track):
    keys = sorted({float(key["time"]): key for key in track["curve"]["m_Curve"]}.values(), key=lambda key: key["time"])
    source_times = [key["time"] for key in keys]
    def evaluate(time):
        index = min(max(bisect.bisect_right(source_times, time) - 1, 0), len(keys) - 1)
        left = keys[index]
        if index == len(keys) - 1:
            return euler_quaternion([left["value"][axis] for axis in "xyz"], track["rotationOrder"])
        right = keys[index + 1]
        duration = right["time"] - left["time"]
        u = (time - left["time"]) / duration
        values = []
        for axis in "xyz":
            v0, v1 = left["value"][axis], right["value"][axis]
            s0, s1 = left["outSlope"][axis], right["inSlope"][axis]
            if not math.isfinite(s0) or not math.isfinite(s1):
                if abs(v0-v1) > 1e-7:
                    raise ValueError(f"Nonconstant stepped Euler curve: {track['path']}")
                s0 = s1 = 0
            values.append((2*u**3-3*u**2+1)*v0+(u**3-2*u**2+u)*duration*s0+
                          (-2*u**3+3*u**2)*v1+(u**3-u**2)*duration*s1)
        return euler_quaternion(values, track["rotationOrder"])
    # glTF has no Euler curve. Preserve all source keys and bake its Hermite
    # interpolation at >=60 Hz; refine until midpoint angular error <0.01 deg.
    times = set(source_times)
    start, stop = source_times[0], source_times[-1]
    times.update(start + step/60 for step in range(math.ceil((stop-start)*60)) if start+step/60 < stop)
    times = sorted(times)
    def refine(left, right, depth=0):
        q0, q1 = evaluate(left), evaluate(right)
        dot = sum(a*b for a,b in zip(q0,q1))
        if dot < 0: q1 = [-v for v in q1]
        middle = (left+right)/2
        actual = evaluate(middle)
        average = [a+b for a,b in zip(q0,q1)]
        norm = math.sqrt(sum(v*v for v in average))
        estimate = [v/norm for v in average] if norm > 1e-9 else q0
        error = 2*math.acos(min(1, abs(sum(a*b for a,b in zip(actual,estimate)))))
        if error > math.radians(0.01):
            if depth >= 12: raise ValueError(f"Euler sampling failed: {track['path']}")
            return refine(left,middle,depth+1)[:-1] + refine(middle,right,depth+1)
        return [left,right]
    refined = [times[0]]
    for left,right in zip(times,times[1:]): refined.extend(refine(left,right)[1:])
    # Accessor times are float32: collapse near-identical source/baked samples.
    refined = sorted({struct.unpack("<f", struct.pack("<f", time))[0] for time in refined})
    values = [evaluate(time) for time in refined]
    for index in range(1,len(values)):
        if sum(a*b for a,b in zip(values[index-1],values[index])) < 0:
            values[index] = [-v for v in values[index]]
    return refined, values


def read_glb(path):
    content = path.read_bytes()
    if content[:4] != b"glTF" or struct.unpack_from("<I", content, 4)[0] != 2:
        raise ValueError(f"Invalid GLB: {path}")
    json_length = struct.unpack_from("<I", content, 12)[0]
    document = json.loads(content[20:20 + json_length])
    binary_offset = 20 + json_length
    binary_length = struct.unpack_from("<I", content, binary_offset)[0]
    binary = bytearray(content[binary_offset + 8:binary_offset + 8 + binary_length])
    return document, binary


def embed(species, clip, output, replace=False):
    target = output / f"{species}.glb"
    document, binary = read_glb(target)
    existing = next((animation for animation in document.get("animations", [])
                     if animation.get("name") == "HOME Idle"), None)
    if existing:
        if not replace:
            expected_bindings = {(track["path"].split("/")[-1], prop)
                                 for kind, prop in (("m_RotationCurves", "rotation"), ("m_EulerCurves", "rotation"),
                                                    ("m_PositionCurves", "translation"), ("m_ScaleCurves", "scale"))
                                 for track in clip[kind] if track["path"].startswith("Origin")}
            actual_bindings = {(document["nodes"][channel["target"]["node"]].get("name"), channel["target"]["path"])
                               for channel in existing["channels"]}
            if (actual_bindings != expected_bindings or
                abs(existing.get("extras", {}).get("homeDuration", 0) - clip["_duration"]) > 1e-7):
                raise ValueError(f"Existing idle lacks source channels or loop length: {species}; run with --replace")
            expected_hidden = [track["path"] for track in clip["m_PositionCurves"]
                               if track["path"].startswith("CusAnimVis_") and
                               not any(float(key["value"]["x"]) < 0 for key in track["curve"]["m_Curve"])]
            return {"id": int(species), "status": "already-present",
                    "tracks": len(existing["channels"]), "skippedBonePaths": [],
                    "eulerTracks": len([track for track in clip["m_EulerCurves"] if track["path"].startswith("Origin")]),
                    "hiddenMeshes": expected_hidden, "bytes": target.stat().st_size}
        document["animations"] = [animation for animation in document["animations"]
                                  if animation.get("name") != "HOME Idle"]
    nodes = document["nodes"]
    path_map = {}
    def walk(index, prefix):
        name = nodes[index].get("name", "")
        path = f"{prefix}/{name}" if prefix else name
        path_map[path] = index
        for child in nodes[index].get("children", []):
            walk(child, path)
    for scene in document.get("scenes", []):
        for root in scene["nodes"]:
            for child in nodes[root].get("children", []):
                walk(child, "")

    views = document.setdefault("bufferViews", [])
    accessors = document.setdefault("accessors", [])
    animation = {"name": "HOME Idle", "samplers": [], "channels": [], "extras": {"homeDuration": clip["_duration"]}}
    skipped = []
    hidden = []
    def add_accessor(values, width, limits=False):
        while len(binary) % 4:
            binary.append(0)
        view = len(views)
        flat = [number for row in values for number in row]
        if not all(math.isfinite(number) for number in flat):
            raise ValueError(f"Non-finite animation value: {species}")
        payload = struct.pack(f"<{len(flat)}f", *flat)
        views.append({"buffer": 0, "byteOffset": len(binary), "byteLength": len(payload)})
        binary.extend(payload)
        accessor = {"bufferView": view, "componentType": 5126, "count": len(values),
                    "type": {1: "SCALAR", 3: "VEC3", 4: "VEC4"}[width]}
        if limits:
            accessor.update({"min": [min(flat)], "max": [max(flat)]})
        index = len(accessors)
        accessors.append(accessor)
        return index

    for track in clip.get("m_PositionCurves", []):
        path = track["path"]
        if not path.startswith("CusAnimVis_") or path not in path_map:
            continue
        keys = track["curve"]["m_Curve"]
        states = {float(key["time"]): float(key["value"]["x"]) < 0 for key in keys}
        node = nodes[path_map[path]]
        if not any(states.values()):
            # HOME FBX helper values are mirrored and centimeter-scaled in
            # Unity: source visibility 1 is X=-0.01; visibility 0 is X=0.
            # Alternate poses and effects that are never visible in this idle.
            node.pop("mesh", None)
            node.pop("skin", None)
            hidden.append(path)
        elif not all(states.values()):
            times = sorted(states)
            # Core glTF has no visibility channel. A zero scale makes a
            # SkinnedMesh's inverse bind transform singular, so the viewer
            # restores these source controls as BooleanKeyframeTracks instead.
            if any(value == 0 for value in node.get("scale", [1, 1, 1])):
                node.pop("scale", None)
            node.setdefault("extras", {})["homeVisibility"] = {
                "times": times, "values": [states[time] for time in times]
            }

    for source, prop, dimensions in [
        ("m_RotationCurves", "rotation", "xyzw"),
        ("m_PositionCurves", "translation", "xyz"),
        ("m_ScaleCurves", "scale", "xyz"),
    ]:
        for track in clip.get(source, []):
            path = track["path"]
            if not path.startswith("Origin"):
                continue  # Material helper transforms are not skeletal motion.
            if path not in path_map:
                skipped.append(path)
                continue
            keys = track["curve"]["m_Curve"]
            unique_keys = {float(key["time"]): key for key in keys}
            times = sorted(unique_keys)
            if not times:
                continue
            # Unity serializes constant quaternion components with -Infinity
            # outgoing slopes. A zero derivative is equivalent on a constant
            # segment. Reject any nonconstant step instead of inventing motion.
            for index, time in enumerate(times):
                key = unique_keys[time]
                for axis in dimensions:
                    if math.isfinite(float(key["outSlope"].get(axis, 0))):
                        continue
                    if index + 1 < len(times):
                        following = unique_keys[times[index + 1]]
                        if (abs(float(key["value"][axis]) - float(following["value"][axis])) > 1e-7
                            or abs(float(following["inSlope"][axis])) > 1e-7):
                            raise ValueError(f"Nonconstant stepped curve: {species} {path}")
                    key["outSlope"][axis] = 0
            values = []
            signs = {"rotation": [1, -1, -1, 1], "translation": [-1, 1, 1],
                     "scale": [1, 1, 1]}[prop]
            for time in times:
                key = unique_keys[time]
                if key.get("weightedMode", 0) != 0:
                    raise ValueError(f"Weighted curve unsupported: {species} {path}")
                for kind in ("inSlope", "value", "outSlope"):
                    values.append([float(key[kind].get(axis, 0)) * sign
                                   for axis, sign in zip(dimensions, signs)])
            sampler = len(animation["samplers"])
            animation["samplers"].append({"input": add_accessor([[time] for time in times], 1, True),
                                           "output": add_accessor(values, len(dimensions)),
                                           "interpolation": "CUBICSPLINE"})
            animation["channels"].append({"sampler": sampler,
                                          "target": {"node": path_map[path], "path": prop}})
    quaternion_paths = {track["path"] for track in clip["m_RotationCurves"]}
    euler_tracks = 0
    for track in clip["m_EulerCurves"]:
        path = track["path"]
        if not path.startswith("Origin"):
            continue
        if path not in path_map:
            raise ValueError(f"Unmatched Euler bone: {species} {path}")
        if path in quaternion_paths:
            raise ValueError(f"Overlapping rotation encodings: {species} {path}")
        times, values = sample_euler(track)
        sampler = len(animation["samplers"])
        animation["samplers"].append({"input": add_accessor([[time] for time in times], 1, True),
                                       "output": add_accessor(values, 4), "interpolation": "LINEAR"})
        animation["channels"].append({"sampler": sampler, "target": {"node": path_map[path], "path": "rotation"}})
        euler_tracks += 1
    if not animation["channels"]:
        raise ValueError(f"No matching skeletal tracks: {species}")
    document.setdefault("animations", []).append(animation)
    document["buffers"][0]["byteLength"] = len(binary)
    encoded = json.dumps(document, separators=(",", ":"), ensure_ascii=False).encode()
    encoded += b" " * (-len(encoded) % 4)
    binary += b"\x00" * (-len(binary) % 4)
    length = 12 + 8 + len(encoded) + 8 + len(binary)
    payload = struct.pack("<III", 0x46546C67, 2, length)
    payload += struct.pack("<II", len(encoded), 0x4E4F534A) + encoded
    payload += struct.pack("<II", len(binary), 0x004E4942) + binary
    temporary = target.with_suffix(".animation.tmp")
    temporary.write_bytes(payload)
    temporary.replace(target)
    return {"id": int(species), "tracks": len(animation["channels"]),
            "skippedBonePaths": sorted(set(skipped)), "hiddenMeshes": hidden, "eulerTracks": euler_tracks,
            "bytes": len(payload)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, default=ROOT / "scripts/data/home-companion-paths.json")
    parser.add_argument("--cache", type=Path, default=ROOT / "work/home-animations")
    parser.add_argument("--output", type=Path, default=ROOT / "public/models/home")
    parser.add_argument("--report", type=Path, default=ROOT / "scripts/data/home-animation-audit.json")
    parser.add_argument("--download-only", action="store_true")
    parser.add_argument("--replace", action="store_true")
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--ids", nargs="*", help="Optional species numbers for a partial rebuild")
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(args.manifest.read_text())
    if args.ids:
        manifest = {key: value for key, value in manifest.items() if key in args.ids}
    report = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        for species, source in pool.map(lambda item: get_source(item, args.cache), manifest.items()):
            # Parse and embed one clip at a time so the full catalog does not
            # retain hundreds of megabytes of expanded YAML objects in memory.
            clip = parse_clip(species, source)
            if not args.download_only:
                report.append(embed(species, clip, args.output, args.replace))
            if (len(report) and len(report) % 50 == 0):
                print(f"Embedded {len(report)} animations", flush=True)
    if args.download_only:
        print(f"Verified {len(manifest)} idle animation sources")
        return
    previous = json.loads(args.report.read_text()) if args.ids and args.report.exists() else []
    merged = {item["id"]: item for item in previous}
    merged.update({item["id"]: item for item in report})
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(sorted(merged.values(), key=lambda item: item["id"]), indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
