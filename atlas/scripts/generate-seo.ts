import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import raw from '../src/data/catalog.json'
import formData from '../src/data/forms.json'
import modelData from '../src/data/models.json'
import { formLabel, type PokemonForm } from '../src/forms'
import { previewImage } from '../src/previews'
import {
  type AtlasPage,
  assetPath,
  atlasPath,
  CATALOG_PAGE_SIZE,
  POKEMON_TYPES,
  SEO_LOCALES,
  type SeoLocale,
  SITE_ORIGIN,
} from '../src/routes'
import { buildIndexSeo, buildPokemonSeo, type PageSeo, seoWords } from '../src/seo'
import type { Pokemon } from '../src/types'
import { type ContentRevision, contentRevision, createContentFingerprint } from './seo-fingerprint'

const entries = raw as Pokemon[]
const forms = formData as PokemonForm[]
const models = modelData as Record<string, { url: string; shiny?: string; animations?: number }>
interface LocalizedEntry {
  name?: string
  genus?: string
  description?: string
  sourceURL?: string
  sourceLabel?: string
  sourceVersion?: string
  descriptionKind?: string
  verifiedAt?: string
}
interface Translation {
  species: Record<string, LocalizedEntry>
  types: Record<string, string>
  stats?: string[]
}
const load = <T>(file: string): T => JSON.parse(readFileSync(file, 'utf8'))
const data = Object.fromEntries(
  [...SEO_LOCALES, 'ja-Hrkt'].map((locale) => [
    locale,
    load<Translation>(`public/locales/catalog/${locale}.json`),
  ]),
)
const messages = Object.fromEntries(
  SEO_LOCALES.map((locale) => [locale, load<Record<string, string>>(`src/locales/ui/${locale}.json`)]),
)
const t = (locale: SeoLocale, key: string) => messages[locale][key] || messages.en[key] || key
const byId = new Map(entries.map((entry) => [entry.id, entry]))
const escapeHtml = (value: unknown) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
const json = (value: unknown) =>
  JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029')
const localized = (entry: Pokemon, locale: SeoLocale) => {
  const translated = {
    ...(locale === 'ja' ? data['ja-Hrkt'].species[entry.id] : {}),
    ...data[locale].species[entry.id],
  }
  return {
    ...entry,
    ...translated,
    name: translated.name || entry.name,
    genus: translated.genus || (locale === 'en' ? entry.genus : ''),
    description: translated.description || entry.description,
  }
}
const typeName = (type: string, locale: SeoLocale) => data[locale].types[type] || t(locale, type)
const standardName = (entry: Pokemon, locale: SeoLocale) => localized(entry, locale).name
const formName = (form: PokemonForm, locale: SeoLocale) =>
  form.names[locale] ||
  `${standardName(byId.get(form.speciesId) as Pokemon, locale)} (${formLabel(form, (key) => t(locale, key))})`
