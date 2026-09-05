import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const base = process.env.ATLAS_URL || 'http://127.0.0.1:3335'
const output = process.env.ATLAS_QA_DIR || 'work/cache/storage'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--disable-webgpu', '--disable-webgl'],
})
const results = []
try {
  for (const mode of [
    'denied',
    'granted',
    'already-persistent',
    'unavailable',
    'throws',
    'installed-startup',
    'install-accepted',
  ]) {
    const context = await browser.newContext({ locale: 'en-US', serviceWorkers: 'block' })
    await context.addInitScript((mode) => {
      window.storageCalls = []
      Object.defineProperty(navigator, 'storage', {
        configurable: true,
        value:
          mode === 'unavailable'
            ? undefined
            : {
                persisted: async () => {
                  window.storageCalls.push('persisted')
                  return mode === 'already-persistent'
                },
                persist: async () => {
                  window.storageCalls.push('persist')
                  if (mode === 'throws') throw new Error('Storage disabled')
                  return mode === 'granted'
                },
              },
      })
      if (mode === 'installed-startup') {
        const original = window.matchMedia.bind(window)
        window.matchMedia = (query) => {
          const media = original(query)
          if (query === '(display-mode: standalone)') Object.defineProperty(media, 'matches', { value: true })
          return media
        }
      }
    }, mode)
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(`${base}/?lang=en`)
    await page.locator('.app-shell').waitFor()
    await page.waitForTimeout(150)
    if (mode === 'installed-startup')
      await page.waitForFunction(() => window.storageCalls.includes('persist'))
    else {
      assert.deepEqual(
        await page.evaluate(() => window.storageCalls),
        [],
        'ordinary visits must not request persistent-storage permission',
      )
      if (mode === 'install-accepted') {
        await page.evaluate(() => {
          const event = new Event('beforeinstallprompt', { cancelable: true })
          event.prompt = async () => {
            window.storageCalls.push('install-prompt')
          }
          event.userChoice = Promise.resolve({ outcome: 'accepted' })
          window.dispatchEvent(event)
        })
        await page.locator('.install-button').click()
      } else await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')))
    }
    await page.waitForTimeout(150)
    const calls = await page.evaluate(() => window.storageCalls)
    assert.equal(
      calls.filter((c) => c === 'persist').length,
      ['unavailable', 'already-persistent'].includes(mode) ? 0 : 1,
    )
    await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')))
    await page.waitForTimeout(100)
    assert.deepEqual(await page.evaluate(() => window.storageCalls), calls, 'one request per visit')
    assert.equal(await page.locator('h1 bdi').innerText(), 'Charizard')
    assert.deepEqual(errors, [])
    results.push({ mode, mockedStorageResponses: true, calls, viewerRemainsUsable: true, errors })
    await context.close()
  }
  await writeFile(`${output}/verification.json`, JSON.stringify({ base, results }, null, 2))
  console.log(`${results.length} persistence scenarios passed`)
} finally {
  await browser.close()
}
