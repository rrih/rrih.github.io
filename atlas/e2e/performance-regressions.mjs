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
page.on('pageerror', error => errors.push(error.message))
page.on('request', request => requests.push(request.url()))
const ready = async () => {
  await page.locator('.live-dot:not(.loading)').waitFor({ timeout: 120000 })
  await page.locator('.loader').waitFor({ state: 'hidden' })
  assert.equal(await page.locator('.viewer-error').count(), 0)
}
const count = () => page.evaluate(() => window.__atlasDrawProbe.calls)
const result = { environment: 'Chrome, forced WebGL2 fallback, 390×844, reduced motion; functional regression, not a field CWV measurement' }
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
  result.cameraAndResumeRedraw = true
  assert.deepEqual(errors, [])
  await writeFile(`${output}/verification.json`, JSON.stringify({ ...result, errors }, null, 2))
  console.log('Lazy dictionaries, paused/offscreen GPU suppression, redraw recovery, early GLB fetch and decoder preload reuse verified.')
} catch (error) {
  await writeFile(`${output}/failure.json`, JSON.stringify({ ...result, error: String(error), stack: error.stack, url: page.url(), errors, requests }, null, 2))
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true }).catch(() => {})
  throw error
} finally { await browser.close() }
