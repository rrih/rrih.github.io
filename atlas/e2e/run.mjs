import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const suites = [
  'migration', 'migration-pwa', 'performance-regressions', 'verify', 'unavailable',
  'localization-failures', 'localization', 'studio', 'studio-storage',
  'expansion', 'expansion-regressions', 'storage-persistence',
  'pwa', 'localization-pwa', 'cache-retention', 'cache-update',
  'advertising', 'privacy', 'advertising-google',
]
const requested = process.argv.slice(2)
if (requested.includes('--list')) { console.log(suites.join('\n')); process.exit(0) }
const selected = requested.length ? requested : suites
for (const name of selected) if (!suites.includes(name)) throw new Error(`Unknown suite ${name}`)
const cwd = fileURLToPath(new URL('../', import.meta.url))
const output = resolve(process.env.ATLAS_QA_DIR || fileURLToPath(new URL('../../work/atlas-migration/regression/', import.meta.url)))
await mkdir(output, { recursive: true })
const results = []
for (const name of selected) {
  const started = Date.now()
  console.log(`Starting ${name} (${results.length + 1}/${selected.length}); one browser process at a time.`)
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [`e2e/${name}.mjs`, ...(name === 'advertising-google' ? ['--run'] : [])], { cwd, stdio: 'inherit', env: { ...process.env, ATLAS_QA_DIR: `${output}/${name}` } })
    child.once('error', reject)
    child.once('exit', code => resolve(code ?? 1))
  })
  results.push({ name, code, elapsedMs: Date.now() - started })
  await writeFile(`${output}/suites.json`, JSON.stringify({ selected, results, complete: results.length === selected.length && code === 0 }, null, 2))
  if (code !== 0) process.exit(code)
}
console.log(`${results.length} suites passed. Evidence: ${output}`)
