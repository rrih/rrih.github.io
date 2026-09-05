import { siteDist } from './helpers.mjs'
import assert from 'node:assert/strict'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { chromium, expect } from '@playwright/test'

// Actual Google libraries and CMP; ad delivery and measurement never leave this browser.
// Run after the mocked suite, against an existing local build. No account/admin session is used.
const origin = 'https://rrih.github.io'
const dist = resolve(process.env.ATLAS_DIST || siteDist)
const output = resolve(process.env.ATLAS_QA_DIR || 'work/ads/google-cmp')
const client = 'ca-pub-6426570202991325'
const slot = '9649739784'
const timeout = Number(process.env.ATLAS_CMP_TIMEOUT || 30_000)
const mime = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary',
}

function classifyRequest(address, method, resourceType) {
  const url = new URL(address)
  if (url.origin === origin) return 'local'
  if (url.protocol !== 'https:') return 'blocked-unknown'
  // Block delivery, click, impression, conversion and diagnostic/measurement beacons before any allowlist.
  if (
    resourceType === 'ping' ||
    /(?:^|\.)(?:google-analytics\.com|googletagmanager\.com|doubleclick\.net)$/.test(url.hostname) &&
      !url.pathname.startsWith('/pagead/managed/') ||
    /\/(?:pagead\/)?(?:ads|adview|activeview|aclk|click|conversion|viewthroughconversion|gen_204|collect|log|logging|el|event|events|measurement|interaction|ptracking|pcs)(?:[/.]|$)/i.test(url.pathname) ||
    /\/(?:logging_library|err_rep)\.js$/.test(url.pathname)
  ) return 'blocked-ad-or-measurement'
  if (method !== 'GET') return 'blocked-unknown'
  if (
    url.hostname === 'pagead2.googlesyndication.com' &&
    (url.pathname === '/pagead/js/adsbygoogle.js' ||
      /^\/pagead\/managed\/js\/.*\.js$/.test(url.pathname) ||
      /^\/pagead\/js\/[\w-]+\.js$/.test(url.pathname))
  ) return 'google-sdk'
  if (
    ['pagead2.googlesyndication.com', 'googleads.g.doubleclick.net'].includes(url.hostname) &&
    url.pathname.startsWith('/pagead/managed/dict/')
  ) return 'google-sdk-config'
  // FC configuration, scripts, frames and consent UI. Tracking/beacon paths remain blocked above.
  if (
    url.hostname === 'fundingchoicesmessages.google.com' &&
    (/^\/i\/pub-\d+$/.test(url.pathname) && resourceType === 'script' ||
      /^\/f\/[^/]+$/.test(url.pathname) && ['script', 'document', 'xhr', 'fetch'].includes(resourceType))
  ) return 'google-cmp'
  if (
    ['www.gstatic.com', 'fonts.gstatic.com', 'fonts.googleapis.com'].includes(url.hostname) &&
    ['script', 'stylesheet', 'font', 'image'].includes(resourceType)
  ) return 'google-static'
  if (
    url.hostname === 'tpc.googlesyndication.com' && resourceType === 'script' &&
    /^\/pagead\/(?:js|managed\/js)\/.*\.js$/.test(url.pathname)
  ) return 'google-sdk'
  return 'blocked-unknown'
}

// This mode verifies the network boundary without creating directories, fetching URLs or launching Chrome.
if (process.argv.includes('--check-policy')) {
  for (const url of [
    'https://googleads.g.doubleclick.net/pagead/ads?client=test',
    'https://pagead2.googlesyndication.com/pagead/ads?client=test',
    'https://pagead2.googlesyndication.com/pagead/adview',
    'https://pagead2.googlesyndication.com/pagead/gen_204',
    'https://www.google-analytics.com/g/collect',
    'https://fundingchoicesmessages.google.com/el/test',
    'https://fundingchoicesmessages.google.com/metrics?event=impression',
    'https://fundingchoicesmessages.google.com/_/ContributorServingWebSwitchboardHttp/jserror',
    'https://example.com/advertisement.js',
  ]) assert.match(classifyRequest(url, 'GET', 'script'), /^blocked-/)
  assert.equal(classifyRequest(`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`, 'GET', 'script'), 'google-sdk')
  assert.equal(classifyRequest('https://fundingchoicesmessages.google.com/i/pub-6426570202991325', 'GET', 'script'), 'google-cmp')
  assert.equal(classifyRequest('https://fundingchoicesmessages.google.com/i/pub-6426570202991325', 'POST', 'fetch'), 'blocked-unknown')
  console.log('Network policy checks passed; no browser launched and no requests sent.')
  process.exit(0)
}

