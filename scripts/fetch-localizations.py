#!/usr/bin/env python3
"""Build localized catalog files and search aliases from pinned PokéAPI CSVs.

Uses Python's standard library and curl. Re-run with --offline and the same
--cache directory to reproduce the output without network access. Missing
translations are omitted; this script never translates or fills source text.
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
REPO = Path(__file__).resolve().parents[1]
CSV_FILES = (
    "languages.csv",
    "pokemon_species.csv",
    "pokemon_species_names.csv",
    "pokemon_species_flavor_text.csv",
    "types.csv",
    "type_names.csv",
    "stats.csv",
    "stat_names.csv",
    "versions.csv",
    "version_groups.csv",
)
LOCALES = {
    "ja-hrkt": "ja-Hrkt",
    "ja-roma": "ja-Latn",
    "zh-hant": "zh-Hant",
    "zh-hans": "zh-Hans",
    "pt-br": "pt-BR",
}
STAT_IDS = tuple(range(1, 7))


def download(name: str, cache: Path) -> None:
    path = cache / name
    if path.exists():
        return
    temporary = path.with_suffix(path.suffix + ".tmp")
    subprocess.run(
        ["curl", "--fail", "--silent", "--show-error", "--location", "--retry", "2",
         "--max-time", "120", SOURCE_ROOT + name, "--output", str(temporary)],
        check=True,
    )
    temporary.replace(path)


def read_csv(cache: Path, name: str) -> list[dict[str, str]]:
    with (cache / name).open(encoding="utf-8", newline="") as source:
        return list(csv.DictReader(source))


def clean_text(value: str) -> str:
    # A discretionary hyphen plus a wrapped line is one word in the original.
    value = re.sub(r"\u00ad\s*", "", value)
    return re.sub(r"\s+", " ", value).strip()


def encoded(value: object, *, pretty: bool = False) -> bytes:
    options = {"indent": 2} if pretty else {"separators": (",", ":")}
    return (json.dumps(value, ensure_ascii=False, **options) + "\n").encode("utf-8")


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def build(cache: Path) -> tuple[dict, dict, dict]:
    rows = {name: read_csv(cache, name) for name in CSV_FILES}
    species_ids = sorted(int(row["id"]) for row in rows["pokemon_species.csv"])
    assert species_ids == list(range(1, 1026)), "Pinned catalog must contain exactly IDs 1–1025"
    expected = set(species_ids)
    language_ids = {int(row["id"]) for row in rows["languages.csv"]}
    type_ids = {int(row["id"]): row["identifier"] for row in rows["types.csv"]}
    stat_ids = {int(row["id"]): row["identifier"] for row in rows["stats.csv"]}
    group_order = {int(row["id"]): int(row["order"]) for row in rows["version_groups.csv"]}
    versions = {
        int(row["id"]): {
            "identifier": row["identifier"],
            "rank": (group_order[int(row["version_group_id"])], int(row["id"])),
        }
        for row in rows["versions.csv"]
    }
    names = collections.defaultdict(dict)
    aliases = {species_id: set() for species_id in species_ids}
    for row in rows["pokemon_species_names.csv"]:
        species_id, language_id = int(row["pokemon_species_id"]), int(row["local_language_id"])
        assert species_id in expected and language_id in language_ids
        assert species_id not in names[language_id], f"Duplicate name row: {language_id}/{species_id}"
        translated = {field: clean_text(row[field]) for field in ("name", "genus") if clean_text(row[field])}
        names[language_id][species_id] = translated
        if translated.get("name"):
            aliases[species_id].add(translated["name"])

    descriptions = collections.defaultdict(dict)
    flavor_keys = set()
    nonempty_flavor_rows = collections.Counter()
    for row in rows["pokemon_species_flavor_text.csv"]:
        species_id, language_id, version_id = (int(row[key]) for key in ("species_id", "language_id", "version_id"))
        assert species_id in expected and language_id in language_ids and version_id in versions
        key = (species_id, language_id, version_id)
        assert key not in flavor_keys, f"Duplicate flavor row: {key}"
        flavor_keys.add(key)
        text = clean_text(row["flavor_text"])
        if not text:
            continue
        nonempty_flavor_rows[language_id] += 1
        prior = descriptions[language_id].get(species_id)
        if prior is None or versions[version_id]["rank"] > versions[prior["versionId"]]["rank"]:
            descriptions[language_id][species_id] = {"text": text, "versionId": version_id}

    types, stats = collections.defaultdict(dict), collections.defaultdict(dict)
    for filename, id_key, known, target in (
        ("type_names.csv", "type_id", type_ids, types),
        ("stat_names.csv", "stat_id", stat_ids, stats),
    ):
        for row in rows[filename]:
            language_id, item_id = int(row["local_language_id"]), int(row[id_key])
            assert language_id in language_ids and item_id in known
            assert item_id not in target[language_id], f"Duplicate label: {filename}/{language_id}/{item_id}"
            text = clean_text(row["name"])
            if text:
                target[language_id][item_id] = text

    catalogs, coverage, empty_locales = {}, {}, []
    for language in sorted(rows["languages.csv"], key=lambda row: int(row["id"])):
        language_id = int(language["id"])
        locale = LOCALES.get(language["identifier"], language["identifier"])
        records = {}
        for species_id in species_ids:
            record = dict(names[language_id].get(species_id, {}))
            if species_id in descriptions[language_id]:
                record["description"] = descriptions[language_id][species_id]["text"]
            if record:
                records[str(species_id)] = record
        translated_types = {type_ids[item]: value for item, value in sorted(types[language_id].items())}
        translated_stats = {item: stats[language_id][item] for item in STAT_IDS if item in stats[language_id]}
        assert len(translated_stats) in (0, 6), f"Partial stat labels require a schema decision: {locale}"
        detail = {
            "languageId": language_id,
            "sourceIdentifier": language["identifier"],
            "sourceOfficialFlag": language["official"] == "1",
            "speciesRecords": len(records),
            "fields": {
                field: {
                    "count": sum(field in record for record in records.values()),
                    "missingIds": [species_id for species_id in species_ids if field not in records.get(str(species_id), {})],
                }
                for field in ("name", "genus", "description")
            },
            "types": {
                "count": len(translated_types),
                "total": len(type_ids),
                "missing": [value for value in type_ids.values() if value not in translated_types],
            },
            "stats": {
                "count": len(translated_stats),
                "total": 6,
                "missing": [stat_ids[item] for item in STAT_IDS if item not in translated_stats],
            },
            "nonemptyFlavorSourceRows": nonempty_flavor_rows[language_id],
            "selectedFlavorVersionBySpecies": {
                str(species_id): description["versionId"]
                for species_id, description in sorted(descriptions[language_id].items())
            },
        }
        coverage[locale] = detail
        if not records and not translated_types and not translated_stats:
            empty_locales.append(locale)
            continue
        catalog = {"locale": locale, "species": records, "types": translated_types}
        if translated_stats:
            catalog["stats"] = [translated_stats[item] for item in STAT_IDS]
        catalogs[locale] = catalog

    search = {str(species_id): sorted(values) for species_id, values in aliases.items()}
    assert all(search.values()), "Every species must have at least one search name"
    assert len(catalogs) == 12, "Review coverage if the pinned source language set changes"
    for locale, catalog in catalogs.items():
        for species_id, record in catalog["species"].items():
            assert int(species_id) in expected
            assert set(record) <= {"name", "genus", "description"}
            assert all(isinstance(value, str) and value and value == clean_text(value) for value in record.values())
            if "name" in record:
                assert record["name"] in search[species_id], f"Search alias missing: {locale}/{species_id}"

    manifest = {
        "sourceRepository": "https://github.com/PokeAPI/pokeapi",
        "sourceCommit": SOURCE_COMMIT,
        "sourceSha256": {name: digest((cache / name).read_bytes()) for name in CSV_FILES},
        "speciesCount": len(species_ids),
        "minId": min(species_ids),
        "maxId": max(species_ids),
        "locales": list(catalogs),
        "excludedEmptyLocales": empty_locales,
        "statOrder": [stat_ids[item] for item in STAT_IDS],
        "flavorTextSelection": "Latest nonempty source text by version_groups.order, then version ID; version IDs alone are not chronological",
        "textCleaning": "Collapse whitespace; remove discretionary soft hyphens and their line wrapping. No translation or content completion.",
        "missingData": "Omit missing species fields and type labels. Omit stats entirely when no base-stat labels exist. No fallback text is stored.",
        "coverage": coverage,
        "search": {
            "speciesCount": len(search),
            "nameCount": sum(map(len, search.values())),
            "minNamesPerSpecies": min(map(len, search.values())),
            "maxNamesPerSpecies": max(map(len, search.values())),
            "missingIds": [species_id for species_id in species_ids if not search[str(species_id)]],
        },
        "verified": ["exact contiguous species IDs 1–1025", "unique language/species and flavor/version keys", "all source name aliases indexed", "nonempty localized fields only", "complete or absent six-stat arrays", "source chronology selection", "no synthesized translations"],
    }
    return catalogs, search, manifest


def write(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, default=REPO / "work" / "localization-cache" / SOURCE_COMMIT)
    parser.add_argument("--output-dir", type=Path, default=REPO / "public" / "locales" / "catalog")
    parser.add_argument("--search-output", type=Path, default=REPO / "public" / "locales" / "search.json")
    parser.add_argument("--verification", type=Path, default=REPO / "scripts" / "data" / "localization-verification.json")
    parser.add_argument("--offline", action="store_true")
    arguments = parser.parse_args()
    arguments.cache.mkdir(parents=True, exist_ok=True)
    if not arguments.offline:
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            list(executor.map(lambda name: download(name, arguments.cache), CSV_FILES))
    catalogs, search, manifest = build(arguments.cache)
    outputs = {f"catalog/{locale}.json": encoded(catalog) for locale, catalog in catalogs.items()}
    outputs["search.json"] = encoded(search)
    manifest["outputSha256"] = {name: digest(data) for name, data in outputs.items()}
    manifest["outputBytes"] = {name: len(data) for name, data in outputs.items()}
    for locale in catalogs:
        write(arguments.output_dir / f"{locale}.json", outputs[f"catalog/{locale}.json"])
    write(arguments.search_output, outputs["search.json"])
    write(arguments.verification, encoded(manifest, pretty=True))
    for locale in catalogs:
        fields = manifest["coverage"][locale]["fields"]
        counts = ", ".join(f"{field}={detail['count']}" for field, detail in fields.items())
        print(f"{locale}: {counts}")
    print(f"Verified {len(catalogs)} locales, 1,025 species, and {manifest['search']['nameCount']:,} distinct search names.")


if __name__ == "__main__":
    main()
