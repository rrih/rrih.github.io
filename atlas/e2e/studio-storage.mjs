import { appBase } from './helpers.mjs'
import assert from 'node:assert/strict'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { chromium } from './helpers.mjs'
const base = appBase
const output = process.env.ATLAS_QA_DIR || 'work/studio/storage-qa'
await mkdir(output, { recursive: true })
const words = Object.fromEntries(await Promise.all((await readdir('src/locales/ui')).filter(f => f.endsWith('.json')).map(async f => [f.slice(0, -5), JSON.parse(await readFile(`src/locales/ui/${f}`, 'utf8'))])))
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--enable-unsafe-swiftshader'] })
const errors = [], results = []
const make = async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'en-US', reducedMotion: 'reduce', acceptDownloads: true })
  const page = await context.newPage()
  page.on('pageerror', e => errors.push(e.message))
  return { context, page }
}
const ready = async (page, code = 'en') => {
  await page.getByText(words[code]['LIVE VIEW'], { exact: true }).waitFor({ timeout: 120_000 })
  await page.locator('.loader').waitFor({ state: 'hidden' })
}
try {
  const { context, page } = await make()
  await page.goto(`${base}/?lang=en`)
  await ready(page)
  await page.getByRole('button', { name: 'Together', exact: true }).click()
  await ready(page)
  const seed = await page.evaluate(() => JSON.parse(localStorage.getItem('atlas-scenes-v1')))
  for (const code of Object.keys(words).sort()) {
    await page.locator('.language-button').click()
    await page.locator(`[data-language="${code}"]`).click()
    await ready(page, code)
    await page.evaluate(() => document.fonts.ready)
    for (const width of [1440, 320]) {
      await page.setViewportSize({ width, height: width === 320 ? 568 : 1000 })
      const result = await page.evaluate(() => ({
        documentFits: document.documentElement.scrollWidth <= innerWidth + 1,
        overflows: Array.from(document.querySelectorAll('.scene-editor,.scene-name-form,.scene-members,.scene-ranges,.scene-member-actions,.scene-file-actions,.scene-mode')).filter(e => e.scrollWidth > e.clientWidth + 2).map(e => e.className)
      }))
      assert(result.documentFits && !result.overflows.length, `${code} ${width} layout: ${JSON.stringify(result)}`)
      assert(await page.getByRole('button', { name: words[code]['Save scene'], exact: true }).isVisible())
      if (['ja', 'ar', 'de'].includes(code) && width === 320) await page.screenshot({ path: `${output}/${code}-320.png`, fullPage: true })
    }
    results.push(code)
    console.log(`${code}: scene UI fits desktop and 320 px`)
  }
  await context.close()
  for (const failure of ['denied', 'unknown-version']) {
    const { context, page } = await make()
    await page.addInitScript(({ failure }) => {
      if (failure === 'unknown-version') localStorage.setItem('atlas-scenes-v1', '{"version":99,"keep":"original"}')
      else { const write = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if(key === 'atlas-scenes-v1') throw new DOMException('denied', 'QuotaExceededError'); return write.call(this, key, value) } }
    }, { failure })
    await page.goto(`${base}/?lang=en`)
    await ready(page)
    await page.getByRole('button', { name: 'Together', exact: true }).click()
    await ready(page)
    await page.locator('.scene-storage-error').waitFor()
    await page.getByLabel('Scene name', { exact: true }).fill('Export still works')
    await page.getByRole('button', { name: 'Save scene', exact: true }).click()
    assert(await page.locator('.scene-storage-error').isVisible())
    const download = page.waitForEvent('download')
    await page.locator('.scene-file-actions').getByRole('button', { name: 'Download scene', exact: true }).click()
    await (await download).saveAs(`${output}/${failure}.json`)
    if (failure === 'unknown-version') assert.equal(await page.evaluate(() => localStorage.getItem('atlas-scenes-v1')), '{"version":99,"keep":"original"}')
    await context.close()
  }
  const limited = await make()
  seed.active = true
  seed.draft.name = 'New beyond limit'
  seed.saved = Array.from({ length: 12 }, (_, index) => ({ ...seed.draft, id: `saved-${index}`, name: `Saved ${index}` }))
  await limited.page.addInitScript(state => localStorage.setItem('atlas-scenes-v1', JSON.stringify(state)), seed)
  await limited.page.goto(`${base}/?lang=en`)
  await ready(limited.page)
  await limited.page.getByRole('button', { name: 'Save scene', exact: true }).click()
  await limited.page.locator('.toast').getByText('You can save up to 12 scenes.', { exact: true }).waitFor()
  assert.equal(await limited.page.evaluate(() => JSON.parse(localStorage.getItem('atlas-scenes-v1')).saved.length), 12)
  await limited.page.getByLabel('Scene name', { exact: true }).fill('Saved 0')
  await limited.page.getByRole('button', { name: 'Save scene', exact: true }).click()
  await limited.page.getByText('Scene saved on this device.', { exact: true }).waitFor()
  assert.equal(await limited.page.evaluate(() => JSON.parse(localStorage.getItem('atlas-scenes-v1')).saved.length), 12)
  await limited.page.locator('.scene-saved summary').click()
  limited.page.once('dialog', dialog => dialog.accept())
  await limited.page.getByRole('button', { name: 'Delete scene: Saved 0', exact: true }).click()
  assert.equal(await limited.page.evaluate(() => JSON.parse(localStorage.getItem('atlas-scenes-v1')).saved.length), 11)
  await limited.context.close()
  assert.deepEqual(errors, [])
  await writeFile(`${output}/verification.json`, JSON.stringify({ locales: results, desktop: true, mobile320: true, deniedStorage: true, unknownVersionPreserved: true, exportWithoutStorage: true, saveLimit: true, overwriteAtLimit: true, deleteSaved: true, errors }, null, 2))
} catch(e) { console.error(e); throw e } finally { await browser.close() }
