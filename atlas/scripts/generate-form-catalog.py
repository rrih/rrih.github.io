#!/usr/bin/env python3
"""Generate only verified Mega and regional form metadata from pinned PokéAPI CSV.

Names remain source spellings; missing translations fall back in the UI. The
three Japanese Tauros breed qualifiers come from Pokémon's Japanese catalogue,
because the CSV labels all three only as Paldean form.
"""
import argparse
import csv
import hashlib
import importlib.util
import io
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('form_sources', ROOT / 'scripts/prepare-form-sources.py')
source = importlib.util.module_from_spec(spec)
spec.loader.exec_module(source)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--preview', action='store_true', help='Write work/forms/forms-preview.json before assets are complete')
    args = parser.parse_args()
    provenance = json.loads((ROOT / 'scripts/data/form-catalog-source.json').read_text())
    rows = {}
    for name, expected in provenance['files'].items():
        target = ROOT / 'work/forms/csv' / name
        if not target.exists():
            data = source.request(f'https://raw.githubusercontent.com/{provenance["repository"]}/{provenance["revision"]}/data/v2/csv/{name}')
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
        data = target.read_bytes()
        if hashlib.sha256(data).hexdigest() != expected:
            raise ValueError(f'Pinned catalogue source changed: {name}')
        rows[name[:-4]] = list(csv.DictReader(io.StringIO(data.decode())))
    pokemon = {int(item['id']): item for item in rows['pokemon']}
    forms = {int(item['pokemon_id']): item for item in rows['pokemon_forms'] if item['is_default'] == '1'}
    languages = {int(item['id']): item['identifier'] for item in rows['languages']}
    species_names = {(int(item['pokemon_species_id']), int(item['local_language_id'])): item['name']
                     for item in rows['pokemon_species_names']}
    form_names = {}
    for item in rows['pokemon_form_names']:
        form_names.setdefault(int(item['pokemon_form_id']), {})[int(item['local_language_id'])] = item
    type_names = {int(item['id']): item['identifier'] for item in rows['types']}
    pokemon_types, pokemon_stats = {}, {}
    for item in rows['pokemon_types']:
        pokemon_types.setdefault(int(item['pokemon_id']), {})[int(item['slot'])] = type_names[int(item['type_id'])]
    for item in rows['pokemon_stats']:
        pokemon_stats.setdefault(int(item['pokemon_id']), {})[int(item['stat_id'])] = int(item['base_stat'])
    home = json.loads((ROOT / 'scripts/data/form-inventory.json').read_text())
    external = json.loads((ROOT / 'scripts/data/form-external-sources.json').read_text())
    inventory = home + external
    home_ids = {item['id'] for item in home}
    aliases = {'zh-hant': 'zh-Hant', 'zh-hans': 'zh-Hans', 'pt-br': 'pt-BR'}
    result = []
    for item in inventory:
        record = pokemon[item['pokemonId']]
        form = forms[item['pokemonId']]
        if record['identifier'] != item['id'] or int(record['species_id']) != item['speciesId']:
            raise ValueError(f'Pokemon/form identity mismatch: {item["id"]}')
        if (form['is_mega'] == '1') != (item['kind'] == 'mega'):
            raise ValueError(f'Form category mismatch: {item["id"]}')
        names = {}
        for language, entry in form_names.get(int(form['id']), {}).items():
            locale = languages[language]
            if locale in ('ja-roma', 'ja-hrkt'):
                continue
            name = entry['pokemon_name']
            qualifier = entry['form_name']
            if not name and qualifier:
                if item['kind'] == 'mega':
                    name = qualifier
                else:
                    species = species_names.get((item['speciesId'], language))
                    if species:
                        # The Zen qualifier is shared with Unovan Darmanitan.
                        # Add this same language's official Galar form label.
                        if item['id'] == 'darmanitan-galar-zen':
                            standard = form_names[int(forms[10177]['id'])].get(language)
                            if standard and standard['form_name']:
                                qualifier = standard['form_name'] + ' / ' + qualifier
                        name = f'{species}（{qualifier}）' if locale == 'ja' else f'{species} ({qualifier})'
            if name:
                names[aliases.get(locale, locale)] = name
        breeds = {'tauros-paldea-combat-breed': 'コンバットしゅ',
                  'tauros-paldea-blaze-breed': 'ブレイズしゅ',
                  'tauros-paldea-aqua-breed': 'ウォーターしゅ'}
        if item['id'] in breeds:
            names['ja'] = f'ケンタロス（パルデアのすがた・{breeds[item["id"]]}）'
        if not names.get('en'):
            raise ValueError(f'No source English form name: {item["id"]}')
        model = {'url': f'/models/forms/{item["id"]}.glb', 'animations': 1}
        if item['id'] in home_ids:
            model['shiny'] = f'/models/forms/{item["id"]}-shiny.glb'
        for url in [model['url'], *([model['shiny']] if 'shiny' in model else [])]:
            if not args.preview and not (ROOT / 'public' / url.lstrip('/')).is_file():
                raise ValueError(f'Form model is not ready: {url}')
        stats = pokemon_stats[item['pokemonId']]
        if set(stats) != set(range(1, 7)):
            raise ValueError(f'Incomplete original stats: {item["id"]}')
        output = {key: item[key] for key in ('id', 'speciesId', 'kind', 'region', 'variant', 'pokemonId') if key in item}
        output.update(name=names['en'], names=names, model=model,
                      types=[value for _, value in sorted(pokemon_types[item['pokemonId']].items())],
                      height=int(record['height']) / 10, weight=int(record['weight']) / 10,
                      stats=[stats[index] for index in range(1, 7)])
        if output['height'] <= 0 or output['weight'] <= 0 or not all(value > 0 for value in output['stats']):
            raise ValueError(f'Invalid source dimensions or stats: {item["id"]}')
        result.append(output)
    result.sort(key=lambda item: (item['speciesId'], item['pokemonId']))
    if len({item['id'] for item in result}) != len(result):
        raise ValueError('Duplicate form identifier')
    target = ROOT / ('work/forms/forms-preview.json' if args.preview else 'src/data/forms.json')
    target.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n')
    included = {item['id'] for item in result}
    unavailable = []
    for form in rows['pokemon_forms']:
        if form['is_mega'] != '1' or form['is_default'] != '1':
            continue
        record = pokemon[int(form['pokemon_id'])]
        if record['identifier'] in included:
            continue
        unavailable.append({'id': record['identifier'], 'pokemonId': int(record['id']),
                            'speciesId': int(record['species_id']),
                            'reason': 'Only a static model without native animation was found' if record['identifier'] == 'starmie-mega'
                            else 'No matching animated model was found in the inspected pinned HOME and Pokemon-3D-api repositories'})
    coverage = {'catalogue': provenance, 'included': len(result),
                'mega': sum(item['kind'] == 'mega' for item in result),
                'regional': sum(item['kind'] == 'regional' for item in result),
                'withShiny': len(home), 'unavailableMegaForms': unavailable,
                'japaneseTaurosBreedSource': 'https://www.pokemon.co.jp/goods/2023/05/230512_go01.html'}
    (ROOT / 'scripts/data/form-coverage.json').write_text(json.dumps(coverage, ensure_ascii=False, indent=2) + '\n')
    print(f'Generated {len(result)} forms ({coverage["mega"]} Mega, {coverage["regional"]} regional), {len(home)} rare variants; {len(unavailable)} Mega forms unavailable in inspected sources')


if __name__ == '__main__':
    main()
