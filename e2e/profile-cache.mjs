import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium, expect } from '@playwright/test'

const root = fileURLToPath(new URL('../', import.meta.url))
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.css': 'text/css', '.png': 'image/png' }

export async function verifyProfileHttpCache({
  dist = resolve(root, process.env.PROFILE_DIST || process.env.ATLAS_DIST || 'dist'),
  output = resolve(root, process.env.PROFILE_QA_DIR || 'work/profile-cache'),
} = {}) {
  await mkdir(output, { recursive: true })
  const html = await readFile(resolve(dist, 'index.html'), 'utf8')
  const entry = html.match(/<script src="([^"]+)" type="module">/)?.[1]
  assert(entry, 'The production profile has a module entry')
  const directory = entry.slice(0, entry.lastIndexOf('/'))
  const currentWasm = await readFile(resolve(dist, `.${directory}/profile_bg.wasm`))
  const expectedWasm = hash(currentWasm)
  const legacy = {
    '/profile.js': "throw new Error('Stale fixed profile entry executed');",
    '/wasm/profile.js': "export default function init() { throw new Error('Stale fixed profile ABI executed') }",
    '/wasm/profile_bg.wasm': 'incompatible legacy WASM response',
  }
  // Uncached legacy URLs would return a coherent current pair. Only the one
  // deliberately retained HTTP-cache response is incompatible in each case.
  const currentLegacy = {
    '/profile.js': "import init from '/wasm/profile.js'; await init();",
    '/wasm/profile.js': await readFile(resolve(dist, `.${directory}/profile.js`)),
    '/wasm/profile_bg.wasm': currentWasm,
  }
  let phase = 'previous'
  let requests = []
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost')
    requests.push({ phase, path: url.pathname })
    if (url.pathname === '/cache-primer') {
      response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' }).end('<!doctype html><title>HTTP cache setup</title>')
      return
    }
    if (url.pathname in legacy) {
      response.writeHead(200, {
        'Content-Type': mime[extname(url.pathname)],
        'Cache-Control': 'public, max-age=31536000, immutable',
      }).end(phase === 'previous' ? legacy[url.pathname] : currentLegacy[url.pathname])
      return
    }
    try {
      let file = resolve(dist, `.${decodeURIComponent(url.pathname)}`)
      if (file !== dist && !file.startsWith(`${dist}${sep}`)) { response.writeHead(403).end(); return }
      if ((await stat(file).catch(() => null))?.isDirectory()) file = resolve(file, 'index.html')
      const body = await readFile(file)
      response.writeHead(200, {
        'Content-Type': mime[extname(file)] || 'application/octet-stream',
        'Cache-Control': file.endsWith('.html') ? 'no-store' : 'public, max-age=31536000, immutable',
      }).end(body)
    } catch { response.writeHead(404).end('Not found') }
  })
  await new Promise((ready, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', ready) })
  const origin = `http://127.0.0.1:${server.address().port}`
  let browser
  const results = []
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true })
    // No Playwright routing: enabling it disables the browser HTTP cache.
    // Prime only one old URL per fresh context to exercise partially stale pairs.
    for (const path of Object.keys(legacy)) {
      const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } })
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      const cdp = await context.newCDPSession(page)
      await cdp.send('Network.enable')
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: false })
      await cdp.send('Network.setBlockedURLs', { urls: ['https://*'] })
      phase = 'previous'
      requests = []
      try {
        await page.goto(`${origin}/cache-primer`)
        const first = await page.evaluate(async path => (await fetch(path)).text(), path)
        assert.equal(first, legacy[path])
        assert.equal(requests.filter(request => request.path === path).length, 1)
        phase = 'current'
        const cached = await page.evaluate(async path => (await fetch(path)).text(), path)
        assert.equal(cached, first, 'The stale response remains in the real HTTP cache after the origin switches releases')
        assert.equal(requests.filter(request => request.path === path).length, 1, 'The second request must not reach the server')
        await page.goto(`${origin}/?lang=ja`, { waitUntil: 'domcontentloaded' })
        await page.waitForURL(`${origin}/ja/`)
        await expect(page.locator('h1')).toHaveText('rrih')
        await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
        await page.locator('summary').click()
        await expect(page.locator('.languages nav')).toBeVisible()
        await page.keyboard.press('Escape')
        await expect(page.locator('details')).not.toHaveAttribute('open')
        assert.equal(await page.locator('link[rel=manifest]').count(), 0)
        assert.equal(await page.evaluate(() => navigator.serviceWorker.controller), null)
        const currentRequests = requests.filter(request => request.phase === 'current').map(request => request.path)
        assert(!currentRequests.some(path => path in legacy), 'New HTML never requests any legacy fixed ABI URL')
        for (const required of [entry, `${directory}/profile.js`, `${directory}/profile_bg.wasm`]) assert(currentRequests.includes(required), required)
        const wasm = await page.evaluate(async path => {
          const bytes = await (await fetch(path)).arrayBuffer()
          return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('')
        }, `${directory}/profile_bg.wasm`)
        assert.equal(wasm, expectedWasm, 'The functioning app uses the production WASM paired with its entry')
        assert.deepEqual(errors, [])
        results.push({ staleUrl: path, staleResponseSha256: hash(first), realHttpCacheHit: true, currentRequests, currentWasmSha256: wasm, queryRedirect: true, keyboardDismissal: true, errors })
      } catch (error) {
        await writeFile(resolve(output, 'failure.json'), JSON.stringify({ staleUrl: path, error: String(error), stack: error.stack, requests, errors, results }, null, 2))
        throw error
      } finally { await context.close() }
    }
    await writeFile(resolve(output, 'verification.json'), JSON.stringify({ origin, dist, entry, results, passed: true }, null, 2))
    console.log('Profile HTTP cache: stale entry, bindings and WASM remain cached separately; current paired application redirects and handles Escape in all three cases.')
  } finally {
    await browser?.close()
    server.closeAllConnections()
    await new Promise(done => server.close(done))
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await verifyProfileHttpCache()
