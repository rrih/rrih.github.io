#!/usr/bin/env python3
"""Compare final HOME form base-color pixels with the pinned source bake.

Lossless WebP images must match alpha and every visible RGB pixel exactly.
WebP may discard RGB beneath alpha zero on transparent materials; those changes
are counted explicitly. Uniform textures folded into glTF
baseColorFactor must produce the same linear color and original alpha factor.
"""
import hashlib
import importlib.util
import io
import json
import pathlib

import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('form_shiny', ROOT / 'scripts/prepare-shiny-home.py')
shiny = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shiny)
home = shiny.home


def main():
    sources = json.loads((ROOT / 'scripts/data/form-sources.json').read_text())['models']
    cache, report = ROOT / 'work/shiny-home/source', []
    for item in sources.values():
        for color, suffix in [('normal', ''), ('rare', '-shiny')]:
            file = ROOT / 'public/models/forms' / f'{item["id"]}{suffix}.glb'
            document, binary = home.read_glb(file)
            comparisons, folded = [], []
            for material in document['materials']:
                original = item[color]['materials'][material['name']]
                if 'map' not in original:
                    continue
                expected = np.asarray(Image.open(io.BytesIO(home.bake_material(original, cache)[0])).convert('RGBA'))
                pbr = material['pbrMetallicRoughness']
                if 'baseColorTexture' in pbr:
                    texture = document['textures'][pbr['baseColorTexture']['index']]
                    index = texture.get('source', texture.get('extensions', {}).get('EXT_texture_webp', {}).get('source'))
                    image = document['images'][index]
                    actual = np.asarray(Image.open(io.BytesIO(shiny.view_bytes(document, binary, image['bufferView']))).convert('RGBA'))
                    hidden_changes = 0
                    equal = np.array_equal(expected, actual)
                    if not equal and actual.shape == expected.shape and material.get('alphaMode') in ('BLEND', 'MASK'):
                        hidden = expected[:, :, 3] == 0
                        equal = np.array_equal(actual[:, :, 3], expected[:, :, 3]) and np.array_equal(actual[~hidden], expected[~hidden])
                        hidden_changes = int(np.count_nonzero(np.any(actual[hidden] != expected[hidden], axis=1)))
                    if not equal:
                        raise ValueError(f'Final source-derived RGBA mismatch: {file.name} {material["name"]}')
                    comparisons.append({'material': material['name'], 'rgbaSha256': hashlib.sha256(actual.tobytes()).hexdigest(),
                                        'transparentPixelsWithDiscardedRgb': hidden_changes})
                else:
                    pixel = expected[0, 0]
                    if not np.all(expected == pixel):
                        raise ValueError(f'Nonuniform source texture disappeared: {file.name} {material["name"]}')
                    srgb = pixel[:3] / 255
                    linear = np.where(srgb <= 0.04045, srgb / 12.92, ((srgb + 0.055) / 1.055) ** 2.4)
                    constant = original.get('colors', {}).get('_ConstantColor0', {})
                    factor = np.array([min(1, max(0, constant.get(c, 1))) for c in 'rgba'], dtype=np.float64)
                    floats = original.get('floats', {})
                    factor[3] *= floats.get('_ConstantAlpha', 1)
                    if floats.get('_BlendMode') == 0:
                        factor[3] = 1
                    factor *= np.r_[linear, pixel[3] / 255]
                    if not np.allclose(factor, pbr.get('baseColorFactor', [1, 1, 1, 1]), rtol=0, atol=1e-6):
                        raise ValueError(f'Folded source color mismatch: {file.name} {material["name"]}')
                    folded.append(material['name'])
            report.append({'file': file.name, 'sourcePixelComparisons': comparisons, 'uniformColorComparisons': folded})
        if len(report) % 40 == 0:
            print(f'Compared final pixels in {len(report)} models', flush=True)
    (ROOT / 'scripts/data/form-material-verification.json').write_text(json.dumps(report, indent=2) + '\n')
    print(f'Verified source-derived final colors in {len(report)} models', flush=True)


if __name__ == '__main__':
    main()
