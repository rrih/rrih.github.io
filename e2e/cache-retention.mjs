import assert from 'node:assert/strict'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const base = process.env.ATLAS_URL || 'http://127.0.0.1:3335'
const output = process.env.ATLAS_QA_DIR || 'work/cache/qa'
const models = JSON.parse(await readFile(new URL('../src/data/models.json', import.meta.url), 'utf8'))
const locales = (await readdir(new URL('../src/locales/ui/', import.meta.url)))
  .filter((name) => name.endsWith('.json'))
  .map((name) => name.slice(0, -5))
  .sort()
const modelCache = 'atlas-models-v1'
const artworkCache = 'atlas-artwork-v1'
const url = (path) => new URL(path, base).href
const modelUrl = (id) => url(models[id].url)
const modelIds = Array.from({ length: 40 }, (_, index) => index + 1)
assert.equal(locales.length, 49)
await mkdir(output, { recursive: true })

// Attach to the worker itself: page request events also include cache hits.
async function attachWorker(browser, scriptURL) {
  const cdp = await browser.newBrowserCDPSession()
  const { targetInfos } = await cdp.send('Target.getTargets')
  const target = targetInfos.find((item) => item.type === 'service_worker' && item.url === scriptURL)
  assert(target, `Cannot find active service worker ${scriptURL}`)
  const { sessionId } = await cdp.send('Target.attachToTarget', {
    targetId: target.targetId,
    flatten: false,
  })
  let nextId = 0
  const pending = new Map()
  const requests = []
  const exceptions = []
  cdp.on('Target.receivedMessageFromTarget', (event) => {
    if (event.sessionId !== sessionId) return
    const message = JSON.parse(event.message)
    if (message.method === 'Network.requestWillBeSent') requests.push(message.params)
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params)
    const handler = pending.get(message.id)
    if (!handler) return
    pending.delete(message.id)
    clearTimeout(handler.timer)
    if (message.error) handler.reject(new Error(JSON.stringify(message.error)))
    else handler.resolve(message.result)
  })
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextId
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error(`Worker CDP timed out: ${method}`))
      }, 30_000)
      pending.set(id, { resolve, reject, timer })
      cdp
        .send('Target.sendMessageToTarget', {
          sessionId,
          message: JSON.stringify({ id, method, params }),
        })
        .catch((error) => {
          clearTimeout(timer)
          pending.delete(id)
          reject(error)
        })
    })
  await send('Runtime.enable')
  await send('Network.enable')
  return {
    send,
    requests,
    exceptions,
    async evaluate(expression) {
      const result = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      })
      assert(!result.exceptionDetails, JSON.stringify(result.exceptionDetails))
      return result.result.value
    },
    async close() {
      for (const handler of pending.values()) {
        clearTimeout(handler.timer)
        handler.reject(new Error('Worker CDP closed'))
      }
      pending.clear()
      await cdp.send('Target.detachFromTarget', { sessionId }).catch(() => {})
      await cdp.detach()
    },
  }
}

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-unsafe-webgpu', '--enable-unsafe-swiftshader'],
})
const context = await browser.newContext({
  locale: 'en-US',
  viewport: { width: 1280, height: 900 },
  reducedMotion: 'reduce',
})
const page = await context.newPage()
const pageCDP = await context.newCDPSession(page)
const errors = []
const consoleMessages = []
const failedRequests = []
const result = { base, modelCache, artworkCache, completed: [] }
let worker
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => {
  if (['error', 'warning'].includes(message.type())) consoleMessages.push(message.text())
})
page.on('requestfailed', (request) =>
  failedRequests.push({ url: request.url(), error: request.failure()?.errorText }),
)
const passed = (step) => {
  result.completed.push(step)
  console.log(`Passed: ${step}`)
}
const responseInfo = async ({ url, cacheName }) => {
  const response = cacheName
    ? await (await caches.open(cacheName)).match(url)
    : await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(90_000) })
  if (!response) return null
  const bytes = await response.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return {
    status: response.status,
    bytes: bytes.byteLength,
    sha256: Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(''),
  }
}
const readResponse = (path, cacheName) => page.evaluate(responseInfo, { url: url(path), cacheName })
const waitCached = (path, cacheName = modelCache) =>
  page.waitForFunction(
    async ({ url, cacheName }) => !!(await (await caches.open(cacheName)).match(url)),
    { url: url(path), cacheName },
    { timeout: 90_000 },
  )
