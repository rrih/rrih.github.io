import { appBase } from './helpers.mjs'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from './helpers.mjs'

const base = appBase
const output = process.env.ATLAS_QA_DIR || 'work/studio/qa'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--enable-unsafe-swiftshader'] })
const context = await browser.newContext({ locale: 'en-US', viewport: { width: 1440, height: 1000 }, acceptDownloads: true })
if (process.env.ATLAS_FORCE_WEBGL === '1') await context.addInitScript(() => Object.defineProperty(navigator, 'gpu', { configurable: true, value: undefined }))
const page = await context.newPage()
const errors = []
const requests = []
page.on('pageerror', error => errors.push(error.message))
page.on('request', request => { if (/\.glb(?:\?|$)/.test(request.url())) requests.push(request.url()) })
const ready = async () => {
  await page.getByText('LIVE VIEW', { exact: true }).waitFor({ timeout: 120_000 })
  await page.locator('.loader').waitFor({ state: 'hidden' })
  await page.locator('canvas').waitFor()
}
const readState = () => page.evaluate(() => JSON.parse(localStorage.getItem('atlas-scenes-v1')))
const pause = async () => { const button = page.getByRole('button', { name: 'Pause animation', exact: true }); if (await button.count()) await button.click(); await page.waitForTimeout(700) }
const motion = async label => {
  await pause()
  const a = await page.locator('canvas').screenshot()
  await page.waitForTimeout(300)
  assert(a.equals(await page.locator('canvas').screenshot()), `${label} pause is stable`)
  await page.getByRole('button', { name: 'Play animation', exact: true }).click()
  await page.waitForTimeout(350)
  const b = await page.locator('canvas').screenshot()
  assert(!a.equals(b), `${label} moves`)
}
try {
  await page.goto(`${base}/?lang=en#pokemon=6&scene=studio`)
  await ready()
  await page.locator('.detail-tabs').getByRole('button', { name: 'Studio', exact: true }).click()
  await page.getByRole('button', { name: 'Shiny appearance', exact: true }).click()
  await ready()
  await motion('Shiny Charizard')
  await page.screenshot({ path: `${output}/shiny-desktop.png`, fullPage: true })
  await page.getByRole('searchbox', { name: 'Search Pokémon by name or number', exact: true }).fill('1')
  await page.getByRole('link', { name: 'View Bulbasaur', exact: true }).click()
  await ready()
  await page.getByRole('button', { name: 'Shiny appearance', exact: true }).click()
  await ready()
  await motion('Previously unanimated shiny Bulbasaur')
  await page.locator('canvas').screenshot({ path: `${output}/shiny-bulbasaur.png` })
  await page.evaluate(() => { history.pushState(null, '', '/atlas/pokemon/6/?lang=en#pokemon=6&scene=studio&shiny=1'); dispatchEvent(new PopStateEvent('popstate')) })
  await page.waitForFunction(() => document.querySelector('h1')?.textContent === 'Charizard')
  await ready()
  await page.getByRole('button', { name: 'Together', exact: true }).click()
  await ready()
  await page.getByRole('button', { name: 'Add a Pokémon', exact: true }).click()
  await page.getByRole('searchbox', { name: 'Search Pokémon to add', exact: true }).fill('ピカチュウ')
  await page.getByRole('button', { name: 'Add Pikachu to scene', exact: true }).click()
  await ready()
  assert.equal((await readState()).draft.members.length, 2)
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 120_000 })
  await page.waitForTimeout(700)
  const requestCount = requests.length
  await page.getByRole('slider', { name: 'Left / right', exact: true }).focus()
  await page.keyboard.press('End')
  await page.getByRole('slider', { name: 'Direction', exact: true }).focus()
  await page.keyboard.press('Home')
  await page.waitForTimeout(300)
  assert.equal((await readState()).draft.members[1].x, 4)
  assert.equal((await readState()).draft.members[1].rotation, -180)
  assert.equal(requests.length, requestCount, 'Moving a member does not reload any model')
  await page.getByRole('button', { name: 'Arrange automatically', exact: true }).click()
  await page.getByRole('button', { name: 'Remove Pikachu from scene', exact: true }).click()
  await ready()
  assert.equal((await readState()).draft.members.length, 1)
  await page.getByRole('button', { name: 'Add a Pokémon', exact: true }).click()
  await page.getByRole('button', { name: 'Add Charizard to scene', exact: true }).click()
  await ready()
  const duplicates = (await readState()).draft.members
  assert.equal(duplicates[0].speciesId, duplicates[1].speciesId)
  assert.notEqual(duplicates[0].key, duplicates[1].key)
  await page.getByRole('button', { name: 'Forest', exact: true }).click()
  await pause()
  const front = await page.locator('canvas').screenshot()
  await page.getByRole('button', { name: 'back', exact: true }).click()
  await page.waitForTimeout(500)
  assert(!front.equals(await page.locator('canvas').screenshot()), 'Forest rear view changes actual geometry')
  await page.getByRole('button', { name: 'Reset camera', exact: true }).click()
  await page.getByLabel('Scene name', { exact: true }).fill('Forest friends')
  await page.getByRole('button', { name: 'Save scene', exact: true }).click()
  await page.getByText('Scene saved on this device.', { exact: true }).waitFor()
  let state = await readState()
  assert.equal(state.saved.length, 1)
  assert.equal(state.draft.settings.habitat, 'forest')
  await page.getByRole('button', { name: 'Solo view', exact: true }).click()
  await ready()
  await page.getByRole('button', { name: 'Together', exact: true }).click()
  await ready()
  assert.equal((await readState()).draft.settings.habitat, 'forest', 'Leaving and returning preserves settings')

  const scene = (await readState()).draft
  scene.name = 'Six friends'
  scene.camera = undefined
  scene.settings.playing = true
  scene.members = [6, 1, 25, 133, 7, 94].map((speciesId, index) => ({ key: `qa-${index}`, speciesId, shiny: index === 0, x: (index % 3 - 1) * 2.6, z: (Math.floor(index / 3) - 0.5) * 2.8, rotation: 0, scale: 0.8 }))
  await page.locator('.scene-file-actions input[type=file]').setInputFiles({ name: 'six.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, scene })) })
  await ready()
  await page.getByText('Scene imported.', { exact: true }).waitFor()
  assert.equal((await readState()).draft.members.length, 6)
  await motion('Six Pokémon')
  await pause()
  await page.getByRole('button', { name: 'Reset camera', exact: true }).click()
  await page.screenshot({ path: `${output}/six-forest.png`, fullPage: true })
  await page.getByRole('button', { name: 'Save scene', exact: true }).click()
  const saved = (await readState()).draft
  await page.reload()
  await ready()
  state = await readState()
  assert.equal(state.active, true)
  assert.deepEqual(state.draft.members, saved.members)
  assert.deepEqual(state.draft.camera, saved.camera)
  assert.equal(state.saved.length, 2)

  const exported = page.waitForEvent('download')
  await page.locator('.scene-file-actions').getByRole('button', { name: 'Download scene', exact: true }).click()
  await (await exported).saveAs(`${output}/scene.json`)
  const beforeBad = (await readState()).draft
  await page.locator('.scene-file-actions input[type=file]').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, scene: { ...beforeBad, members: [{ ...beforeBad.members[0], speciesId: 99999 }] } })) })
  await page.getByText('This scene file could not be opened.', { exact: true }).waitFor()
  assert.deepEqual((await readState()).draft, beforeBad)

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    await page.waitForTimeout(400)
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}px no horizontal overflow`)
    await page.screenshot({ path: `${output}/mobile-${width}.png`, fullPage: true })
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 120_000 })
  await page.waitForFunction(async () => {
    const state = JSON.parse(localStorage.getItem('atlas-scenes-v1'))
    return (await Promise.all(state.draft.members.map(member => caches.match(member.shiny ? `/models/shiny-home/${member.speciesId}.glb` : `/models/home/${member.speciesId}.glb`)))).every(Boolean)
  }, null, { timeout: 60_000 })
  await context.setOffline(true)
  await page.reload()
  await ready()
  assert.equal((await readState()).draft.members.length, 6)
  await page.screenshot({ path: `${output}/offline-scene.png`, fullPage: true })
  await context.setOffline(false)
  assert.deepEqual(errors, [])
  const result = { base, forcedWebGL: process.env.ATLAS_FORCE_WEBGL === '1', previouslyUnanimatedShiny: true, addSearch: true, duplicateSpecies: true, remove: true, placementWithoutReload: true, shinyAnimation: true, pause: true, forestCamera: true, sixMembers: true, namedSave: true, leaveRestore: true, reloadRestore: true, export: true, invalidImportPreservesScene: true, mobile390: true, mobile320: true, offlineScene: true, modelRequests: requests.length, errors }
  await writeFile(`${output}/verification.json`, JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result, null, 2))
} catch (error) { await page.screenshot({path: `${output}/failure.png`, fullPage: true}).catch(() => {}); throw error } finally { await browser.close() }