const noScriptCopy = {
  en: 'Enable JavaScript to use the 3D viewer. The Pokédex information remains available on this page.',
  ja: '3Dモデルの操作にはJavaScriptを有効にしてください。図鑑の情報はこのまま読めます。',
  fr: 'Activez JavaScript pour utiliser le visualiseur 3D. Les informations du Pokédex restent consultables sur cette page.',
  de: 'Aktiviere JavaScript für den 3D-Betrachter. Die Pokédex-Informationen bleiben auf dieser Seite lesbar.',
  es: 'Activa JavaScript para usar el visor 3D. La información de la Pokédex sigue disponible en esta página.',
  it: 'Attiva JavaScript per usare il visualizzatore 3D. Le informazioni del Pokédex restano disponibili in questa pagina.',
  ko: '3D 뷰어를 사용하려면 JavaScript를 활성화하세요. 포켓몬 도감 정보는 이 페이지에서 계속 읽을 수 있습니다.',
  'zh-Hans': '请启用JavaScript以使用3D查看器。本页的宝可梦图鉴信息仍可阅读。',
  'zh-Hant': '請啟用JavaScript以使用3D檢視器。本頁的寶可夢圖鑑資訊仍可閱讀。',
} as const
const sourceCopy = {
  en: [
    'Data source',
    'Verified',
    'Form data',
    'Reference image',
    'Species information',
    'Available forms',
    'Show the viewer',
    'All types',
    'All generations',
  ],
  ja: [
    'データの出典',
    '確認日',
    'フォルムのデータ',
    '参考画像',
    '基本となるポケモンの情報',
    '収録フォルム',
    'ビューアへ移動',
    'すべてのタイプ',
    'すべての世代',
  ],
  fr: [
    'Source des données',
    'Vérifié le',
    'Données de la forme',
    'Image de référence',
    'Informations sur l’espèce',
    'Formes disponibles',
    'Afficher le visualiseur',
    'Tous les types',
    'Toutes les générations',
  ],
  de: [
    'Datenquelle',
    'Geprüft am',
    'Formdaten',
    'Referenzbild',
    'Informationen zur Art',
    'Verfügbare Formen',
    'Zum Betrachter',
    'Alle Typen',
    'Alle Generationen',
  ],
  es: [
    'Fuente de datos',
    'Verificado',
    'Datos de la forma',
    'Imagen de referencia',
    'Información de la especie',
    'Formas disponibles',
    'Mostrar el visor',
    'Todos los tipos',
    'Todas las generaciones',
  ],
  it: [
    'Fonte dei dati',
    'Verificato',
    'Dati della forma',
    'Immagine di riferimento',
    'Informazioni sulla specie',
    'Forme disponibili',
    'Apri il visualizzatore',
    'Tutti i tipi',
    'Tutte le generazioni',
  ],
  ko: [
    '데이터 출처',
    '확인일',
    '폼 데이터',
    '참고 이미지',
    '기본 포켓몬 정보',
    '제공되는 폼',
    '뷰어로 이동',
    '모든 타입',
    '모든 세대',
  ],
  'zh-Hans': [
    '数据来源',
    '核查日期',
    '形态数据',
    '参考图片',
    '基础宝可梦信息',
    '收录形态',
    '前往查看器',
    '全部属性',
    '全部世代',
  ],
  'zh-Hant': [
    '資料來源',
    '核查日期',
    '形態資料',
    '參考圖片',
    '基礎寶可夢資訊',
    '收錄形態',
    '前往檢視器',
    '全部屬性',
    '全部世代',
  ],
} as const
const modelImage = (entry: Pokemon, form?: PokemonForm) => previewImage(entry.id, form?.id)

