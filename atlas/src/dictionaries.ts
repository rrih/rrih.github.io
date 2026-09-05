import type { Locale, Messages } from './locales'
import english from './locales/ui/en.json'
import { assetPath } from './routes'

type DictionaryFetcher = (input: string, init: RequestInit) => Promise<Response>

export function createDictionaryLoader(fetcher: DictionaryFetcher = fetch) {
  const loaded = new Map<Locale, Messages>([['en', english]])
  const pending = new Map<Locale, Promise<Messages>>()

  return {
    get: (locale: Locale) => loaded.get(locale),
    load(locale: Locale): Promise<Messages> {
      const cached = loaded.get(locale)
      if (cached) return Promise.resolve(cached)
      const existing = pending.get(locale)
      if (existing) return existing
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15_000)
      const request = fetcher(assetPath(`/locales/ui/${locale}.json`), { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error('Language unavailable')
          const data: unknown = await response.json()
          if (
            !data ||
            Array.isArray(data) ||
            typeof data !== 'object' ||
            !('Choose your language' in data) ||
            !Object.values(data).every((value) => typeof value === 'string' && value.trim())
          )
            throw new Error('Invalid language')
          const messages = data as Messages
          loaded.set(locale, messages)
          return messages
        })
        .finally(() => {
          clearTimeout(timeout)
          pending.delete(locale)
        })
      pending.set(locale, request)
      return request
    },
  }
}

export const dictionaries = createDictionaryLoader()
