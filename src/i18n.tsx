import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import {
  isRTL,
  type Locale,
  locales,
  type Messages,
  preferredLocale,
  resolveLocale,
  translator,
} from './locales'
import type { Pokemon } from './types'

const dictionaries = Object.fromEntries(
  Object.entries(import.meta.glob<Messages>('./locales/ui/*.json', { eager: true, import: 'default' })).map(
    ([path, messages]) => [path.split('/').pop()?.replace('.json', ''), messages],
  ),
)
const catalogLocales = new Set(['ja', 'ko', 'zh-Hans', 'zh-Hant', 'fr', 'de', 'es', 'es-419', 'it'])
interface Catalog {
  locale: string
  species: Record<string, { name?: string; genus?: string; description?: string }>
  types: Record<string, string>
  stats?: string[]
}
const loadedCatalogs = new Map<string, Catalog>()
async function fetchCatalog(locale: string, signal: AbortSignal): Promise<Catalog> {
  const cached = loadedCatalogs.get(locale)
  if (cached) return cached
  const response = await fetch(`/locales/catalog/${locale}.json`, { signal })
  if (!response.ok) throw new Error('Translation unavailable')
  const data: Catalog = await response.json()
  if (data.locale !== locale || !data.species || !data.types) throw new Error('Invalid translation')
  loadedCatalogs.set(locale, data)
  return data
}
function initialLocale(): Locale {
  let saved: string | null = null
  try {
    saved = localStorage.getItem('atlas-language')
  } catch {
    /* A preference is optional in private browsing. */
  }
  return preferredLocale(new URLSearchParams(location.search).get('lang'), saved, navigator.languages)
}
interface LocaleContextValue {
  locale: Locale
  chooseLocale: (locale: Locale) => void
  t: ReturnType<typeof translator>
  number: (value: number, options?: Intl.NumberFormatOptions) => string
  species: (entry: Pokemon) => Pokemon & { nameLang: string; genusLang: string; descriptionLang: string }
  typeName: (type: string) => string
  catalogStatus: 'ready' | 'loading' | 'failed'
  retryCatalog: () => void
  localeName: (code: string) => string
  preferenceSaved: boolean
}
const LocaleContext = createContext<LocaleContextValue | null>(null)
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState(initialLocale)
  const [attempt, setAttempt] = useState(0)
  const [savedLocale, setSavedLocale] = useState<string | null>(() => {
    try {
      return localStorage.getItem('atlas-language')
    } catch {
      return null
    }
  })
  const [catalog, setCatalog] = useState<{
    locale: string
    data: Catalog | null
    status: 'ready' | 'loading' | 'failed'
  }>({ locale: '', data: null, status: 'ready' })
  const t = useMemo(() => translator(dictionaries[locale] || dictionaries.en), [locale])
  const displayNames = useMemo(() => new Intl.DisplayNames([locale], { type: 'language' }), [locale])

  useEffect(() => {
    const url = new URL(location.href)
    url.searchParams.set('lang', locale)
    history.replaceState(null, '', url)
    document.documentElement.lang = locale
    document.documentElement.dir = isRTL(locale) ? 'rtl' : 'ltr'
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', t('A closer look at Pokémon.'))
    document
      .querySelector('link[rel="manifest"]')
      ?.setAttribute(
        'href',
        locale === 'en' ? '/manifest.webmanifest' : `/locales/manifests/${locale}.webmanifest`,
      )
  }, [locale, t])
  useEffect(() => {
    const change = () => {
      const next = resolveLocale(new URLSearchParams(location.search).get('lang'))
      if (next) setLocale(next)
    }
    window.addEventListener('popstate', change)
    return () => window.removeEventListener('popstate', change)
  }, [])
  // biome-ignore lint/correctness/useExhaustiveDependencies: The retry counter intentionally restarts this request.
  useEffect(() => {
    const controller = new AbortController()
    if (!catalogLocales.has(locale)) {
      setCatalog({ locale, data: null, status: 'ready' })
      return () => controller.abort()
    }
    setCatalog({ locale, data: null, status: 'loading' })
    Promise.all([
      fetchCatalog(locale, controller.signal).catch(() => null),
      locale === 'ja' ? fetchCatalog('ja-Hrkt', controller.signal).catch(() => null) : null,
    ])
      .then(([primary, kana]) => {
        if (controller.signal.aborted) return
        let data = primary || kana
        if (!data) throw new Error('Translation unavailable')
        if (primary && kana)
          data = {
            ...data,
            species: Object.fromEntries(
              Object.keys(primary.species).map((id) => [id, { ...kana.species[id], ...primary.species[id] }]),
            ),
          }
        setCatalog({ locale, data, status: 'ready' })
      })
      .catch(() => {
        if (!controller.signal.aborted) setCatalog({ locale, data: null, status: 'failed' })
      })
    return () => controller.abort()
  }, [locale, attempt])
  const current = catalog.locale === locale ? catalog.data : null
  const value: LocaleContextValue = {
    locale,
    preferenceSaved: savedLocale === locale,
    chooseLocale: (next) => {
      setLocale(next)
      try {
        localStorage.setItem('atlas-language', next)
        setSavedLocale(next)
      } catch {
        /* Session language still works without storage. */
      }
    },
    t,
    number: (number, options) => new Intl.NumberFormat(locale, options).format(number),
    species: (entry) => {
      const fields = current?.species[entry.id]
      return {
        ...entry,
        ...fields,
        nameLang: fields?.name ? locale : 'en',
        genusLang: fields?.genus ? locale : 'en',
        descriptionLang: fields?.description ? locale : 'en',
      }
    },
    typeName: (type) => current?.types[type] || t(type),
    catalogStatus:
      catalog.locale === locale ? catalog.status : catalogLocales.has(locale) ? 'loading' : 'ready',
    retryCatalog: () => setAttempt((value) => value + 1),
    localeName: (code) =>
      displayNames.of(code) || locales.find(([candidate]) => candidate === code)?.[2] || code,
  }
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}
export function useLocale() {
  const value = useContext(LocaleContext)
  if (!value) throw new Error('LocaleProvider is required')
  return value
}
