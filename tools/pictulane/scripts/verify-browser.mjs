import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
const origin = process.env.SITE_URL || 'https://rrih.github.io'
const out = process.env.EVIDENCE_DIR || 'work/browser'
await mkdir(out, { recursive: true })
const browser = await chromium.launch(
  process.env.CHROME_CHANNEL ? { channel: process.env.CHROME_CHANNEL } : {},
)
const context = await browser.newContext()
const page = await context.newPage()
const errors = [],
  requests = [],
  report = { origin, checkedAt: new Date().toISOString() }
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
page.on('request', (r) => requests.push(r.url()))
try {
  await page.goto(`${origin}/tools/pictulane`, { waitUntil: 'networkidle' })
  assert.equal(new URL(page.url()).pathname, '/tools/pictulane/')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload({ waitUntil: 'networkidle' })
  report.worker = await page.evaluate(async () => ({
    controller: navigator.serviceWorker.controller?.scriptURL,
    registrations: (await navigator.serviceWorker.getRegistrations()).map((r) => r.scope),
  }))
  assert(report.worker.controller?.endsWith('/tools/pictulane/sw.js'))
  assert.equal(report.worker.registrations.length, 1)
  assert(report.worker.registrations[0].endsWith('/tools/pictulane/'))
  await page.screenshot({ path: `${out}/production-desktop.png`, fullPage: true })
  await page.setViewportSize({ width: 375, height: 850 })
  await page.screenshot({ path: `${out}/production-mobile.png`, fullPage: true })
  await page.locator('#account').fill('https://x.com/NASA/media')
  await page.locator('form button').click()
  await page.getByText('画像取得は現在利用できません', { exact: true }).waitFor()
  assert.equal(await page.locator('.thumb').count(), 0)
  assert(page.url().endsWith('#/nasa'))
  await page.goto(`${origin}/tools/pictulane/#/nasa/status/900000000000000002/media/B1`)
  await page.locator('.unresolved').waitFor()
  assert.equal(await page.locator('.main-image').count(), 0)
  assert.equal(errors.length, 0, errors.join('\n'))
  report.pictulaneErrors = [...errors]
  report.pictulaneRequests = [...new Set(requests)]
  assert(report.pictulaneRequests.every((u) => u === origin + '/tools/pictulane' || u.startsWith(origin + '/tools/pictulane/')))
  await context.setOffline(true)
  await page.reload()
  await page.locator('.unresolved').waitFor()
  report.offlineShell = true
  await context.setOffline(false)
  await page.goto(`${origin}/`)
  assert.equal(await page.title(), 'rrih — Web Developer')
  assert.equal(await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL || null), null)
  assert(
    await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration('/tools/pictulane/'))),
  )
  await page.goto(`${origin}/ja/`)
  assert((await page.locator('html').getAttribute('lang')) === 'ja')
  await page.goto(`${origin}/atlas/`, { waitUntil: 'domcontentloaded' })
  await page.locator('canvas').first().waitFor({ timeout: 30000 })
  await page.waitForTimeout(4000)
  report.atlasCanvas = await page.locator('canvas').count()
  await page.screenshot({ path: `${out}/atlas.png` })
  report.atlasErrors = errors.slice(report.pictulaneErrors.length)
  assert(
    await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration('/tools/pictulane/'))),
  )
  const response = await page.goto(`${origin}/pictulane-not-a-real-page/`)
  assert.equal(response.status(), 404)
  report.unrelated404 = response.status()
  report.passed = true
} finally {
  await browser.close()
  await writeFile(`${out}/browser.json`, JSON.stringify(report, null, 2))
}
console.log(JSON.stringify(report, null, 2))
