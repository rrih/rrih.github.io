import { siteDist } from './helpers.mjs'
import assert from 'node:assert/strict'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { chromium, expect } from '@playwright/test'

// Serve only the local build under the eligible hostname. No route ever continues to the network.
const origin = 'https://rrih.github.io'
const dist = resolve(process.env.ATLAS_DIST || siteDist)
const output = resolve(process.env.ATLAS_QA_DIR || 'work/advertising/qa')
await readFile(resolve(dist, 'index.html'))
await mkdir(output, { recursive: true })
const mime = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.glb': 'model/gltf-binary',
}
const files = new Map()
const results = []
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-unsafe-webgpu', '--enable-unsafe-swiftshader'],
})

// Google FC callback keys and listener signatures follow the documented browser APIs:
// https://developers.google.com/funding-choices/fc-api-docs
// All strings below are fixtures, not valid consent strings or production ad responses.
function googleFixture(config) {
  const state = window.__atlasAdTest
  const accepted = {
    cmpStatus: 'loaded',
    eventStatus: 'tcloaded',
    gdprApplies: true,
    tcString: 'atlas-test-consent-fixture',
    purpose: { consents: { 1: true } },
    vendor: { consents: { 755: true } },
  }
  const denied = { ...accepted, purpose: { consents: { 1: false } } }
  let tcf =
    config.tcf === 'denied'
      ? denied
      : config.tcf === 'unknown'
        ? { cmpStatus: 'loading' }
        : config.tcf === 'error'
          ? { cmpStatus: 'error' }
          : config.tcf === 'not-applicable'
            ? { gdprApplies: false }
            : accepted
  let gpp = {
    eventName: 'listenerRegistered',
    pingData: {
      cmpStatus: 'loaded',
      signalStatus: config.gpp === 'unknown' ? 'not ready' : 'ready',
      gppString: 'atlas-test-gpp-fixture',
    },
  }
  const tcfListeners = []
  const gppListeners = []
  state.bootstrap = {
    paused: window.adsbygoogle?.pauseAdRequests,
    nonPersonalized: window.adsbygoogle?.requestNonPersonalizedAds,
    privacyTreatments: document.getElementById('atlas-advertising')?.dataset.privacyTreatments,
  }
  window.adsbygoogle.push = () => {
    const ins = [...document.querySelectorAll('ins.adsbygoogle')].find(
      (element) => !element.dataset.adsbygoogleStatus,
    )
    const rect = ins?.getBoundingClientRect()
    const parent = ins?.parentElement
    state.pushes.push({
      width: rect?.width,
      height: rect?.height,
      parentWidth: parent?.getBoundingClientRect().width,
      parentHeight: parent?.getBoundingClientRect().height,
      parentOverflow: parent && getComputedStyle(parent).overflow,
      client: ins?.dataset.adClient,
      slot: ins?.dataset.adSlot,
      paused: window.adsbygoogle.pauseAdRequests,
      nonPersonalized: window.adsbygoogle.requestNonPersonalizedAds,
      path: location.pathname,
    })
    if (!ins) throw new Error('Ad fixture received a request without a slot')
    ins.dataset.adsbygoogleStatus = 'done'
    ins.dataset.adStatus = config.unfilled ? 'unfilled' : 'filled'
    if (!config.unfilled) {
      const frame = document.createElement('iframe')
      frame.title = 'Simulated advertisement; no advertising request was sent'
      frame.width = String(rect.width)
      frame.height = String(rect.height)
      frame.style.border = '0'
      frame.srcdoc =
        '<style>body{margin:0;display:grid;place-items:center;height:100vh;background:#e5e7df;color:#344034;font:12px sans-serif}</style>Advertisement test fixture'
      ins.append(frame)
    }
  }
  if (config.deferCmp) { state.fixtureReady = true; return }
  const fc = window.googlefc
  fc.showRevocationMessage = () => {
    state.revocations++
    state.emitTcf(false)
  }
  fc.usstatesoptout.getInitialUsStatesOptOutStatus = () => config.usStatus ?? 1
  fc.usstatesoptout.openConfirmationDialog = (callback) => {
    state.usDialogs++
    callback(true)
  }
  state.emitTcf = (allow) => {
    tcf = { ...(allow ? accepted : denied), eventStatus: 'useractioncomplete' }
    for (const callback of tcfListeners) callback(tcf, true)
  }
  state.emitGppChange = () => {
    gpp = {
      eventName: 'signalStatus',
      pingData: { ...gpp.pingData, gppString: 'atlas-test-changed-gpp-fixture' },
    }
    for (const callback of gppListeners) callback(gpp, true)
  }
  if (!config.missingCmp) {
    window.__tcfapi = (command, version, callback) => {
      state.tcfSubscriptions.push({ command, version })
      tcfListeners.push(callback)
      callback(tcf, true)
    }
    window.__gpp = (command, callback) => {
      state.gppSubscriptions.push(command)
      gppListeners.push(callback)
      callback(gpp, true)
    }
  }
  const queued = Array.from(fc.callbackQueue)
  const invoke = (entry) => {
    if (typeof entry === 'function') entry()
    else
      for (const [key, callback] of Object.entries(entry)) {
        state.fcCallbacks.push(key)
        callback()
      }
  }
  fc.callbackQueue.push = (entry) => invoke(entry)
  for (const entry of queued) invoke(entry)
  state.fixtureReady = true
}