const snapshot = () =>
  page.evaluate(async () =>
    Object.fromEntries(
      await Promise.all(
        (await caches.keys()).map(async (name) => [
          name,
          (await (await caches.open(name)).keys()).map((request) => request.url).sort(),
        ]),
      ),
    ),
  )
const setOffline = async (offline) => {
  await context.setOffline(offline)
  await pageCDP.send('Network.overrideNetworkState', {
    offline,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  })
}
const proveOffline = () =>
  page.evaluate(async () => {
    try {
      await fetch(`/robots.txt?offline-proof=${Date.now()}`, { cache: 'no-store' })
      return false
    } catch {
      return true
    }
  })
const showModel = async (id, name) => {
  await page.getByRole('searchbox').fill(String(id))
  await page.getByRole('button', { name: `View ${name}`, exact: true }).click()
  await page.waitForFunction((id) => location.hash.includes(`pokemon=${id}`), id)
  await page.getByText('LIVE VIEW', { exact: true }).waitFor({ timeout: 90_000 })
  assert.equal(await page.locator('h1').innerText(), `${name}.`)
  assert.equal(await page.locator('.loader').count(), 0)
}

try {
  // Seed an existing v1 cache before the first app visit and before any registration.
  const bootstrap = url('/__cache-retention-bootstrap')
  await page.route(bootstrap, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Cache seed</title>' }),
  )
  await page.goto(bootstrap)
  assert.equal(await page.evaluate(() => navigator.serviceWorker.controller), null)
  assert.equal(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), 0)
  await page.evaluate(
    async ({ cacheName, url }) => {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Seed fetch failed: ${response.status}`)
      await (await caches.open(cacheName)).put(url, response)
    },
    { cacheName: modelCache, url: modelUrl(41) },
  )
  result.seed = await readResponse(modelUrl(41), modelCache)
  assert(result.seed.bytes > 0)
  await page.unroute(bootstrap)

  // Exercise the first-visit gap deterministically, without replacing the fetched body.
  // This is installed after the seed page and runs only for the initial deep link.
  await page.addInitScript((targetUrl) => {
    if (location.pathname !== '/' || new URLSearchParams(location.hash.slice(1)).get('pokemon') !== '500')
      return
    const serviceWorker = navigator.serviceWorker
    const nativeRegister = serviceWorker.register.bind(serviceWorker)
    const nativeFetch = window.fetch.bind(window)
    let bodyReceived
    const firstBodyReady = new Promise((resolve) => {
      bodyReceived = resolve
    })
    const probe = { registerCalls: [], fetchStarted: false }
    window.__atlasInitialFetch = probe
    serviceWorker.addEventListener('controllerchange', () => {
      if (serviceWorker.controller) {
        probe.controllerAcquiredAt = performance.now()
        probe.controllerAfterAcquisition = serviceWorker.controller.scriptURL
      }
    })
    serviceWorker.register = async (...args) => {
      const call = { requestedAt: performance.now() }
      probe.registerCalls.push(call)
      await firstBodyReady
      call.invokedAt = performance.now()
      return nativeRegister(...args)
    }
    window.fetch = async (input, init) => {
      const requestUrl = input instanceof Request ? input.url : new URL(String(input), location.href).href
      if (requestUrl !== targetUrl || probe.fetchStarted) return nativeFetch(input, init)
      probe.fetchStarted = true
      probe.fetchStartedAt = performance.now()
      probe.controllerAtFetchStart = serviceWorker.controller?.scriptURL || null
      try {
        const response = await nativeFetch(input, init)
        const bytes = await response.clone().arrayBuffer()
        probe.bodyCompletedAt = performance.now()
        probe.controllerAtBodyComplete = serviceWorker.controller?.scriptURL || null
        const digest = await crypto.subtle.digest('SHA-256', bytes)
        probe.response = {
          status: response.status,
          bytes: bytes.byteLength,
          sha256: Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(''),
        }
        bodyReceived()
        return response
      } catch (error) {
        probe.error = String(error)
        throw error
      }
    }
  }, modelUrl(500))
  const started = performance.now()
  await page.goto(url('/?lang=en#pokemon=500&scene=studio'))
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 120_000 })
  result.initialSWControlMs = Math.round(performance.now() - started)
  result.firstUncontrolledModelFetch = await page.evaluate(() => window.__atlasInitialFetch)
  const initialFetch = result.firstUncontrolledModelFetch
  assert.equal(initialFetch.fetchStarted, true)
  assert.equal(initialFetch.controllerAtFetchStart, null)
  assert.equal(initialFetch.controllerAtBodyComplete, null)
  assert.equal(initialFetch.response.status, 200)
  assert.equal(initialFetch.response.bytes, models[500].bytes)
  assert(initialFetch.registerCalls.length > 0)
  assert(initialFetch.registerCalls.every((call) => call.invokedAt >= initialFetch.bodyCompletedAt))
  assert(initialFetch.controllerAcquiredAt >= initialFetch.bodyCompletedAt)
  assert(initialFetch.controllerAfterAcquisition)
  await page.getByText('LIVE VIEW', { exact: true }).waitFor({ timeout: 90_000 })
  assert.equal(await page.locator('h1').innerText(), 'Emboar.')
  // No explicit fetch of model 500 before this assertion: first-visit saving is the app's job.
  await waitCached(modelUrl(500))
  result.firstDeepLinkModel = await readResponse(modelUrl(500), modelCache)
  assert.deepEqual(result.firstDeepLinkModel, initialFetch.response)
  assert.deepEqual(await readResponse(modelUrl(41), modelCache), result.seed)
  const initialCaches = await snapshot()
  const precacheUrls = Object.entries(initialCaches)
    .filter(([name]) => name.includes('precache'))
    .flatMap(([, urls]) => urls)
  const precachePaths = new Set(precacheUrls.map((value) => new URL(value).pathname))
  result.initialPrecacheCount = precacheUrls.length
  assert(result.initialPrecacheCount > 0 && result.initialPrecacheCount < 150)
  for (const locale of locales) assert(precachePaths.has(`/locales/manifests/${locale}.webmanifest`), locale)
  assert.equal([...precachePaths].filter((path) => path.startsWith('/locales/catalog/')).length, 12)
  assert(!precachePaths.has('/artwork/500.webp'))
  worker = await attachWorker(
    browser,
    await page.evaluate(() => navigator.serviceWorker.controller.scriptURL),
  )
  passed(
    'Model 500 fetched fully before SW registration, then saved after control; existing v1 model preserved',
  )

  result.onlineModels = {}
  for (const id of modelIds) {
    result.onlineModels[id] = await readResponse(modelUrl(id))
    assert.equal(result.onlineModels[id].status, 200)
    assert.equal(result.onlineModels[id].bytes, models[id].bytes)
    if (id !== 6) await waitCached(modelUrl(id))
  }
  result.onlineArtwork = await readResponse('/artwork/500.webp')
  assert.equal(result.onlineArtwork.status, 200)
  assert(result.onlineArtwork.bytes > 0)
  await waitCached('/artwork/500.webp', artworkCache)
  assert.deepEqual(await readResponse(modelUrl(1), modelCache), result.onlineModels[1])
  assert.deepEqual(await readResponse(modelUrl(41), modelCache), result.seed)
  const retained = await snapshot()
  for (const id of modelIds.filter((id) => id !== 6))
    assert(retained[modelCache].includes(modelUrl(id)), `Missing model ${id}`)
  result.retainedRuntimeModelCount = retained[modelCache].length
  assert(result.retainedRuntimeModelCount > 24)
  passed('All 40 requested models remain available beyond the old 24-model limit')

  result.agedDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toUTCString()
  await page.evaluate(
    async ({ entries, date }) => {
      for (const { cacheName, url } of entries) {
        const cache = await caches.open(cacheName)
        const response = await cache.match(url)
        if (!response) throw new Error(`Cannot age missing entry ${url}`)
        const headers = new Headers(response.headers)
        headers.set('Date', date)
        await cache.put(url, new Response(await response.arrayBuffer(), { status: response.status, headers }))
        if ((await cache.match(url)).headers.get('Date') !== date) throw new Error('Date header was not aged')
      }
    },
    {
      entries: [
        { cacheName: modelCache, url: modelUrl(1) },
        { cacheName: artworkCache, url: url('/artwork/500.webp') },
      ],
      date: result.agedDate,
    },
  )
  await setOffline(true)
  assert(
    await proveOffline(),
    'An uncached request must fail, independently proving offline network emulation',
  )
  result.offlineModels = {}
  for (const id of modelIds) {
    result.offlineModels[id] = await readResponse(modelUrl(id))
    assert.deepEqual(result.offlineModels[id], result.onlineModels[id], `Offline model ${id} differs`)
  }
  result.offlineArtwork = await readResponse('/artwork/500.webp')
  assert.deepEqual(result.offlineArtwork, result.onlineArtwork)
  assert.deepEqual(await readResponse(modelUrl(41)), result.seed)
  const afterOffline = await snapshot()
  for (const cacheName of [modelCache, artworkCache]) {
    for (const cachedUrl of retained[cacheName])
      assert(afterOffline[cacheName].includes(cachedUrl), `Entry expired: ${cachedUrl}`)
  }
  passed('45-day-old model and artwork plus all 40 models retain identical bodies offline')

  result.offlineManifests = await page.evaluate(async (locales) => {
    const records = []
    for (const locale of locales) {
      const response = await fetch(`/locales/manifests/${locale}.webmanifest`, { cache: 'no-store' })
      const manifest = await response.json()
      if (
        response.status !== 200 ||
        manifest.lang !== locale ||
        manifest.start_url !== '/' ||
        manifest.display !== 'standalone'
      ) {
        throw new Error(`Invalid offline manifest: ${locale}`)
      }
      records.push({ locale, status: response.status, lang: manifest.lang, dir: manifest.dir })
    }
    return records
  }, locales)
  assert.equal(result.offlineManifests.length, 49)
  await showModel(32, 'Nidoran♂')
  await page.screenshot({ path: `${output}/offline-model-32.png`, fullPage: true })
  await showModel(33, 'Nidorino')
  await page.screenshot({ path: `${output}/offline-model-33.png`, fullPage: true })
  passed('All 49 manifests and the 32nd/33rd models work offline without prior locale visits')

  await setOffline(false)
  // A deliberately uncached request verifies that the worker network observer is active.
  const probeUrl = modelUrl(43)
  assert.equal(await readResponse(probeUrl, modelCache), null)
  const probeStart = worker.requests.length
  assert.equal((await readResponse(probeUrl)).status, 200)
  await waitCached(probeUrl)
  await worker.evaluate('true')
  assert(
    worker.requests.slice(probeStart).some((entry) => entry.request.url === probeUrl),
    'Worker network observer did not see its positive control',
  )
  const revisitStart = worker.requests.length
  await showModel(32, 'Nidoran♂')
  assert.deepEqual(await readResponse(modelUrl(32)), result.onlineModels[32])
  await worker.evaluate('true')
  result.revisit32NetworkRequests = worker.requests
    .slice(revisitStart)
    .filter((entry) => entry.request.url === modelUrl(32)).length
  assert.equal(
    result.revisit32NetworkRequests,
    0,
    'A saved model must not be fetched again after reconnecting',
  )
  await page.screenshot({ path: `${output}/reconnected-model-32.png`, fullPage: true })
  passed('Reconnected model 32 renders with zero service-worker network requests')

  const quotaUrl = modelUrl(42)
  assert.equal(await readResponse(quotaUrl, modelCache), null)
  await worker.evaluate(`(() => {
    const original = Cache.prototype.put;
    self.__atlasQuotaProbe = { url: ${JSON.stringify(quotaUrl)}, attempts: 0, throws: 0, restored: false, recoveryComplete: false };
    let quotaSettled;
    self.__atlasQuotaSettled = new Promise(resolve => { quotaSettled = resolve; });
    const onQuotaSettled = event => {
      if (event.reason?.name !== 'QuotaExceededError' || event.reason?.message !== 'One-shot cache retention test') return;
      self.__atlasQuotaProbe.recoveryComplete = true;
      self.removeEventListener('unhandledrejection', onQuotaSettled);
      quotaSettled(true);
    };
    self.addEventListener('unhandledrejection', onQuotaSettled);
    self.__atlasRestorePut = () => {
      Cache.prototype.put = original;
      self.removeEventListener('unhandledrejection', onQuotaSettled);
      self.__atlasQuotaProbe.restored = true;
    };
    Cache.prototype.put = function(request, response) {
      const requestUrl = typeof request === 'string' ? new URL(request, self.location.href).href : request.url;
      if (requestUrl === self.__atlasQuotaProbe.url) {
        self.__atlasQuotaProbe.attempts++;
        if (!self.__atlasQuotaProbe.throws) {
          self.__atlasQuotaProbe.throws++;
          return Promise.reject(new DOMException('One-shot cache retention test', 'QuotaExceededError'));
        }
      }
      return original.call(this, request, response);
    };
    return true;
  })()`)
  result.quotaNetworkResponse = await readResponse(quotaUrl)
  assert.equal(result.quotaNetworkResponse.status, 200)
  assert.equal(result.quotaNetworkResponse.bytes, models[42].bytes)
  // Workbox rethrows only after all quota cleanup callbacks have completed.
  // Cache names disappear before their IndexedDB metadata has finished clearing.
  assert.equal(await worker.evaluate('self.__atlasQuotaSettled'), true)
  await page.waitForFunction(
    async (names) => (await caches.keys()).every((name) => !names.includes(name)),
    [modelCache, artworkCache],
    { timeout: 30_000 },
  )
  result.quotaProbe = await worker.evaluate('self.__atlasQuotaProbe')
  assert.equal(result.quotaProbe.throws, 1)
  assert.equal(result.quotaProbe.recoveryComplete, true)
  const afterQuota = await snapshot()
  for (const [name, entries] of Object.entries(initialCaches).filter(([name]) => name.includes('precache'))) {
    assert.deepEqual(afterQuota[name], entries, 'Quota recovery must preserve the application shell')
  }
  assert.deepEqual(await readResponse(quotaUrl), result.quotaNetworkResponse)
  await waitCached(quotaUrl)
  assert.deepEqual(await readResponse(quotaUrl, modelCache), result.quotaNetworkResponse)
  result.quotaProbe = await worker.evaluate('self.__atlasQuotaProbe')
  assert(result.quotaProbe.attempts >= 2)
  await worker.evaluate('self.__atlasRestorePut()')
  result.quotaProbe = await worker.evaluate('self.__atlasQuotaProbe')
  assert.equal(result.quotaProbe.restored, true)
  await showModel(6, 'Charizard')
  await setOffline(true)
  await page.reload()
  await page.getByText('LIVE VIEW', { exact: true }).waitFor({ timeout: 90_000 })
  assert.equal(await page.locator('h1').innerText(), 'Charizard.')
  assert(await proveOffline(), 'Real network requests must still fail after the cached reload')
  // Chromium may reset navigator.onLine after a cached navigation; network emulation remains active.
  await setOffline(true)
  await page.getByText('You’re offline.', { exact: false }).waitFor()
  assert.deepEqual(await readResponse(quotaUrl), result.quotaNetworkResponse)
  await page.screenshot({ path: `${output}/offline-after-quota.png`, fullPage: true })
  passed('One-shot quota failure preserves readable data and shell, and the next save succeeds')

  assert.deepEqual(errors, [])
  result.errors = errors
  result.workerExceptions = worker.exceptions
  result.unexpectedWorkerExceptions = worker.exceptions.filter(
    (entry) =>
      !entry.exceptionDetails.exception?.description?.includes(
        'QuotaExceededError: One-shot cache retention test',
      ),
  )
  assert.deepEqual(result.unexpectedWorkerExceptions, [])
  result.workerNetworkRequests = worker.requests.map((entry) => ({
    url: entry.request.url,
    type: entry.type,
  }))
  result.finalCaches = await snapshot()
  await writeFile(`${output}/verification.json`, JSON.stringify(result, null, 2))
  console.log(`Cache retention passed: ${result.completed.length} sections. Evidence: ${output}`)
} catch (error) {
  const [screenshot, body, state] = await Promise.allSettled([
    page.screenshot({ path: `${output}/failure.png`, fullPage: true, timeout: 10_000 }),
    page.locator('body').innerText({ timeout: 10_000 }),
    page.evaluate(async () => ({
      online: navigator.onLine,
      initialFetch: window.__atlasInitialFetch,
      controller: navigator.serviceWorker.controller?.scriptURL,
      registrations: (await navigator.serviceWorker.getRegistrations()).map((registration) => ({
        scope: registration.scope,
        installing: registration.installing?.state,
        waiting: registration.waiting?.state,
        active: registration.active?.state,
      })),
      cacheNames: await caches.keys(),
    })),
  ])
  await writeFile(
    `${output}/failure-diagnostics.json`,
    JSON.stringify(
      {
        error: { name: error.name, message: error.message, stack: error.stack },
        url: page.url(),
        screenshot: screenshot.status === 'fulfilled' ? 'failure.png' : String(screenshot.reason),
        body: body.status === 'fulfilled' ? body.value : String(body.reason),
        state: state.status === 'fulfilled' ? state.value : String(state.reason),
        result,
        consoleMessages,
        failedRequests,
        errors,
        workerExceptions: worker?.exceptions,
        workerNetworkRequests: worker?.requests.map((entry) => ({
          url: entry.request.url,
          type: entry.type,
        })),
      },
      null,
      2,
    ),
  ).catch((diagnosticError) => console.error('Failed to save diagnostics:', diagnosticError))
  throw error
} finally {
  await worker?.evaluate('self.__atlasRestorePut?.()').catch(() => {})
  await worker?.close().catch(() => {})
  await browser.close()
}
