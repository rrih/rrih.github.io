import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { appBase, chromium, expect } from './helpers.mjs'

const output = process.env.ATLAS_QA_DIR || 'work/ui-state/qa'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--enable-unsafe-swiftshader'] })
const context = await browser.newContext({ locale: 'en-US', viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block' })
const page = await context.newPage(), errors = [], results = []
page.on('pageerror', error => errors.push(error.message))
const ready = async () => {
  await page.locator('.app-shell[data-catalog-state=ready]').waitFor({ timeout: 120_000 })
  await page.getByText('LIVE VIEW', { exact: true }).waitFor({ timeout: 120_000 })
  await page.locator('.loader').waitFor({ state: 'hidden' })
  await page.locator('canvas').waitFor({ timeout: 120000 })
  assert.equal(await page.locator('.viewer-error').count(), 0)
}
const studio = () => page.evaluate(() => JSON.parse(localStorage.getItem('atlas-scenes-v1')))
try {
  await page.goto(`${appBase}/?lang=en#pokemon=6&scene=custom`)
  await ready()
  await expect(page.locator('.environment-card.studio')).toHaveAttribute('aria-pressed', 'true')
  assert.equal(new URLSearchParams(new URL(page.url()).hash.slice(1)).get('scene'), 'studio')
  results.push('custom-scene-without-local-photo-falls-back-to-studio')

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Save Charizard', exact: true }).click()
  await expect(page.locator('.save-button svg')).toHaveAttribute('fill', 'currentColor')
  await page.screenshot({ path: `${output}/saved-mobile-heart.png`, fullPage: true })
  await page.getByRole('button', { name: 'Remove Charizard from collection', exact: true }).click()
  await expect(page.locator('.save-button svg')).toHaveAttribute('fill', 'none')
  results.push('saved-mobile-heart-retains-visible-filled-state')

  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.getByRole('button', { name: 'Together', exact: true }).click()
  await ready()
  await page.getByRole('button', { name: 'Midnight', exact: true }).click()
  await page.getByRole('button', { name: 'side', exact: true }).click()
  await page.waitForTimeout(700)
  await page.getByLabel('Scene name', { exact: true }).fill('Retain the Together view')
  await page.getByRole('button', { name: 'Solo view', exact: true }).click()
  await ready()
  const dormant = (await studio()).draft
  assert.equal(dormant.settings.habitat, 'night')
  assert(dormant.camera, 'The Together camera is saved before leaving')
  await page.locator('.environment-card.studio').click()
  await page.getByRole('button', { name: 'front', exact: true }).click()
  await page.waitForTimeout(700)
  await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })))
  assert.deepEqual((await studio()).draft, dormant, 'Solo pagehide must not overwrite the dormant Together settings or camera')
  await page.reload()
  await ready()
  assert.equal((await studio()).active, false)
  assert.deepEqual((await studio()).draft, dormant, 'A real Solo reload retains the dormant Together draft')
  await page.getByRole('button', { name: 'Together', exact: true }).click()
  await ready()
  assert.deepEqual((await studio()).draft, dormant, 'Returning to Together restores the original view')
  await page.screenshot({ path: `${output}/restored-together.png`, fullPage: true })
  results.push('solo-pagehide-reload-and-return-preserve-together-settings-and-camera')

  await page.getByRole('button', { name: 'Save scene', exact: true }).click()
  await page.getByText('Scene saved on this device.', { exact: true }).waitFor({ timeout: 120000 })
  await page.locator('.toast').waitFor({ state: 'hidden', timeout: 10_000 })
  await page.evaluate(() => {
    window.__idleWrites = { history: 0, scenes: 0 }
    const replace = history.replaceState.bind(history)
    history.replaceState = (...args) => { window.__idleWrites.history++; return replace(...args) }
    const store = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'atlas-scenes-v1') window.__idleWrites.scenes++
      return store.call(this, key, value)
    }
  })
  await page.waitForTimeout(8500)
  const idle = await page.evaluate(() => window.__idleWrites)
  assert.deepEqual(idle, { history: 0, scenes: 0 }, 'A cleared notice must not keep waking the app and writing history or scene storage')
  results.push('cleared-notice-stops-its-timer-with-no-idle-state-writes')

  await page.evaluate(() => {
    window.__installPersistence = 0
    Object.defineProperty(navigator, 'storage', { configurable: true, value: {
      persisted: async () => false,
      persist: async () => { window.__installPersistence++; return true },
    } })
    const event = new Event('beforeinstallprompt', { cancelable: true })
    Object.defineProperties(event, {
      prompt: { value: async () => {} },
      userChoice: { value: Promise.resolve({ outcome: 'accepted' }) },
    })
    dispatchEvent(event)
  })
  await page.getByRole('button', { name: 'Get the app', exact: true }).click()
  await page.getByText('Atlas is ready for your home screen.', { exact: true }).waitFor({ timeout: 120000 })
  await expect.poll(() => page.evaluate(() => window.__installPersistence)).toBe(1)
  results.push('accepted-install-requests-persistent-storage-without-appinstalled-event')

  assert.deepEqual(errors, [])
  await writeFile(`${output}/verification.json`, JSON.stringify({ passed: true, results, idle, errors }, null, 2))
  console.log(`UI state regression checks passed: ${results.length}.`)
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true }).catch(() => {})
  await writeFile(`${output}/failure.json`, JSON.stringify({ error: String(error), stack: error.stack, results, errors, url: page.url(), studio: await studio().catch(() => null) }, null, 2))
  throw error
} finally {
  await browser.close()
}
