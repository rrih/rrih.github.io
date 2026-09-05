import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import locales from '../profile/locales.json'

for (const locale of Object.keys(locales)) {
  const path = locale === 'en' ? '/' : `/${locale}/`
  const html = readFileSync(`dist${path}index.html`, 'utf8')
  assert(html.includes(`lang="${locale}"`))
  assert(html.includes(`rel="canonical" href="https://rrih.github.io${path}"`))
  assert.equal([...html.matchAll(/rel="alternate"/g)].length, 13)
  assert(html.includes('https://github.com/rrih.png'))
  assert(html.includes('https://x.com/rrih_dev'))
  assert(html.includes('2019'))
  assert.doesNotMatch(html, /atlas|pokémon|manifest|projects|orimemo|zenn|googletagmanager|adsbygoogle|\{\{/i)
  const data = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)?.[1] || '')
  assert.equal(data['@type'], 'ProfilePage')
  assert.equal(data.mainEntity.jobTitle, 'Web Developer')
}
for (const file of ['manifest.webmanifest', 'atlas', 'icon-192.png']) assert(!existsSync(`dist/${file}`))
assert(existsSync('dist/profile-card.png'))
assert.doesNotMatch(
  readFileSync('profile/client.js', 'utf8'),
  /atlas|\.register\(|caches\.|localStorage|indexedDB/,
)
const worker = readFileSync('dist/sw.js', 'utf8')
assert(worker.includes('self.registration.unregister()'))
assert.doesNotMatch(worker, /addEventListener\('fetch'|caches\.delete|clients\.claim/)
assert.equal([...readFileSync('dist/sitemap.xml', 'utf8').matchAll(/<loc>/g)].length, 12)
assert.doesNotMatch(readFileSync('README.md', 'utf8'), /atlas|pokémon|orimemo|zenn/i)
console.log('Independent profile: 12 language pages, metadata, social links and no PWA passed.')
