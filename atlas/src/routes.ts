export const ATLAS_BASE = '/atlas'
export const SITE_ORIGIN = 'https://rrih.github.io'
export const SEO_LOCALES = ['en', 'ja', 'fr', 'de', 'es', 'it', 'ko', 'zh-Hans', 'zh-Hant'] as const
export type SeoLocale = (typeof SEO_LOCALES)[number]
export const CATALOG_PAGE_SIZE = 60
export const POKEMON_TYPES = [
  'normal',
  'fire',
  'water',
  'electric',
  'grass',
  'ice',
  'fighting',
  'poison',
  'ground',
  'flying',
  'psychic',
  'bug',
  'rock',
  'ghost',
  'dragon',
  'dark',
  'steel',
  'fairy',
] as const
export type AtlasPage =
  | { kind: 'home' }
  | { kind: 'catalog'; page?: number }
  | { kind: 'pokemon'; id: number; formId?: string }
  | { kind: 'type'; type: string }
  | { kind: 'generation'; generation: number }
  | { kind: 'forms'; formKind?: 'mega' | 'regional' }
  | { kind: 'help' }
  | { kind: 'about' }
export type AtlasRoute = AtlasPage & { locale: SeoLocale }

export function seoLocale(value?: string | null): SeoLocale {
  const tag = (value || 'en').replaceAll('_', '-').toLowerCase()
  if (tag.startsWith('zh')) return /(?:hant|tw|hk|mo)/.test(tag) ? 'zh-Hant' : 'zh-Hans'
  return SEO_LOCALES.find((locale) => locale === tag.split('-')[0]) || 'en'
}

export function assetPath(path: string): string {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(path)) return path
  const absolute = `/${path.replace(/^\/+/, '')}`
  return absolute === ATLAS_BASE || absolute.startsWith(`${ATLAS_BASE}/`)
    ? absolute
    : `${ATLAS_BASE}${absolute}`
}

export function atlasPath(page: AtlasPage | AtlasRoute, language?: string): string {
  let locale = seoLocale(language || ('locale' in page ? page.locale : 'en'))
  if (page.kind === 'help' || page.kind === 'about') locale = locale === 'ja' ? 'ja' : 'en'
  const prefix = `${ATLAS_BASE}${locale === 'en' ? '' : `/${locale}`}`
  switch (page.kind) {
    case 'home':
      return `${prefix}/`
    case 'catalog':
      return `${prefix}/pokemon/${page.page && page.page > 1 ? `page/${page.page}/` : ''}`
    case 'pokemon':
      return `${prefix}/pokemon/${page.id}/${page.formId ? `forms/${encodeURIComponent(page.formId)}/` : ''}`
    case 'type':
      return `${prefix}/types/${page.type}/`
    case 'generation':
      return `${prefix}/generations/${page.generation}/`
    case 'forms':
      return `${prefix}/forms/${page.formKind ? `${page.formKind}/` : ''}`
    case 'help':
      return `${prefix}/help/`
    case 'about':
      return `${prefix}/about/`
  }
}

export const canonicalUrl = (page: AtlasPage | AtlasRoute, locale?: string) =>
  SITE_ORIGIN + atlasPath(page, locale)

export function parseAtlasRoute(pathname: string): AtlasRoute | null {
  const path = pathname.replace(/\/index\.html$/, '/').replace(/\/+$/, '')
  if (path !== ATLAS_BASE && !path.startsWith(`${ATLAS_BASE}/`)) return null
  const parts = path.slice(ATLAS_BASE.length).split('/').filter(Boolean)
  const explicit = SEO_LOCALES.find((locale) => locale !== 'en' && parts[0] === locale)
  const locale: SeoLocale = explicit || 'en'
  if (explicit) parts.shift()
  const remaining = parts.join('/')
  if (!remaining) return { kind: 'home', locale }
  if (remaining === 'pokemon') return { kind: 'catalog', locale, page: 1 }
  let match = remaining.match(/^pokemon\/page\/(\d+)$/)
  if (match && Number(match[1]) >= 1 && Number(match[1]) <= Math.ceil(1025 / CATALOG_PAGE_SIZE))
    return { kind: 'catalog', locale, page: Number(match[1]) }
  match = remaining.match(/^pokemon\/(\d+)(?:\/forms\/([a-z\d-]+))?$/)
  if (match && Number(match[1]) >= 1 && Number(match[1]) <= 1025)
    return { kind: 'pokemon', locale, id: Number(match[1]), ...(match[2] ? { formId: match[2] } : {}) }
  match = remaining.match(/^types\/([a-z]+)$/)
  const typeSlug = match?.[1]
  if (match && POKEMON_TYPES.some((type) => type === typeSlug))
    return { kind: 'type', locale, type: match[1] }
  match = remaining.match(/^generations\/([1-9])$/)
  if (match) return { kind: 'generation', locale, generation: Number(match[1]) }
  match = remaining.match(/^forms(?:\/(mega|regional))?$/)
  if (match)
    return { kind: 'forms', locale, ...(match[1] ? { formKind: match[1] as 'mega' | 'regional' } : {}) }
  if ((remaining === 'help' || remaining === 'about') && (locale === 'en' || locale === 'ja'))
    return { kind: remaining, locale }
  return null
}
