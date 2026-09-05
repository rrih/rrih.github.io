import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { chromium, expect } from '@playwright/test'
import { siteOrigin } from './helpers.mjs'

const origin = 'https://rrih.github.io'
const output = process.env.ATLAS_QA_DIR || 'work/expansion/qa-privacy'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--enable-unsafe-swiftshader'] })
const context = await browser.newContext({ locale: 'en-US', serviceWorkers: 'block', viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' })
const googleRequests = [], collected = [], blocked = [], errors = []
let failModel = false
await context.route('**/*', async route => {
  const request = route.request(), url = new URL(request.url())
  if (url.origin === origin) {
    if (failModel && url.pathname === '/atlas/models/home/500.glb') return route.fulfill({ status: 503, body: 'Temporary model failure' })
    const response = await route.fetch({ url: `${siteOrigin}${url.pathname}${url.search}`, headers: { 'Cache-Control': 'no-cache' }, maxRedirects: 0 })
    return route.fulfill({ response })
  }
  if (url.hostname === 'fundingchoicesmessages.google.com' || url.hostname === 'pagead2.googlesyndication.com') return route.fulfill({ status: 200, contentType: 'text/javascript', body: '' })
  if (/(^|\.)google-analytics\.com$/.test(url.hostname)) {
    collected.push({ url: request.url(), body: request.postData() || '' })
    return route.fulfill({ status: 204, body: '' })
  }
  if (url.hostname === 'www.googletagmanager.com' && url.pathname === '/gtag/js') {
    googleRequests.push(url.href)
    const response = await route.fetch({ maxRedirects: 0 })
    assert(response.status() < 300, 'Google tag script must not redirect outside the allowlist')
    return route.fulfill({ response })
  }
  blocked.push(request.url())
  return route.abort('blockedbyclient')
})
const page = await context.newPage()
page.on('pageerror', error => errors.push(error.message))
const ready = async () => { await page.locator('.live-label').getByText('LIVE VIEW', { exact: true }).waitFor({ timeout: 120000 }); await page.locator('.loader').waitFor({ state: 'hidden' }) }
const openPrivacy = async () => { const panel = page.locator('.privacy-settings'); if (await panel.getAttribute('open') === null) await panel.locator('summary').click() }
const events = () => collected.flatMap(record => {
  const query = new URL(record.url).searchParams
  return (record.body ? record.body.split('\n') : ['']).map(body => {
    const params = new URLSearchParams(query)
    for (const [key, value] of new URLSearchParams(body)) params.set(key, value)
    return Object.fromEntries(params)
  })
})
const named = name => events().filter(event => event.en === name)
const choose = async (id, name) => {
  await page.getByRole('searchbox', { name: 'Search Pokémon by name or number', exact: true }).fill(String(id))
  await page.getByRole('link', { name: `View ${name}`, exact: true }).click()
}
const telemetryQueued = () => page.evaluate(() => (window.dataLayer || []).map(item => Array.from(item)).filter(item => item[0] === 'event' && ['atlas_web_vital', 'atlas_model_load'].includes(item[1])))
const result = { actualGoogleLibrary: true, measurementEndpointsIntercepted: true }
try {
  await page.goto(`${origin}/atlas/pokemon/6/?lang=en`)
  await ready()
  await page.waitForTimeout(700)
  assert.equal(googleRequests.length, 0)
  assert.equal(collected.length, 0)
  assert.equal((await telemetryQueued()).length, 0)
  await page.getByRole('button', { name: 'Decline', exact: true }).click()
  await page.reload()
  await ready()
  await page.waitForTimeout(400)
  assert.equal(googleRequests.length, 0)
  await openPrivacy()
  await page.getByRole('button', { name: 'Accept analytics', exact: true }).click()
  await expect.poll(() => named('page_view').length, { timeout: 30000 }).toBe(1)
  const first = named('page_view')[0]
  assert.equal(first.tid, 'G-4GYW68LVTM')
  assert.equal(first.dl, `${origin}/atlas/`)
  assert.equal(first.dt, 'Pokémon Atlas')
  assert(!first.dr)
  await page.getByRole('button', { name: 'side', exact: true }).click()
  await page.waitForTimeout(1000)
  assert.equal((await telemetryQueued()).length, 0, 'New consent never replays the already-finished model or prior CWV')
  assert.equal(named('atlas_web_vital').length, 0)
  assert.equal(named('atlas_model_load').length, 0)
  result.noRetroactiveMetricsAfterNewConsent = true

  await page.getByRole('searchbox', { name: 'Search Pokémon by name or number', exact: true }).fill('private-search-999')
  await page.getByRole('button', { name: 'Together', exact: true }).click()
  await ready()
  await page.getByRole('textbox', { name: 'Scene name', exact: true }).fill('private-scene-999')
  await page.locator('.background-picker input[type=file]').setInputFiles({ name: 'private-photo-999.jpg', mimeType: 'image/jpeg', buffer: await readFile('public/social.jpg') })
  await page.locator('.viewer-stage.custom').waitFor()
  await expect.poll(() => named('atlas_model_load').filter(event => event['ep.outcome'] === 'ready' && event['ep.view_mode'] === 'together').length, { timeout: 30000 }).toBe(1)
  assert.equal(named('page_view').length, 1)
  await page.getByRole('button', { name: 'Solo view', exact: true }).click()
  await choose(25, 'Pikachu')
  await ready()
  await expect.poll(() => named('page_view').length, { timeout: 30000 }).toBe(2)
  await expect.poll(() => named('atlas_model_load').some(event => event['ep.outcome'] === 'ready' && event['ep.view_mode'] === 'solo'), { timeout: 30000 }).toBe(true)
  failModel = true
  await choose(500, 'Emboar')
  await page.locator('.viewer-error').waitFor()
  await expect.poll(() => named('atlas_model_load').some(event => event['ep.outcome'] === 'failed'), { timeout: 30000 }).toBe(true)
  result.modelLoadReadyAndFailed = named('atlas_model_load').map(event => ({ outcome: event['ep.outcome'], mode: event['ep.view_mode'], ms: Number(event['epn.model_load_ms']) }))
  for (const value of result.modelLoadReadyAndFailed) assert(Number.isFinite(value.ms) && value.ms >= 0)
  assert.equal(named('atlas_web_vital').length, 0, 'Even new interactions do not enable CWV retrospectively in this visit')
  failModel = false

  // A fresh navigation begins with accepted consent and uses the real web-vitals package.
  const readyLoadsBeforeReturn = named('atlas_model_load').filter(event => event['ep.outcome'] === 'ready').length
  await page.goto(`${origin}/atlas/pokemon/25/?lang=en`)
  await ready()
  await expect.poll(() => named('page_view').length, { timeout: 30000 }).toBe(4)
  await expect.poll(() => named('atlas_model_load').filter(event => event['ep.outcome'] === 'ready').length, { timeout: 30000 }).toBe(readyLoadsBeforeReturn + 1)
  result.returnVisitInitialModelMeasuredOnce = true
  await page.getByRole('button', { name: 'side', exact: true }).click()
  await page.waitForTimeout(700)
  result.beforeLifecycle = await page.evaluate(() => ({ visibility: document.visibilityState, supported: PerformanceObserver.supportedEntryTypes, queued: (window.dataLayer || []).map(item => Array.from(item)).filter(item => item[0] === 'event'), resources: performance.getEntriesByType('resource').filter(item => /vitals/i.test(item.name)).map(item => item.name) }))
  await page.waitForTimeout(5500)
  // Headless Chrome keeps pages visible even when navigating/activating another tab.
  // Simulate only the hidden lifecycle signal; the metrics and trusted interaction are native.
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); dispatchEvent(new Event('visibilitychange')) })
  result.lifecycleSignal = 'Simulated hidden visibility event; real web-vitals package and native metric entries'
  await expect.poll(() => named('atlas_web_vital').some(event => event['ep.metric_name'] === 'LCP'), { timeout: 30000 }).toBe(true)
  await expect.poll(() => [...new Set(named('atlas_web_vital').map(event => event['ep.metric_name']))].sort(), { timeout: 30000 }).toEqual(['CLS', 'INP', 'LCP'])
  const vitals = named('atlas_web_vital')
  assert(vitals.length > 0)
  for (const event of vitals) {
    assert(['LCP', 'CLS', 'INP'].includes(event['ep.metric_name']))
    assert(Number.isFinite(Number(event['epn.metric_value'])) && Number(event['epn.metric_value']) >= 0)
    assert(Number.isFinite(Number(event['epn.metric_delta'])) && Number(event['epn.metric_delta']) >= 0)
    assert(['good', 'needs-improvement', 'poor'].includes(event['ep.metric_rating']))
    assert(/^[\w-]{1,96}$/.test(event['ep.metric_id']))
  }
  await page.evaluate(() => { delete document.visibilityState; dispatchEvent(new Event('visibilitychange')) })
  result.returnVisitWebVitals = vitals.map(event => ({ name: event['ep.metric_name'], value: Number(event['epn.metric_value']), rating: event['ep.metric_rating'] }))

  await page.goto(`${origin}/atlas/pokemon/25/?lang=en`)
  await ready()
  await openPrivacy()
  // Let the SDK finish batches already accepted before withdrawal.
  await page.waitForTimeout(6000)
  await page.getByRole('button', { name: 'Stop analytics', exact: true }).click()
  await page.waitForTimeout(500)
  const afterStop = collected.length, queuedAfterStop = (await telemetryQueued()).length
  await choose(7, 'Squirtle')
  await ready()
  await page.getByRole('button', { name: 'side', exact: true }).click()
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); dispatchEvent(new Event('visibilitychange')) })
  await page.waitForTimeout(5500)
  assert.equal((await telemetryQueued()).length, queuedAfterStop, 'No model or lifecycle command is queued after withdrawal')
  await page.goto(`${origin}/`)
  await page.waitForTimeout(1500)
  assert.equal(collected.length, afterStop, 'Withdrawal stops page, model and lifecycle metrics')
  const cookies = await context.cookies(origin)
  assert(!cookies.some(cookie => cookie.name === '_ga' || cookie.name === '_ga_4GYW68LVTM'))
  const scriptsBefore = googleRequests.length
  await page.goto(`${origin}/atlas/pokemon/7/?lang=en`)
  await ready()
  await page.waitForTimeout(700)
  assert.equal(googleRequests.length, scriptsBefore, 'Declined consent survives a fresh navigation')
  assert.equal((await telemetryQueued()).length, 0)
  result.withdrawStopsEventsAndClearsCookies = true
  result.withdrawalBoundary = 'No new measurement commands or events after withdrawal; already-processed pre-withdrawal SDK batches are drained before this assertion'
  result.queuedBeforeWithdrawal = queuedAfterStop

  const raw = JSON.stringify(events())
  for (const privateValue of ['private-search-999', 'private-scene-999', 'private-photo-999', '/pokemon/', '/models/', 'data:image/', 'blob:']) assert(!raw.includes(privateValue), `No private page/model or user data: ${privateValue}`)
  for (const event of events()) {
    if (event.dl) assert.equal(event.dl, `${origin}/atlas/`)
    if (event.dt) assert.equal(event.dt, 'Pokémon Atlas')
    assert(!event.dr)
    assert(!Object.keys(event).some(key => /(?:pokemon|species|form)_?id|model_url|image_name|search_term|scene_name/i.test(key)))
  }
  assert.deepEqual(errors, [])
  await page.screenshot({ path: `${output}/declined.png`, fullPage: true })
  await writeFile(`${output}/results.json`, JSON.stringify({ ...result, noModelIdentityOrPrivateInput: true, blocked, errors }, null, 2))
  await writeFile(`${output}/captured-events.json`, JSON.stringify(events(), null, 2))
  console.log('Actual GA tag: consent timing, ready/failed loads, return-visit CWV, safe fields and withdrawal verified; no measurement sent to Google.')
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true }).catch(() => {})
  await writeFile(`${output}/failure-events.json`, JSON.stringify({ ...result, error: String(error), stack: error.stack, events: events(), googleRequests, blocked, errors }, null, 2))
  throw error
} finally { await browser.close() }