function metadata(entry: Pokemon, locale: SeoLocale, form?: PokemonForm) {
  const details = localized(entry, locale)
  return buildPokemonSeo({
    pokemon: form ? { ...entry, ...form, id: entry.id } : entry,
    localized: { ...details, name: form ? formName(form, locale) : details.name },
    locale,
    ...(form ? { form } : {}),
    baseName: details.name,
    typeNames: (form?.types || entry.types).map((type) => typeName(type, locale)),
    image: modelImage(entry, form),
  })
}
function head(meta: PageSeo) {
  return `<title>${escapeHtml(meta.title)}</title>
<meta name="description" content="${escapeHtml(meta.description)}">
<link rel="canonical" href="${meta.canonical}">
${meta.alternates.map((alternate) => `<link rel="alternate" hreflang="${alternate.lang}" href="${alternate.href}">`).join('\n')}
<meta property="og:site_name" content="Pokémon Atlas"><meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(meta.title)}"><meta property="og:description" content="${escapeHtml(meta.description)}">
<meta property="og:url" content="${meta.canonical}"><meta property="og:locale" content="${meta.ogLocale}">
<meta property="og:image" content="${meta.image}"><meta property="og:image:alt" content="${escapeHtml(meta.imageAlt)}">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${json(meta.jsonLd)}</script>`
}
function languages(page: AtlasPage, locale: SeoLocale) {
  const languages = page.kind === 'about' || page.kind === 'help' ? ['en', 'ja'] : SEO_LOCALES
  return `<nav class="languages" aria-label="${escapeHtml(t(locale, 'Choose your language'))}">${languages.map((language) => `<a href="${atlasPath(page, language)}" lang="${language}" hreflang="${language}"${language === locale ? ' aria-current="page"' : ''}>${new Intl.DisplayNames([language], { type: 'language' }).of(language)}</a>`).join('')}</nav>`
}
function breadcrumb(meta: PageSeo) {
  return `<nav class="breadcrumbs" aria-label="${meta.language === 'ja' ? '現在の位置' : 'Breadcrumb'}"><ol>${meta.breadcrumbs.map((crumb, index) => `<li><a href="${crumb.href}"${index === meta.breadcrumbs.length - 1 ? ' aria-current="page"' : ''}>${escapeHtml(crumb.name)}</a></li>`).join('')}</ol></nav>`
}
function footer(locale: SeoLocale) {
  const legal = locale === 'ja' ? 'ja' : 'en'
  return `<footer><a href="${atlasPath({ kind: 'home' }, locale)}">Pokémon Atlas</a><a href="${atlasPath({ kind: 'catalog' }, locale)}">${escapeHtml(seoWords(locale).catalog)}</a><a href="${atlasPath({ kind: 'help' }, locale)}">${escapeHtml(t(locale, 'How to explore'))}</a><a href="${atlasPath({ kind: 'about' }, locale)}">${escapeHtml(t(locale, 'About Atlas & credits'))}</a><a href="/atlas/legal/${legal}/rights.html">${escapeHtml(t(locale, 'Rights & credits'))}</a><a href="/atlas/legal/${legal}/terms.html">${escapeHtml(t(locale, 'Terms of use'))}</a><a href="/atlas/legal/${legal}/privacy.html">${escapeHtml(t(locale, 'Privacy policy'))}</a></footer>`
}
function card(entry: Pokemon, locale: SeoLocale, form?: PokemonForm) {
  return `<li><a class="entry-card" href="${atlasPath({ kind: 'pokemon', id: entry.id, ...(form ? { formId: form.id } : {}) }, locale)}"><img src="${assetPath(modelImage(entry, form))}" alt="" width="96" height="96" loading="lazy"><span><small>No.${String(entry.id).padStart(4, '0')}</small><strong>${escapeHtml(form ? formName(form, locale) : standardName(entry, locale))}</strong><span>${escapeHtml((form?.types || entry.types).map((type) => typeName(type, locale)).join(' / '))}</span></span></a></li>`
}
function indexLinks(locale: SeoLocale) {
  return `<nav class="index-links" aria-label="${escapeHtml(seoWords(locale).catalog)}"><a href="${atlasPath({ kind: 'catalog' }, locale)}">${escapeHtml(seoWords(locale).catalog)}</a><a href="${atlasPath({ kind: 'forms', formKind: 'mega' }, locale)}">${escapeHtml(seoWords(locale).mega)}</a><a href="${atlasPath({ kind: 'forms', formKind: 'regional' }, locale)}">${escapeHtml(seoWords(locale).regional)}</a></nav><details><summary>${escapeHtml(sourceCopy[locale][7])}</summary><nav class="index-links">${POKEMON_TYPES.map((type) => `<a href="${atlasPath({ kind: 'type', type }, locale)}">${escapeHtml(typeName(type, locale))}</a>`).join('')}</nav></details><details><summary>${escapeHtml(sourceCopy[locale][8])}</summary><nav class="index-links">${Array.from({ length: 9 }, (_, i) => `<a href="${atlasPath({ kind: 'generation', generation: i + 1 }, locale)}">${escapeHtml(seoWords(locale).generation)} ${i + 1}</a>`).join('')}</nav></details>`
}
function body(entry: Pokemon, locale: SeoLocale, form?: PokemonForm) {
  const details = localized(entry, locale)
  const meta = metadata(entry, locale, form)
  const page: AtlasPage = { kind: 'pokemon', id: entry.id, ...(form ? { formId: form.id } : {}) }
  const shown = form || entry,
    name = form ? formName(form, locale) : details.name
  const stats = data[locale].stats || [
    'HP',
    'Attack',
    'Defense',
    'Special Attack',
    'Special Defense',
    'Speed',
  ]
  const sourceURL = details.sourceURL || `https://pokeapi.co/api/v2/pokemon-species/${entry.id}/`
  const image = modelImage(entry, form)
  const reference = !!form && !image.includes('/previews/forms/')
  const adjacent = entries.filter(
    (candidate) => candidate.id === entry.id - 1 || candidate.id === entry.id + 1,
  )
  const evolution = entries.filter(
    (candidate) => candidate.id === entry.evolvesFrom || candidate.evolvesFrom === entry.id,
  )
  const available = forms.filter((candidate) => candidate.speciesId === entry.id)
  const hasShiny = !!(form ? form.model.shiny : models[String(entry.id)]?.shiny)
  return `<main id="main" class="seo-static">${breadcrumb(meta)}
<article><p class="entry-number">No.${String(entry.id).padStart(4, '0')}</p><h1>${escapeHtml(name)}</h1>
<figure><img class="entry-image" src="${assetPath(image)}" alt="${escapeHtml(reference ? details.name : name)}" width="320" height="320" fetchpriority="high">${reference ? `<figcaption>${escapeHtml(sourceCopy[locale][3])}: ${escapeHtml(details.name)}</figcaption>` : ''}</figure>
<a class="viewer-link" href="#viewer">${escapeHtml(sourceCopy[locale][6])}</a><div id="viewer" tabindex="-1"><p>${escapeHtml(meta.description)}</p></div>
${form ? `<h2>${escapeHtml(sourceCopy[locale][4])}</h2>` : ''}${details.genus ? `<p>${escapeHtml(details.genus)}</p>` : ''}<p>${escapeHtml(details.description)}</p>
<dl class="facts"><div><dt>${escapeHtml(t(locale, 'Type'))}</dt><dd>${shown.types.map((type) => `<a href="${atlasPath({ kind: 'type', type }, locale)}">${escapeHtml(typeName(type, locale))}</a>`).join(' / ')}</dd></div><div><dt>${escapeHtml(t(locale, 'HEIGHT'))}</dt><dd>${shown.height} m</dd></div><div><dt>${escapeHtml(t(locale, 'WEIGHT'))}</dt><dd>${shown.weight} kg</dd></div><div><dt>${escapeHtml(seoWords(locale).generation)}</dt><dd><a href="${atlasPath({ kind: 'generation', generation: entry.gen }, locale)}">${entry.gen}</a></dd></div></dl>
<h2>${escapeHtml(t(locale, 'Base stats'))}</h2><table><tbody>${shown.stats.map((value, i) => `<tr><th scope="row">${escapeHtml(stats[i])}</th><td>${value}</td></tr>`).join('')}</tbody></table>
<p>${escapeHtml(t(locale, hasShiny ? 'Shiny appearance' : 'A shiny model isn’t available for this Pokémon.'))}${hasShiny ? `: <a href="${atlasPath(page, locale)}#shiny=1">${escapeHtml(t(locale, 'Shiny appearance'))}</a>` : ''}</p>
${available.length ? `<h2>${escapeHtml(sourceCopy[locale][5])}</h2><ul class="text-links"><li><a href="${atlasPath({ kind: 'pokemon', id: entry.id }, locale)}">${escapeHtml(details.name)} · ${escapeHtml(seoWords(locale).standard)}</a></li>${available.map((variant) => `<li><a href="${atlasPath({ kind: 'pokemon', id: entry.id, formId: variant.id }, locale)}">${escapeHtml(formName(variant, locale))}</a></li>`).join('')}</ul>` : ''}
${evolution.length ? `<h2>${escapeHtml(t(locale, 'Connected by evolution'))}</h2><ul class="entry-list">${evolution.map((candidate) => card(candidate, locale)).join('')}</ul>` : ''}
<details class="source"><summary>${escapeHtml(sourceCopy[locale][0])}</summary><p><a href="${escapeHtml(sourceURL)}" target="_blank" rel="noreferrer">${escapeHtml(details.sourceLabel || 'PokéAPI')}</a>${details.verifiedAt ? ` · ${escapeHtml(sourceCopy[locale][1])}: <time datetime="${escapeHtml(details.verifiedAt)}">${escapeHtml(details.verifiedAt)}</time>` : ''}</p>${form ? `<p><a href="https://pokeapi.co/api/v2/pokemon/${form.pokemonId}/" target="_blank" rel="noreferrer">${escapeHtml(sourceCopy[locale][2])} · PokéAPI</a></p>` : ''}<p><a href="/atlas/legal/${locale === 'ja' ? 'ja' : 'en'}/rights.html">${escapeHtml(t(locale, 'Rights & credits'))}</a></p></details></article>
<nav class="adjacent">${adjacent.map((target) => `<a href="${atlasPath({ kind: 'pokemon', id: target.id }, locale)}">${escapeHtml(standardName(target, locale))}</a>`).join('')}</nav>${languages(page, locale)}${footer(locale)}</main>`
}
function homeBody(locale: SeoLocale) {
  const page: AtlasPage = { kind: 'home' },
    meta = buildIndexSeo(page, locale)
  return `<main id="main" class="seo-static"><p>Pokémon Atlas</p><h1>${escapeHtml(seoWords(locale).home)}</h1><p>${escapeHtml(meta.description)}</p><div id="viewer" tabindex="-1"><img class="entry-image" src="${assetPath(modelImage(entries[5]))}" alt="${escapeHtml(standardName(entries[5], locale))}" width="320" height="320" fetchpriority="high"></div>${indexLinks(locale)}<ul class="entry-list">${[1, 6, 25, 133, 151, 1025].map((id) => card(byId.get(id) as Pokemon, locale)).join('')}</ul>${languages(page, locale)}${footer(locale)}</main>`
}
function indexBody(
  page: Exclude<AtlasPage, { kind: 'pokemon' | 'home' | 'help' | 'about' }>,
  locale: SeoLocale,
) {
  let selected = entries,
    selectedForms: PokemonForm[] | undefined
  if (page.kind === 'catalog')
    selected = entries.slice(((page.page || 1) - 1) * CATALOG_PAGE_SIZE, (page.page || 1) * CATALOG_PAGE_SIZE)
  if (page.kind === 'type') selected = entries.filter((entry) => entry.types.includes(page.type))
  if (page.kind === 'generation') selected = entries.filter((entry) => entry.gen === page.generation)
  if (page.kind === 'forms')
    selectedForms = forms.filter((form) => !page.formKind || form.kind === page.formKind)
  const label =
    page.kind === 'type' ? `${typeName(page.type, locale)} · ${seoWords(locale).types}` : undefined
  const meta = buildIndexSeo(page, locale, { label, count: selectedForms?.length ?? selected.length })
  const pagination =
    page.kind === 'catalog'
      ? `<nav class="pagination" aria-label="${escapeHtml(seoWords(locale).page)}">${Array.from({ length: Math.ceil(entries.length / CATALOG_PAGE_SIZE) }, (_, index) => `<a href="${atlasPath({ kind: 'catalog', page: index + 1 }, locale)}"${(page.page || 1) === index + 1 ? ' aria-current="page"' : ''}>${index + 1}</a>`).join('')}</nav>`
      : ''
  return {
    meta,
    body: `<main id="main" class="seo-static">${breadcrumb(meta)}<h1>${escapeHtml(meta.breadcrumbs.at(-1)?.name)}</h1><p>${escapeHtml(meta.description)}</p>${indexLinks(locale)}${pagination}<ul class="entry-list">${selectedForms ? selectedForms.map((form) => card(byId.get(form.speciesId) as Pokemon, locale, form)).join('') : selected.map((entry) => card(entry, locale)).join('')}</ul>${pagination}${languages(page, locale)}${footer(locale)}</main>`,
  }
}
function staticDocument(meta: PageSeo, content: string) {
  return `<!doctype html><html lang="${meta.language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101311">${head(meta)}<link rel="icon" href="/atlas/icon.svg"><link rel="stylesheet" href="/atlas/seo-static.css"></head><body><a class="seo-skip" href="#main">${escapeHtml(t(meta.language, 'Skip to viewer'))}</a>${content}</body></html>\n`
}
const metadataMarker = /<!-- ATLAS-PAGE-METADATA -->[\s\S]*?<!-- \/ATLAS-PAGE-METADATA -->/
const bodyMarker = /<!-- ATLAS-STATIC-CONTENT -->[\s\S]*?<!-- \/ATLAS-STATIC-CONTENT -->/
function inject(template: string, meta: PageSeo, content: string) {
  const preloads =
    meta.language === 'en'
      ? ''
      : [
          `/locales/ui/${meta.language}.json`,
          `/locales/catalog/${meta.language}.json`,
          ...(meta.language === 'ja' ? ['/locales/catalog/ja-Hrkt.json'] : []),
        ]
          .map((path) => `<link rel="preload" href="${assetPath(path)}" as="fetch" crossorigin="anonymous">`)
          .join('')
  return template
    .replace(/<html lang="[^"]+">/, `<html lang="${meta.language}">`)
    .replace(
      metadataMarker,
      () => `<!-- ATLAS-PAGE-METADATA -->${head(meta)}${preloads}<!-- /ATLAS-PAGE-METADATA -->`,
    )
    .replace(bodyMarker, () => `<!-- ATLAS-STATIC-CONTENT -->${content}<!-- /ATLAS-STATIC-CONTENT -->`)
    .replace(
      /<noscript>[\s\S]*?<\/noscript>/,
      `<noscript>${escapeHtml(noScriptCopy[meta.language])}</noscript>`,
    )
}
const output = resolve(process.env.ATLAS_SEO_DIR || 'dist')
if (
  entries.length !== 1025 ||
  entries.some((entry, index) => entry.id !== index + 1 || entry.stats.length !== 6)
)
  throw new Error('Invalid ordered Pokémon catalog')
