import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const base = process.env.ATLAS_URL || 'http://127.0.0.1:3335'
const output = process.env.ATLAS_QA_DIR || 'work/qa-pwa'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-unsafe-webgpu', '--enable-unsafe-swiftshader'],
})
const context = await browser.newContext({ locale: 'en-US', viewport: { width: 1280, height: 900 } })
const page = await context.newPage()
const errors = []
const consoleMessages = []
const failedRequests = []
page.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning') consoleMessages.push(message.text())
})
page.on('requestfailed', (request) =>
  failedRequests.push({ url: request.url(), error: request.failure()?.errorText }),
)
page.on('pageerror', (error) => errors.push(error.message))
const readRuntimeArtwork = async () => {
  const response = await fetch('/artwork/500.webp')
  const bytes = await response.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return {
    status: response.status,
    contentType: response.headers.get('content-type'),
    bytes: bytes.byteLength,
    sha256: Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(''),
  }
}
try {
  const initialVisitStartedAt = performance.now()
  await page.goto(base)
  await page
    .waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 120_000 })
    .catch(async (error) => {
      const diagnostics = await page.evaluate(async () => ({
        registrations: (await navigator.serviceWorker.getRegistrations()).map((registration) => ({
          scope: registration.scope,
          installing: registration.installing?.state,
          waiting: registration.waiting?.state,
          active: registration.active?.state,
        })),
        caches: await caches.keys(),
      }))
      await writeFile(
        `${output}/install-diagnostics.json`,
        JSON.stringify(
          {
            initialSWControlMs: Math.round(performance.now() - initialVisitStartedAt),
            diagnostics,
            consoleMessages,
            failedRequests,
          },
          null,
          2,
        ),
      )
      throw error
    })
  const initialSWControlMs = Math.round(performance.now() - initialVisitStartedAt)
  const initialPrecacheUrls = await page.evaluate(async () => {
    const names = (await caches.keys()).filter((name) => name.includes('precache'))
    const requests = await Promise.all(names.map(async (name) => (await caches.open(name)).keys()))
    return requests.flat().map((request) => request.url)
  })
  const initialPrecacheCount = initialPrecacheUrls.length
  assert(
    initialPrecacheCount > 0 && initialPrecacheCount < 150,
    'First installation must precache fewer than 150 assets, including all language manifests',
  )
  assert(
    !initialPrecacheUrls.some((url) => new URL(url).pathname === '/artwork/500.webp'),
    'Artwork 500 must exercise runtime caching, not precaching',
  )
  console.log(
    `Service worker controls the first visit after ${initialSWControlMs} ms with ${initialPrecacheCount} precached assets`,
  )
  await page.getByText('LIVE VIEW', { exact: true }).waitFor({ timeout: 60_000 })
  const manifest = await page.evaluate(async () =>
    (await fetch(document.querySelector('link[rel=manifest]').href)).json(),
  )
  assert.equal(manifest.display, 'standalone')
  assert(manifest.icons.some((icon) => icon.purpose === 'maskable'))
  const onlineRuntimeArtwork = await page.evaluate(readRuntimeArtwork)
  assert.equal(onlineRuntimeArtwork.status, 200)
  assert(onlineRuntimeArtwork.contentType?.includes('image/webp'))
  assert(onlineRuntimeArtwork.bytes > 0)
  await page.waitForFunction(
    async () => !!(await (await caches.open('atlas-artwork-v1')).match('/artwork/500.webp')),
  )
  await context.setOffline(true)
  await page.reload()
  await page.getByText('LIVE VIEW', { exact: true }).waitFor({ timeout: 60_000 })
  // Chromium resets navigator.onLine on a cached navigation in current Playwright.
  // Verify the network failure independently, then emulate the OS network-state event.
  assert(
    await page.evaluate(async () => {
      try {
        await fetch(`/robots.txt?offline-proof=${Date.now()}`, { cache: 'no-store' })
        return false
      } catch {
        return true
      }
    }),
    'An uncached real network request must fail while offline',
  )
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.overrideNetworkState', {
    offline: true,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  })
  await page.getByText('You’re offline.', { exact: false }).waitFor()

  const artwork = await page
    .locator('.pokemon-card img')
    .evaluateAll((images) => images.filter((image) => image.complete && image.naturalWidth > 0).length)
  assert(artwork > 0, 'Collection artwork is cached')
  const offlineRuntimeArtwork = await page.evaluate(readRuntimeArtwork)
  assert.deepEqual(
    offlineRuntimeArtwork,
    onlineRuntimeArtwork,
    'A thumbnail outside the initial 24 must remain identical offline',
  )
  console.log('Offline application, default model, and runtime artwork passed')
  await page.screenshot({ path: `${output}/offline.png`, fullPage: true })
  await page.getByRole('searchbox').fill('500')
  await page.getByRole('button', { name: 'View Emboar', exact: true }).click()
  await page
    .getByText('Connect to the internet to open this Pokémon for the first time.', { exact: true })
    .waitFor({ timeout: 20_000 })
  await page.screenshot({ path: `${output}/offline-uncached.png`, fullPage: true })
  await context.setOffline(false)
  await cdp.send('Network.overrideNetworkState', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  })
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await page.getByText('LIVE VIEW', { exact: true }).waitFor({ timeout: 90_000 })
  assert.equal(await page.locator('h1').innerText(), 'Emboar.')
  console.log('Uncached model guidance and reconnection retry passed')
  await page.getByRole('searchbox').fill('6')
  await page.getByRole('button', { name: 'View Charizard', exact: true }).click()
  await page.getByText('LIVE VIEW', { exact: true }).waitFor({ timeout: 60_000 })
  await page.getByRole('button', { name: 'Studio', exact: true }).click()
  await page.getByRole('button', { name: 'Shiny appearance', exact: true }).click()
  await page.getByText('LIVE VIEW', { exact: true }).waitFor({ timeout: 90_000 })
  await page.waitForFunction(async () => {
    const cache = await caches.open('atlas-models-v1')
    return (await cache.keys()).some((request) => request.url.includes('/shiny/6.glb'))
  })
  console.log('Online shiny model rendered and entered the model cache')
  await context.setOffline(true)
  await page.reload()
  await page.getByText('LIVE VIEW', { exact: true }).waitFor({ timeout: 60_000 })
  assert((await page.evaluate(() => location.hash)).includes('shiny=1'))
  await context.setOffline(false)
  assert.deepEqual(errors, [])
  const result = {
    base,
    manifest: true,
    controlsFirstVisit: true,
    initialSWControlMs,
    initialPrecacheCount,
    runtimeArtworkCache: 'atlas-artwork-v1',
    runtimeArtworkPath: '/artwork/500.webp',
    onlineRuntimeArtwork,
    offlineRuntimeArtwork,
    offlineReload: true,
    offline3D: true,
    uncachedNetworkFailed: true,
    browserStateEmulation: 'CDP overrideNetworkState after cached reload',
    offlineArtwork: true,
    uncachedMessage: true,
    reconnectRetry: true,
    shinyCachedOffline: true,
    errors,
  }
  await writeFile(`${output}/verification.json`, JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result, null, 2))
} catch (error) {
  const [screenshot, body, browserState] = await Promise.allSettled([
    page.screenshot({ path: `${output}/failure.png`, fullPage: true, timeout: 10_000 }),
    page.locator('body').innerText({ timeout: 10_000 }),
    page.evaluate(async () => ({
      online: navigator.onLine,
      controller: navigator.serviceWorker.controller
        ? {
            scriptURL: navigator.serviceWorker.controller.scriptURL,
            state: navigator.serviceWorker.controller.state,
          }
        : null,
      registrations: (await navigator.serviceWorker.getRegistrations()).map((registration) => ({
        scope: registration.scope,
        installing: registration.installing?.state,
        waiting: registration.waiting?.state,
        active: registration.active?.state,
      })),
    })),
  ])
  const diagnostics = {
    error: { name: error.name, message: error.message, stack: error.stack },
    url: page.url(),
    screenshot: screenshot.status === 'fulfilled' ? 'failure.png' : String(screenshot.reason),
    body: body.status === 'fulfilled' ? body.value : String(body.reason),
    browserState: browserState.status === 'fulfilled' ? browserState.value : String(browserState.reason),
    consoleMessages,
    failedRequests,
    errors,
  }
  await writeFile(`${output}/failure-diagnostics.json`, JSON.stringify(diagnostics, null, 2)).catch(
    (diagnosticError) => console.error('Failed to save failure diagnostics:', diagnosticError),
  )
  throw error
} finally {
  await browser.close()
}
