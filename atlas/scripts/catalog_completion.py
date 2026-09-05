#!/usr/bin/env python3
"""Apply reviewed Japanese summaries and clearly attributed localized data summaries.

No network or UI text generation occurs during an application build. The source
fetcher calls this after rebuilding its pinned source catalogs. It never replaces
an existing source description, nor presents Atlas text as a game's quotation.
"""

from __future__ import annotations

import argparse
import collections
from datetime import date
import hashlib
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
SEO_LOCALES = ("en", "ja", "fr", "de", "es", "it", "ko", "zh-Hans", "zh-Hant")
SOURCE_FIELDS = ("sourceURL", "sourceLabel", "sourceVersion", "descriptionKind", "verifiedAt")
DATA_LABELS = {
    "fr": "PokéAPI · Données", "de": "PokéAPI · Daten", "es": "PokéAPI · Datos",
    "es-419": "PokéAPI · Datos", "it": "PokéAPI · Dati", "ko": "PokéAPI · 기본 정보",
    "zh-Hans": "PokéAPI · 基础资料", "zh-Hant": "PokéAPI · 基本資料",
}


def number(value: float, locale: str) -> str:
    text = str(int(value)) if int(value) == value else str(value)
    return text.replace(".", ",") if locale in {"fr", "de", "es", "es-419", "it"} else text


def facts(entry: dict, record: dict, catalog: dict, locale: str) -> str:
    name = record["name"]
    types = [catalog["types"][key] for key in entry["types"]]
    joined = ("、" if locale in ("zh-Hans", "zh-Hant") else " / ").join(types)
    h, w = number(entry["height"], locale), number(entry["weight"], locale)
    if locale == "fr":
        return f"{name} est de type {joined}. Il mesure {h} m et pèse {w} kg."
    if locale == "de":
        return f"{name} hat {'den Typ' if len(types) == 1 else 'die Typen'} {joined}. Es ist {h} m groß und wiegt {w} kg."
    if locale in ("es", "es-419"):
        return f"{name} es de tipo {joined}. Mide {h} m y pesa {w} kg."
    if locale == "it":
        return f"{name} è di tipo {joined}. È alto {h} m e pesa {w} kg."
    if locale == "ko":
        return f"{name}: {joined} 타입. 키는 {h}m, 몸무게는 {w}kg이다."
    if locale == "zh-Hans":
        return f"{name}的属性为{joined}，身高{h}米，体重{w}千克。"
    if locale == "zh-Hant":
        return f"{name}的屬性為{joined}，身高{h}公尺，體重{w}公斤。"
    raise ValueError(f"Unsupported data-summary language: {locale}")


