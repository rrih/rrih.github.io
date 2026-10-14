import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { appBase, chromium } from './helpers.mjs'

const output = process.env.ATLAS_QA_DIR || 'work/atlas-migration/performance-regressions'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--enable-unsafe-swiftshader'] })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US', reducedMotion: 'reduce', serviceWorkers: 'block' })
await context.addInitScript(() => {
  Object.defineProperty(navigator, 'gpu', { configurable: true, value: undefined })
  window.__atlasDrawProbe = { calls: 0, firstDrawAt: null }
  for (const key of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
    const original = WebGL2RenderingContext.prototype[key]
    WebGL2RenderingContext.prototype[key] = function (...args) {
      window.__atlasDrawProbe.calls++
      window.__atlasDrawProbe.firstDrawAt ??= performance.now()
      return original.apply(this, args)
    }
  }
})
const page = await context.newPage(), errors = [], requests = []
const network = new Map(), cdp = await context.newCDPSession(page)
await cdp.send('Network.enable')
cdp.on('Network.requestWillBeSent', event => network.set(event.requestId, { url: event.request.url, start: event.timestamp }))
cdp.on('Network.responseReceived', event => Object.assign(network.get(event.requestId) || {}, { status: event.response.status, mime: event.response.mimeType, headers: event.response.headers, response: event.timestamp }))
cdp.on('Network.loadingFinished', event => Object.assign(network.get(event.requestId) || {}, { end: event.timestamp, bytes: event.encodedDataLength }))
cdp.on('Network.loadingFailed', event => Object.assign(network.get(event.requestId) || {}, { failed: event.errorText }))
page.on('pageerror', error => errors.push(error.message))
page.on('request', request => requests.push(request.url()))
const ready = async () => {
  await page.locator('.live-dot:not(.loading)').waitFor({ timeout: 120000 })
  await page.locator('.loader').waitFor({ state: 'hidden' })
  assert.equal(await page.locator('.viewer-error').count(), 0)
}
const count = () => page.evaluate(() => window.__atlasDrawProbe.calls)
const result = { environment: 'Chrome, forced WebGL2 fallback, 390×844, reduced motion; functional regression, not a field CWV measurement' }
const sharedLayout = Buffer.from(JSON.stringify({ v: 1, m: [[25, '', false, 0, 0, 0, 1]], s: { playing: false, rotate: false, speed: 1, light: 1, habitat: 'studio', wireframe: false, shiny: false, quality: 'standard', animation: 0 } })).toString('base64url')
const modelPreloadChecks = async () => {
  result.modelPreloadChecks = []
  const cases = [
    { name: 'normal-before-catalog', path: '/pokemon/6/?lang=fr', model: '/atlas/models/home/6.glb', early: true },
    { name: 'shiny-before-catalog', path: '/pokemon/6/?lang=fr#shiny=1', model: '/atlas/models/shiny-home/6.glb', early: true },
    { name: 'route-form-beats-hash-form', path: '/pokemon/6/forms/charizard-mega-x/?lang=fr#form=charizard-mega-y&shiny=1', model: '/atlas/models/forms/charizard-mega-x-shiny.glb', early: true },
    { name: 'hash-form-skips-base-preload', path: '/pokemon/6/?lang=fr#form=charizard-mega-x', model: '/atlas/models/forms/charizard-mega-x.glb', early: false },
    { name: 'shared-scene-skips-route-preload', path: `/pokemon/6/?lang=fr#view=together&layout=${sharedLayout}`, model: '/atlas/models/home/25.glb', early: false },
    { name: 'failed-dictionary-then-retry', path: '/pokemon/6/?lang=fr', model: '/atlas/models/home/6.glb', early: true, failDictionary: true },
  ]
  for (const scenario of cases) {
    const probeContext = await browser.newContext({ locale: 'en-US', viewport: { width: 1000, height: 800 }, reducedMotion: 'reduce', serviceWorkers: 'block' })
    await probeContext.addInitScript(() => Object.defineProperty(navigator, 'gpu', { configurable: true, value: undefined }))
    let releaseCatalog, failDictionary = !!scenario.failDictionary
    const catalogHeld = new Promise(resolve => { releaseCatalog = resolve })
    await probeContext.route('**/atlas/locales/catalog/*.json', async route => { await catalogHeld; await route.continue() })
    if (scenario.failDictionary) await probeContext.route('**/atlas/locales/ui/fr.json', route => failDictionary ? route.abort('failed') : route.continue())
    const probe = await probeContext.newPage(), modelRequests = [], pageErrors = []
    probe.on('request', request => { if (new URL(request.url()).pathname.endsWith('.glb')) modelRequests.push(new URL(request.url()).pathname) })
    probe.on('pageerror', error => pageErrors.push(error.message))
    const preloads = () => probe.locator('link[rel="preload"][as="fetch"][href*="/models/"]')
    try {
      await probe.goto(`${appBase}${scenario.path}`, { waitUntil: 'domcontentloaded' })
      await probe.locator('#atlas-initial-model').waitFor({ state: 'attached' })
      if (scenario.failDictionary) {
        await probe.locator('#atlas-start-retry').waitFor({ timeout: 120000 })
        assert.deepEqual(modelRequests, [], 'A failed UI dictionary must not fetch any model')
        assert.equal(await preloads().count(), 0, 'A failed UI dictionary must not create model preloads')
        failDictionary = false
        await probe.getByRole('button', { name: 'Retry translations', exact: true }).click()
      }
      if (scenario.early) {
        await probe.waitForFunction(model => performance.getEntriesByType('resource').some(entry => new URL(entry.name).pathname === model && entry.responseEnd > 0), scenario.model, { timeout: 120000 })
        assert.equal(await probe.locator('.app-shell').count(), 0, 'Model transfer completes while translated catalog is held and before the application mounts')
        assert.equal(await preloads().count(), 1)
        assert.equal(await preloads().getAttribute('href'), scenario.model)
        assert.equal(await preloads().getAttribute('crossorigin'), 'anonymous')
        assert.deepEqual(modelRequests, [scenario.model], 'Only the exact selected model is requested early')
      }
      releaseCatalog()
      await probe.locator('.live-dot:not(.loading)').waitFor({ timeout: 120000 })
      await probe.locator('.loader').waitFor({ state: 'hidden' })
      assert.equal(await probe.locator('.viewer-error').count(), 0)
      assert.deepEqual(modelRequests, [scenario.model], 'Rendering reuses the preload, with one request and no unused normal/form model')
      assert.equal(await preloads().count(), scenario.early ? 1 : 0)
      const resources = await probe.evaluate(() => performance.getEntriesByType('resource').filter(entry => new URL(entry.name).pathname.endsWith('.glb')).map(entry => ({ path: new URL(entry.name).pathname, initiatorType: entry.initiatorType, startTime: entry.startTime, responseEnd: entry.responseEnd, transferSize: entry.transferSize })))
      assert.deepEqual([...new Set(resources.map(entry => entry.path))], [scenario.model])
      assert.equal(resources.filter(entry => entry.transferSize > 0).length, 1, 'The selected GLB has exactly one actual transfer')
      if (scenario.early) assert(resources.some(entry => entry.initiatorType === 'link'), 'The initial model comes from the guarded preload')
      assert.deepEqual(pageErrors, [])
      result.modelPreloadChecks.push({ ...scenario, modelRequests, resources, pageErrors })
    } catch (error) {
      await probe.screenshot({ path: `${output}/${scenario.name}-failure.png` }).catch(() => {})
      result.modelPreloadFailure = { scenario, modelRequests, pageErrors, error: String(error) }
      throw error
    } finally { releaseCatalog(); await probeContext.close() }
  }
}
try {
  await page.goto(`${appBase}/pokemon/6/?lang=en`)
  await ready()
  await page.locator('canvas').scrollIntoViewIfNeeded()
  await page.waitForTimeout(1500)
  assert(await count() > 0, 'The graphics probe observes actual GL draws')
  const paused = await count()
  await page.waitForTimeout(700)
  assert.equal(await count(), paused, 'Paused, settled view submits no further GPU draw calls')
  result.stoppedDrawCalls = 0
  await page.getByRole('button', { name: 'side', exact: true }).click()
  await page.waitForTimeout(700)
  assert(await count() > paused, 'Changing the camera redraws a paused view')
  await page.getByRole('button', { name: 'Play animation', exact: true }).click()
  await page.waitForTimeout(500)
  const playing = await count()
  await page.waitForTimeout(500)
  assert(await count() > playing, 'Visible animation submits new draws')
  await page.locator('.footer').scrollIntoViewIfNeeded()
  await page.waitForTimeout(700)
  assert(await page.locator('canvas').evaluate(canvas => canvas.getBoundingClientRect().bottom < 0), 'The actual mobile viewer is fully outside the viewport')
  const offscreen = await count()
  await page.waitForTimeout(700)
  assert.equal(await count(), offscreen, 'Offscreen animation submits no GPU draws')
  result.offscreenDrawCalls = 0
  await page.locator('canvas').scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)
  assert(await count() > offscreen, 'Animation resumes after returning to the viewer')
  await page.getByRole('button', { name: 'Pause animation', exact: true }).click()
  for (const code of ['fr', 'ja', 'fr']) {
    await page.locator('.language-button').click()
    await page.locator(`[data-language="${code}"]`).click()
    await page.locator(`.app-shell[data-locale="${code}"][data-catalog-state=ready]`).waitFor()
  }
  const uiRequests = requests.filter(url => /\/locales\/ui\/.*\.json$/.test(new URL(url).pathname))
  assert.equal(uiRequests.filter(url => url.endsWith('/fr.json')).length, 1)
  assert.equal(uiRequests.filter(url => url.endsWith('/ja.json')).length, 1)
  assert.equal(uiRequests.length, 2, 'Only chosen UI dictionaries are fetched and returning to a language uses memory')
  assert(!requests.some(url => /\/habitat\.webp(?:\?|$)/.test(url)), 'Forest picker has no full-size background image request')
  result.dictionaryRequests = uiRequests.map(url => new URL(url).pathname)
  result.resources = await page.evaluate(() => ({ firstDrawAt: window.__atlasDrawProbe.firstDrawAt, entries: performance.getEntriesByType('resource').filter(entry => /\/(?:models|draco)\//.test(entry.name)).map(entry => ({ path: new URL(entry.name).pathname, startTime: entry.startTime, responseEnd: entry.responseEnd, transferSize: entry.transferSize, decodedBodySize: entry.decodedBodySize })) }))
  const glb = result.resources.entries.find(entry => entry.path.endsWith('/models/home/6.glb'))
  const decoder = result.resources.entries.filter(entry => entry.path.startsWith('/atlas/draco/'))
  assert(glb && decoder.length >= 2)
  assert(glb.startTime < result.resources.firstDrawAt, 'First model fetch starts before renderer preparation draws')
  for (const path of [...new Set(decoder.map(entry => entry.path))]) assert(decoder.filter(entry => entry.path === path && entry.transferSize > 0).length <= 1, `${path}: decoder preload must not duplicate network transfer`)
  result.applicationStartup = await page.evaluate(() => performance.getEntriesByType('resource')
    .filter(entry => /\/assets\/(?:atlas_bg-.*\.wasm|three-.*\.js)$/.test(new URL(entry.name).pathname))
    .map(entry => ({ path: new URL(entry.name).pathname, initiatorType: entry.initiatorType, startTime: entry.startTime, responseEnd: entry.responseEnd, transferSize: entry.transferSize })))
  const applicationWasm = result.applicationStartup.filter(entry => entry.path.endsWith('.wasm'))
  const three = result.applicationStartup.find(entry => entry.path.endsWith('.js'))
  assert(applicationWasm.some(entry => entry.initiatorType === 'link'), 'HTML starts loading application WASM before JavaScript evaluates')
  assert(three && applicationWasm[0].startTime < three.responseEnd, 'WASM loading overlaps the renderer library download')
  assert.equal(applicationWasm.filter(entry => entry.transferSize > 0).length, 1, 'The application reuses its WASM preload without a second transfer')
  result.cameraAndResumeRedraw = true
  assert.deepEqual(errors, [])
  await modelPreloadChecks()
  await writeFile(`${output}/verification.json`, JSON.stringify({ ...result, errors }, null, 2))
  console.log('Lazy dictionaries, paused/offscreen GPU suppression, redraw recovery, guarded normal/shiny/form model preloads, shared/failed-language exclusions, decoder reuse and one early WASM transfer verified.')
} catch (error) {
  await writeFile(`${output}/failure.json`, JSON.stringify({ ...result, error: String(error), stack: error.stack, url: page.url(), errors, requests, network: [...network.values()] }, null, 2))
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true }).catch(() => {})
  throw error
} finally { await browser.close() }
