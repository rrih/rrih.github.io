import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const base = process.env.ATLAS_URL || 'http://127.0.0.1:3335'
const output = process.env.ATLAS_QA_DIR || 'work/i18n/pwa'
const source = (path) => new URL(`../${path}`, import.meta.url)
const readJSON = async (path) => JSON.parse(await readFile(source(path), 'utf8'))
const dictionaries = Object.fromEntries(
  await Promise.all(
    ['en', 'fr', 'ja', 'ar'].map(async (code) => [code, await readJSON(`src/locales/ui/${code}.json`)]),
  ),
)
const entries = await readJSON('src/data/catalog.json')
const charizard = entries.find(({ id }) => id === 6)
const emboar = entries.find(({ id }) => id === 500)
const model500 = (await readJSON('src/data/models.json'))['500']
assert.equal(model500.url, '/models/home/500.glb')
const catalogFiles = (await readdir(source('public/locales/catalog/')))
  .filter((name) => name.endsWith('.json'))
  .sort()
assert.equal(catalogFiles.length, 12, 'The release must contain exactly 12 local catalogs')
const catalogSources = await Promise.all(
  catalogFiles.map(async (name) => {
    const bytes = await readFile(source(`public/locales/catalog/${name}`))
    return {
      path: `/locales/catalog/${name}`,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      data: JSON.parse(bytes.toString('utf8')),
    }
  }),
)
const expectedCatalogPaths = catalogSources.map(({ path }) => path)
const translated = Object.fromEntries(catalogSources.map(({ data }) => [data.locale, data]))
await mkdir(output, { recursive: true })
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-unsafe-webgpu', '--enable-unsafe-swiftshader'],
})
// A new context has no saved language, HTTP cache, Cache Storage, or visited translations.
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  locale: 'en-US',
  reducedMotion: 'reduce',
  serviceWorkers: 'allow',
})
context.setDefaultTimeout(30_000)
let page = await context.newPage()
let phase = 'online-en'
const errors = []
const consoleMessages = []
const failedRequests = []
const catalogResponses = []
const result = { base, onlineUiLocales: ['en'], offlineSwitches: [] }
const observe = (target) => {
  target.on('pageerror', (error) => errors.push({ phase, message: error.message }))
  target.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) consoleMessages.push({ phase, text: message.text() })
  })
  target.on('requestfailed', (request) =>
    failedRequests.push({ phase, url: request.url(), error: request.failure()?.errorText }),
  )
  target.on('response', (response) => {
    if (new URL(response.url()).pathname.startsWith('/locales/catalog/')) {
      catalogResponses.push({
        phase,
        path: new URL(response.url()).pathname,
        status: response.status(),
        fromServiceWorker: response.fromServiceWorker(),
      })
    }
  })
}
observe(page)
const live = async (target, code) => {
  await target
    .locator(`.app-shell[data-locale="${code}"][data-catalog-state="ready"]`)
    .waitFor({ timeout: 120_000 })
  await target.getByText(dictionaries[code]['LIVE VIEW'], { exact: true }).waitFor({ timeout: 120_000 })
  await target.locator('.loader').waitFor({ state: 'hidden' })
  assert.equal(await target.locator('html').getAttribute('lang'), code)
  assert.equal(await target.locator('html').getAttribute('dir'), code === 'ar' ? 'rtl' : 'ltr')
  assert.equal(await target.locator('.viewer-error').count(), 0)
}
const description = async (target, uiLocale, entryLocale) => {
  const expected = entryLocale === 'en' ? charizard : translated[entryLocale].species['6']
  const text = target.locator('.detail-panel .description')
  assert.equal(await text.getAttribute('lang'), entryLocale)
  assert.equal(await text.innerText(), expected.description)
  assert.equal(await target.locator('h1 bdi').innerText(), expected.name)
  if (uiLocale === 'ar') {
    assert.equal(await target.locator('.entry-language').innerText(), dictionaries.ar['English entry'])
  } else {
    assert.equal(await target.locator('.entry-language').count(), 0)
  }
  return { uiLocale, entryLocale, name: expected.name, description: expected.description }
}
const cachedPaths = (target) =>
  target.evaluate(async () => {
    const paths = []
    for (const name of await caches.keys()) {
      for (const request of await (await caches.open(name)).keys()) paths.push(new URL(request.url).pathname)
    }
    return paths
  })
const offlineState = async (target, code) => {
  // Chromium can reset navigator.onLine on a cached navigation in Playwright.
  // Prove a real uncached request fails before emulating the OS network-state event.
  assert(
    await target.evaluate(async () => {
      try {
        await fetch(`/robots.txt?localization-offline-proof=${Date.now()}`, { cache: 'no-store' })
        return false
      } catch {
        return true
      }
    }),
    'An uncached real network request must fail while offline',
  )
  const cdp = await context.newCDPSession(target)
  await cdp.send('Network.overrideNetworkState', {
    offline: true,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  })
  await target.waitForFunction(() => !navigator.onLine)
  await target
    .getByText(dictionaries[code]['You’re offline. Recently viewed Pokémon may still be available.'], {
      exact: true,
    })
    .waitFor()
  return cdp
}