def complete_catalogs(catalogs: dict, verified_at: str) -> dict:
    entries = json.loads((REPO / "src/data/catalog.json").read_text())
    summaries = json.loads((REPO / "scripts/data/japanese-description-summaries.json").read_text())
    official = json.loads((REPO / "scripts/data/official-japanese-provenance.json").read_text())["species"]
    chinese_categories = json.loads((REPO / "scripts/data/official-chinese-categories.json").read_text())["locales"]
    assert set(summaries) == set(official) == {str(i) for i in range(899, 1026)}
    changes = collections.defaultdict(lambda: collections.Counter())
    for entry in entries:
        ident = str(entry["id"])
        ja = catalogs["ja"]["species"][ident]
        kana = catalogs["ja-Hrkt"]["species"][ident]
        if not ja.get("genus") and kana.get("genus"):
            ja["genus"] = kana["genus"]
            changes["ja"]["kanaGenus"] += 1
        if ident in official:
            source = official[ident]
            assert source["name"] == ja["name"], f"Wrong source species: {ident}"
            if not ja.get("genus"):
                ja["genus"] = source["genus"]
                changes["ja"]["officialGenus"] += 1
            if not ja.get("description") or ja.get("descriptionKind") == "atlas-summary":
                ja.update({
                    "description": summaries[ident],
                    "descriptionKind": "atlas-summary",
                    "sourceURL": source["sourceURL"],
                    "sourceLabel": f"ポケモンずかん · {source['sourceVersion']}（要約）",
                    "sourceVersion": source["sourceVersion"],
                    "verifiedAt": source["verifiedAt"],
                })
                changes["ja"]["reviewedSummary"] += 1
        for locale in (*SEO_LOCALES, "es-419"):
            record = catalogs[locale]["species"][ident]
            category = chinese_categories.get(locale, {}).get(ident)
            if not record.get("genus") and category:
                assert category["name"] == record["name"], f"Wrong category source: {locale}/{ident}"
                record["genus"] = category["genus"]
                changes[locale]["officialGenus"] += 1
            if not record.get("description") or record.get("descriptionKind") == "atlas-facts":
                assert locale in DATA_LABELS, f"No reviewed description: {locale}/{ident}"
                record.update({
                    "description": facts(entry, record, catalogs[locale], locale),
                    "descriptionKind": "atlas-facts",
                    "sourceURL": f"https://pokeapi.co/api/v2/pokemon/{entry['id']}/",
                    "sourceLabel": DATA_LABELS[locale],
                    "verifiedAt": verified_at,
                })
                record.pop("sourceVersion", None)
                changes[locale]["dataSummary"] += 1
    for locale in SEO_LOCALES:
        records = catalogs[locale]["species"]
        assert set(records) == {str(i) for i in range(1, 1026)}
        for ident, record in records.items():
            assert record.get("name") and record.get("description"), f"Incomplete {locale}/{ident}"
            assert record.get("sourceURL", "").startswith("https://")
            assert record.get("descriptionKind") in ("source-entry", "atlas-summary", "atlas-facts")
            assert record.get("sourceLabel") and record.get("verifiedAt")
            assert not any(char in record["description"] for char in ("<", ">")), f"HTML in {locale}/{ident}"
    return {
        "verifiedAt": verified_at,
        "languages": list(SEO_LOCALES),
        "changes": {locale: dict(counts) for locale, counts in sorted(changes.items())},
        "publishedDescriptionKinds": {locale: dict(collections.Counter(record["descriptionKind"] for record in catalogs[locale]["species"].values())) for locale in SEO_LOCALES},
        "descriptionPolicy": "Preserve source entries. Reviewed Japanese summaries cite the official species page and edition. Data summaries state localized types and metric measurements only; they are not game flavor text.",
        "japaneseSummarySha256": hashlib.sha256((REPO / "scripts/data/japanese-description-summaries.json").read_bytes()).hexdigest(),
        "officialJapaneseProvenanceSha256": hashlib.sha256((REPO / "scripts/data/official-japanese-provenance.json").read_bytes()).hexdigest(),
        "missingGenus": {locale: [int(ident) for ident, record in catalogs[locale]["species"].items() if not record.get("genus")] for locale in SEO_LOCALES},
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog-dir", type=Path, default=REPO / "public/locales/catalog")
    parser.add_argument("--verified-at", default=date.today().isoformat())
    args = parser.parse_args()
    date.fromisoformat(args.verified_at)
    catalogs = {file.stem: json.loads(file.read_text()) for file in args.catalog_dir.glob("*.json")}
    report = complete_catalogs(catalogs, args.verified_at)
    for locale, catalog in catalogs.items():
        (args.catalog_dir / f"{locale}.json").write_text(json.dumps(catalog, ensure_ascii=False, separators=(",", ":")) + "\n")
    entries_path = REPO / "src/data/catalog.json"
    entries = json.loads(entries_path.read_text())
    for entry in entries:
        source = catalogs["en"]["species"][str(entry["id"])]
        assert entry["description"] == source["description"], f"English source mismatch: {entry['id']}"
        entry.update({key: source[key] for key in SOURCE_FIELDS if key in source})
    entries_path.write_text(json.dumps(entries, ensure_ascii=False, separators=(",", ":")) + "\n")
    (REPO / "scripts/data/catalog-completion-verification.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"completeLanguages": report["languages"], "changes": report["changes"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
