import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { dictionaries } from './dictionaries'
import { isRTL, type Locale, locales, preferredLocale, resolveLocale, translator } from './locales'
import { assetPath, parseAtlasRoute } from './routes'
import type { Pokemon } from './types'

const catalogLocales = new Set(['ja', 'ko', 'zh-Hans', 'zh-Hant', 'fr', 'de', 'es', 'es-419', 'it'])
interface Catalog {
  locale: string
  species: Record<
    string,
    Partial<
      Pick<
        Pokemon,
        | 'name'
        | 'genus'
        | 'description'
        | 'sourceURL'
        | 'sourceLabel'
        | 'sourceVersion'
        | 'descriptionKind'
        | 'verifiedAt'
      >
    >
  >
  types: Record<string, string>
  stats?: string[]
}
const loadedCatalogs = new Map<string, Catalog>()
async function fetchCatalog(locale: string, signal: AbortSignal): Promise<Catalog> {
  const cached = loadedCatalogs.get(locale)
  if (cached) return cached
  const response = await fetch(assetPath(`/locales/catalog/${locale}.json`), { signal })
  if (!response.ok) throw new Error('Translation unavailable')
  const data: Catalog = await response.json()
  if (data.locale !== locale || !data.species || !data.types) throw new Error('Invalid translation')
  loadedCatalogs.set(locale, data)
  return data
}
export function initialLocale(): Locale {
  let saved: string | null = null
  try {
    saved = localStorage.getItem('atlas-language')
  } catch {
    /* A preference is optional in private browsing. */
  }
  return preferredLocale(
    new URLSearchParams(location.search).get('lang') || parseAtlasRoute(location.pathname)?.locale || null,
    saved,
    navigator.languages,
  )
}

function cachedCatalog(locale: string): Catalog | null {
  const primary = loadedCatalogs.get(locale)
  const kana = locale === 'ja' ? loadedCatalogs.get('ja-Hrkt') : undefined
  if (!primary) return kana || null
  if (!kana) return primary
  return {
    ...primary,
    species: Object.fromEntries(
      Object.keys(primary.species).map((id) => [id, { ...kana.species[id], ...primary.species[id] }]),
    ),
  }
}

async function loadCatalog(locale: string, signal: AbortSignal): Promise<Catalog | null> {
  if (!catalogLocales.has(locale)) return null
  await Promise.all([
    fetchCatalog(locale, signal).catch(() => null),
    locale === 'ja' ? fetchCatalog('ja-Hrkt', signal).catch(() => null) : null,
  ])
  const data = cachedCatalog(locale)
  if (!data) throw new Error('Translation unavailable')
  return data
}

// Keep the readable server-generated document until the requested interface is ready.
export async function prepareLocale(locale: Locale): Promise<void> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    await Promise.all([dictionaries.load(locale), loadCatalog(locale, controller.signal).catch(() => null)])
  } finally {
    clearTimeout(timeout)
    controller.abort()
  }
}
interface LocaleContextValue {
  locale: Locale
  chooseLocale: (locale: Locale) => Promise<boolean>
  languageStatus: 'ready' | 'loading' | 'failed'
  retryLanguage: () => Promise<boolean>
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
export function LocaleProvider({
  children,
  initialLanguage,
}: {
  children: ReactNode
  initialLanguage?: Locale
}) {
  const [locale, setLocale] = useState(initialLanguage || initialLocale)
  const [languageRequest, setLanguageRequest] = useState<{
    locale: Locale | null
    status: 'ready' | 'loading' | 'failed'
  }>({ locale: null, status: 'ready' })
  const languageRequestId = useRef(0)
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
  }>(() => ({
    locale,
    data: cachedCatalog(locale),
    status: !catalogLocales.has(locale) || cachedCatalog(locale) ? 'ready' : 'loading',
  }))
  const t = useMemo(() => translator(dictionaries.get(locale) || dictionaries.get('en') || {}), [locale])
  const displayNames = useMemo(() => new Intl.DisplayNames([locale], { type: 'language' }), [locale])

  const selectLanguage = useCallback(async (next: Locale, persist: boolean): Promise<boolean> => {
    const requestId = ++languageRequestId.current
    setLanguageRequest({ locale: next, status: 'loading' })
    try {
      await prepareLocale(next)
      if (languageRequestId.current !== requestId) return false
      setLocale(next)
      setLanguageRequest({ locale: null, status: 'ready' })
      if (persist) {
        try {
          localStorage.setItem('atlas-language', next)
          setSavedLocale(next)
        } catch {
          // The interface changes even when saving a preference is unavailable.
        }
      }
      return true
    } catch {
      if (languageRequestId.current === requestId) setLanguageRequest({ locale: next, status: 'failed' })
      return false
    }
  }, [])

  useEffect(
    () => () => {
      languageRequestId.current++
    },
    [],
  )

  useEffect(() => {
    const url = new URL(location.href)
    url.searchParams.set('lang', locale)
    history.replaceState(null, '', url)
    document.documentElement.lang = locale
    document.documentElement.dir = isRTL(locale) ? 'rtl' : 'ltr'
    document
      .querySelector('link[rel="manifest"]')
      ?.setAttribute(
        'href',
        assetPath(locale === 'en' ? '/manifest.webmanifest' : `/locales/manifests/${locale}.webmanifest`),
      )
  }, [locale])
  useEffect(() => {
    const change = () => {
      const next =
        resolveLocale(new URLSearchParams(location.search).get('lang')) ||
        parseAtlasRoute(location.pathname)?.locale
      if (next) void selectLanguage(next, false)
    }
    window.addEventListener('popstate', change)
    return () => window.removeEventListener('popstate', change)
  }, [selectLanguage])
  // biome-ignore lint/correctness/useExhaustiveDependencies: The retry counter intentionally restarts this request.
  useEffect(() => {
    const controller = new AbortController()
    if (!catalogLocales.has(locale)) {
      setCatalog({ locale, data: null, status: 'ready' })
      return () => controller.abort()
    }
    const cached = cachedCatalog(locale)
    setCatalog({ locale, data: cached, status: cached ? 'ready' : 'loading' })
    loadCatalog(locale, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return
        setCatalog({ locale, data, status: 'ready' })
      })
      .catch(() => {
        if (!controller.signal.aborted) setCatalog({ locale, data: null, status: 'failed' })
      })
    return () => controller.abort()
  }, [locale, attempt])
  const current = catalog.locale === locale ? catalog.data : cachedCatalog(locale)
  const value: LocaleContextValue = {
    locale,
    preferenceSaved: savedLocale === locale,
    chooseLocale: (next) => selectLanguage(next, true),
    languageStatus: languageRequest.status,
    retryLanguage: () =>
      languageRequest.locale ? selectLanguage(languageRequest.locale, true) : Promise.resolve(true),
    t,
    number: (number, options) => new Intl.NumberFormat(locale, options).format(number),
    species: (entry) => {
      const fields = current?.species[entry.id]
      return {
        ...entry,
        ...fields,
        ...(current && !fields?.genus ? { genus: '' } : {}),
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
