import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { appBase, siteOrigin, chromium, expect, seoLocales, localeHome } from './helpers.mjs'

const output = process.env.ATLAS_QA_DIR || 'work/atlas-migration/qa'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--enable-unsafe-swiftshader'] })
const context = await browser.newContext({ locale: 'en-US', viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block' })
const page = await context.newPage()
const errors = [], requests = [], results = { root: {}, static: [], rendered: [], legacy: [] }
page.on('pageerror', error => errors.push(error.message))
page.on('request', request => requests.push(request.url()))
const ready = async () => {
  await page.locator('.app-shell[data-catalog-state=ready]').waitFor({ timeout: 120000 })
  await page.locator('.live-dot:not(.loading)').waitFor({ timeout: 120000 })
  await page.locator('.loader').waitFor({ state: 'hidden' })
  assert.equal(await page.locator('.viewer-error').count(), 0)
}
const seo = () => page.evaluate(() => ({ title: document.title, canonical: document.querySelector('link[rel=canonical]')?.href, description: document.querySelector('meta[name=description]')?.content, language: document.documentElement.lang, alternates: Array.from(document.querySelectorAll('link[hreflang]'), link => [link.hreflang, link.href]), structured: Array.from(document.querySelectorAll('script[type="application/ld+json"]'), node => JSON.parse(node.textContent)) }))
const initialSeo = html => page.evaluate(html => {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return { title: doc.title, canonical: doc.querySelector('link[rel=canonical]')?.getAttribute('href'), description: doc.querySelector('meta[name=description]')?.content, language: doc.documentElement.lang, alternates: Array.from(doc.querySelectorAll('link[hreflang]'), link => [link.hreflang, link.getAttribute('href')]), structured: Array.from(doc.querySelectorAll('script[type="application/ld+json"]'), node => JSON.parse(node.textContent)) }
}, html)
const is3D = url => /\/(?:models|draco)\/|\/(?:three|Viewer)[^/]*\.js(?:\?|$)/i.test(new URL(url).pathname)
try {
  const response = await page.goto(`${siteOrigin}/`)
  const initial = await initialSeo(await response.text())
  await page.waitForTimeout(1200)
  assert.equal(new URL(page.url()).pathname, '/')
  assert.equal(new URL(page.url()).hash, '')
  assert.equal(initial.canonical, 'https://rrih.github.io/')
  assert.match(initial.title, /rrih/)
  assert.deepEqual(await seo(), initial, 'Personal root metadata stays unchanged after JavaScript')
  assert.equal(await page.locator('canvas').count(), 0)
  assert.equal(requests.filter(is3D).length, 0, 'Personal root does not load a renderer or model')
  await page.screenshot({ path: `${output}/personal-desktop.png`, fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  await page.screenshot({ path: `${output}/personal-mobile.png`, fullPage: true })
  await page.setViewportSize({ width: 1440, height: 1000 })
  results.root = { status: response.status(), metadataStable: true, no3D: true, mobileFits: true, metadata: initial }
  assert.equal(await page.locator('a[href="/atlas/"]').count(), 0)
  results.root.independent = true

  for (const locale of seoLocales) {
    for (const suffix of ['pokemon/', 'pokemon/page/2/', 'types/fire/', 'generations/1/', 'forms/', 'forms/mega/', 'forms/regional/']) {
      const path = `${localeHome(locale)}${suffix}`
      const begin = requests.length
      const res = await page.goto(`${siteOrigin}${path}`)
      assert.equal(res.status(), 200, path)
      const before = await initialSeo(await res.text())
      await page.waitForTimeout(150)
      assert.deepEqual(await seo(), before, `${path}: static metadata is stable`)
      assert.equal(before.canonical, `https://rrih.github.io${path}`)
      assert.equal(before.language, locale)
      assert.equal(before.alternates.filter(([lang]) => lang !== 'x-default').length, 9)
      assert.equal(await page.locator('canvas').count(), 0)
      assert.equal(requests.slice(begin).filter(is3D).length, 0, `${path}: list must not load 3D`)
      const links = await page.locator('main a[href]').evaluateAll(links => links.map(link => link.getAttribute('href')))
      assert(links.some(href => /\/pokemon\/\d+\//.test(href)), `${path}: crawlable detail links`)
      results.static.push({ path, status: res.status(), metadataStable: true, no3D: true, links: links.length })
    }
  }
  for (const path of ['/atlas/pokemon/6/', '/atlas/ja/pokemon/753/', '/atlas/fr/pokemon/6/', '/atlas/pokemon/6/forms/charizard-mega-x/', '/atlas/zh-Hant/pokemon/6/forms/charizard-mega-x/']) {
    const response = await page.goto(`${siteOrigin}${path}`)
    const before = await initialSeo(await response.text())
    await ready()
    const after = await seo()
    assert.deepEqual(after, before, `${path}: title, canonical, description, hreflang and JSON-LD agree before and after rendering`)
    assert.equal(new URL(page.url()).pathname, path)
    assert.equal(after.canonical, `https://rrih.github.io${path}`)
    results.rendered.push({ path, metadata: after, sameBeforeAndAfter: true })
  }
  for (const [legacy, path, name] of [
    ['/pokemon/6/?lang=en#pokemon=6&form=charizard-mega-x&scene=night&shiny=1', '/atlas/pokemon/6/forms/charizard-mega-x/', 'Mega Charizard X'],
    ['/ja/pokemon/753/?lang=ja#pokemon=753&scene=forest', '/atlas/ja/pokemon/753/', 'カリキリ'],
  ]) {
    await page.goto(`${siteOrigin}${legacy}`)
    await ready()
    assert.equal(new URL(page.url()).pathname, path)
    assert.equal(await page.locator('h1 bdi').innerText(), name)
    const expected = new URLSearchParams(new URL(legacy, siteOrigin).hash.slice(1))
    const actual = new URLSearchParams(new URL(page.url()).hash.slice(1))
    for (const [key, value] of expected) assert.equal(actual.get(key), value, `${legacy}: preserved ${key}`)
    results.legacy.push({ legacy, destination: new URL(page.url()).pathname, settingsPreserved: true })
  }
  await page.goto(`${appBase}/pokemon/6/?lang=en`)
  await ready()
  await page.getByRole('link', { name: 'Explore', exact: true }).click()
  assert.equal(new URL(page.url()).pathname, '/atlas/pokemon/')
  assert.equal(await page.locator('canvas').count(), 0)
  results.exploreLink = true
  assert.deepEqual(errors, [])
  await writeFile(`${output}/verification.json`, JSON.stringify({ ...results, errors, network: 'Only same-origin and local test servers allowed; ad/GA endpoints blocked' }, null, 2))
  console.log(`Migration routing and SEO verified: ${results.static.length} static lists, ${results.rendered.length} rendered details, ${results.legacy.length} legacy links.`)
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true }).catch(() => {})
  await writeFile(`${output}/failure.json`, JSON.stringify({ error: String(error), stack: error.stack, url: page.url(), errors, results }, null, 2))
  throw error
} finally { await browser.close() }
