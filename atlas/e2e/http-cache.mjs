import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { chromium, expect } from '@playwright/test'
import { siteDist } from './helpers.mjs'

const output = resolve(process.env.ATLAS_QA_DIR || 'work/atlas-migration/http-cache')
const dist = resolve(process.env.ATLAS_CACHE_DIST || siteDist)
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const html = await readFile(resolve(dist, 'atlas/index.html'), 'utf8')
const entry = [...html.matchAll(/<script\b[^>]*>/g)].map(match => match[0])
  .find(tag => /type="module"/.test(tag))?.match(/src="([^"]+)"/)?.[1]
assert(entry && /^\/atlas\/assets\/[^/]+-[\w-]{8}\.js$/.test(entry), 'HTML selects the immutable Vite entry')
const bindings = await readFile(resolve(dist, `.${entry}`))
const wasmPaths = [...new Set(bindings.toString().match(/\/atlas\/assets\/atlas_bg-[\w-]{8}\.wasm/g))]
assert.equal(wasmPaths.length, 1, 'The entry pins one application WASM')
const wasm = wasmPaths[0], wasmBytes = await readFile(resolve(dist, `.${wasm}`))
const worker = await readFile(resolve(dist, 'atlas/sw.js'), 'utf8')
const notFound = await readFile(resolve(dist, 'atlas/404.html'))
for (const [path, bytes] of [[entry, bindings], [wasm, wasmBytes], ['/atlas/404.html', notFound]]) {
  const records = [...worker.matchAll(/\{url:"([^"]+)",revision:(null|"[a-f0-9]{32}")\}/g)]
  const record = records.find(match => match[1] === path.slice('/atlas/'.length))
  assert(record, `Worker precaches the actual module ${path}`)
  if (path.endsWith('.html')) assert.notEqual(record[2], 'null', 'Mutable HTML requires a content revision')
  if (record[2] !== 'null') assert.equal(JSON.parse(record[2]), createHash('md5').update(bytes).digest('hex'))
}
const legacyPath = '/atlas/bootstrap.js'
const staleEntry = "throw new Error('Stale fixed Atlas entry executed');"
let phase = 'previous'
const requests = [], errors = [], failedResponses = []
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost')
    requests.push({ phase, path: url.pathname })
    if (url.pathname === '/cache-primer') {
      response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' }).end('<!doctype html><title>HTTP cache setup</title>')
      return
    }
    if (url.pathname === legacyPath) {
      // If it were not stale, the fixed URL could start the current application.
      response.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'public, max-age=31536000, immutable' })
        .end(phase === 'previous' ? staleEntry : `import '${entry}';`)
      return
    }
    let file = resolve(dist, `.${decodeURIComponent(url.pathname)}`)
    if (file !== dist && !file.startsWith(`${dist}${sep}`)) { response.writeHead(403).end(); return }
    if ((await stat(file).catch(() => null))?.isDirectory()) file = resolve(file, 'index.html')
    const bytes = await readFile(file)
    response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': file.endsWith('.html') ? 'no-store' : 'public, max-age=31536000, immutable' }).end(bytes)
  } catch { response.writeHead(404, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' }).end(notFound) }
})
await mkdir(output, { recursive: true })
await new Promise((ready, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', ready) })
const origin = `http://127.0.0.1:${server.address().port}`
let browser, page
const responses = []
try {
  browser = await chromium.launch({ channel: process.env.CHROME_CHANNEL || 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--enable-unsafe-swiftshader'] })
  const context = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce', viewport: { width: 1000, height: 800 }, locale: 'en-US' })
  await context.addInitScript(() => Object.defineProperty(navigator, 'gpu', { configurable: true, value: undefined }))
  page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  page.on('response', response => {
    const url = new URL(response.url())
    if (url.origin !== origin) return
    if (response.status() >= 400) failedResponses.push({ path: url.pathname, status: response.status() })
    if ([entry, wasm].includes(url.pathname)) responses.push(response.body().then(bytes => ({ path: url.pathname, sha256: sha(bytes) })))
  })
  // Playwright routing disables HTTP cache; use CDP only to block external hosts.
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: false })
  await cdp.send('Network.setBlockedURLs', { urls: ['https://*'] })
  await page.goto(`${origin}/cache-primer`)
  assert.equal(await page.evaluate(async path => (await fetch(path)).text(), legacyPath), staleEntry)
  assert.equal(requests.filter(request => request.path === legacyPath).length, 1)
  phase = 'current'
  assert.equal(await page.evaluate(async path => (await fetch(path)).text(), legacyPath), staleEntry)
  assert.equal(requests.filter(request => request.path === legacyPath).length, 1, 'The stale entry remains in the real HTTP cache after switching releases')
  await page.goto(`${origin}/atlas/pokemon/6/?lang=en`, { waitUntil: 'domcontentloaded' })
  await page.locator('.live-dot:not(.loading)').waitFor({ timeout: 120000 })
  await page.locator('.loader').waitFor({ state: 'hidden' })
  assert.equal(await page.locator('.viewer-error').count(), 0)
  await page.getByRole('button', { name: 'Play animation', exact: true }).waitFor()
  const before = await page.locator('canvas').screenshot()
  await page.getByRole('button', { name: 'side', exact: true }).click()
  await expect.poll(async () => before.equals(await page.locator('canvas').screenshot())).toBe(false)
  await page.getByRole('button', { name: 'Save Charizard', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Remove Charizard from collection', exact: true })).toBeVisible()
  assert.equal(await page.evaluate(() => navigator.serviceWorker.controller), null)
  const loaded = await Promise.all(responses)
  for (const [path, bytes] of [[entry, bindings], [wasm, wasmBytes]]) {
    assert(loaded.some(response => response.path === path && response.sha256 === sha(bytes)), `The working renderer used the exact current bytes: ${path}`)
  }
  assert(!requests.some(request => request.phase === 'current' && request.path === legacyPath), 'Current HTML bypasses the stale fixed entry')
  const missingPath = '/atlas/no-such-abi-cache-page/'
  for (const locale of ['ja', 'ar']) {
    const words = JSON.parse(await readFile(resolve(dist, `atlas/locales/ui/${locale}.json`)))
    const response = await page.goto(`${origin}${missingPath}?lang=${locale}`)
    assert.equal(response.status(), 404, 'An unrelated missing route remains a true HTTP 404')
    await expect(page.locator('html')).toHaveAttribute('lang', locale)
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
    await expect(page.locator('#atlas-not-found h1')).toHaveText(words['Page not found'])
    await expect(page.locator('#atlas-not-found a')).toHaveText(words['Open Pokémon Atlas'])
    assert.equal(await page.locator('script[type="module"]').getAttribute('src'), entry)
    assert(!requests.some(request => request.phase === 'current' && request.path === legacyPath), 'Localized 404 also bypasses the stale fixed entry')
  }
  assert.deepEqual(errors, [])
  assert.deepEqual(failedResponses, [{ path: missingPath, status: 404 }, { path: missingPath, status: 404 }])
  await page.screenshot({ path: `${output}/current.png` })
  await writeFile(`${output}/verification.json`, JSON.stringify({ passed: true, origin, entry, wasm, loaded, realHttpCacheHit: true, controls: ['camera', 'favorite', 'localized-404'], serviceWorker: false, requests, errors, failedResponses }, null, 2))
  console.log('Atlas HTTP cache: retained old fixed bootstrap is bypassed; exact paired production JS/WASM renders and handles camera/favorites.')
} catch (error) {
  await page?.screenshot({ path: `${output}/failure.png` }).catch(() => {})
  await writeFile(`${output}/failure.json`, JSON.stringify({ error: String(error), stack: error.stack, origin, entry, wasm, requests, errors, failedResponses }, null, 2))
  throw error
} finally {
  await browser?.close()
  server.closeAllConnections()
  await new Promise(done => server.close(done))
}
