import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'

const origin = (process.env.SITE_URL || 'https://rrih.github.io').replace(/\/$/, '')
const canonicalOrigin = 'https://rrih.github.io'
const results: { path: string; status: number; milliseconds: number }[] = []

async function get(path: string, status = 200) {
  const start = performance.now()
  const response = await fetch(`${origin}${path}`, {
    signal: AbortSignal.timeout(30000),
    redirect: 'manual',
    headers: { 'Cache-Control': 'no-cache' },
  })
  results.push({ path, status: response.status, milliseconds: Math.round(performance.now() - start) })
  assert.equal(response.status, status, `${path}: HTTP status`)
  return response.text()
}

function canonical(html: string, path: string) {
  assert(html.includes(`rel="canonical" href="${canonicalOrigin}${path}"`), `${path}: canonical`)
}

const root = await get('/')
canonical(root, '/')
assert(root.includes('<title>rrih — Web Developer</title>'))
assert(!/atlas|manifest|projects/i.test(root))
assert(!/adsbygoogle|googletagmanager/.test(root), 'Personal root must remain lightweight')
assert.equal(
  (await get('/googleb565df21987f6d4c.html')).trim(),
  'google-site-verification: googleb565df21987f6d4c.html',
)

for (const path of [
  '/atlas/',
  '/atlas/ja/',
  '/atlas/pokemon/6/',
  '/atlas/ja/pokemon/753/',
  '/atlas/fr/pokemon/1025/',
  '/atlas/zh-Hant/pokemon/6/forms/charizard-mega-x/',
  '/atlas/pokemon/',
  '/atlas/ja/types/grass/',
  '/atlas/ja/forms/mega/',
  '/atlas/ja/help/',
  '/atlas/ja/about/',
  '/atlas/legal/ja/privacy.html',
]) {
  const html = await get(path)
  canonical(html, path)
  assert(/<h1[ >]/.test(html), `${path}: meaningful initial HTML`)
  assert(!/name="robots" content="noindex/.test(html), `${path}: unexpected noindex`)
}

for (const path of ['/pokemon/6/', '/ja/pokemon/753/', '/legal/ja/privacy.html']) {
  const html = await get(path)
  canonical(html, `/atlas${path}`)
  assert(html.includes('http-equiv="refresh"'), `${path}: immediate move`)
}

const profileMap = await get('/sitemap.xml')
assert.equal([...profileMap.matchAll(/<loc>/g)].length, 12)
assert(!profileMap.includes('/atlas/'))
const sitemap = await get('/atlas/sitemap.xml')
const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])
assert.equal(new Set(locations).size, locations.length, 'Unique sitemap URLs')
assert(locations.length === 10756, 'Complete independent Atlas sitemap')
assert(locations.every((url) => url === `${canonicalOrigin}/` || url.startsWith(`${canonicalOrigin}/atlas/`)))
assert((await get('/robots.txt')).includes(`Sitemap: ${canonicalOrigin}/sitemap.xml`))
assert.equal((await get('/ads.txt')).trim(), 'google.com, pub-6426570202991325, DIRECT, f08c47fec0942fa0')
const manifest = JSON.parse(await get('/atlas/manifest.webmanifest'))
assert.equal(manifest.id, '/atlas/')
assert.equal(manifest.scope, '/atlas/')
assert.equal(manifest.start_url, '/atlas/')
assert((await get('/sw.js')).includes('self.registration.unregister()'))
await get('/manifest.webmanifest', 404)
await get('/atlas/sw.js')
for (const path of ['/atlas/pokemon/99999/', '/atlas/not-a-real-page/', '/shitsugyo-hoken/']) {
  const html = await get(path, 404)
  assert(html.includes('noindex'), `${path}: real missing page`)
}

mkdirSync('work/production-check', { recursive: true })
writeFileSync(
  'work/production-check/latest.json',
  `${JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      origin,
      sitemapURLs: locations.length,
      results,
      scope:
        'Public HTTP and initial HTML. Does not measure Google indexing, field performance, or ad delivery.',
    },
    null,
    2,
  )}\n`,
)
console.log(`Verified ${results.length} public responses and ${locations.length} sitemap URLs.`)
