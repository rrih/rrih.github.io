# Localized catalog sources

The nine search languages are English, Japanese, French, German, Spanish, Italian,
Korean, Simplified Chinese, and Traditional Chinese. Their 1,025 species names and
descriptions are complete. Latin American Spanish receives the same factual
completion treatment; the remaining interface languages retain an explicit
English catalog fallback.

Descriptions are distinguished using `descriptionKind`:

- `source-entry`: the selected game entry from the pinned PokéAPI snapshot,
  with its edition. Existing text is preserved.
- `atlas-summary`: a short Japanese summary of the official Japanese Pokédex.
  These cover species 899–1025 and retain qualifications such as uncertain
  origins and accounts attributed to fictional books. The source label says
  `要約`; the summaries are not presented as official quotations.
- `atlas-facts`: localized types, height, and weight from the pinned species
  data. These fill absent translated entries without fabricating game text.
  Their labels say data in the target language, and omit a game edition.

Each described species has `sourceURL`, `sourceLabel`, `descriptionKind`, and
`verifiedAt`; `sourceVersion` is present when a game edition exists. The date
means the source snapshot was checked, not that the source or every web page was
modified on that date. It must not be used to refresh every sitemap `lastmod`.

Japanese classifications are complete: kana source records fill existing gaps,
and seven terms are verified against the official Japanese Pokédex. Thirty
missing Chinese terms are verified against the official Chinese/Taiwan pages.
Unverified German, Spanish, and Italian classification terms are omitted rather
than translated into invented official labels. The interface should hide those
missing classification fields, not substitute English into translated pages.

## Reproduction

Run from `atlas/`. The cache path is outside the published application directory.
Replace the date only when performing a new source check.

```sh
python3 scripts/fetch-official-localizations.py --cache ../work/atlas-data --verified-at 2026-09-06
python3 scripts/fetch-localizations.py --cache ../work/atlas-data/pokeapi --verified-at 2026-09-06
python3 scripts/catalog_completion.py --verified-at 2026-09-06
```

The first command caches original official pages privately under ignored `work/`
and commits only source URL/name/edition/classification/hash evidence. It does
not copy original official descriptions into the repository. The checked
`japanese-description-summaries.json` is the reviewed editorial input.

The second command reproduces the pinned upstream data, adds edition provenance,
and applies completions. `--source-only` produces the upstream extraction without
the completions. `--offline` reuses existing source snapshots. The final command
also synchronizes English provenance to the application's base catalog and
writes the final completion report. Repeating the commands with the same source
files, editorial input, and verification date produces identical catalog data.

`localization-verification.json` separates upstream field availability from
published completion counts and output hashes. `catalog-completion-verification.json`
summarizes the resulting description kinds. `catalog-verification.json` records
the source of the base numeric catalog. `fetch-catalog.py` uses the same game
chronology rule as localization, so regenerating English does not silently select
a different edition.

## Source checks on 2026-09-06

- The live PokéAPI endpoints for 899 and 1025 still had no Japanese game entries.
- Official Japanese pages 899–1025 all provided a matching national number,
  standard form, name, classification, description, and edition attribution.
- The official simplified/traditional Chinese Pokédex provided classifications
  for 1011–1025. Their other readable game text is not bulk republished here;
  absent translations are instead filled with labelled numeric facts.
- French/German/Spanish/Italian Pokémon.com checks returned an iframe shell in
  this environment, not a reliably extractable species entry. The Korean official
  site uses a different page-ID mapping. No access-control workaround was used.

Official public entry examples:

- <https://zukan.pokemon.co.jp/detail/1025>
- <https://www.pokemon.cn/play/pokedex/1025>
- <https://tw.portal-pokemon.com/play/pokedex/1025>
- <https://www.pokemonkorea.co.kr/pokedex/view/1248>
- <https://pokeapi.co/api/v2/pokemon-species/1025/>

For new languages, preserve the distinction between translated game entries,
editorial summaries, and numeric facts. A complete interface dictionary alone is
not evidence of a translated catalog.
