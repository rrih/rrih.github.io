// Build orchestration only. The inspection/preview exports live in Rust and are
// excluded from the production application by the renderer-qa Cargo feature.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const output = resolve(root, 'atlas/work/rust-renderer-qa')
const tool = (directory, name) => {
  const candidate = resolve(homedir(), directory, name)
  return existsSync(candidate) ? candidate : name
}
function run(program, args) {
  const result = spawnSync(program, args, { cwd: root, stdio: 'inherit' })
  assert.ifError(result.error)
  assert.equal(result.status, 0, `${program} failed`)
}
mkdirSync(resolve(output, 'browser'), { recursive: true })
run(tool('.cargo/bin', 'cargo'), ['build', '--locked', '-p', 'atlas-app', '--target', 'wasm32-unknown-unknown', '--release', '--features', 'renderer-qa'])
run(tool('.cargo/bin', 'wasm-bindgen'), ['target/wasm32-unknown-unknown/release/atlas_app.wasm', '--target', 'web', '--out-dir', resolve(output, 'pkg'), '--out-name', 'atlas_app', '--no-typescript'])
run(tool('.bun/bin', 'bun'), ['build', resolve(output, 'pkg/atlas_app.js'), '--target', 'browser', '--outdir', resolve(output, 'browser')])
copyFileSync(resolve(output, 'pkg/atlas_app_bg.wasm'), resolve(output, 'browser/atlas_app_bg.wasm'))
