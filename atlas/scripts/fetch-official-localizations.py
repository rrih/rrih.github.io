#!/usr/bin/env python3
"""Refresh source evidence for reviewed Japanese summaries and missing Chinese categories.

Only public species pages are fetched. Full original descriptions stay in the
ignored cache. The committed evidence contains source identities, edition labels,
classification terms and content hashes, not a copy of the official encyclopedia.
"""

from __future__ import annotations

import argparse
import concurrent.futures
from datetime import date
import hashlib
import html
import json
import re
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", value))).strip()


def fetch(url: str) -> bytes:
    return subprocess.check_output([
        "curl", "--fail", "--silent", "--show-error", "--location", "--retry", "1", "--max-time", "30", url,
    ])


def japanese(ident: int, cache: Path, verified_at: str, offline: bool) -> dict:
    file = cache / "official-ja" / f"{ident}.json"
    if not file.exists():
        if offline:
            raise FileNotFoundError(file)
        url = f"https://zukan.pokemon.co.jp/detail/{ident:04}"
        raw = fetch(url)
        match = re.search(r'<script id="json-data" type="application/json">(.*?)</script>', raw.decode(), re.S)
        if not match:
            raise ValueError(f"Official page has no readable species record: {url}")
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(json.dumps({
            "url": url, "verifiedAt": verified_at, "htmlSha256": hashlib.sha256(raw).hexdigest(),
            "pokemon": json.loads(match.group(1))["pokemon"],
        }, ensure_ascii=False, indent=2) + "\n")
    snapshot = json.loads(file.read_text())
    pokemon = snapshot["pokemon"]
    assert int(pokemon["no"]) == ident and pokemon["sub"] == 0, f"Wrong species or form: {ident}"
    description = clean(pokemon["text_1"])
    version = re.search(r"（『(.+?)』より）", description)
    assert pokemon["name"] and pokemon["bunrui"] and version, f"Incomplete official record: {ident}"
    return {
        "name": pokemon["name"], "genus": pokemon["bunrui"],
        "sourceURL": snapshot["url"], "sourceVersion": version.group(1),
        "verifiedAt": snapshot["verifiedAt"], "htmlSha256": snapshot["htmlSha256"],
        "selectedField": "text_1", "sourceTextSha256": hashlib.sha256(description.encode()).hexdigest(),
    }


def chinese(locale: str, ident: int, expected_name: str, cache: Path, verified_at: str, offline: bool) -> dict:
    file = cache / f"official-{locale}" / f"{ident}.html"
    url = ("https://www.pokemon.cn" if locale == "zh-Hans" else "https://tw.portal-pokemon.com") + f"/play/pokedex/{ident}"
    if not file.exists():
        if offline:
            raise FileNotFoundError(file)
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_bytes(fetch(url))
    raw = file.read_bytes()
    text = raw.decode()
    title = re.search(r"<title>(.*?)</title>", text, re.S)
    assert title and expected_name in clean(title.group(1)), f"Wrong Chinese species: {locale}/{ident}"
    if locale == "zh-Hans":
        match = re.search(r'class="pokemon-info__category"[^>]*>(.*?)</div>', text, re.S)
        assert match, f"Missing category: {locale}/{ident}"
        category = clean(match.group(1)).removeprefix("分类").strip()
        assert re.search(rf'data-zukanid="0?{ident}"', text), f"Wrong Chinese ID: {locale}/{ident}"
    else:
        match = re.search(r">分類</p>\s*<p[^>]*>(.*?)</p>", text, re.S)
        assert match, f"Missing category: {locale}/{ident}"
        category = clean(match.group(1))
        assert re.search(rf'/pokedex/{ident}/?"', text), f"Wrong Chinese ID: {locale}/{ident}"
    assert category and ("宝可梦" in category or "寶可夢" in category), f"Invalid category: {locale}/{ident}"
    return {
        "name": expected_name, "genus": category, "sourceURL": url,
        "verifiedAt": verified_at, "htmlSha256": hashlib.sha256(raw).hexdigest(),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, default=REPO.parent / "work/atlas-data")
    parser.add_argument("--verified-at", default=date.today().isoformat())
    parser.add_argument("--offline", action="store_true")
    args = parser.parse_args()
    date.fromisoformat(args.verified_at)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        rows = list(pool.map(lambda ident: japanese(ident, args.cache, args.verified_at, args.offline), range(899, 1026)))
    output = REPO / "scripts/data"
    output.joinpath("official-japanese-provenance.json").write_text(json.dumps({
        "source": "https://zukan.pokemon.co.jp/", "policy": "Reviewed summaries use text_1; official category terms fill missing classifications. No original description is republished in this evidence file.",
        "species": dict(zip(map(str, range(899, 1026)), rows)),
    }, ensure_ascii=False, indent=2) + "\n")
    categories = {}
    for locale in ("zh-Hans", "zh-Hant"):
        catalog = json.loads((REPO / f"public/locales/catalog/{locale}.json").read_text())
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            rows = list(pool.map(lambda ident: chinese(locale, ident, catalog["species"][str(ident)]["name"], args.cache, args.verified_at, args.offline), range(1011, 1026)))
        categories[locale] = dict(zip(map(str, range(1011, 1026)), rows))
    output.joinpath("official-chinese-categories.json").write_text(json.dumps({"locales": categories}, ensure_ascii=False, indent=2) + "\n")
    print("Verified 127 Japanese source pages and 30 Chinese category records.")


if __name__ == "__main__":
    main()