async function readLocal(url) {
  let path = resolve(dist, `.${decodeURIComponent(url.pathname)}`)
  if (path !== dist && !path.startsWith(`${dist}${sep}`)) throw new Error('Path escapes local build')
  if ((await stat(path)).isDirectory()) path = resolve(path, 'index.html')
  if (!files.has(path)) files.set(path, await readFile(path))
  return { path, body: files.get(path) }
}

async function scenario(name, config, run) {
  if (process.env.ATLAS_CASE && !process.env.ATLAS_CASE.split(',').includes(name)) return
  const context = await browser.newContext({
    locale: 'en-US',
    viewport: { width: config.width || 1280, height: 900 },
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  })
  const page = await context.newPage()
  page.setDefaultTimeout(30_000)
  const errors = []
  const consoleMessages = []
  const routes = { local: 0, ads: [], cmp: [], analytics: [], blocked: [], missing: [] }
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') consoleMessages.push(message.text())
  })
  await context.addInitScript(() => {
    window.__atlasAdTest = {
      documentId: `${Date.now()}-${Math.random()}`,
      pushes: [],
      tcfSubscriptions: [],
      gppSubscriptions: [],
      fcCallbacks: [],
      revocations: 0,
      usDialogs: 0,
      fixtureReady: false,
    }
  })
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.hostname === 'fundingchoicesmessages.google.com') {
      routes.cmp.push(url.href)
      if (config.cmpFailed) return route.abort('failed')
      if (config.cmpOwnFixture) return route.fulfill({ contentType: 'text/javascript', body: `(${googleFixture.toString()})(${JSON.stringify(config)});` })
      if (config.cmpDelayed) {
        await page.waitForFunction(() => window.__atlasAdTest.releaseCmp === true)
        return route.fulfill({ contentType: 'text/javascript', body: `(${googleFixture.toString()})(${JSON.stringify(config)});` })
      }
      return route.fulfill({ status: 200, contentType: 'text/javascript', body: '' })
    }
    if (url.hostname === 'pagead2.googlesyndication.com' && url.pathname === '/pagead/js/adsbygoogle.js') {
      routes.ads.push(url.href)
      if (config.scriptFailed) return route.abort('failed')
      return route.fulfill({
        contentType: 'application/javascript',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: `(${googleFixture.toString()})(${JSON.stringify({ ...config, deferCmp: config.cmpFailed || config.cmpDelayed })});`,
      })
    }
    if (url.hostname === 'www.googletagmanager.com' && url.pathname === '/gtag/js') {
      routes.analytics.push(url.href)
      return route.fulfill({ contentType: 'application/javascript', body: '/* analytics test fixture */' })
    }
    if (url.origin !== origin) {
      routes.blocked.push(url.href)
      return route.abort('blockedbyclient')
    }
    try {
      let { path, body } = await readLocal(url)
      if (extname(path) === '.html' && (config.farAway || config.hideIns)) {
        const css = config.farAway
          ? '.atlas-ad-placement{margin-block-start:1600px!important}'
          : '.adsbygoogle{display:none!important}'
        body = body.toString().replace('</head>', `<style>${css}</style></head>`)
      }
      routes.local++
      return route.fulfill({ contentType: mime[extname(path)] || 'application/octet-stream', body })
    } catch (error) {
      routes.missing.push({ url: url.href, message: String(error) })
      return route.fulfill({ status: 404, body: 'Local test asset not found' })
    }
  })
  try {
    await page.goto(`${origin}/atlas/?lang=${config.locale || 'en'}#pokemon=6&scene=studio`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    })
    await expect(page.locator('.app-shell')).toHaveAttribute('data-locale', config.locale || 'en')
    const evidence = await run(page, routes)
    assert.deepEqual(errors, [], `${name}: no unhandled application errors`)
    assert.deepEqual(routes.missing, [], `${name}: all requested local build assets must exist`)
    assert.deepEqual(routes.blocked, [], `${name}: application must not attempt other external requests`)
    results.push({ name, ...evidence, routes, errors })
    await writeFile(`${output}/verification.json`, JSON.stringify({ status: 'running', results }, null, 2))
    console.log(`PASS ${name}`)
  } catch (error) {
    const [screenshot, body, state] = await Promise.allSettled([
      page.screenshot({ path: `${output}/${name}-failure.png`, fullPage: true, timeout: 10_000 }),
      page.locator('body').innerText({ timeout: 10_000 }),
      readState(page),
    ])
    await writeFile(
      `${output}/failure.json`,
      JSON.stringify(
        {
          name,
          error: String(error),
          stack: error.stack,
          url: page.url(),
          results,
          routes,
          errors,
          consoleMessages,
          screenshot: screenshot.status === 'fulfilled' ? `${name}-failure.png` : String(screenshot.reason),
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

async function settle(page) {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  )
  await page.waitForTimeout(500)
}

async function readState(page) {
  return page.evaluate(() => {
    const { emitTcf, emitGppChange, ...state } = window.__atlasAdTest
    return { ...state, paused: window.adsbygoogle?.pauseAdRequests }
  })
}

async function waitFixture(page) {
  await page.waitForFunction(() => window.__atlasAdTest.fixtureReady)
  await settle(page)
}

async function showAd(page, width, height) {
  await waitFixture(page)
  await page.locator('.atlas-ad-placement').scrollIntoViewIfNeeded()
  await page.waitForFunction(() => window.__atlasAdTest.pushes.length > 0)
  await expect(page.locator('.atlas-ad-slot')).toBeVisible()
  await settle(page)
  const state = await readState(page)
  assert.equal(state.pushes.length, 1, 'At most one request per document')
  assert.deepEqual(state.bootstrap, {
    paused: 1,
    nonPersonalized: 1,
    privacyTreatments: 'disablePersonalization',
  })
  assert.deepEqual(state.tcfSubscriptions, [{ command: 'addEventListener', version: 0 }])
  assert.deepEqual(state.gppSubscriptions, ['addEventListener'])
  const request = state.pushes[0]
  assert.deepEqual(
    {
      width: request.width,
      height: request.height,
      parentWidth: request.parentWidth,
      parentHeight: request.parentHeight,
    },
    { width, height, parentWidth: width, parentHeight: height },
  )
  assert.equal(request.parentOverflow, 'visible', 'Fixed parent must not clip Google content')
  assert.equal(request.client, 'ca-pub-6426570202991325')
  assert.equal(request.slot, '9649739784')
  assert.equal(request.paused, 0)
  assert.equal(request.nonPersonalized, 1)
  return state
}

async function noAd(page, expectedPushes = 0) {
  await page.locator('.footer').scrollIntoViewIfNeeded()
  await settle(page)
  await expect(page.locator('ins.adsbygoogle')).toHaveCount(0)
  const state = await readState(page)
  assert.equal(state.pushes.length, expectedPushes)
  return state
}

async function changeLanguage(page, locale) {
  await page.locator('.language-button').click()
  await page.locator(`[data-language="${locale}"]`).click()
  await expect(page.locator('.app-shell')).toHaveAttribute('data-locale', locale)
  await settle(page)
}

try {
  await scenario('desktop-fixed-size-and-spa', {}, async (page, routes) => {
    await page.getByText('LIVE VIEW', { exact: true }).waitFor({ timeout: 120_000 })
    const first = await showAd(page, 728, 90)
    await page.screenshot({ path: `${output}/desktop.png`, fullPage: true })
    await page.getByRole('searchbox').fill('25')
    await page.getByRole('link', { name: 'View Pikachu', exact: true }).click()
    await expect(page.locator('h1')).toHaveText('Pikachu')
    await page.getByText('LIVE VIEW', { exact: true }).waitFor({ timeout: 120_000 })
    await changeLanguage(page, 'fr')
    await changeLanguage(page, 'en')
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.locator('.atlas-ad-slot')).toBeHidden()
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.locator('.atlas-ad-placement').scrollIntoViewIfNeeded()
    await expect(page.locator('.atlas-ad-slot')).toBeVisible()
    const last = await readState(page)
    assert.equal(last.documentId, first.documentId)
    assert.deepEqual(last.pushes, first.pushes, 'SPA, language changes, and resize must not refresh the unit')
    assert.equal(routes.ads.length, 1)
    assert.equal(routes.analytics.length, 0)
    return {
      size: '728x90',
      live3D: ['Charizard', 'Pikachu'],
      requests: 1,
      preservedAcrossSpaAndResize: true,
    }
  })

  for (const [name, viewport, width, height] of [
    ['mobile', 390, 320, 50],
    ['narrow-mobile', 300, 300, 50],
    ['medium', 600, 468, 60],
  ]) {
    await scenario(name, { width: viewport }, async (page) => {
      await showAd(page, width, height)
      if (name === 'mobile') {
        await page.getByText('LIVE VIEW', { exact: true }).waitFor({ timeout: 120_000 })
        await page.screenshot({ path: `${output}/mobile.png`, fullPage: true })
      }
      return { viewport, size: `${width}x${height}`, requests: 1 }
    })
  }

  await scenario('too-narrow', { width: 299 }, async (page) => {
    await waitFixture(page)
    await noAd(page)
    await expect(page.locator('.atlas-ad-placement')).toHaveAttribute('data-state', 'empty')
    return { viewport: 299, requests: 0 }
  })

  await scenario('lazy-until-near-viewport', { farAway: true }, async (page) => {
    await waitFixture(page)
    assert((await page.locator('.atlas-ad-placement').boundingBox()).y > 1100)
    assert.equal((await readState(page)).pushes.length, 0)
    await showAd(page, 728, 90)
    return { beforeApproach: 0, afterApproach: 1 }
  })

  for (const [name, config] of [
    ['tcf-rejected', { tcf: 'denied' }],
    ['tcf-unknown', { tcf: 'unknown' }],
    ['cmp-error', { tcf: 'error' }],
    ['cmp-missing', { missingCmp: true }],
    ['us-unknown', { tcf: 'not-applicable', usStatus: 0 }],
    ['us-opted-out', { tcf: 'not-applicable', usStatus: 3 }],
    ['gpp-not-ready', { tcf: 'not-applicable', usStatus: 2, gpp: 'unknown' }],
  ]) {
    await scenario(name, config, async (page) => {
      await waitFixture(page)
      const state = await noAd(page)
      assert.equal(state.paused, 1)
      return { requests: 0, paused: true }
    })
  }

  await scenario('script-failure', { scriptFailed: true }, async (page, routes) => {
    await page.waitForFunction(() => !document.getElementById('atlas-advertising'))
    await noAd(page)
    assert.equal(routes.ads.length, 1, 'The intercepted script must actually fail')
    return { requests: 0, scriptRemoved: true }
  })

  await scenario('independent-cmp-failure', { cmpFailed: true }, async (page, routes) => {
    await waitFixture(page)
    await page.waitForFunction(() => !document.getElementById('atlas-ad-consent'))
    const state = await noAd(page)
    assert.equal(state.paused, 1)
    assert.equal(routes.ads.length, 1)
    assert.equal(routes.cmp.length, 1)
    await changeLanguage(page, 'fr')
    await noAd(page)
    assert.equal(routes.cmp.length, 1, 'CMP failure must not cause a language-change retry')
    return { requests: 0, independentCmpFailureClosed: true }
  })

  await scenario('ad-sdk-failure-preserves-cmp-choices', { scriptFailed: true, cmpOwnFixture: true, usStatus: 2 }, async (page) => {
    await waitFixture(page)
    await page.waitForFunction(() => !document.getElementById('atlas-advertising'))
    await noAd(page)
    await page.getByRole('button', { name: 'Ad privacy choices', exact: true }).click()
    assert.equal((await readState(page)).revocations, 1)
    await page.getByRole('button', { name: 'Do not sell or share my personal information', exact: true }).click()
    const state = await noAd(page)
    assert.equal(state.usDialogs, 1)
    assert.equal(state.paused, 1)
    return { requests: 0, adScriptFailed: true, workingCmpControlsPreserved: true }
  })

  await scenario('independent-cmp-delayed', { cmpDelayed: true }, async (page, routes) => {
    await waitFixture(page)
    assert.equal((await noAd(page)).paused, 1)
    await page.evaluate(() => { window.__atlasAdTest.releaseCmp = true })
    await showAd(page, 728, 90)
    assert.equal(routes.ads.length, 1)
    assert.equal(routes.cmp.length, 1)
    return { beforeCmp: 0, afterCmp: 1, separateScripts: 2 }
  })

  await scenario('unfilled-collapses', { unfilled: true }, async (page) => {
    await waitFixture(page)
    await page.locator('.atlas-ad-placement').scrollIntoViewIfNeeded()
    await page.waitForFunction(() => window.__atlasAdTest.pushes.length === 1)
    await noAd(page, 1)
    const box = await page.locator('.atlas-ad-placement').boundingBox()
    assert(box && box.height <= 1, 'Unfilled unit must leave no reserved advertisement gap')
    return { requests: 1, remainingHeight: box.height }
  })

  await scenario('hidden-slot-adblock', { hideIns: true }, async (page) => {
    await waitFixture(page)
    await noAd(page)
    return { requests: 0, hiddenSlotNeverSubmitted: true }
  })

  await scenario('withdrawal-and-remount', {}, async (page) => {
    await showAd(page, 728, 90)
    await page.getByRole('button', { name: 'Ad privacy choices', exact: true }).click()
    let state = await noAd(page, 1)
    assert.equal(state.revocations, 1)
    assert.equal(state.paused, 1)
    await page.evaluate(() => window.__atlasAdTest.emitTcf(true))
    state = await noAd(page, 1)
    assert.equal(
      state.paused,
      0,
      'Renewed consent must reach the controller while the used slot stays retired',
    )
    return { requests: 1, removedAfterWithdrawal: true, renewedConsentDoesNotRefresh: true }
  })

  await scenario('non-eu-consent-not-applicable', { tcf: 'not-applicable' }, async (page) => {
    await showAd(page, 728, 90)
    await expect(page.getByRole('button', { name: 'Ad privacy choices', exact: true })).toHaveCount(0)
    return { requests: 1, minimalTcfResponse: { gdprApplies: false }, usStatus: 1 }
  })

  await scenario('us-choices-retire-unit', { tcf: 'not-applicable', usStatus: 2 }, async (page) => {
    await showAd(page, 728, 90)
    await page
      .getByRole('button', { name: 'Do not sell or share my personal information', exact: true })
      .click()
    let state = await noAd(page, 1)
    assert.equal(state.usDialogs, 1)
    await page.evaluate(() => window.__atlasAdTest.emitGppChange())
    state = await noAd(page, 1)
    assert.equal(state.paused, 1)
    return { requests: 1, optedOut: true, gppChangeDoesNotRefresh: true }
  })

  for (const locale of ['is', 'fa', 'ne', 'sw', 'af']) {
    await scenario(`unsupported-initial-${locale}`, { locale }, async (page, routes) => {
      await noAd(page)
      assert.equal(routes.ads.length, 0)
      assert.equal(await page.locator('script#atlas-advertising').count(), 0)
      return { locale, advertisingScriptRequests: 0, requests: 0 }
    })
  }

  await scenario('unsupported-switch-removes-unit', {}, async (page, routes) => {
    await showAd(page, 728, 90)
    await changeLanguage(page, 'fa')
    assert.equal((await noAd(page, 1)).paused, 1)
    await changeLanguage(page, 'en')
    await noAd(page, 1)
    assert.equal(routes.ads.length, 1)
    return { requests: 1, unsupportedRemoved: true, returnDoesNotRefresh: true }
  })

  await scenario('analytics-consent-is-independent', { tcf: 'denied' }, async (page, routes) => {
    await waitFixture(page)
    await noAd(page)
    await page.getByRole('button', { name: 'Accept analytics', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('script#atlas-analytics'))
    const state = await noAd(page)
    assert.equal(state.paused, 1)
    assert.equal(routes.analytics.length, 1)
    const consent = await page.evaluate(() =>
      window.dataLayer.map((entry) => Array.from(entry)).filter((entry) => entry[0] === 'consent'),
    )
    assert(consent.some((entry) => entry[2]?.analytics_storage === 'granted'))
    for (const entry of consent)
      for (const key of ['ad_storage', 'ad_user_data', 'ad_personalization'])
        assert.notEqual(entry[2]?.[key], 'granted', 'Analytics consent must not grant advertising consent')
    return {
      analyticsScriptMocked: true,
      analyticsConsent: true,
      advertisingRequests: 0,
      separateConsent: true,
    }
  })

  const report = {
    status: 'passed',
    origin,
    dist,
    realAdvertisingRequests: 0,
    allRoutesIntercepted: true,
    results,
  }
  await writeFile(`${output}/verification.json`, JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ status: report.status, cases: results.length, output }, null, 2))
} finally {
  await browser.close()
}
