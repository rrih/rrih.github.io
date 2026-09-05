import assert from 'node:assert/strict'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { chromium, siteDist } from './helpers.mjs'

const builds = { previous: resolve(process.env.ATLAS_PREVIOUS_DIST || fileURLToPath(new URL('../../work/atlas-migration/previous/', import.meta.url))), current: resolve(process.env.ATLAS_DIST || siteDist) }
const output = process.env.ATLAS_QA_DIR || 'work/atlas-migration/performance-comparison'
await mkdir(output, { recursive: true })
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }
let variant = 'previous'
const bodies = new Map()
const server = createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname), root = builds[variant]
    let file = resolve(root, `.${path}`)
    if (file !== root && !file.startsWith(`${root}/`)) return response.writeHead(403).end()
    if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html')
    const compressed = /\.(?:html|js|css|json|svg|webmanifest|wasm)$/.test(file)
    const key = `${file}:${compressed}`
    if (!bodies.has(key)) { const bytes = await readFile(file); bodies.set(key, compressed ? gzipSync(bytes, { level: 9 }) : bytes) }
    const body = bodies.get(key)
    response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Content-Length': body.byteLength, 'Cache-Control': 'no-store', ...(compressed ? { 'Content-Encoding': 'gzip' } : {}) })
    response.end(request.method === 'HEAD' ? undefined : body)
  } catch (error) { response.writeHead(error.code === 'ENOENT' ? 404 : 500).end() }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`
const conditions = { measuredAt: new Date().toISOString(), browser: 'Installed Chrome; exact version recorded in each trial', viewport: '390×844', deviceScaleFactor: 2, CPU: '4× slowdown', network: '1.6 Mbps down, 0.75 Mbps up, 150 ms additional latency via CDP', server: 'Same local Node HTTP/1.1 server; gzip level 9 for HTML/JS/CSS/JSON/SVG/WASM; other bodies unchanged', cache: 'New browser process and context per run, HTTP cache disabled, service workers blocked', consent: 'All third-party requests blocked', readyDefinition: 'First DOM state with completed live status, canvas present and no viewer error', sampling: 'Three runs per build and species; order alternates previous/current then current/previous', limits: 'Laboratory comparison on this Mac, OS/driver caches not cleared, no field CWV, ranking inference, physical-phone claim or inferred INP' }
const results = []
try {
  for (const id of [6, 753]) for (let trial = 1; trial <= 3; trial++) for (const build of trial === 2 ? ['current', 'previous'] : ['previous', 'current']) {
    variant = build
    const path = `${build === 'current' ? '/atlas' : ''}${id === 753 ? '/ja' : ''}/pokemon/${id}/`
    const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--enable-unsafe-swiftshader'] })
    const context = await browser.newContext({ locale: 'en-US', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' })
    const page = await context.newPage(), errors = [], blocked = []
    await context.route('**/*', route => { const url = new URL(route.request().url()); if (url.origin === origin) return route.continue(); blocked.push(url.origin + url.pathname); return route.abort('blockedbyclient') })
    page.on('pageerror', error => errors.push(error.message))
    const cdp = await context.newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 93750, connectionType: 'cellular4g' })
    await page.addInitScript(() => {
      window.__comparison = { readyMs: null, lcp: [], shifts: [], longTasks: [], canvasContexts: [] }
      const getContext = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function (...args) {
        const value = getContext.apply(this, args)
        if (value && ['webgpu', 'webgl', 'webgl2'].includes(args[0])) window.__comparison.canvasContexts.push({ type: args[0], at: performance.now() })
        return value
      }
      const probe = () => {
        if (window.__comparison.readyMs === null && document.querySelector('.live-dot:not(.loading)') && document.querySelector('canvas') && !document.querySelector('.viewer-error')) window.__comparison.readyMs = performance.now()
      }
      new MutationObserver(probe).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
      for (const [type, key] of [['largest-contentful-paint', 'lcp'], ['layout-shift', 'shifts'], ['longtask', 'longTasks']]) {
        try { new PerformanceObserver(list => { for (const e of list.getEntries()) window.__comparison[key].push({ startTime: e.startTime, duration: e.duration, value: e.value, hadRecentInput: e.hadRecentInput, element: e.element?.tagName, className: e.element?.className, size: e.size }) }).observe({ type, buffered: true }) } catch {}
      }
    })
    console.log(`Cold ${build} #${id}, sample ${trial}/3`)
    try {
      const response = await page.goto(`${origin}${path}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
      assert.equal(response.status(), 200)
      await page.waitForFunction(() => window.__comparison.readyMs !== null, null, { timeout: 120000 })
      await page.locator('.loader').waitFor({ state: 'hidden' })
      await page.waitForTimeout(2000)
      const observed = await page.evaluate(() => ({ ...window.__comparison, paints: performance.getEntriesByType('paint').map(e => e.toJSON()), navigation: performance.getEntriesByType('navigation')[0].toJSON(), resources: performance.getEntriesByType('resource').map(e => ({ path: new URL(e.name).pathname, startTime: e.startTime, responseEnd: e.responseEnd, transferSize: e.transferSize, encodedBodySize: e.encodedBodySize, decodedBodySize: e.decodedBodySize, initiatorType: e.initiatorType })), name: document.querySelector('h1 bdi')?.textContent, canvas: (() => { const canvas = document.querySelector('canvas'), rect = canvas.getBoundingClientRect(); return { width: canvas.width, height: canvas.height, cssWidth: rect.width, cssHeight: rect.height } })(), environment: document.querySelector('.viewer-stage')?.className, overflow: document.documentElement.scrollWidth > innerWidth + 1 }))
      const completed = observed.resources.filter(e => e.responseEnd > 0)
      const initial = completed.filter(e => e.responseEnd <= observed.readyMs)
      const sum = (entries, key) => entries.reduce((value, item) => value + item[key], 0)
      const js = completed.filter(e => e.path.endsWith('.js'))
      const record = { build, id, trial, path, browser: browser.version(), readyMs: observed.readyMs, fcpMs: observed.paints.find(e => e.name === 'first-contentful-paint')?.startTime, labLcpMs: observed.lcp.at(-1)?.startTime, lcpElement: observed.lcp.at(-1), transferByReadyBytes: sum(initial, 'transferSize') + observed.navigation.transferSize, observedTotalTransferBytes: sum(completed, 'transferSize') + observed.navigation.transferSize, jsTransferBytes: sum(js, 'transferSize'), jsDecodedBytes: sum(js, 'decodedBodySize'), longTasksCount: observed.longTasks.length, longTasksMs: sum(observed.longTasks, 'duration'), observed, errors, blocked }
      assert.deepEqual(errors, [])
      assert.equal(observed.overflow, false)
      assert.equal(observed.name, id === 6 ? 'Charizard' : 'カリキリ')
      if (trial === 1) await page.screenshot({ path: `${output}/${build}-${id}.png`, fullPage: true })
      results.push(record)
      await writeFile(`${output}/${build}-${id}-${trial}.json`, JSON.stringify(record, null, 2))
      await writeFile(`${output}/results.json`, JSON.stringify({ conditions, results }, null, 2))
      console.log(`${build} #${id}: ready ${(record.readyMs / 1000).toFixed(2)} s, JS ${Math.round(record.jsTransferBytes / 1024)} KiB`)
    } finally { await context.close(); await browser.close() }
  }
  const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
  const summaries = []
  for (const id of [6, 753]) for (const build of ['previous', 'current']) {
    const records = results.filter(r => r.id === id && r.build === build), metrics = {}
    for (const key of ['readyMs', 'fcpMs', 'labLcpMs', 'transferByReadyBytes', 'observedTotalTransferBytes', 'jsTransferBytes', 'jsDecodedBytes', 'longTasksMs']) {
      const values = records.map(r => r[key]); metrics[key] = { median: median(values), min: Math.min(...values), max: Math.max(...values), values }
    }
    summaries.push({ id, build, samples: records.length, metrics })
  }
  await writeFile(`${output}/summary.json`, JSON.stringify({ conditions, summaries }, null, 2))
  console.log(JSON.stringify(summaries, null, 2))
} finally { await new Promise(resolve => server.close(resolve)) }
