import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const pkg = resolve(root, process.env.ATLAS_RENDERER_QA || 'work/rust-renderer-qa/pkg')
const { default: init, renderer_environment_snapshot } = await import(pathToFileURL(`${pkg}/atlas_app.js`).href)
await init({ module_or_path: await readFile(`${pkg}/atlas_app_bg.wasm`) })
const fixture = JSON.parse(await readFile(new URL('../test/fixtures/environment-geometry.json', import.meta.url)))
const results = []
for (const record of fixture.records) {
  const actual = renderer_environment_snapshot(record.key, record.time === 'initial' ? undefined : record.time)
  const sha256 = createHash('sha256').update(JSON.stringify(actual)).digest('hex')
  assert.equal(actual.length, record.meshes, `${record.key}/${record.time}: mesh count`)
  assert.equal(sha256, record.sha256, `${record.key}/${record.time}: geometry, normals, colors, indices, instance transforms and shadows must match the original renderer`)
  results.push({ ...record, passed: true })
}
const output = resolve(root, process.env.ATLAS_QA_DIR || 'work/rust-renderer-qa')
await mkdir(output, { recursive: true })
await writeFile(`${output}/geometry.json`, JSON.stringify({ sourceRevision: fixture.sourceRevision, results, passed: true }, null, 2))
console.log(`${results.length} Rust environment snapshots exactly match original geometry and animation hashes.`)
