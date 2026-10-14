import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, siteOrigin } from './helpers.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const build = resolve(root, process.env.ATLAS_RENDERER_BROWSER_QA || 'work/rust-renderer-qa/browser')
const output = resolve(root, process.env.ATLAS_QA_DIR || 'work/rust-renderer-qa/model-bounds')
const sha256 = value => createHash('sha256').update(value).digest('hex')
const fixturePath = resolve(root, 'test/fixtures/model-bounds-oracle.ts')
const fixture = await readFile(fixturePath, 'utf8')
const provenance = JSON.parse(await readFile(resolve(root, 'test/fixtures/model-bounds-oracle.json')))
for (const [name, hash] of Object.entries(provenance.sections)) {
  const start = fixture.indexOf(`// BEGIN baseline ${name}\n`) + `// BEGIN baseline ${name}\n`.length
  const end = fixture.indexOf(`// END baseline ${name}`, start)
  assert.equal(sha256(fixture.slice(start, end)), hash, `Frozen original ${name}`)
}
const preparationStart = fixture.indexOf('function prepareMeasurement(gltf: GLTF) {\n') + 'function prepareMeasurement(gltf: GLTF) {\n'.length
const preparationEnd = fixture.indexOf('\n}\n', preparationStart) + 1
assert.equal(sha256(fixture.slice(preparationStart, preparationEnd)), provenance.preparationSha256, 'Frozen original HOME animation preparation')
await mkdir(output, { recursive: true })
const oracleBundle = resolve(output, 'oracle.js')
const bundledBun = resolve(homedir(), '.bun/bin/bun')
const bundled = spawnSync(existsSync(bundledBun) ? bundledBun : 'bun', [
  'build', fixturePath, '--target', 'browser', '--outfile', oracleBundle,
], { cwd: root, stdio: 'inherit' })
assert.ifError(bundled.error)
assert.equal(bundled.status, 0, 'Bundle the unchanged original Three.js oracle')

