#!/usr/bin/env python3
"""Build a complete species catalog from pinned upstream PokeAPI CSV data.

Usage: python3 fetch_catalog.py --output catalog.json
Uses Python's standard library and curl. Downloaded sources are cached locally.
Use --offline to reproduce the catalog and checks without network requests.
"""

from __future__ import annotations

import argparse
import collections
import concurrent.futures
import csv
import hashlib
import json
import re
import subprocess
from pathlib import Path


SOURCE_COMMIT = "d4f9a4af58ade123fbc0558f68b1c69daa97d9e4"
SOURCE_ROOT = f"https://raw.githubusercontent.com/PokeAPI/pokeapi/{SOURCE_COMMIT}/data/v2/csv/"
API_URL = "https://pokeapi.co/api/v2/pokemon-species?limit=10000"
CSV_FILES = (
    "pokemon_species.csv",
    "pokemon.csv",
    "pokemon_species_names.csv",
    "pokemon_types.csv",
    "types.csv",
    "pokemon_stats.csv",
    "pokemon_species_flavor_text.csv",
)


def download(url: str, path: Path) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    subprocess.run(
        ["curl", "--fail", "--silent", "--show-error", "--location",
         "--retry", "2", "--max-time", "120", url, "--output", str(temporary)],
        check=True,
    )
    temporary.replace(path)


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as source:
        return list(csv.DictReader(source))


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def build(cache: Path) -> tuple[list[dict], dict]:
    species = read_csv(cache / "pokemon_species.csv")
    species.sort(key=lambda row: int(row["id"]))
    default_pokemon = {}
    for row in read_csv(cache / "pokemon.csv"):
        if row["is_default"] == "1":
            species_id = int(row["species_id"])
            assert species_id not in default_pokemon, f"Duplicate default for {species_id}"
            default_pokemon[species_id] = row
    names = collections.defaultdict(dict)
    for row in read_csv(cache / "pokemon_species_names.csv"):
        names[int(row["pokemon_species_id"])][int(row["local_language_id"])] = row
    type_names = {int(row["id"]): row["identifier"] for row in read_csv(cache / "types.csv")}
    types = collections.defaultdict(dict)
    for row in read_csv(cache / "pokemon_types.csv"):
        types[int(row["pokemon_id"])][int(row["slot"])] = type_names[int(row["type_id"])]
    stats = collections.defaultdict(dict)
    for row in read_csv(cache / "pokemon_stats.csv"):
        stats[int(row["pokemon_id"])][int(row["stat_id"])] = int(row["base_stat"])
    descriptions = {}
    for row in read_csv(cache / "pokemon_species_flavor_text.csv"):
        species_id = int(row["species_id"])
        if row["language_id"] == "9" and clean_text(row["flavor_text"]):
            if species_id not in descriptions or int(row["version_id"]) > int(descriptions[species_id]["version_id"]):
                descriptions[species_id] = row

    catalog = []
    for row in species:
        species_id = int(row["id"])
        pokemon = default_pokemon[species_id]
        pokemon_id = int(pokemon["id"])
        english = names[species_id][9]
        japanese = names[species_id].get(11) or names[species_id][1]
        entry = {
            "id": species_id,
            "slug": row["identifier"],
            "name": english["name"],
            "ja": japanese["name"],
            "gen": int(row["generation_id"]),
            "types": [value for _, value in sorted(types[pokemon_id].items())],
            "height": int(pokemon["height"]) / 10,
            "weight": int(pokemon["weight"]) / 10,
            "stats": [stats[pokemon_id][stat_id] for stat_id in range(1, 7)],
            "description": clean_text(descriptions[species_id]["flavor_text"]),
            "genus": english["genus"],
            "evolvesFrom": int(row["evolves_from_species_id"]) if row["evolves_from_species_id"] else None,
        }
        assert all(entry[key] for key in ("slug", "name", "ja", "description", "genus")), entry
        assert 1 <= len(entry["types"]) <= 2, entry
        assert entry["height"] > 0 and entry["weight"] > 0, entry
        assert all(0 < stat <= 255 for stat in entry["stats"]), entry
        catalog.append(entry)

    api = json.loads((cache / "species-api.json").read_text())
    actual = {entry["id"]: entry["slug"] for entry in catalog}
    expected = {int(entry["url"].rstrip("/").split("/")[-1]): entry["name"] for entry in api["results"]}
    assert api["next"] is None, "API snapshot is incomplete; increase the requested limit"
    assert len(catalog) == len(actual) == len(expected) == api["count"], "Species counts disagree"
    assert actual == expected, "Species IDs or identifiers disagree with the API"
    assert sorted(actual) == list(range(1, max(actual) + 1)), "National species IDs have gaps"
    assert all(entry["evolvesFrom"] is None or entry["evolvesFrom"] in actual for entry in catalog), "Broken evolution reference"

    manifest = {
        "sourceRepository": "https://github.com/PokeAPI/pokeapi",
        "sourceCommit": SOURCE_COMMIT,
        "countVerificationEndpoint": API_URL,
        "speciesCount": len(catalog),
        "minId": min(actual),
        "maxId": max(actual),
        "generationCounts": dict(sorted(collections.Counter(entry["gen"] for entry in catalog).items())),
        "statOrder": ["HP", "Attack", "Defense", "Special Attack", "Special Defense", "Speed"],
        "heightUnit": "m",
        "weightUnit": "kg",
        "formSelection": "One record per species using the upstream default Pokemon form",
        "flavorTextSelection": "Latest version ID with nonempty English flavor text; whitespace normalized",
        "verified": ["unique IDs", "complete contiguous national IDs", "API count/ID/slug parity", "names in English and Japanese", "six valid base stats", "one or two types", "positive metric dimensions", "flavor text and genus", "valid evolution references"],
        "sourceSha256": {name: hashlib.sha256((cache / name).read_bytes()).hexdigest() for name in (*CSV_FILES, "species-api.json")},
    }
    return catalog, manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path(__file__).with_name("catalog.json"))
    parser.add_argument("--cache", type=Path, default=Path(__file__).with_name("source-cache") / SOURCE_COMMIT)
    parser.add_argument("--offline", action="store_true")
    arguments = parser.parse_args()
    arguments.cache.mkdir(parents=True, exist_ok=True)
    if not arguments.offline:
        missing = [name for name in CSV_FILES if not (arguments.cache / name).exists()]
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            list(executor.map(lambda name: download(SOURCE_ROOT + name, arguments.cache / name), missing))
        download(API_URL, arguments.cache / "species-api.json")
    catalog, manifest = build(arguments.cache)
    encoded = json.dumps(catalog, ensure_ascii=False, separators=(",", ":")) + "\n"
    manifest["catalogSha256"] = hashlib.sha256(encoded.encode()).hexdigest()
    arguments.output.parent.mkdir(parents=True, exist_ok=True)
    arguments.output.write_text(encoded, encoding="utf-8")
    manifest_path = arguments.output.with_name(arguments.output.stem + ".verification.json")
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Verified {len(catalog)} species, IDs {manifest['minId']}–{manifest['maxId']}, with no gaps.")
    print(f"Catalog: {arguments.output} ({len(encoded.encode()):,} bytes)")
    print(f"Verification: {manifest_path}")


if __name__ == "__main__":
    main()
