#!/usr/bin/env python3
"""Build verified HOME forms, retaining the same native rig and idle in both colors.

Run normal, then optimize-home-models.mjs on work/forms/normal, then rare and
publish. Existing public/models/home and shiny-home files are never opened for
writing. The rare stage preserves the optimized normal geometry bytes exactly.
"""
import argparse
import hashlib
import importlib.util
import json
import pathlib
import shutil
import tempfile
import types

ROOT = pathlib.Path(__file__).resolve().parents[1]


def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / filename)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


shiny = module('forms_shiny', 'prepare-shiny-home.py')
home = shiny.home
animation = module('forms_animation', 'prepare-home-animations.py')


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify_sources(identifier, item, args):
    files = {args.work / 'geometry' / f'{identifier}.glb': item['sourceHashes']['geometry'],
             args.work / 'animations' / f'{identifier}.anim': item['sourceHashes']['animation']}
    for key in ('normalPrefab', 'rarePrefab', 'animation'):
        files[args.cache / item[key]] = item['sourceHashes'][key]
    for material in item['materialSources'].values():
        for color in ('normal', 'rare'):
            files[args.cache / material[color + 'Path']] = material[color + 'Sha256']
    for color in ('normal', 'rare'):
        for material in item[color]['materials'].values():
            for texture in material.values():
                if isinstance(texture, dict) and 'path' in texture:
                    files[args.cache / texture['path']] = texture['sha256']
    for path, expected in files.items():
        if digest(path) != expected:
            raise ValueError(f'Pinned form source changed: {path}')


def build_normal(identifier, item, args):
    source = item['normal']
    options = types.SimpleNamespace(cache=args.cache, geometry_cache=args.work / 'geometry',
                                    output=args.work / 'normal')
    options.output.mkdir(parents=True, exist_ok=True)
    audit = home.build_one(identifier, source, options)
    destination = options.output / f'{identifier}.glb'
    document, binary = home.read_glb(destination)
    # Like the already verified Gen 9 surfaces, these Hisuian surfaces export
    # auxiliary vertex masks. Red-only or cyan mask channels are not albedo;
    # preserve the actual color maps without multiplying those masks into them.
    # Galarian Weezing's distinct SmokeMask billboard attributes are retained.
    mask_counts = {'typhlosion-hisui': 5, 'zorua-hisui': 5,
                   'zoroark-hisui': 6, 'braviary-hisui': 4}
    removed = 0
    if item['id'] in mask_counts:
        for mesh in document['meshes']:
            for primitive in mesh['primitives']:
                if 'COLOR_0' not in primitive['attributes']:
                    continue
                name = document['materials'][primitive['material']]['name']
                if 'map' not in source['materials'][name] or 'Mask' in name:
                    raise ValueError(f'Unexpected auxiliary vertex-mask material: {name}')
                primitive['attributes'].pop('COLOR_0')
                removed += 1
        if removed != mask_counts[item['id']]:
            raise ValueError(f'Unexpected auxiliary vertex-mask count: {item["id"]}')
        home.write_glb(destination, document, binary)
    audit['ignoredVertexColorPrimitives'] = removed
    audit['sourcePixelComparisons'] = shiny.verify_pixels(document, binary, source, args.cache)
    clip = animation.parse_clip(identifier, args.work / 'animations' / f'{identifier}.anim')
    audit['animation'] = animation.embed(identifier, clip, options.output)
    if audit['animation'].get('skippedBonePaths'):
        raise ValueError(f'Unmapped native animation bones: {identifier}')
    audit.update(formId=item['id'], sha256=digest(destination), bytes=destination.stat().st_size)
    return audit