if (!process.argv.includes('--run')) {
  console.log('Prepared only. Use --check-policy for offline boundary checks, or --run to explicitly launch the Google CMP browser QA.')
  process.exit(0)
}

await readFile(resolve(dist, 'index.html'))
await mkdir(output, { recursive: true })
const files = new Map()
const results = []
const browser = await chromium.launch({
  channel: 'chrome', headless: true,
  args: ['--enable-unsafe-webgpu', '--enable-unsafe-swiftshader'],
})

// Observers only: do not manufacture applicability, purpose choices, consent strings or ad flags.
function observeGoogle({ preservePreview }) {
  if (window.top !== window) return
  const evidence = window.__atlasGoogleCmp = { callbacks: [], tcf: [], gpp: [], us: [], errors: [] }
  const remember = (collection, value) => {
    try { evidence[collection].push({ at: performance.now(), ...JSON.parse(JSON.stringify(value)) }) }
    catch (error) { evidence.errors.push(String(error)) }
  }
  const tcfApis = new Set()
  const gppApis = new Set()
  const attach = () => {
    if (typeof window.__tcfapi === 'function' && !tcfApis.has(window.__tcfapi)) {
      tcfApis.add(window.__tcfapi)
      try { window.__tcfapi('addEventListener', 0, (data, success) => remember('tcf', { success, data })) }
      catch (error) { evidence.errors.push(String(error)) }
    }
    if (typeof window.__gpp === 'function' && !gppApis.has(window.__gpp)) {
      gppApis.add(window.__gpp)
      try { window.__gpp('addEventListener', (data, success) => remember('gpp', { success, data })) }
      catch (error) { evidence.errors.push(String(error)) }
    }
  }
  window.googlefc ??= {}
  window.googlefc.callbackQueue ??= []
  for (const key of ['CONSENT_API_READY', 'CONSENT_DATA_READY']) {
    window.googlefc.callbackQueue.push({ [key]: () => {
      evidence.callbacks.push({ key, at: performance.now() })
      attach()
    } })
  }
  window.googlefc.callbackQueue.push({ INITIAL_US_STATES_OPT_OUT_DATA_READY: () => {
    evidence.callbacks.push({ key: 'INITIAL_US_STATES_OPT_OUT_DATA_READY', at: performance.now() })
    try { remember('us', { status: window.googlefc.usstatesoptout.getInitialUsStatesOptOutStatus() }) }
    catch (error) { evidence.errors.push(String(error)) }
    attach()
  } })
  if (preservePreview) {
    // The app canonicalizes its query. Preserve Google's documented preview parameters only in this QA context.
    const replace = history.replaceState
    history.replaceState = function (state, title, address) {
      if (address != null) {
        const next = new URL(address, location.href)
        if (next.origin === location.origin) {
          next.searchParams.set('fc', 'alwaysshow')
          next.searchParams.set('fctype', preservePreview)
          address = next.href
        }
      }
      return replace.call(this, state, title, address)
    }
  }
}

async function snapshot(page) {
  const main = await page.evaluate(() => ({
    url: location.href,
    evidence: window.__atlasGoogleCmp,
    sdkPrivacySetters: {
      pause: typeof Object.getOwnPropertyDescriptor(window.adsbygoogle || {}, 'pauseAdRequests')?.set === 'function',
      npa: typeof Object.getOwnPropertyDescriptor(window.adsbygoogle || {}, 'requestNonPersonalizedAds')?.set === 'function',
    },
    paused: window.adsbygoogle?.pauseAdRequests,
    nonPersonalized: window.adsbygoogle?.requestNonPersonalizedAds,
    adsLibraryLoaded: window.adsbygoogle?.loaded,
    queueLength: Array.isArray(window.adsbygoogle) ? window.adsbygoogle.length : null,
    tcfCallable: typeof window.__tcfapi === 'function',
    gppCallable: typeof window.__gpp === 'function',
    fcKeys: Object.keys(window.googlefc || {}),
    scripts: [...document.scripts].map((script) => ({ src: script.src, id: script.id, status: script.dataset.adsbygoogleStatus })),
    slots: [...document.querySelectorAll('ins.adsbygoogle')].map((element) => ({
      html: element.outerHTML.slice(0, 2000), width: element.getBoundingClientRect().width,
      height: element.getBoundingClientRect().height,
    })),
  }))
  main.frames = await Promise.all(page.frames().map(async (frame) => ({
    url: frame.url(), name: frame.name(),
    text: await frame.locator('body').innerText({ timeout: 3000 }).then((text) => text.slice(0, 20_000)).catch(String),
  })))
  return main
}