if (process.argv.includes('--prepare')) {
  const template = readFileSync('index.html', 'utf8')
  if (!metadataMarker.test(template) || !bodyMarker.test(template))
    throw new Error('Missing SEO template markers')
  writeFileSync('index.html', inject(template, buildIndexSeo({ kind: 'home' }, 'en'), homeBody('en')))
  console.log('Prepared the Atlas home metadata and accessible HTML before Vite precaching.')
} else {
  const template = readFileSync(join(output, 'index.html'), 'utf8')
  const stateFile = 'scripts/seo-content-state.json'
  const previous = existsSync(stateFile) ? load<Record<string, ContentRevision>>(stateFile) : {}
  const state: typeof previous = {},
    urls: { path: string; modified: string }[] = []
  const today = new Date().toISOString().slice(0, 10)
  const fingerprint = createContentFingerprint('public')
  const modelPaths = (model: { url: string; shiny?: string }) => [
    model.url,
    ...(model.shiny ? [model.shiny] : []),
  ]
  const writePage = (
    path: string,
    html: string,
    contentHash: string,
    options: { keep?: boolean; models?: string[] } = {},
  ) => {
    const images = [...html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map((match) => match[1])
    const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1]
    const assets = [...images, ...(ogImage ? [ogImage] : []), ...(options.models || [])]
    const revision = contentRevision(fingerprint(contentHash, assets), previous[path], today)
    const { modified } = revision
    state[path] = revision
    urls.push({ path, modified })
    if (!options.keep) {
      const file = join(output, path.replace(/^\/atlas\//, ''), 'index.html')
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, html)
    }
  }
  for (const locale of SEO_LOCALES) {
    const home = buildIndexSeo({ kind: 'home' }, locale),
      content = homeBody(locale)
    writePage(atlasPath({ kind: 'home' }, locale), inject(template, home, content), json({ home, content }), {
      keep: locale === 'en',
      models: modelPaths(models[6]),
    })
    for (const entry of entries)
      for (const form of [undefined, ...forms.filter((candidate) => candidate.speciesId === entry.id)]) {
        const meta = metadata(entry, locale, form),
          content = body(entry, locale, form)
        writePage(
          atlasPath({ kind: 'pokemon', id: entry.id, ...(form ? { formId: form.id } : {}) }, locale),
          inject(template, meta, content),
          json({ meta, content }),
          { models: modelPaths(form?.model || models[entry.id]) },
        )
      }
    const indexes: Exclude<AtlasPage, { kind: 'pokemon' | 'home' | 'help' | 'about' }>[] = [
      ...Array.from({ length: Math.ceil(entries.length / CATALOG_PAGE_SIZE) }, (_, index) => ({
        kind: 'catalog' as const,
        page: index + 1,
      })),
      ...POKEMON_TYPES.map((type) => ({ kind: 'type' as const, type })),
      ...Array.from({ length: 9 }, (_, index) => ({ kind: 'generation' as const, generation: index + 1 })),
      { kind: 'forms' },
      { kind: 'forms', formKind: 'mega' },
      { kind: 'forms', formKind: 'regional' },
    ]
    for (const page of indexes) {
      const { meta, body } = indexBody(page, locale)
      writePage(atlasPath(page, locale), staticDocument(meta, body), json({ meta, body }))
    }
  }
  for (const locale of ['en', 'ja'] as const) {
    for (const page of ['rights', 'terms', 'privacy']) {
      const path = `/atlas/legal/${locale}/${page}.html`,
        html = readFileSync(`public/legal/${locale}/${page}.html`, 'utf8')
      const revision = contentRevision(fingerprint(html), previous[path], today)
      const { modified } = revision
      state[path] = revision
      urls.push({ path, modified })
    }
    for (const kind of ['help', 'about'] as const) {
      const page: AtlasPage = { kind },
        meta = buildIndexSeo(page, locale, {
          description:
            locale === 'ja'
              ? kind === 'help'
                ? 'Pokémon Atlasの3D操作、複数配置、端末内保存、オフライン利用の使い方。'
                : 'Pokémon Atlasの運営者、非公式ファンサイトとしての権利表示とお問い合わせ。'
              : kind === 'help'
                ? 'How to use Pokémon Atlas: 3D controls, shared scenes, local saves and offline viewing.'
                : 'About Pokémon Atlas, its independent operator, credits and contact details.',
        })
      const html = readFileSync(`scripts/content/${locale}/${kind}.html`, 'utf8')
      const content = `<main id="main" class="seo-static">${breadcrumb(meta)}${html}${languages(page, locale)}${footer(locale)}</main>`
      writePage(atlasPath(page, locale), staticDocument(meta, content), json({ meta, content }))
    }
  }
  writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`)
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(({ path, modified }) => `  <url><loc>${SITE_ORIGIN + path}</loc><lastmod>${modified}</lastmod></url>`).join('\n')}\n</urlset>\n`
  writeFileSync(join(output, 'sitemap.xml'), sitemap)
  writeFileSync('public/sitemap.xml', sitemap)
  console.log(
    `Generated ${urls.length} Atlas URLs in ${SEO_LOCALES.length} languages, including ${forms.length} distinct forms.`,
  )
}