def build_rare(identifier, item, args):
    normal = args.work / 'normal' / f'{identifier}.glb'
    document, binary = home.read_glb(normal)
    if len(document.get('animations', [])) != 1 or document['animations'][0]['name'] != 'HOME Idle':
        raise ValueError(f'Expected original HOME idle: {identifier}')
    signature = shiny.geometry_signature(document, binary)
    normal_hash = digest(normal)
    source = dict(item['rare'], bindings=item['bindings'])
    shiny.restore_bindings(document, source)
    output = args.work / 'rare'
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=args.work, prefix='form-rare-input-') as temporary:
        geometry = pathlib.Path(temporary)
        home.write_glb(geometry / f'{identifier}.glb', document, binary)
        options = types.SimpleNamespace(cache=args.cache, geometry_cache=geometry,
                                        output=output, preserve_geometry=True)
        audit = home.build_one(identifier, source, options)
    destination = output / f'{identifier}.glb'
    document, binary = home.read_glb(destination)
    document, binary = shiny.compact(document, binary)
    if shiny.geometry_signature(document, binary) != signature:
        raise ValueError(f'Rare geometry, rig, visibility or animation changed: {identifier}')
    audit['sourcePixelComparisons'] = shiny.verify_pixels(document, binary, source, args.cache)
    home.write_glb(destination, document, binary)
    final, final_binary = home.read_glb(destination)
    if shiny.geometry_signature(final, final_binary) != signature or digest(normal) != normal_hash:
        raise ValueError(f'Serialized rare geometry or normal source changed: {identifier}')
    audit.update(formId=item['id'], sha256=digest(destination), bytes=destination.stat().st_size,
                 normalSha256=normal_hash, geometryAndAnimationUnchanged=True)
    return audit


def publish(identifier, item, args):
    output = ROOT / 'public/models/forms'
    output.mkdir(parents=True, exist_ok=True)
    result = {'id': item['id'], 'pokemonId': int(identifier)}
    for color, suffix in [('normal', ''), ('rare', '-shiny')]:
        source = args.work / color / f'{identifier}.glb'
        document, binary = home.read_glb(source)
        if len(document.get('animations', [])) != 1 or not document['animations'][0].get('channels'):
            raise ValueError(f'Missing native form idle: {identifier} {color}')
        name = f'{item["id"]}{suffix}.glb'
        destination = output / name
        shutil.copyfile(source, destination)
        if digest(destination) != digest(source):
            raise ValueError(f'Publication copy changed: {name}')
        result[color] = {'url': f'/models/forms/{name}', 'bytes': destination.stat().st_size,
                         'sha256': digest(destination)}
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('stage', choices=['normal', 'rare', 'publish'])
    parser.add_argument('--cache', type=pathlib.Path, default=ROOT / 'work/shiny-home/source')
    parser.add_argument('--work', type=pathlib.Path, default=ROOT / 'work/forms')
    parser.add_argument('--ids', nargs='*')
    args = parser.parse_args()
    sources = json.loads((ROOT / 'scripts/data/form-sources.json').read_text())
    for key in ('geometryRepository', 'geometryRevision', 'textureRepository', 'textureRevision'):
        if sources[key] != home.SOURCES[key]:
            raise ValueError(f'Form and tested HOME source revision mismatch: {key}')
    reports = []
    for identifier, item in sources['models'].items():
        if args.ids and identifier not in args.ids and item['id'] not in args.ids:
            continue
        verify_sources(identifier, item, args)
        report = {'normal': build_normal, 'rare': build_rare, 'publish': publish}[args.stage](identifier, item, args)
        reports.append(report)
        print(f'Prepared {args.stage} {item["id"]}: {len(reports)}', flush=True)
    target = ROOT / f'scripts/data/form-home-{args.stage}-audit.json'
    previous = json.loads(target.read_text()) if args.ids and target.exists() else []
    combined = {item.get('formId', item['id']): item for item in previous}
    combined.update({item.get('formId', item['id']): item for item in reports})
    target.write_text(json.dumps(list(combined.values()), indent=2) + '\n')
    print(f'Completed {args.stage}: {len(reports)} forms', flush=True)


if __name__ == '__main__':
    main()
