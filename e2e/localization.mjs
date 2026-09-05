import assert from 'node:assert/strict'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const base = process.env.ATLAS_URL || 'http://127.0.0.1:3340'
const output = process.env.ATLAS_QA_DIR || 'work/i18n/browser'
await mkdir(output, { recursive: true })
const dictionaries = Object.fromEntries(await Promise.all((await readdir('src/locales/ui')).filter(f => f.endsWith('.json')).map(async f => [f.replace('.json', ''), JSON.parse(await readFile(`src/locales/ui/${f}`, 'utf8'))])))
const codes = process.env.ATLAS_LOCALES?.split(',') || Object.keys(dictionaries).sort()
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--enable-unsafe-swiftshader'] })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'en-US', reducedMotion: 'reduce' })
const page = await context.newPage()
const errors = [], results = []
page.on('pageerror', e => errors.push(e.message))
const ready = async (p, code) => {
  await p.locator(`.app-shell[data-locale="${code}"][data-catalog-state="ready"]`).waitFor({ timeout: 120_000 })
  await p.getByText(dictionaries[code]['LIVE VIEW'], { exact: true }).waitFor({ timeout: 120_000 })
  await p.locator('.loader').waitFor({ state: 'hidden' })
}
const bounds = async p => p.evaluate(() => {
  const selectors = ['.header', '.angle-controls', '.playback-bar', '.speed-control', '.auto-orbit', '.mobile-toolbar', '.specimen-navigation', '.language-options', '.collection-panel.mobile-open']
  const overflow = [...document.querySelectorAll(selectors.join(','))].filter(el => {
    const r = el.getBoundingClientRect()
    return r.width && r.height && (r.left < -1 || r.right > innerWidth + 1 || el.scrollWidth > el.clientWidth + 2)
  }).map(el => ({ selector: el.className, text: el.textContent, rect: el.getBoundingClientRect().toJSON(), scrollWidth: el.scrollWidth, width: el.clientWidth }))
  return { document: document.documentElement.scrollWidth <= innerWidth + 1, overflow }
})
const change = async code => {
  await page.locator('.language-button').click()
  await page.locator(`[data-language="${code}"]`).click()
  await ready(page, code)
  await page.evaluate(() => document.fonts.ready)
}
try {
  await page.goto(`${base}/?lang=en#pokemon=6&scene=night`)
  await ready(page, 'en')
  await page.getByRole('button', { name: 'side', exact: true }).click()
  await page.mouse.move(0, 0)
  await page.waitForTimeout(500)
  const canvasHandle = await page.locator('canvas').elementHandle()
  const canvasBefore = await page.locator('canvas').screenshot()
  await change('ja')
  assert(await page.evaluate(canvas => document.querySelector('canvas') === canvas, canvasHandle), 'language change must preserve the viewer canvas')
  await page.waitForTimeout(500)
  await page.locator('canvas').screenshot({ path: `${output}/camera-ja.png` })
  await change('en')
  await page.waitForTimeout(500)
  await writeFile(`${output}/camera-before.png`, canvasBefore)
  await page.locator('canvas').screenshot({ path: `${output}/camera-after.png` })
  assert(canvasBefore.equals(await page.locator('canvas').screenshot()), 'language round trip must preserve paused model and camera')
  await change('ja')
  assert.equal(await page.locator('h1 bdi').innerText(), 'リザードン')
  assert.equal(await page.locator('.description').getAttribute('lang'), 'ja')
  assert((await page.url()).includes('scene=night'))
  await page.reload()
  await ready(page, 'ja')
  assert.equal(await page.evaluate(() => localStorage.getItem('atlas-language')), 'ja')
  await page.goto(`${base}/`)
  await ready(page, 'ja')
  await page.goto(`${base}/?lang=fr`)
  await ready(page, 'fr')
  assert.equal(await page.locator('h1 bdi').innerText(), 'Dracaufeu')
  assert.equal(await page.evaluate(() => localStorage.getItem('atlas-language')), 'ja', 'shared language must not overwrite saved preference')
  for (const code of codes) {
    const t = dictionaries[code]
    await page.setViewportSize({ width: 1440, height: 1000 })
    await change(code)
    assert.equal(await page.locator('html').getAttribute('lang'), code)
    assert.equal(await page.locator('html').getAttribute('dir'), ['ar','he','fa','ur'].includes(code) ? 'rtl' : 'ltr')
    assert.equal(new URL(page.url()).searchParams.get('lang'), code)
    assert.equal(await page.getByRole('searchbox').getAttribute('placeholder'), t['Name or number…'])
    assert.equal(await page.locator('.header nav button').first().innerText(), t.Explore)
    const desktop = await bounds(page)
    const manifest = await page.evaluate(async code => (await fetch(document.querySelector('link[rel=manifest]')?.href || `/locales/manifests/${code}.webmanifest`)).json(), code)
    assert.equal(manifest.lang, code)
    assert.equal(manifest.id, '/')
    assert.equal(manifest.start_url, '/')
    await page.locator('.header-actions .icon-button').click()
    assert((await page.locator('dialog').innerText()).includes(t['Your own little observatory for the world of Pokémon.']))
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: t.Studio, exact: true }).click()
    assert.equal(await page.getByLabel(t['Render quality'], { exact: true }).count(), 1)
    await page.getByRole('button', { name: t.Overview, exact: true }).click()
    if (['en','ja','ar','de','zh-Hant','ko','hi','ta','th'].includes(code)) await page.screenshot({ path: `${output}/${code}-desktop.png`, fullPage: true })
    const mobile = []
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: width === 320 ? 568 : 844 })
      await page.waitForTimeout(500)
      mobile.push({ width, ...(await bounds(page)) })
      if (width === 320) await page.screenshot({ path: `${output}/${code}-320.png`, fullPage: true })
    }
    await page.locator('.mobile-toolbar button').click()
    const collection = await bounds(page)
    await page.getByRole('searchbox').fill('Glurak')
    assert.equal(await page.locator('.pokemon-card').count(), 1)
    await page.locator('.pokemon-card').click()
    await ready(page, code)
    await page.locator('.language-button').click()
    const chooser = await bounds(page)
    assert.equal(await page.locator('.language-choice').count(), 49)
    await page.keyboard.press('Escape')
    results.push({ code, desktop, mobile, collection, chooser })
    console.log(`${code}: ${[desktop,...mobile,collection,chooser].every(r => r.document && !r.overflow.length) ? 'PASS' : 'LAYOUT REVIEW'}`)
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await change('ja')
  await page.getByRole('searchbox').fill('モモワロウ')
  await page.locator('.pokemon-card').click()
  await ready(page, 'ja')
  assert.equal(await page.locator('h1 bdi').innerText(), 'モモワロウ')
  assert.equal(await page.locator('.description').getAttribute('lang'), 'en')
  assert.equal(await page.locator('.entry-language').innerText(), dictionaries.ja['English entry'])
  assert.deepEqual(errors, [])
  await writeFile(`${output}/verification.json`, JSON.stringify({ base, codes, results, errors, cameraPreserved: true, storageAndShare: true, fallback: true }, null, 2))
  const bad = results.filter(r => [r.desktop,...r.mobile,r.collection,r.chooser].some(b => !b.document || b.overflow.length))
  assert.deepEqual(bad.map(r => r.code), [], 'all locale layouts must fit')
} catch (e) {
  await writeFile(`${output}/partial.json`, JSON.stringify({ results, errors, message: String(e), url: page.url() }, null, 2))
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true }).catch(() => {})
  throw e
} finally { await browser.close() }
