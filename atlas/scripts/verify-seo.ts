import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import catalog from '../src/data/catalog.json'
import forms from '../src/data/forms.json'
import { formLabel, type PokemonForm } from '../src/forms'
import { previewImage } from '../src/previews'
import {
  assetPath,
  atlasPath,
  CATALOG_PAGE_SIZE,
  POKEMON_TYPES,
  SEO_LOCALES,
  type SeoLocale,
  SITE_ORIGIN,
} from '../src/routes'
import { buildIndexSeo, buildPokemonSeo, type PageSeo, seoWords } from '../src/seo'

const output = resolve(process.env.ATLAS_SEO_DIR || 'dist')
const read = (path: string) => readFileSync(join(output, path), 'utf8')
const decode = (value: string) =>
  value.replace(/&(?:#(\d+)|#x([\da-f]+)|(amp|lt|gt|quot|apos));/gi, (_, decimal, hex, named) =>
    decimal
      ? String.fromCodePoint(Number(decimal))
      : hex
        ? String.fromCodePoint(Number.parseInt(hex, 16))
        : ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" } as Record<string, string>)[
            named.toLowerCase()
          ] || '',
  )
const attributes = (tag: string) =>
  Object.fromEntries(
    [...tag.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)].map((match) => [match[1], decode(match[2])]),
  )
