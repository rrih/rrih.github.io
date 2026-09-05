import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, expect } from '@playwright/test'

const base = process.env.ATLAS_URL || 'http://127.0.0.1:3333'
const output = process.env.ATLAS_QA_DIR || 'work/qa-unavailable'
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--enable-unsafe-swiftshader'] })
const context = await browser.newContext({ locale: 'en-US', viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' })
const page = await context.newPage()
const errors = []
const checked = []
page.on('pageerror', error => errors.push(error.message))
await page.addInitScript(() => {
  const gpu = Object.getOwnPropertyDescriptor(navigator, 'gpu')
  const getContext = HTMLCanvasElement.prototype.getContext
  Object.defineProperty(navigator, 'gpu', { configurable: true, value: undefined })
  HTMLCanvasElement.prototype.getContext = function (type, ...args) {
    return type === 'webgl2' || type === 'webgl' ? null : getContext.call(this, type, ...args)
  }
  window.restoreAtlasGraphics = () => {
    if (gpu) Object.defineProperty(navigator, 'gpu', gpu)
    else delete navigator.gpu
    HTMLCanvasElement.prototype.getContext = getContext
  }
})

const unavailable = async name => {
  await expect(page.locator('.viewer-error p')).toHaveText('3D viewing is unavailable in this browser. Try updating your browser or enabling graphics acceleration.', { timeout: 60_000 })
  await expect(page.locator('.loader')).toHaveCount(0)
  await expect(page.locator('.live-label')).toHaveText('Preview unavailable')
  await expect(page.locator('.play-button')).toBeDisabled()
  await expect(page.getByLabel('Animation speed', { exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Save studio image', exact: true })).toBeDisabled()
  await expect(page.locator('.playback-main .control-heading')).toHaveText('Motion unavailable')
  await expect(page.getByText('This model has no recorded character animation.', { exact: false })).toHaveCount(0)
  await expect(page.getByLabel('Animation', { exact: true })).toHaveCount(0)
  checked.push(name)
}

try {
  await page.goto(`${base}/#pokemon=6&scene=studio`)
  await page.getByRole('button', { name: 'Studio', exact: true }).click()
  await unavailable('initialization failure explains how to restore 3D viewing')

  await page.getByRole('searchbox').fill('25')
  await page.getByRole('button', { name: 'View Pikachu', exact: true }).click()
  await expect(page.locator('h1')).toHaveText('Pikachu.')
  await unavailable('selecting another species retains a completed failure state')

  await page.evaluate(() => { location.hash = 'pokemon=6&scene=night&shiny=1' })
  await expect(page.locator('h1')).toHaveText('Charizard.')
  await expect(page.locator('.viewer-stage')).toHaveClass(/night/)
  const shiny = page.getByRole('button', { name: 'Shiny appearance', exact: true })
  await expect(shiny).toHaveAttribute('aria-pressed', 'true')
  await unavailable('hash changes species, scene, and shiny without a stuck loader')

  await page.evaluate(() => { location.hash = 'pokemon=6&scene=forest&shiny=1' })
  await expect(page.locator('.viewer-stage')).toHaveClass(/forest/)
  await unavailable('same species scene hash preserves the failure message')

  await shiny.click()
  await expect(shiny).toHaveAttribute('aria-pressed', 'false')
  await unavailable('shiny toggle ends in the same useful failure state')
  await shiny.click()
  await expect(shiny).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Reset studio', exact: true }).click()
  await expect(shiny).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('.viewer-stage')).toHaveClass(/studio/)
  await unavailable('resetting studio and shiny does not strand loading')

  await page.getByRole('button', { name: 'Try again', exact: false }).click()
  await unavailable('retrying while graphics remain unavailable explains the failure')

  await page.evaluate(() => window.restoreAtlasGraphics())
  await page.getByRole('button', { name: 'Try again', exact: false }).click()
  await expect(page.locator('.live-label')).toHaveText('LIVE VIEW', { timeout: 120_000 })
  await expect(page.locator('.viewer-error')).toHaveCount(0)
  await expect(page.locator('.loader')).toHaveCount(0)
  await expect(page.locator('.play-button')).toBeEnabled()
  await expect(page.getByLabel('Animation', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save studio image', exact: true })).toBeEnabled()
  checked.push('retry recovers after graphics are available and restores animation controls')

  await page.getByRole('button', { name: 'Pause animation', exact: true }).click()
  await page.waitForTimeout(400)
  const paused = await page.locator('canvas').screenshot()
  await page.getByRole('button', { name: 'Play animation', exact: true }).click()
  await page.waitForTimeout(500)
  assert(!paused.equals(await page.locator('canvas').screenshot()), 'Recovered character animation changes the rendered image')
  await expect(page.locator('.viewer-error')).toHaveCount(0)
  checked.push('the recovered 3D model renders a moving character animation')

  assert.deepEqual(errors, [], 'No unhandled browser exceptions')
  await mkdir(output, { recursive: true })
  const result = { base, checked, errors }
  await writeFile(`${output}/verification.json`, JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result, null, 2))
} finally {
  await browser.close()
}
