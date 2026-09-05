#!/usr/bin/env python3
"""Resolve exact normal/rare HOME form assets from pinned prefab material GUIDs."""
import argparse
import concurrent.futures
import hashlib
import importlib.util
import json
import os
import pathlib
import re
import ssl
import struct
import time
import urllib.parse
import urllib.request

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = json.loads((ROOT / 'scripts/data/home-sources.json').read_text())
SPEC = importlib.util.spec_from_file_location('home_sources', ROOT / 'scripts/prepare-home-sources.py')
HELPER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(HELPER)
CA = os.environ.get('SSL_CERT_FILE', '/etc/ssl/cert.pem')
CONTEXT = ssl.create_default_context(cafile=CA if pathlib.Path(CA).exists() else None)


def request(url):
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'pokemon-atlas-assets'}),
                                        context=CONTEXT, timeout=90) as response:
                return response.read()
        except Exception:
            if attempt == 3:
                raise
            time.sleep(attempt + 1)


def blob_sha(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()


def get_tree(repository, revision, cache, recursive=True):
    if cache.exists():
        result = json.loads(cache.read_text())
    else:
        suffix = '?recursive=1' if recursive else ''
        result = json.loads(request(f'https://api.github.com/repos/{repository}/git/trees/{revision}{suffix}'))
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_text(json.dumps(result))
    if result.get('truncated'):
        raise ValueError(f'Truncated source tree: {repository}')
    return result['tree']


def download(repository, revision, remote, destination, expected):
    if destination.exists() and blob_sha(destination.read_bytes()) == expected:
        return destination
    data = request(f'https://raw.githubusercontent.com/{repository}/{revision}/' + urllib.parse.quote(remote))
    if blob_sha(data) != expected:
        raise ValueError(f'Pinned source blob changed: {remote}')
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(destination.name + '.form-source-part')
    temporary.write_bytes(data)
    temporary.replace(destination)
    return destination


def prefab(raw):
    chunks = re.split(r'^--- !u!(\d+) &(-?\d+)[^\n]*\n', raw, flags=re.M)
    objects, renderers = {}, []
    for index in range(1, len(chunks), 3):
        type_id, file_id, body = chunks[index:index + 3]
        if type_id == '1':
            name = re.search(r'^  m_Name: (.*)$', body, re.M)[1]
            objects[file_id] = json.loads(name) if name.startswith('"') else name
        if type_id in ('137', '23'):
            game = re.search(r'^  m_GameObject: \{fileID: (-?\d+)', body, re.M)[1]
            section = re.search(r'^  m_Materials:\n((?:  - .*\n)+)', body, re.M)
            if not section:
                raise ValueError('Renderer without material slots')
            guids = re.findall(r'guid: ([a-f0-9]{32})', section[1])
            if len(guids) != section[1].count('  - '):
                raise ValueError('Unresolved prefab material slot')
            mesh = re.search(r'^  m_Mesh: (.*)$', body, re.M)
            renderers.append((game, {'materials': guids, 'mesh': mesh[1] if mesh else None}))
    result = {}
    for game, renderer in renderers:
        name = objects[game]
        if name in result:
            raise ValueError(f'Duplicate renderer: {name}')
        result[name] = renderer
    return result


def transform_hierarchy(raw):
    """Compare every source normal/rare local transform and parent by name."""
    chunks = re.split(r'^--- !u!(\d+) &(-?\d+)[^\n]*\n', raw, flags=re.M)
    names, transforms = {}, {}
    for index in range(1, len(chunks), 3):
        type_id, file_id, body = chunks[index:index + 3]
        if type_id == '1':
            names[file_id] = re.search(r'^  m_Name: (.*)$', body, re.M)[1].removesuffix('_rare')
        if type_id == '4':
            transforms[file_id] = body
    result = []
    for body in transforms.values():
        game = re.search(r'^  m_GameObject: \{fileID: (-?\d+)', body, re.M)[1]
        parent = re.search(r'^  m_Father: \{fileID: (-?\d+)', body, re.M)[1]
        parent_game = re.search(r'^  m_GameObject: \{fileID: (-?\d+)', transforms[parent], re.M)[1] if parent != '0' else None
        local = {key: re.search(r'^  ' + key + r': (.*)$', body, re.M)[1]
                 for key in ('m_LocalRotation', 'm_LocalPosition', 'm_LocalScale')}
        result.append((names[game], names[parent_game] if parent_game else None, local))
    return sorted(result, key=json.dumps)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', type=pathlib.Path, default=ROOT / 'work/shiny-home/source')
    parser.add_argument('--work', type=pathlib.Path, default=ROOT / 'work/forms')
    parser.add_argument('--workers', type=int, default=8)
    args = parser.parse_args()
    args.work.mkdir(parents=True, exist_ok=True)
    inventory = json.loads((ROOT / 'scripts/data/form-inventory.json').read_text())
    geometry_entries = get_tree(BASE['geometryRepository'], BASE['geometryRevision'], args.work / 'geometry-tree.json')
    if (args.work / 'unity-tree.json').exists():
        entries = json.loads((args.work / 'unity-tree.json').read_text())['tree']
    else:
        roots = get_tree(BASE['textureRepository'], BASE['textureRevision'], args.work / 'unity-root.json', False)
        entries = []
        projects = {item['project'] for item in inventory} | {'MitakeCommon'}
        for entry in roots:
            if entry['type'] != 'tree' or entry['path'] not in projects:
                continue
            sub = get_tree(BASE['textureRepository'], entry['sha'], args.work / f'tree-{entry["path"]}.json')
            entries.extend(dict(item, path=entry['path'] + '/' + item['path']) for item in sub)
        (args.work / 'unity-tree.json').write_text(json.dumps({'tree': entries}))
    tree = {entry['path']: entry['sha'] for entry in entries if entry['type'] == 'blob'}
    geometry_tree = {entry['path']: entry['sha'] for entry in geometry_entries if entry['type'] == 'blob'}
    geometry = {}

    def get_geometry(item):
        path = download(BASE['geometryRepository'], BASE['geometryRevision'], item['geometry'],
                        args.work / 'geometry' / f'{item["pokemonId"]}.glb', geometry_tree[item['geometry']])
        data = path.read_bytes()
        document = json.loads(data[20:20 + struct.unpack_from('<I', data, 12)[0]])
        return item['pokemonId'], document

    def get(remote):
        return download(BASE['textureRepository'], BASE['textureRevision'], remote, args.cache / remote, tree[remote])

    def acquire(paths, label):
        selected = sorted(set(paths))
        print(f'Acquiring {len(selected)} {label}', flush=True)
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
            for count, _ in enumerate(pool.map(get, selected), 1):
                if count % 250 == 0:
                    print(f'{label}: {count}/{len(selected)}', flush=True)
        return selected

    with concurrent.futures.ThreadPoolExecutor(max_workers=min(6, args.workers)) as pool:
        geometry.update(pool.map(get_geometry, inventory))
    print(f'Acquired {len(geometry)} exact form geometries', flush=True)
    names_by_project = {}
    for item in inventory:
        names_by_project.setdefault(item['project'], set()).update(m['name'] for m in geometry[item['pokemonId']]['materials'])
    mat_meta_paths = [path for path in tree if path.endswith('.mat.meta') and '/Material/' in path and
                      path.split('/')[0] in names_by_project and
                      any(pathlib.PurePosixPath(path).name.startswith(name) for name in names_by_project[path.split('/')[0]])]
    acquire(mat_meta_paths + [item[key] for item in inventory for key in ('normalPrefab', 'rarePrefab', 'animation')],
            'prefabs, material metadata and native idles')
    guid_paths = {}
    for remote in mat_meta_paths:
        guid = re.search(r'^guid: ([a-f0-9]{32})$', (args.cache / remote).read_text(), re.M)[1]
        guid_paths[(remote.split('/')[0], guid)] = remote[:-5]
    models, prefab_audit = {}, []
    required_materials = set()
    for item in inventory:
        normal_raw, rare_raw = ((args.cache / item[key]).read_text() for key in ('normalPrefab', 'rarePrefab'))
        hierarchy = transform_hierarchy(normal_raw)
        if hierarchy != transform_hierarchy(rare_raw):
            raise ValueError(f'Normal/rare source transform hierarchy differs: {item["id"]}')
        regular, rare = prefab(normal_raw), prefab(rare_raw)
        document = geometry[item['pokemonId']]
        bindings, materials = {}, {}
        for mesh in document['meshes']:
            name = mesh['name']
            a, b = regular[name], rare[name]
            if a['mesh'] != b['mesh'] or len(a['materials']) != len(b['materials']) or len(a['materials']) != len(mesh['primitives']):
                raise ValueError(f'Normal/rare form mesh or slots differ: {item["id"]} {name}')
            bindings[name] = []
            for slot, primitive in enumerate(mesh['primitives']):
                name = document['materials'][primitive['material']]['name']
                binding = {'normalGuid': a['materials'][slot], 'rareGuid': b['materials'][slot]}
                for color in ('normal', 'rare'):
                    binding[color + 'Path'] = guid_paths[(item['project'], binding[color + 'Guid'])]
                    required_materials.add(binding[color + 'Path'])
                if name in materials and materials[name] != binding:
                    raise ValueError(f'Ambiguous material: {item["id"]} {name}')
                materials[name] = binding
                bindings[mesh['name']].append(name)
        animation_file = args.work / 'animations' / f'{item["pokemonId"]}.anim'
        animation_file.parent.mkdir(parents=True, exist_ok=True)
        animation_file.write_bytes((args.cache / item['animation']).read_bytes())
        models[str(item['pokemonId'])] = dict(item, bindings=bindings, materialSources=materials)
        prefab_audit.append({'id': item['id'], 'transforms': len(hierarchy),
                             'transformHierarchySha256': hashlib.sha256(json.dumps(hierarchy, separators=(',', ':')).encode()).hexdigest(),
                             'normalAndRareTransformsIdentical': True,
                             'rendererMaterialSlots': sum(len(value) for value in bindings.values())})
    acquire(required_materials, 'exact normal and rare materials')
    # Include every texture from the actual referenced material model prefixes,
    # plus common shared shader maps. Unresolved GUIDs stop preparation.
    prefixes_by_project = {project: {name.split('-')[0] for name in names} for project, names in names_by_project.items()}
    meta_paths = [path for path in tree if path.endswith('.png.meta') and
                  (path.startswith('MitakeCommon/') or (path.split('/')[0] in prefixes_by_project and
                   any('/' + prefix + '/' in path for prefix in prefixes_by_project[path.split('/')[0]])))]
    acquire(meta_paths, 'texture GUID metadata')
    textures = {}
    for remote in meta_paths:
        raw = (args.cache / remote).read_text()
        guid = re.search(r'^guid: ([a-f0-9]{32})$', raw, re.M)[1]
        record = {'path': remote[:-5], 'guid': guid,
                  'wrap': [int(re.search(r'wrap' + axis + r': (\d+)', raw)[1]) for axis in 'UV']}
        textures[(remote.split('/')[0], guid)] = record
        if remote.startswith('MitakeCommon/'):
            textures[('*', guid)] = record
    unresolved = []
    required_textures = set()
    for item in models.values():
        for color in ('normal', 'rare'):
            parsed = {}
            for name, pair in item['materialSources'].items():
                remote = pair[color + 'Path']
                raw = (args.cache / remote).read_bytes()
                source = yaml.load('\n'.join(raw.decode().splitlines()[3:]), Loader=yaml.CSafeLoader)['Material']
                if source['m_Name'] != name + ('_rare' if color == 'rare' else ''):
                    raise ValueError(f'Material name mismatch: {remote}')
                props = source['m_SavedProperties']
                record = {}
                for field, key in (('_Col0Tex', 'map'), ('_MainTex', 'map'), ('_L1Col0Tex', 'layer'),
                                   ('_EmissionMaskTex', 'emissiveMap'), ('_Blend0Tex', 'blend0'), ('_Blend1Tex', 'blend1'),
                                   ('_LerpTex', 'lerp'), ('_Mask0Tex', 'mask0'), ('_Mask1Tex', 'mask1')):
                    texture = props.get('m_TexEnvs', {}).get(field)
                    guid = texture.get('m_Texture', {}).get('guid') if texture else None
                    if not guid:
                        continue
                    found = textures.get((item['project'], guid), textures.get(('*', guid)))
                    if found is None:
                        unresolved.append([item['id'], remote, field, guid])
                        continue
                    record[key] = dict(found, repeat=[texture['m_Scale'][axis] for axis in 'xy'],
                                       offset=[texture['m_Offset'][axis] for axis in 'xy'])
                    required_textures.add(record[key]['path'])
                record['floats'] = {key: value for key, value in props.get('m_Floats', {}).items() if key in HELPER.FLOATS}
                record['colors'] = {key: value for key, value in props.get('m_Colors', {}).items() if key in HELPER.COLORS}
                parsed[name] = record
                pair[color + 'Sha256'] = hashlib.sha256(raw).hexdigest()
            item[color] = {'geometry': item['geometry'], 'materials': parsed}
    (args.work / 'unresolved-source-textures.json').write_text(json.dumps(unresolved, indent=2))
    if unresolved:
        raise ValueError(f'{len(unresolved)} unresolved texture GUIDs; see work/forms/unresolved-source-textures.json')
    acquire(required_textures, 'source texture images')
    for item in models.values():
        for color in ('normal', 'rare'):
            for material in item[color]['materials'].values():
                for texture in material.values():
                    if isinstance(texture, dict) and 'path' in texture:
                        texture['sha256'] = hashlib.sha256((args.cache / texture['path']).read_bytes()).hexdigest()
        item['sourceHashes'] = {key: hashlib.sha256((args.cache / item[key]).read_bytes()).hexdigest()
                                for key in ('normalPrefab', 'rarePrefab', 'animation')}
        item['sourceHashes']['geometry'] = hashlib.sha256((args.work / 'geometry' / f'{item["pokemonId"]}.glb').read_bytes()).hexdigest()
    result = {key: value for key, value in BASE.items() if key != 'models'}
    result['models'] = models
    (ROOT / 'scripts/data/form-sources.json').write_text(json.dumps(result, separators=(',', ':')) + '\n')
    (ROOT / 'scripts/data/form-prefab-verification.json').write_text(json.dumps(prefab_audit, indent=2) + '\n')
    print(f'Resolved {len(models)} forms, both colors, exact geometry and original native idles', flush=True)


if __name__ == '__main__':
    main()