async function capture(page, directory, name) {
  const state = await snapshot(page)
  await writeFile(`${directory}/${name}.json`, JSON.stringify(state, null, 2))
  await page.screenshot({ path: `${directory}/${name}.png`, fullPage: true, timeout: 20_000 }).catch(() => {})
  return state
}

async function findReject(page) {
  for (const frame of page.frames()) {
    const button = frame.getByRole('button', { name: /^(Do not consent|同意しない)$/i }).first()
    if (await button.isVisible().catch(() => false)) return button
  }
  return null
}

async function scenario(name, preview, inspect) {
  if (process.env.ATLAS_CASE && process.env.ATLAS_CASE !== name) return
  const directory = `${output}/${name}`
  await mkdir(directory, { recursive: true })
  const context = await browser.newContext({
    locale: 'en-US', viewport: { width: 1280, height: 950 },
    reducedMotion: 'reduce', serviceWorkers: 'block',
  })
  const page = await context.newPage()
  const requests = []
  const responses = []
  const errors = []
  const messages = []
  const outstandingRoutes = new Set()
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) messages.push(message.text())
  })
  context.on('response', (response) => {
    if (!response.url().startsWith(origin)) responses.push({ url: response.url(), status: response.status() })
  })
  await context.addInitScript(observeGoogle, { preservePreview: preview })
  await context.route('**/*', async (route) => {
    const operation = (async () => {
      const request = route.request()
      const url = new URL(request.url())
      const decision = classifyRequest(url.href, request.method(), request.resourceType())
      if (decision !== 'local') requests.push({ url: url.href, method: request.method(), type: request.resourceType(), decision })
      if (decision.startsWith('blocked-')) return route.abort('blockedbyclient')
      if (decision === 'local') {
        try {
          let path = resolve(dist, `.${decodeURIComponent(url.pathname)}`)
          if (path !== dist && !path.startsWith(`${dist}${sep}`)) throw new Error('Path escapes local build')
          if ((await stat(path)).isDirectory()) path = resolve(path, 'index.html')
          if (!files.has(path)) files.set(path, await readFile(path))
          return route.fulfill({ contentType: mime[extname(path)] || 'application/octet-stream', body: files.get(path) })
        } catch (error) {
          errors.push(`Local asset ${url.href}: ${error}`)
          return route.fulfill({ status: 404, body: 'Local build asset not found' })
        }
      }
      try {
        if (url.hostname === 'pagead2.googlesyndication.com' && url.pathname === '/pagead/js/adsbygoogle.js') {
          // Observe the app's flags before the real SDK consumes them into setter-only properties.
          await page.evaluate(() => {
            window.__atlasGoogleCmp.sdkBootstrap = {
              paused: window.adsbygoogle?.pauseAdRequests,
              nonPersonalized: window.adsbygoogle?.requestNonPersonalizedAds,
              privacyTreatments: document.getElementById('atlas-advertising')?.dataset.privacyTreatments,
            }
          })
        }
        // No redirects: an allowed script must not redirect past the network boundary to an ad endpoint.
        const fetchUrl = new URL(url)
        if (preview && url.hostname === 'fundingchoicesmessages.google.com' && url.pathname.startsWith('/i/')) {
          // The standalone tag is configured server-side before page preview activates. Forward
          // the same documented preview parameters for a complete Google-generated preview API.
          // No production tag or returned consent signal is modified.
          fetchUrl.searchParams.set('fc', 'alwaysshow')
          fetchUrl.searchParams.set('fctype', preview)
          requests.push({ url: fetchUrl.href, decision: 'google-cmp-preview-configuration' })
        }
        const response = await route.fetch({ url: fetchUrl.href, maxRedirects: 0, timeout: 20_000 })
        if (response.status() >= 300 && response.status() < 400) {
          requests.push({ url: url.href, decision: 'blocked-redirect', location: response.headers().location })
          return route.abort('blockedbyclient')
        }
        return route.fulfill({ response })
      } catch (error) {
        requests.push({ url: url.href, decision: 'network-error', error: String(error) })
        return route.abort('failed').catch(() => {})
      }
    })()
    outstandingRoutes.add(operation)
    try { await operation } finally { outstandingRoutes.delete(operation) }
  })
  let result = { name, status: 'running' }
  try {
    await page.goto(`${origin}/atlas/?lang=en${preview ? `&fc=alwaysshow&fctype=${preview}` : ''}#pokemon=6&scene=studio`, {
      waitUntil: 'domcontentloaded', timeout: 60_000,
    })
    await expect(page.locator('.app-shell')).toHaveAttribute('data-locale', 'en', { timeout: 30_000 })
    const evidence = await inspect(page, directory, requests)
    result = { ...result, ...evidence, status: 'passed' }
  } catch (error) {
    result = { ...result, status: 'failed', error: String(error), stack: error.stack }
    await capture(page, directory, 'failure').catch(() => {})
  } finally {
    result.requests = requests
    result.responses = responses
    result.errors = errors
    result.consoleMessages = messages
    await writeFile(`${directory}/result.json`, JSON.stringify(result, null, 2))
    results.push(result)
    await writeFile(`${output}/verification.json`, JSON.stringify({ status: 'running', results }, null, 2))
    console.log(`${result.status.toUpperCase()} ${name}`)
    await context.close()
    await Promise.allSettled([...outstandingRoutes])
  }
}