const tags = (html: string, name: string) =>
  [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map((match) => attributes(match[0]))
const moduleScripts = (html: string) =>
  tags(html, 'script')
    .filter((tag) => tag.type === 'module')
    .map((tag) => tag.src)
const root = read('index.html'),
  appScripts = moduleScripts(root)
assert(appScripts.length > 0 && appScripts.every((path) => path.startsWith('/atlas/assets/')))
for (const path of appScripts) assert(existsSync(join(output, path.replace(/^\/atlas\//, ''))))
const expected = new Set<string>()
const pathFile = (path: string) =>
  join(output, path.replace(/^\/atlas\//, ''), path.endsWith('/') ? 'index.html' : '')
const localized = Object.fromEntries(
  [...SEO_LOCALES, 'ja-Hrkt'].map((locale) => [
    locale,
    JSON.parse(readFileSync(`public/locales/catalog/${locale}.json`, 'utf8')),
  ]),
)
let species = 0,
  variants = 0,
  indexPages = 0,
  bodyLinks = 0
const adjacency = new Map<string, Set<string>>()
const modifiedByPath = JSON.parse(readFileSync('scripts/seo-content-state.json', 'utf8')) as Record<
  string,
  { modified: string; hash: string }
>
function check(path: string, meta: PageSeo, app: boolean) {
  assert(!expected.has(path), `Duplicate generated path ${path}`)
  expected.add(path)
  const html = readFileSync(pathFile(path), 'utf8')
  assert.equal(tags(html, 'html')[0]?.lang, meta.language, path)
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)]
  assert.equal(h1s.length, 1, `${path}: one visible main heading`)
  assert.equal(tags(html, 'main').length, 1, `${path}: one main landmark`)
  assert.equal(
    decode(html.match(/<title>([\s\S]*?)<\/title>/)?.[1] || ''),
    meta.title,
    `${path}: title matches shared metadata`,
  )
  const metadata = tags(html, 'meta'),
    links = tags(html, 'link')
  assert.deepEqual(
    links.filter((link) => link.rel === 'canonical').map((link) => link.href),
    [meta.canonical],
    path,
  )
  assert.deepEqual(
    Object.fromEntries(
      links.filter((link) => link.rel === 'alternate').map((link) => [link.hreflang, link.href]),
    ),
    Object.fromEntries(meta.alternates.map((alternate) => [alternate.lang, alternate.href])),
    `${path}: reciprocal alternates`,
  )
  for (const [key, value] of [
    ['description', meta.description],
    ['og:title', meta.title],
    ['og:description', meta.description],
    ['og:url', meta.canonical],
    ['og:locale', meta.ogLocale],
    ['og:image', meta.image],
  ])
    assert.equal(
      metadata.find((tag) => tag.name === key || tag.property === key)?.content,
      value,
      `${path}: ${key}`,
    )
  const blocks = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
  assert.equal(blocks.length, 1, path)
  assert.deepEqual(JSON.parse(blocks[0][1]), meta.jsonLd, `${path}: shared JSON-LD`)
  assert.deepEqual(moduleScripts(html), app ? appScripts : [], `${path}: only viewer pages load the app`)
  assert(!/pagead2\.googlesyndication|adsbygoogle/.test(html), `${path}: ads remain behind runtime consent`)
  assert(!metadata.some((tag) => tag.name === 'robots' && /noindex/.test(tag.content)), path)
  const outgoing = new Set<string>()
  for (const tag of tags(html, 'a')) {
    const url = new URL(tag.href, SITE_ORIGIN + path)
    if (url.origin !== SITE_ORIGIN) continue
    if (url.pathname === '/') continue
    assert(url.pathname.startsWith('/atlas/'), `${path}: obsolete internal path ${url.pathname}`)
    assert(existsSync(pathFile(url.pathname)), `${path}: missing linked page ${tag.href}`)
    if (url.hash && !url.hash.includes('=')) {
      const target = url.pathname === path ? html : readFileSync(pathFile(url.pathname), 'utf8')
      assert(
        tags(target, '[a-z][a-z\\d]*').some(
          (element) => element.id === decodeURIComponent(url.hash.slice(1)),
        ),
        `${path}: missing anchor ${tag.href}`,
      )
    }
    outgoing.add(url.pathname)
    bodyLinks++
  }
  adjacency.set(path, outgoing)
  for (const image of tags(html, 'img')) {
    assert(image.src.startsWith('/atlas/'), `${path}: image base path`)
    assert(existsSync(join(output, image.src.replace(/^\/atlas\//, ''))), `${path}: missing image`)
    assert(Number(image.width) > 0 && Number(image.height) > 0, `${path}: image dimensions`)
  }
  assert(/^\d{4}-\d{2}-\d{2}$/.test(modifiedByPath[path]?.modified), `${path}: real modification date`)
  return { html, name: decode(h1s[0][1]) }
}
function details(entry: (typeof catalog)[number], locale: SeoLocale) {
  return {
    ...entry,
    ...(locale === 'ja' ? localized['ja-Hrkt'].species[entry.id] : {}),
    ...localized[locale].species[entry.id],
  }
}

for (const locale of SEO_LOCALES) {
  const result = check(atlasPath({ kind: 'home' }, locale), buildIndexSeo({ kind: 'home' }, locale), true)
  assert.equal(result.name, seoWords(locale).home)
  for (const entry of catalog) {
    const base = details(entry, locale)
    for (const form of [undefined, ...forms.filter((candidate) => candidate.speciesId === entry.id)]) {
      const ui = JSON.parse(readFileSync(`src/locales/ui/${locale}.json`, 'utf8'))
      const name = form
        ? form.names[locale] || `${base.name} (${formLabel(form as PokemonForm, (key) => ui[key] || key)})`
        : base.name
      const typeNames = (form?.types || entry.types).map((type) => localized[locale].types[type] || type)
      const meta = buildPokemonSeo({
        pokemon: form ? { ...entry, ...form, id: entry.id } : entry,
        localized: { ...base, name },
        locale,
        ...(form ? { form } : {}),
        baseName: base.name,
        typeNames,
        image: previewImage(entry.id, form?.id),
      })
      const path = atlasPath({ kind: 'pokemon', id: entry.id, ...(form ? { formId: form.id } : {}) }, locale)
      const checked = check(path, meta, true)
      assert.equal(checked.name, name, `${path}: correct species or form name`)
      assert.deepEqual(
        [...checked.html.matchAll(/<td>(\d+)<\/td>/g)].map((match) => Number(match[1])),
        form?.stats || entry.stats,
        `${path}: correct form stats`,
      )
      assert(checked.html.includes('id="viewer"'), `${path}: usable viewer anchor`)
      assert(checked.html.includes(`/${entry.id}/`), `${path}: species identity`)
      if (form) {
        assert(
          checked.html.includes(`https://pokeapi.co/api/v2/pokemon/${form.pokemonId}/`),
          `${path}: form source`,
        )
        variants++
      } else species++
    }
  }
  for (let page = 1; page <= Math.ceil(catalog.length / CATALOG_PAGE_SIZE); page++) {
    const route = { kind: 'catalog' as const, page },
      count = catalog.slice((page - 1) * CATALOG_PAGE_SIZE, page * CATALOG_PAGE_SIZE).length
    check(atlasPath(route, locale), buildIndexSeo(route, locale, { count }), false)
    indexPages++
  }
  for (const type of POKEMON_TYPES) {
    const route = { kind: 'type' as const, type }
    check(
      atlasPath(route, locale),
      buildIndexSeo(route, locale, {
        count: catalog.filter((entry) => entry.types.includes(type)).length,
        label: `${localized[locale].types[type]} · ${seoWords(locale).types}`,
      }),
      false,
    )
    indexPages++
  }
  for (let generation = 1; generation <= 9; generation++) {
    const route = { kind: 'generation' as const, generation }
    check(
      atlasPath(route, locale),
      buildIndexSeo(route, locale, { count: catalog.filter((entry) => entry.gen === generation).length }),
      false,
    )
    indexPages++
  }
  for (const formKind of [undefined, 'mega', 'regional'] as const) {
    const route = { kind: 'forms' as const, ...(formKind ? { formKind } : {}) }
    check(
      atlasPath(route, locale),
      buildIndexSeo(route, locale, {
        count: forms.filter((form) => !formKind || form.kind === formKind).length,
      }),
      false,
    )
    indexPages++
  }
}
for (const locale of ['en', 'ja'] as const) {
  for (const kind of ['help', 'about'] as const) {
    const description =
      locale === 'ja'
        ? kind === 'help'
          ? 'Pokémon Atlasの3D操作、複数配置、端末内保存、オフライン利用の使い方。'
          : 'Pokémon Atlasの運営者、非公式ファンサイトとしての権利表示とお問い合わせ。'
        : kind === 'help'
          ? 'How to use Pokémon Atlas: 3D controls, shared scenes, local saves and offline viewing.'
          : 'About Pokémon Atlas, its independent operator, credits and contact details.'
    check(atlasPath({ kind }, locale), buildIndexSeo({ kind }, locale, { description }), false)
  }
  for (const kind of ['rights', 'terms', 'privacy']) {
    const path = `/atlas/legal/${locale}/${kind}.html`,
      html = readFileSync(pathFile(path), 'utf8')
    expected.add(path)
    assert.equal(tags(html, 'link').find((link) => link.rel === 'canonical')?.href, SITE_ORIGIN + path)
    assert(!/href="\/legal\//.test(html), path)
  }
}
const sitemap = read('sitemap.xml'),
  urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => decode(match[1]))
assert.equal(urls.length, expected.size)
assert.deepEqual(new Set(urls), new Set([...expected].map((path) => SITE_ORIGIN + path)))
assert.equal([...sitemap.matchAll(/<lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>/g)].length, expected.size)
const depth = new Map<string, number>([[atlasPath({ kind: 'home' }), 0]]),
  queue = [...depth.keys()]
for (let index = 0; index < queue.length; index++)
  for (const target of adjacency.get(queue[index]) || [])
    if (!depth.has(target)) {
      depth.set(target, (depth.get(queue[index]) || 0) + 1)
      queue.push(target)
    }
for (const path of expected) assert(depth.has(path), `Unreachable page ${path}`)
const maxDepth = Math.max(...depth.values())
assert(maxDepth <= 5, `Index graph too deep: ${maxDepth}`)
const sw = read('sw.js')
const revision = sw.match(
  /(?:\burl|"url")\s*:\s*"index\.html"\s*,\s*(?:revision|"revision")\s*:\s*"([a-f\d]{32})"/,
)?.[1]
assert.equal(
  revision,
  createHash('md5').update(root).digest('hex'),
  'Postbuild must preserve the precached home',
)
assert(!/\burl:"(?:ja\/)?pokemon\//.test(sw), 'Generated catalog pages must not all be precached')
assert(read('robots.txt').includes('Sitemap: https://rrih.github.io/'))
assert.equal(read('ads.txt').trim(), 'google.com, pub-6426570202991325, DIRECT, f08c47fec0942fa0')
for (const locale of ['en', 'ja', 'es-419', 'fa']) {
  const manifest = JSON.parse(read(`locales/manifests/${locale}.webmanifest`))
  assert.equal(manifest.id, '/atlas/')
  assert.equal(manifest.scope, '/atlas/')
  assert(manifest.start_url.startsWith('/atlas/'))
  assert(manifest.icons.every((icon: { src: string }) => icon.src.startsWith('/atlas/')))
  assert(existsSync(join(output, 'locales/ui', `${locale}.json`)))
}
assert.equal(assetPath('/models/home/6.glb'), '/atlas/models/home/6.glb')
console.log(
  JSON.stringify({
    speciesPages: species,
    formPages: variants,
    languages: SEO_LOCALES,
    staticIndexes: indexPages,
    sitemapUrls: urls.length,
    bodyLinks,
    maxInternalLinkDepth: maxDepth,
    sharedMetadataMatches: true,
    appShellRevisionMatches: true,
  }),
)