const models = JSON.parse(await readFile(resolve(root, 'src/data/models.json')))
const forms = JSON.parse(await readFile(resolve(root, 'src/data/forms.json')))
const mega = forms.find(form => form.id === 'charizard-mega-x')
assert(mega?.model.shiny, 'The sourced Mega form has normal and shiny models')
const cases = [
  { key: '6', model: models[6].url },
  { key: '753', model: models[753].url },
  { key: '6-shiny', model: models[6].shiny },
  { key: 'charizard-mega-x', model: mega.model.url },
  { key: 'charizard-mega-x-shiny', model: mega.model.shiny },
  { key: '94-visibility', model: models[94].url },
  { key: '936-stencil', model: models[936].url },
  { key: '1025-visibility', model: models[1025].url },
  { key: '753-parent-transform', model: models[753].url, parentTransform: true },
  { key: '753-without-clip', model: models[753].url, withoutClip: true },
]
const browser = await chromium.launch({ channel: process.env.CHROME_CHANNEL || 'chrome', headless: true })
const context = await browser.newContext({ serviceWorkers: 'block' })
const prefix = `${siteOrigin}/model-bounds-qa/`
const errors = [], blocked = [], results = []
await context.route('**/*', async route => {
  const url = new URL(route.request().url())
  if (url.origin === siteOrigin || ['blob:', 'data:'].includes(url.protocol)) return route.continue()
  blocked.push(url.origin + url.pathname)
  await route.abort()
})
await context.route(`${prefix}*`, async route => {
  const name = new URL(route.request().url()).pathname.split('/').pop()
  if (!name) return route.fulfill({ contentType: 'text/html', body: `<!doctype html><title>Model bounds oracle</title><script type="module">
import * as qa from './atlas_app.js';
import * as oracle from './oracle.js';
await qa.default({ module_or_path: './atlas_app_bg.wasm' });
window.measurement = { qa, oracle };
</script>` })
  assert(['atlas_app.js', 'atlas_app_bg.wasm', 'oracle.js'].includes(name), 'Known QA module')
  await route.fulfill({
    body: await readFile(name === 'oracle.js' ? oracleBundle : resolve(build, name)),
    contentType: name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript',
  })
})
const page = await context.newPage()
page.on('pageerror', error => errors.push(error.message))
try {
  await page.goto(prefix)
  await page.waitForFunction(() => window.measurement)
  const cdp = await context.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  for (const [index, fixture] of cases.entries()) {
    assert(fixture.model, `Sourced model for ${fixture.key}`)
    const source = await readFile(resolve(root, 'public', fixture.model.replace(/^\/atlas\//, '/').slice(1)))
    const measured = await page.evaluate(async ({ fixture, rustFirst }) => {
      const { qa, oracle } = window.measurement
      const { THREE, GLTFLoader, DRACOLoader, prepareMeasurement, measureMotion, normalizedPoints } = oracle
      if (typeof qa.qa_measure_motion !== 'function') throw new Error('Rebuild the renderer-qa WASM before bounds parity')
      const decoder = new DRACOLoader().setDecoderPath('/atlas/draco/').setWorkerLimit(1)
      const loader = new GLTFLoader().setDRACOLoader(decoder)
      const path = fixture.model.startsWith('/atlas/') ? fixture.model : `/atlas${fixture.model}`
      const response = await fetch(path)
      if (!response.ok) throw new Error(`Model HTTP ${response.status}: ${path}`)
      const bytes = await response.arrayBuffer()
      const sourceSha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('')
      const instances = []
      const pack = values => Array.from(new Uint8Array(values.buffer, values.byteOffset, values.byteLength))
      const run = async rust => {
        // Each side receives independent state decoded from the same original GLB bytes.
        const gltf = await loader.parseAsync(bytes.slice(0), '/atlas/')
        instances.push(gltf.scene)
        prepareMeasurement(gltf)
        if (fixture.parentTransform) {
          const parent = new THREE.Group()
          parent.position.set(2.2, -1.1, 3.7)
          parent.rotation.set(.12, .23, -.34)
          parent.scale.set(1.1, .8, 1.4)
          parent.add(gltf.scene)
          parent.updateMatrixWorld(true)
        }
        const mixer = new THREE.AnimationMixer(gltf.scene)
        const clips = fixture.withoutClip ? [] : gltf.animations.slice(0, 1)
        if (!fixture.withoutClip && !clips.length) throw new Error(`Missing recorded animation: ${fixture.key}`)
        const began = performance.now()
        const measured = rust ? qa.qa_measure_motion(gltf.scene, mixer, clips) : measureMotion(gltf.scene, mixer, clips)
        const measureMs = performance.now() - began
        const bounds = rust ? measured.bounds : new Float64Array([...measured.bounds.min.toArray(), ...measured.bounds.max.toArray()])
        const points = new Float64Array(measured.points)
        if (!points.length || !Array.from(bounds).every(Number.isFinite)) throw new Error(`Empty or nonfinite measurement: ${fixture.key}`)
        const box = new THREE.Box3(new THREE.Vector3().fromArray(bounds), new THREE.Vector3().fromArray(bounds, 3))
        const size = box.getSize(new THREE.Vector3())
        const center = box.getCenter(new THREE.Vector3())
        const scale = 3 / Math.max(size.x, size.y, size.z)
        const normalization = new THREE.Group()
        normalization.scale.setScalar(scale)
        normalization.position.set(-center.x * scale, -bounds[1] * scale, -center.z * scale)
        const normalized = rust ? qa.qa_normalized_points(points, normalization) : normalizedPoints(Array.from(points), normalization)
        mixer.stopAllAction()
        mixer.uncacheRoot(gltf.scene)
        return {
          bounds: pack(bounds), points: pack(points), normalized: pack(new Float64Array(normalized)),
          transform: pack(new Float64Array([...normalization.position.toArray(), ...normalization.scale.toArray()])),
          measureMs, pointCount: points.length / 3,
          durations: clips.map(clip => clip.duration),
        }
      }
      try {
        // Alternate order so one side is not always the first to warm the JS methods.
        if (rustFirst) { const rust = await run(true); return { sourceSha256, rust, original: await run(false) } }
        const original = await run(false); return { sourceSha256, original, rust: await run(true) }
      } finally {
        decoder.dispose()
        for (const scene of instances) scene.traverse(object => {
          object.geometry?.dispose()
          object.skeleton?.dispose()
          for (const material of [object.material].flat().filter(Boolean)) {
            for (const texture of Object.values(material)) if (texture?.isTexture) {
              texture.source?.data?.close?.()
              texture.dispose()
            }
            material.dispose()
          }
        })
      }
    }, { fixture, rustFirst: index % 2 === 1 })
    assert.equal(measured.sourceSha256, sha256(source), `${fixture.key}: the browser received the exact sourced GLB`)
    const comparison = Object.fromEntries(['bounds', 'points', 'normalized', 'transform'].map(key => [key, {
      originalSha256: sha256(Buffer.from(measured.original[key])),
      rustSha256: sha256(Buffer.from(measured.rust[key])),
      bytes: measured.original[key].length,
    }]))
    const record = {
      key: fixture.key, model: fixture.model, sourceSha256: sha256(source), comparison,
      originalMs: measured.original.measureMs, rustMs: measured.rust.measureMs,
      pointCount: measured.original.pointCount, durations: measured.original.durations,
      rustFirst: index % 2 === 1,
    }
    results.push(record)
    await writeFile(resolve(output, `${fixture.key}.json`), JSON.stringify(record, null, 2))
    for (const key of Object.keys(comparison)) {
      assert.deepEqual(measured.rust[key], measured.original[key], `${fixture.key}: exact ${key} bytes, including signed zero`)
    }
    assert.deepEqual(measured.rust.durations, measured.original.durations)
    console.log(`PASS ${fixture.key}: bounds, points and normalization exactly match; JS ${record.originalMs.toFixed(1)} ms / Rust ${record.rustMs.toFixed(1)} ms`)
  }
  assert.deepEqual(errors, [])
  assert.deepEqual(blocked, [])
  await writeFile(resolve(output, 'results.json'), JSON.stringify({
    passed: true, provenance, browser: browser.version(), cpuSlowdown: 4,
    performanceNote: 'Per-measurement diagnostics; full cold-load readiness is measured separately.',
    errors, blocked, results,
  }, null, 2))
} catch (error) {
  await writeFile(resolve(output, 'failure.json'), JSON.stringify({ error: String(error), stack: error.stack, errors, blocked, results }, null, 2))
  throw error
} finally {
  await browser.close()
}
