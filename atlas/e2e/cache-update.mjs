import { siteDist } from './helpers.mjs'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, resolve } from 'node:path'
import { chromium } from './helpers.mjs'

const dist = resolve(process.env.ATLAS_DIST || siteDist)
const output = process.env.ATLAS_QA_DIR || 'work/cache/update-qa'
const cacheName = 'atlas-models-v1'
const modelPath = '/atlas/models/home/500.glb'
const originalWorker = await readFile(`${dist}/atlas/sw.js`, 'utf8')
const expectedModel = await readFile(`${dist}${modelPath}`)
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.wasm': 'application/wasm',
  '.glb': 'model/gltf-binary',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
}
let revision = 0
const workerBody = () => `${originalWorker}\n// cache-update-e2e version ${revision}\n`
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
    if (pathname === '/atlas/sw.js') {
      response.writeHead(200, {
        'Content-Type': mime['.js'],
        'Cache-Control': 'no-store',
        'Service-Worker-Allowed': '/atlas/',
      })
      response.end(request.method === 'HEAD' ? undefined : workerBody())
      return
    }
    const filename = resolve(dist, `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`)
    if (!filename.startsWith(`${dist}/`)) {
      response.writeHead(403).end()
      return
    }
    const info = await stat(filename)
    if (!info.isFile()) {
      response.writeHead(404).end()
      return
    }
    response.writeHead(200, {
      'Content-Type': mime[extname(filename)] || 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': 'no-cache',
    })
    if (request.method === 'HEAD') response.end()
    else
      createReadStream(filename)
        .on('error', () => response.destroy())
        .pipe(response)
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 500).end()
  }
})
await mkdir(output, { recursive: true })
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}`
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-unsafe-webgpu', '--enable-unsafe-swiftshader'],
})
const cases = []
const readModel = async ({ path, cacheName }) => {
  const response = cacheName
    ? await (await caches.open(cacheName)).match(path.replace('/atlas/models/', '/models/'))
    : await fetch(path, { cache: 'no-store' })
  if (!response) return null
  const bytes = await response.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return {
    status: response.status,
    bytes: bytes.byteLength,
    sha256: Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(''),
  }
}

async function observedPage(context) {
  const page = await context.newPage()
  const lifecycle = []
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.exposeBinding('__atlasUpdateEvent', (_source, event) => lifecycle.push(event))
  await page.addInitScript((origin) => {
    if (location.origin !== origin) return
    const documentId = crypto.randomUUID()
    window.__atlasUpdateDocument = documentId
    let previous = navigator.serviceWorker.controller
    const report = (kind, extra = {}) => {
      void window
        .__atlasUpdateEvent({
          kind,
          documentId,
          time: Date.now(),
          controller: navigator.serviceWorker.controller?.scriptURL || null,
          ...extra,
        })
        .catch(() => {})
    }
    report('document')
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      report('controllerchange', { changed: navigator.serviceWorker.controller !== previous })
      previous = navigator.serviceWorker.controller
    })
  }, base)
  return { page, lifecycle, errors }
}

async function waitForModel(page) {
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 120_000 })
  await page.getByText('LIVE VIEW', { exact: true }).waitFor({ timeout: 120_000 })
  assert.equal(await page.locator('.specimen-heading bdi').innerText(), 'Emboar')
  await page.waitForFunction(
    async ({ cacheName, path }) => !!(await (await caches.open(cacheName)).match(path.replace('/atlas/models/', '/models/'))),
    { cacheName, path: modelPath },
    { timeout: 90_000 },
  )
}

async function runCase(returning, activatedElsewhere = false) {
  const name = activatedElsewhere ? 'activated-by-other-tab' : returning ? 'returning-visit' : 'first-visit'
  const context = await browser.newContext({
    locale: 'en-US',
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
  })
  let observed = await observedPage(context)
  let { page } = observed
  const record = { name, activatedElsewhere, lifecycle: observed.lifecycle, errors: observed.errors }
  try {
    assert.equal(await page.evaluate(() => navigator.serviceWorker?.controller || null), null)
    await page.goto(`${base}/atlas/?lang=en#pokemon=500&scene=studio`)
    await waitForModel(page)
    assert.equal(observed.lifecycle.find((event) => event.kind === 'document').controller, null)
    if (returning) {
      // A new tab represents a real return visit; there is no manual reload in either case.
      const firstPage = page
      const initialLifecycle = observed.lifecycle
      observed = await observedPage(context)
      page = observed.page
      record.lifecycle = observed.lifecycle
      record.errors = observed.errors
      record.installationLifecycle = initialLifecycle
      await page.goto(`${base}/atlas/?lang=en#pokemon=500&scene=studio`)
      await waitForModel(page)
      await firstPage.close()
    }
    record.initialController = observed.lifecycle.find((event) => event.kind === 'document').controller
    assert.equal(Boolean(record.initialController), returning)
    record.modelBefore = await page.evaluate(readModel, { path: modelPath, cacheName })
    assert.deepEqual(record.modelBefore, {
      status: 200,
      bytes: expectedModel.byteLength,
      sha256: sha256(expectedModel),
    })
    record.workerBefore = sha256(workerBody())
    await page.screenshot({ path: `${output}/${name}-before.png`, fullPage: true })

    console.log(`${name}: model 500 saved; waiting 61 seconds beyond Workbox's update heuristic`)
    await delay(30_000)
    console.log(`${name}: 31 seconds remain before publishing the next worker version`)
    await delay(31_000)
    revision += 1
    record.workerAfter = sha256(workerBody())
    assert.notEqual(record.workerAfter, record.workerBefore)
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update())
    await page.getByRole('button', { name: 'Update now', exact: true }).waitFor({ timeout: 120_000 })
    record.waitingState = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration()
      return { waiting: registration.waiting?.state, active: registration.active?.state }
    })
    assert.equal(record.waitingState.waiting, 'installed')
    await page.screenshot({ path: `${output}/${name}-update-ready.png`, fullPage: true })
    const beforeDocument = await page.evaluate(() => window.__atlasUpdateDocument)
    const beforeEvents = observed.lifecycle.length
    const beforeDocuments = observed.lifecycle.filter((event) => event.kind === 'document').length

    let otherPage
    if (activatedElsewhere) {
      otherPage = await context.newPage()
      otherPage.on('pageerror', (error) => observed.errors.push(error.message))
      await otherPage.goto(`${base}/atlas/?lang=en#pokemon=500&scene=studio`)
      await waitForModel(otherPage)
      await otherPage.getByRole('button', { name: 'Update now', exact: true }).waitFor({ timeout: 120_000 })
    }
    // With the network disabled before activation, missing cached data cannot be downloaded again.
    await context.setOffline(true)
    assert(
      await page.evaluate(async () => {
        try {
          await fetch(`/robots.txt?offline-proof=${Date.now()}`, { cache: 'no-store' })
          return false
        } catch {
          return true
        }
      }),
      'Network must be unavailable before clicking the public update control',
    )
    if (otherPage) {
      await Promise.all([
        otherPage.waitForEvent('domcontentloaded', { timeout: 120_000 }),
        otherPage.getByRole('button', { name: 'Update now', exact: true }).click(),
      ])
      await waitForModel(otherPage)
      await otherPage.close()
      assert.equal(
        await page.evaluate(() => window.__atlasUpdateDocument),
        beforeDocument,
        'The original first-visit tab must remain open until its own update action',
      )
      record.waitingBeforeOwnClick = await page.evaluate(
        async () => (await navigator.serviceWorker.getRegistration()).waiting?.state || null,
      )
      assert.equal(record.waitingBeforeOwnClick, null)
      assert.equal(
        observed.lifecycle
          .slice(beforeEvents)
          .filter((event) => event.kind === 'controllerchange' && event.changed).length,
        1,
      )
      await page.getByRole('button', { name: 'Update now', exact: true }).waitFor()
      console.log(`${name}: another tab activated the worker; original tab now updates with waiting=null`)
    }
    console.log(`${name}: update is ready; clicking Update now while offline`)
    await Promise.all([
      page.waitForEvent('domcontentloaded', { timeout: 120_000 }),
      page.getByRole('button', { name: 'Update now', exact: true }).click(),
    ])
    await waitForModel(page)
    assert.notEqual(await page.evaluate(() => window.__atlasUpdateDocument), beforeDocument)
    record.controllerChanges = observed.lifecycle
      .slice(beforeEvents)
      .filter((event) => event.kind === 'controllerchange' && event.changed)
    assert.equal(record.controllerChanges.length, 1, 'One new worker must take control')
    assert.equal(record.controllerChanges[0].documentId, beforeDocument)
    record.modelAfter = await page.evaluate(readModel, { path: modelPath, cacheName })
    record.modelOffline = await page.evaluate(readModel, { path: modelPath })
    assert.deepEqual(record.modelAfter, record.modelBefore)
    assert.deepEqual(record.modelOffline, record.modelBefore)
    assert.equal(await page.getByRole('button', { name: 'Update now', exact: true }).count(), 0)
    const cdp = await context.newCDPSession(page)
    await cdp.send('Network.overrideNetworkState', {
      offline: true,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    })
    await page.getByText('You’re offline.', { exact: false }).waitFor()
    // Observe after rendering as well, so two competing update listeners cannot pass as one reload.
    await delay(3000)
    record.reloads = observed.lifecycle.filter((event) => event.kind === 'document').length - beforeDocuments
    assert.equal(record.reloads, 1, 'The update must reload the page exactly once')
    assert.equal(
      observed.lifecycle.filter((event) => event.kind === 'document').at(-1).controller,
      `${base}/atlas/sw.js`,
    )
    assert.deepEqual(observed.errors, [])
    await page.screenshot({ path: `${output}/${name}-offline-after.png`, fullPage: true })
    record.offline3D = true
    cases.push(record)
    console.log(`Passed: ${name}, one controller change and one reload, model 500 SHA retained offline`)
  } catch (error) {
    const [screenshot, body, state] = await Promise.allSettled([
      page.screenshot({ path: `${output}/${name}-failure.png`, fullPage: true, timeout: 10_000 }),
      page.locator('body').innerText({ timeout: 10_000 }),
      page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration()
        return {
          controller: navigator.serviceWorker.controller?.scriptURL,
          waiting: registration?.waiting?.state,
          active: registration?.active?.state,
          online: navigator.onLine,
          documentId: window.__atlasUpdateDocument,
          caches: await caches.keys(),
        }
      }),
    ])
    await writeFile(
      `${output}/${name}-failure.json`,
      JSON.stringify(
        {
          error: { message: error.message, stack: error.stack },
          record,
          screenshot: screenshot.status === 'fulfilled' ? true : String(screenshot.reason),
          body: body.status === 'fulfilled' ? body.value : String(body.reason),
          state: state.status === 'fulfilled' ? state.value : String(state.reason),
        },
        null,
        2,
      ),
    )
    throw error
  } finally {
    await context.close()
  }
}

try {
  await runCase(false)
  await runCase(true)
  await runCase(false, true)
  await writeFile(`${output}/verification.json`, JSON.stringify({ base, cases }, null, 2))
  console.log(`Update regression passed for all three cases. Evidence: ${output}`)
} finally {
  await browser.close()
  await new Promise((resolve) => server.close(resolve))
}
