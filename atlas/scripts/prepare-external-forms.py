#!/usr/bin/env python3
"""Keep an actual sourced Mega idle, geometry and materials; discard other clips.

This performs lossless buffer/accessor compaction. It does not retarget bones,
change the clip name, modify colors, or recompress Draco geometry.
"""
import copy
import hashlib
import importlib.util
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]

def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / filename)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result

home = module('home_texture', 'prepare-home-textures.py')
source = module('form_source', 'prepare-form-sources.py')
SIZES = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}
COMPONENTS = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def view_data(document, binary, index):
    view = document['bufferViews'][index]
    if view.get('buffer', 0) != 0:
        raise ValueError('External buffer is unsupported')
    start, size = view.get('byteOffset', 0), view['byteLength']
    if start + size > len(binary):
        raise ValueError('Buffer view is out of bounds')
    return memoryview(binary)[start:start + size]


def accessor_data(document, binary, index):
    accessor = document['accessors'][index]
    if 'sparse' in accessor:
        raise ValueError('Sparse source accessor needs explicit handling')
    if 'bufferView' not in accessor:
        return None
    view = document['bufferViews'][accessor['bufferView']]
    data = view_data(document, binary, accessor['bufferView'])
    size = SIZES[accessor['componentType']] * COMPONENTS[accessor['type']]
    stride, start = view.get('byteStride', size), accessor.get('byteOffset', 0)
    stop = start + (accessor['count'] - 1) * stride + size
    if stop > len(data):
        raise ValueError('Accessor is out of bounds')
    if stride == size:
        return bytes(data[start:start + accessor['count'] * size])
    return b''.join(data[start + i * stride:start + i * stride + size] for i in range(accessor['count']))


def map_accessors(document, convert):
    for mesh in document['meshes']:
        for primitive in mesh['primitives']:
            for key in primitive['attributes']:
                primitive['attributes'][key] = convert(primitive['attributes'][key])
            if 'indices' in primitive:
                primitive['indices'] = convert(primitive['indices'])
            for target in primitive.get('targets', []):
                for key in target:
                    target[key] = convert(target[key])
    for skin in document.get('skins', []):
        if 'inverseBindMatrices' in skin:
            skin['inverseBindMatrices'] = convert(skin['inverseBindMatrices'])
    for animation in document['animations']:
        for sampler in animation['samplers']:
            for key in ('input', 'output'):
                sampler[key] = convert(sampler[key])


def signature(document, binary):
    result = copy.deepcopy(document)
    used, signatures = set(), {}
    map_accessors(copy.deepcopy(result), lambda index: used.add(index))
    for index in sorted(used):
        accessor = document['accessors'][index]
        value = {k: v for k, v in accessor.items() if k not in ('bufferView', 'byteOffset')}
        data = accessor_data(document, binary, index)
        if data is not None:
            value['dataSha256'] = sha(data)
        signatures[index] = value
    map_accessors(result, lambda index: signatures[index])
    for mesh in result['meshes']:
        for primitive in mesh['primitives']:
            draco = primitive.get('extensions', {}).get('KHR_draco_mesh_compression')
            if draco:
                draco['bufferView'] = sha(view_data(document, binary, draco['bufferView']))
    for image in result.get('images', []):
        if 'bufferView' in image:
            image['bufferView'] = sha(view_data(document, binary, image['bufferView']))
        elif 'uri' in image:
            raise ValueError('Unbundled source texture')
    for key in ('accessors', 'bufferViews', 'buffers'):
        result.pop(key, None)
    return result


def compact(document, binary):
    result = copy.deepcopy(document)
    used = set()
    map_accessors(copy.deepcopy(result), lambda index: used.add(index))
    output, views, accessors, mapping, dedup = bytearray(), [], [], {}, {}

    def append(data, target=None):
        key = (sha(data), target)
        if key in dedup:
            return dedup[key]
        output.extend(b'\0' * (-len(output) % 4))
        view = {'buffer': 0, 'byteOffset': len(output), 'byteLength': len(data)}
        if target is not None:
            view['target'] = target
        index = len(views)
        views.append(view)
        output.extend(data)
        dedup[key] = index
        return index

    for index in sorted(used):
        accessor = copy.deepcopy(document['accessors'][index])
        data = accessor_data(document, binary, index)
        if data is not None:
            view = document['bufferViews'][accessor['bufferView']]
            accessor['bufferView'] = append(data, view.get('target'))
            accessor.pop('byteOffset', None)
        mapping[index] = len(accessors)
        accessors.append(accessor)
    map_accessors(result, lambda index: mapping[index])
    for mesh in result['meshes']:
        for primitive in mesh['primitives']:
            draco = primitive.get('extensions', {}).get('KHR_draco_mesh_compression')
            if draco:
                draco['bufferView'] = append(view_data(document, binary, draco['bufferView']))
    for image in result.get('images', []):
        image['bufferView'] = append(view_data(document, binary, image['bufferView']))
    result['accessors'], result['bufferViews'], result['buffers'] = accessors, views, [{'byteLength': len(output)}]
    return result, output


def main():
    inventory = json.loads((ROOT / 'scripts/data/form-external-sources.json').read_text())
    output = ROOT / 'public/models/forms'
    output.mkdir(parents=True, exist_ok=True)
    report = []
    for item in inventory:
        path = source.download(item['repository'], item['revision'], item['path'],
                               ROOT / 'work/forms/external' / f'{item["id"]}.glb', item['gitBlobSha1'])
        document, binary = home.read_glb(path)
        clip = document['animations'][item['animationIndex']]
        if clip['name'] != item['animationName'] or not clip['channels']:
            raise ValueError(f'Source idle changed: {item["id"]}')
        original_count = len(document['animations'])
        document['animations'] = [clip]
        expected = signature(document, binary)
        document, binary = compact(document, binary)
        if signature(document, binary) != expected:
            raise ValueError(f'Compaction changed source data: {item["id"]}')
        destination = output / f'{item["id"]}.glb'
        home.write_glb(destination, document, binary)
        final, final_binary = home.read_glb(destination)
        if signature(final, final_binary) != expected:
            raise ValueError(f'Serialized form changed source data: {item["id"]}')
        report.append({'id': item['id'], 'sourceSha256': sha(path.read_bytes()),
                       'sha256': sha(destination.read_bytes()), 'before': path.stat().st_size,
                       'bytes': destination.stat().st_size, 'sourceClips': original_count,
                       'retainedClip': clip['name'], 'geometryMaterialsAndIdleUnchanged': True})
        print(f'Prepared {item["id"]}: {destination.stat().st_size:,} bytes; exact source idle', flush=True)
    (ROOT / 'scripts/data/form-external-audit.json').write_text(json.dumps(report, indent=2) + '\n')


if __name__ == '__main__':
    main()