try {
  await scenario('default-applicability', false, async (page, directory, requests) => {
    let settled = true
    try {
      await page.waitForFunction(() => {
        const state = window.__atlasGoogleCmp
        return state.tcf.some((entry) => entry.success && typeof entry.data?.gdprApplies === 'boolean') &&
          state.us.some((entry) => [1, 2, 3].includes(entry.status))
      }, null, { timeout })
    } catch { settled = false }
    const initial = await capture(page, directory, 'initial')
    if (!settled) {
      // A diagnostic push is allowed only while actual privacy flags remain paused/NPA.
      // It is recorded separately and cannot turn the normal bootstrap result into a pass.
      const diagnostic = await page.evaluate(({ client, slot }) => {
        const initial = window.__atlasGoogleCmp.sdkBootstrap
        if (initial?.paused !== 1 || initial?.nonPersonalized !== 1 || initial?.privacyTreatments !== 'disablePersonalization') return { submitted: false }
        // The actual SDK uses setter-only properties; reading them cannot verify their state.
        // Reassert the already configured pause/NPA controls, without changing any CMP consent data.
        window.adsbygoogle.pauseAdRequests = 1
        window.adsbygoogle.requestNonPersonalizedAds = 1
        const host = document.createElement('div')
        host.dataset.cmpBootstrapDiagnostic = 'true'
        const element = document.createElement('ins')
        element.className = 'adsbygoogle'
        element.style.cssText = 'display:inline-block;width:300px;height:50px'
        element.dataset.adClient = client
        element.dataset.adSlot = slot
        host.append(element)
        document.body.append(host)
        try { window.adsbygoogle.push({}); return { submitted: true, pausedAtSubmission: 1 } }
        catch (error) { return { submitted: false, error: String(error) } }
      }, { client, slot })
      try {
        await page.waitForFunction(() => window.__atlasGoogleCmp.callbacks.length > 0, null, { timeout: 15_000 })
      } catch { /* Preserve absent callbacks as evidence instead of inventing applicability. */ }
      const after = await capture(page, directory, 'after-paused-bootstrap-probe')
      await writeFile(`${directory}/bootstrap-diagnostic.json`, JSON.stringify({
        diagnostic,
        callbacksBefore: initial.evidence.callbacks,
        callbacksAfter: after.evidence.callbacks,
        possibleCircularGate: initial.evidence.callbacks.length === 0 && after.evidence.callbacks.length > 0,
      }, null, 2))
      throw new Error('Default CMP applicability did not settle without a diagnostic push; inspect bootstrap-diagnostic.json and blocked requests.')
    }
    const tcf = initial.evidence.tcf.filter((entry) => entry.success).at(-1)?.data
    const us = initial.evidence.us.at(-1)?.status
    assert.equal(tcf?.gdprApplies, false, 'Actual default egress must be confirmed non-GDPR; no forced regional override')
    assert.equal(us, 1, 'Actual default egress must return US DOES_NOT_APPLY')
    assert.equal(initial.evidence.sdkBootstrap.nonPersonalized, 1)
    await page.locator('.atlas-ad-slot').scrollIntoViewIfNeeded({ timeout: 15_000 })
    await expect.poll(() => requests.some((request) => new URL(request.url).pathname === '/pagead/ads' && new URL(request.url).searchParams.get('slotname') === slot), { timeout: 20_000 }).toBe(true)
    const request = requests.find((request) => new URL(request.url).pathname === '/pagead/ads' && new URL(request.url).searchParams.get('slotname') === slot)
    const parameters = Object.fromEntries(new URL(request.url).searchParams)
    assert.match(request.decision, /^blocked-/)
    assert.equal(parameters.npa, '1')
    assert.equal(parameters.ppt, '1')
    assert.equal(parameters.w, '728')
    assert.equal(parameters.h, '90')
    assert.equal(parameters.slotname, slot)
    await capture(page, directory, 'blocked-ad-request')
    return { applicability: { gdprApplies: tcf.gdprApplies, usStatus: us }, blockedAdRequest: parameters, snapshot: 'initial.json' }
  })

  await scenario('gdpr-preview-refuse-reopen', 'gdpr', async (page, directory, requests) => {
    // Google's documented preview: https://developers.google.com/funding-choices/fc-api-docs#testing-and-debugging-on-your-site
    await expect.poll(async () => !!(await findReject(page)), { timeout, intervals: [250, 500, 1000] }).toBe(true)
    await capture(page, directory, 'consent-message')
    await (await findReject(page)).click()
    await page.waitForFunction(() => window.__atlasGoogleCmp.tcf.some((entry) =>
      entry.success && entry.data?.eventStatus === 'useractioncomplete' && entry.data?.purpose?.consents?.[1] === false,
    ), null, { timeout: 15_000 })
    const refused = await capture(page, directory, 'refused')
    assert.equal(refused.evidence.sdkBootstrap.paused, 1, 'Ad requests started paused before the SDK consumed its flags')
    await expect(page.locator('ins.adsbygoogle[data-ad-slot]')).toHaveCount(0)
    const choices = page.getByRole('button', { name: 'Ad privacy choices', exact: true })
    await expect(choices).toBeVisible()
    await choices.click()
    await expect.poll(async () => !!(await findReject(page)), { timeout: 20_000, intervals: [250, 500, 1000] }).toBe(true)
    await capture(page, directory, 'reopened')
    await (await findReject(page)).click()
    assert.equal(requests.filter((request) => new URL(request.url).searchParams.get('slotname') === slot).length, 0)
    return { refused: true, footerReopenedActualGoogleMessage: true, manualSlotRequestsBeforeAndAfterRefusal: 0 }
  })

  await scenario('us-preview-opt-out', 'usnat', async (page, directory) => {
    const choices = page.getByRole('button', { name: 'Do not sell or share my personal information', exact: true })
    await expect(choices).toBeVisible({ timeout })
    await capture(page, directory, 'before-opt-out')
    await choices.click()
    let confirm
    await expect.poll(async () => {
      for (const frame of page.frames()) {
        const button = frame.getByRole('button', { name: /^(Confirm|Confirm choice|Opt out|Do not sell or share)$/i }).first()
        if (await button.isVisible().catch(() => false)) { confirm = button; return true }
      }
      return false
    }, { timeout, intervals: [250, 500, 1000] }).toBe(true)
    await capture(page, directory, 'confirmation')
    await confirm.click()
    await expect(choices).toHaveCount(0)
    await expect(page.locator('ins.adsbygoogle[data-ad-slot]')).toHaveCount(0)
    await capture(page, directory, 'opted-out')
    return { actualUsConfirmation: true, optOutRemovedAd: true }
  })

} finally {
  await browser.close()
  const status = results.length === (process.env.ATLAS_CASE ? 1 : 3) && results.every((result) => result.status === 'passed') ? 'passed' : 'failed'
  await writeFile(`${output}/verification.json`, JSON.stringify({
    status, testedAt: new Date().toISOString(),
    scope: 'Actual Google CMP, local application build, blocked ad delivery and measurement. No impressions or clicks.',
    results,
  }, null, 2))
  if (status !== 'passed') process.exitCode = 1
}