try {
  const started = performance.now()
  await page.goto(`${base}/?lang=en#pokemon=6`, { waitUntil: 'domcontentloaded' })
  await live(page, 'en')
  assert.equal(await page.evaluate(() => localStorage.getItem('atlas-language')), null)
  await description(page, 'en', 'en')
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 120_000 })
  // Controller/registration alone is insufficient: check the saved responses themselves.
  await page.waitForFunction(
    async (paths) => {
      const saved = new Set()
      for (const name of (await caches.keys()).filter((name) => name.includes('precache'))) {
        const cache = await caches.open(name)
        for (const request of await cache.keys()) {
          const path = new URL(request.url).pathname
          if (paths.includes(path) && (await cache.match(request))?.ok) saved.add(path)
        }
      }
      return paths.every((path) => saved.has(path))
    },
    [...expectedCatalogPaths, '/models/home/6.glb'],
    { timeout: 120_000 },
  )
  result.cacheSaveMs = Math.round(performance.now() - started)
  const precache = await page.evaluate(async () => {
    const names = (await caches.keys()).filter((name) => name.includes('precache'))
    const urls = []
    const catalogs = []
    for (const name of names) {
      const cache = await caches.open(name)
      for (const request of await cache.keys()) {
        urls.push(request.url)
        const path = new URL(request.url).pathname
        if (!path.startsWith('/locales/catalog/')) continue
        const response = await cache.match(request)
        const bytes = await response.arrayBuffer()
        catalogs.push({
          path,
          status: response.status,
          bytes: bytes.byteLength,
          sha256: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (byte) =>
            byte.toString(16).padStart(2, '0'),
          ).join(''),
        })
      }
    }
    return { names, urls, catalogs }
  })
  assert.equal(precache.catalogs.length, 12, 'All 12 catalog responses must actually be precached')
  assert.deepEqual(precache.catalogs.map(({ path }) => path).sort(), expectedCatalogPaths)
  for (const expected of catalogSources) {
    const actual = precache.catalogs.find(({ path }) => path === expected.path)
    assert.equal(actual.status, 200, expected.path)
    assert.equal(actual.bytes, expected.bytes, expected.path)
    assert.equal(
      actual.sha256,
      expected.sha256,
      `Saved catalog content must match the release: ${expected.path}`,
    )
  }
  assert(!(await cachedPaths(page)).includes(model500.url), 'Model 500 must never have been cached')
  result.precache = {
    cacheNames: precache.names,
    assetCount: precache.urls.length,
    catalogCount: precache.catalogs.length,
    catalogs: precache.catalogs,
  }
  result.manifest = await page.evaluate(async () => {
    const response = await fetch(document.querySelector('link[rel="manifest"]').href)
    if (!response.ok) throw new Error('Manifest could not be read')
    return response.json()
  })
  assert.equal(result.manifest.start_url, '/')
  assert.equal(result.manifest.id, '/')
  assert.equal(result.manifest.lang, 'en')
  assert.equal(result.manifest.display, 'standalone')
  assert(result.manifest.icons.some(({ purpose }) => purpose?.split(' ').includes('maskable')))

  phase = 'offline-en-reload'
  await context.setOffline(true)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await live(page, 'en')
  const firstCdp = await offlineState(page, 'en')
  await description(page, 'en', 'en')
  result.offlineReload = true
  for (const code of ['fr', 'ja', 'ar']) {
    phase = `offline-first-${code}`
    await page.locator('.language-button').click()
    await page.locator(`[data-language="${code}"]`).click()
    await live(page, code)
    assert.equal(await page.evaluate(() => navigator.onLine), false)
    assert.equal(await page.evaluate(() => localStorage.getItem('atlas-language')), code)
    assert.equal(new URL(page.url()).searchParams.get('lang'), code)
    result.offlineSwitches.push(await description(page, code, code === 'ar' ? 'en' : code))
    await page.screenshot({ path: `${output}/offline-first-${code}.png`, fullPage: true })
  }
  for (const code of ['fr', 'ja', 'ja-Hrkt']) {
    assert(
      catalogResponses.some(
        (response) =>
          response.path === `/locales/catalog/${code}.json` &&
          response.phase.startsWith('offline-first-') &&
          response.status === 200 &&
          response.fromServiceWorker,
      ),
      `${code} must be served locally by the service worker on its first UI use`,
    )
  }
  assert(!(await cachedPaths(page)).includes(model500.url))
  await firstCdp.detach()
  await page.close()

  phase = 'offline-saved-ar-launch'
  page = await context.newPage()
  observe(page)
  const launchUrl = new URL(result.manifest.start_url, base).href
  assert.equal(new URL(launchUrl).search, '')
  assert.equal(new URL(launchUrl).hash, '')
  // Launch the manifest URL in a fresh document, without an explicit ?lang=ar.
  await page.goto(launchUrl, { waitUntil: 'domcontentloaded' })
  await live(page, 'ar')
  const launchCdp = await offlineState(page, 'ar')
  assert.equal(await page.evaluate(() => localStorage.getItem('atlas-language')), 'ar')
  result.offlineSavedLanguageLaunch = {
    requestedUrl: launchUrl,
    savedLocale: 'ar',
    ...(await description(page, 'ar', 'en')),
  }
  await page.screenshot({ path: `${output}/offline-ar-start-url.png`, fullPage: true })

  phase = 'offline-uncached-500'
  assert(!(await cachedPaths(page)).includes(model500.url), 'Model 500 must still be absent before selection')
  await page.getByRole('searchbox').fill('500')
  await page
    .getByRole('button', { name: dictionaries.ar['View {name}'].replace('{name}', emboar.name), exact: true })
    .click()
  const guidance = dictionaries.ar['Connect to the internet to open this Pokémon for the first time.']
  await page.locator('.viewer-error').getByText(guidance, { exact: true }).waitFor({ timeout: 30_000 })
  assert.equal(await page.locator('h1 bdi').innerText(), emboar.name)
  assert.equal(await page.locator('html').getAttribute('lang'), 'ar')
  result.uncachedModel = { id: 500, path: model500.url, guidanceLocale: 'ar', guidance }
  await page.screenshot({ path: `${output}/offline-ar-uncached-500.png`, fullPage: true })

  phase = 'reconnect-ar-500'
  await context.setOffline(false)
  await launchCdp.send('Network.overrideNetworkState', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  })
  await page.waitForFunction(() => navigator.onLine)
  await page.getByRole('button', { name: dictionaries.ar['Try again'], exact: true }).click()
  await live(page, 'ar')
  assert.equal(await page.locator('h1 bdi').innerText(), emboar.name)
  await page.waitForFunction(
    async (path) => {
      const response = await (await caches.open('atlas-models-v1')).match(path)
      return response?.ok && (await response.arrayBuffer()).byteLength > 0
    },
    model500.url,
    { timeout: 30_000 },
  )
  assert.equal(
    await page
      .locator('.offline-notice')
      .filter({ hasText: dictionaries.ar['You’re offline. Recently viewed Pokémon may still be available.'] })
      .count(),
    0,
  )
  result.reconnectRetry = true
  result.recoveredModelCached = true
  result.browserStateEmulation =
    'Real network failure checked before CDP overrideNetworkState after each cached navigation'
  result.catalogResponses = catalogResponses
  assert.deepEqual(errors, [], 'No unhandled browser errors are allowed')
  result.errors = errors
  await page.screenshot({ path: `${output}/reconnected-ar-500.png`, fullPage: true })
  await writeFile(`${output}/verification.json`, `${JSON.stringify(result, null, 2)}\n`)
  console.log(JSON.stringify(result, null, 2))
} catch (error) {
  const [screenshot, body, state] = await Promise.allSettled([
    page.screenshot({ path: `${output}/failure.png`, fullPage: true, timeout: 10_000 }),
    page.locator('body').innerText({ timeout: 10_000 }),
    page.evaluate(async () => ({
      online: navigator.onLine,
      language: document.documentElement.lang,
      savedLanguage: localStorage.getItem('atlas-language'),
      controller: navigator.serviceWorker.controller?.scriptURL,
      registrations: (await navigator.serviceWorker.getRegistrations()).map((registration) => ({
        scope: registration.scope,
        installing: registration.installing?.state,
        waiting: registration.waiting?.state,
        active: registration.active?.state,
      })),
      caches: await caches.keys(),
    })),
  ])
  await writeFile(
    `${output}/failure-diagnostics.json`,
    JSON.stringify(
      {
        phase,
        url: page.url(),
        error: { name: error.name, message: error.message, stack: error.stack },
        screenshot: screenshot.status === 'fulfilled' ? 'failure.png' : String(screenshot.reason),
        body: body.status === 'fulfilled' ? body.value : String(body.reason),
        state: state.status === 'fulfilled' ? state.value : String(state.reason),
        result,
        catalogResponses,
        consoleMessages,
        failedRequests,
        errors,
      },
      null,
      2,
    ),
  ).catch((diagnosticError) => console.error('Failed to save failure diagnostics:', diagnosticError))
  throw error
} finally {
  await browser.close()
}
