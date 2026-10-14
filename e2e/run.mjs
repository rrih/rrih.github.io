import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const dist = resolve(root, process.env.SITE_E2E_DIST || 'site-dist')
const output = resolve(root, process.env.SITE_E2E_OUTPUT || 'work/rust-migration/e2e')
const suites = process.argv.slice(2)
if (!suites.length) suites.push('profile', 'atlas')
for (const suite of suites) {
  if (!['profile', 'atlas', 'pictulane', 'google', 'upgrade'].includes(suite)) {
    throw new Error(`Unknown suite ${suite}. Choose profile, atlas, pictulane, google or upgrade.`)
  }
}
const atlasSuites = [
  'migration', 'migration-pwa', 'performance-regressions', 'verify', 'unavailable',
  'localization-failures', 'localization', 'studio', 'studio-storage', 'ui-state',
  'expansion', 'expansion-regressions', 'scene-sharing', 'storage-persistence',
  'pwa', 'localization-pwa', 'cache-retention', 'cache-update', 'http-cache', 'advertising',
]
const contentTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm',
  '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary', '.woff2': 'font/woff2', '.txt': 'text/plain',
}
await mkdir(output, { recursive: true })
if (suites.some(suite => suite !== 'pictulane')) {
  await access(resolve(dist, 'index.html'))
  await access(resolve(dist, 'atlas/index.html'))
  await access(resolve(dist, 'tools/pictulane/index.html'))
  if (await access(resolve(dist, 'tools/pictulane/TEST-ONLY')).then(() => true, () => false)) {
    throw new Error('The assembled site must use the production Pictulane build.')
  }
}
if (suites.includes('pictulane')) {
  await access(resolve(root, 'tools/pictulane/dist/TEST-ONLY')).catch(() => {
    throw new Error('Pictulane E2E requires its independent build:test output; never compose this fixture build.')
  })
}

// Match Pages directory URLs and true 404s; never use an SPA fallback in QA.
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1')
    const pathname = decodeURIComponent(url.pathname)
    let file = resolve(dist, `.${pathname}`)
    if (file !== dist && !file.startsWith(`${dist}${sep}`)) {
      response.writeHead(403).end('Forbidden')
      return
    }
    let info = await stat(file).catch(() => null)
    if (info?.isDirectory()) {
      if (!url.pathname.endsWith('/')) {
        response.writeHead(301, { Location: `${url.pathname}/${url.search}` }).end()
        return
      }
      file = resolve(file, 'index.html')
      info = await stat(file).catch(() => null)
    }
    const found = info?.isFile()
    const body = await readFile(found ? file : resolve(dist, '404.html'))
    response.writeHead(found ? 200 : 404, {
      'Content-Type': found ? contentTypes[extname(file)] || 'application/octet-stream' : 'text/html; charset=utf-8',
      'Cache-Control': file.endsWith('/sw.js') || file.endsWith('.webmanifest') ? 'no-cache' : 'public, max-age=600',
    })
    response.end(request.method === 'HEAD' ? undefined : body)
  } catch (error) {
    response.writeHead(error instanceof URIError ? 400 : 500).end(String(error))
  }
})
await new Promise((ready, reject) => {
  server.once('error', reject)
  server.listen(0, '127.0.0.1', ready)
})
const origin = `http://127.0.0.1:${server.address().port}`
const results = []
const started = new Date().toISOString()
const env = {
  ...process.env, ATLAS_URL: origin, PROFILE_URL: origin, ATLAS_DIST: dist,
  ATLAS_QA_DIR: resolve(output, 'atlas'), PROFILE_QA_DIR: resolve(output, 'profile'),
  CHROME_CHANNEL: process.env.CHROME_CHANNEL || 'chrome',
  PLAYWRIGHT_HTML_OUTPUT_DIR: resolve(output, 'pictulane-report'),
}
try {
  for (const suite of suites) {
    const begin = Date.now()
    const command = suite === 'pictulane' ? 'npm' : process.execPath
    const args = suite === 'profile' ? ['e2e/profile.mjs']
      : suite === 'pictulane' ? ['run', 'e2e', '--', '--output', resolve(output, 'pictulane')]
        : suite === 'upgrade' ? ['atlas/e2e/release-upgrade.mjs']
        : ['atlas/e2e/run.mjs', ...(suite === 'google' ? ['privacy', 'advertising-google'] : atlasSuites)]
    console.log(`Starting ${suite}; only one browser suite runs at a time. Evidence: ${output}`)
    const code = await new Promise((done, reject) => {
      const child = spawn(command, args, {
        cwd: suite === 'pictulane' ? resolve(root, 'tools/pictulane') : root,
        env: { ...env, ATLAS_QA_DIR: resolve(output, ['google', 'upgrade'].includes(suite) ? suite : 'atlas') }, stdio: 'inherit',
      })
      child.once('error', reject)
      child.once('exit', code => done(code ?? 1))
    })
    results.push({ suite, code, elapsedMs: Date.now() - begin })
    await writeFile(resolve(output, 'results.json'), JSON.stringify({
      started, dist, suites, results, complete: results.length === suites.length && code === 0,
      googleResourcesExercised: suites.includes('google'),
    }, null, 2))
    if (code !== 0) {
      process.exitCode = code
      break
    }
  }
} finally {
  server.closeAllConnections()
  await new Promise(done => server.close(done))
}
