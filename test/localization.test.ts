import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { filterPokemon } from '../src/catalog'
import { isRTL, locales, normalizeSearch, preferredLocale, resolveLocale, translator } from '../src/locales'
import english from '../src/locales/ui/en.json'

describe('language selection and interpolation', () => {
  test('shared links win, then saved preferences, then supported browser languages', () => {
    expect(preferredLocale('fr-CA', 'ja', ['ko-KR'])).toBe('fr')
    expect(preferredLocale('unsupported', 'ar', ['ja'])).toBe('ar')
    expect(preferredLocale(null, 'unsupported', ['xx', 'zh-TW', 'ja'])).toBe('zh-Hant')
    expect(preferredLocale(null, null, ['xx'])).toBe('en')
    expect(preferredLocale(null, null, [])).toBe('en')
  })
  test('regional/script choices and legacy browser tags resolve consistently', () => {
    for (const [tag, expected] of Object.entries({
      ZH_hant_HK: 'zh-Hant',
      'zh-CN': 'zh-Hans',
      'zh-Hans-TW': 'zh-Hans',
      'zh-Hant-CN': 'zh-Hant',
      'zh-SG': 'zh-Hans',
      'pt-BR': 'pt-BR',
      'pt-PT': 'pt',
      'es-MX': 'es-419',
      'es-ES': 'es',
      'es-AR': 'es-419',
      'no-NO': 'nb',
      'tl-PH': 'fil',
      'iw-IL': 'he',
      'in-ID': 'id',
    } as const))
      expect(resolveLocale(tag)).toBe(expected)
    for (const [code] of locales) expect(resolveLocale(code)).toBe(code)
    expect(resolveLocale('')).toBeUndefined()
    expect(resolveLocale('<script>')).toBeUndefined()
    expect(locales.filter(([code]) => isRTL(code)).map(([code]) => code)).toEqual(['ar', 'he', 'fa', 'ur'])
  })
  test('interpolation preserves zero and literal dollar sequences', () => {
    const t = translator({ 'View {name}': '{name} ansehen', '{count} saved': '{count} gespeichert' })
    expect(t('View {name}', { name: '$&' })).toBe('$& ansehen')
    expect(t('{count} saved', { count: 0 })).toBe('0 gespeichert')
    expect(t('Explore')).toBe('Explore')
  })
})

describe('complete UI and genuine source catalogs', () => {
  test('all 49 UI dictionaries have all 195 keys and exact placeholders', () => {
    expect(locales.length).toBe(49)
    const keys = Object.keys(english).sort()
    expect(keys.length).toBe(195)
    const placeholders = (value: string) => (value.match(/\{\w+\}/g) || []).sort()
    for (const [code] of locales) {
      const words = JSON.parse(readFileSync(`src/locales/ui/${code}.json`, 'utf8'))
      expect(Object.keys(words).sort()).toEqual(keys)
      for (const key of keys) {
        expect(typeof words[key]).toBe('string')
        expect(words[key].trim().length).toBeGreaterThan(0)
        expect(placeholders(words[key])).toEqual(placeholders(key))
      }
    }
  })
  test('all source catalogs map every species and leave absent translations absent', () => {
    for (const code of [
      'en',
      'ja',
      'ja-Hrkt',
      'ja-Latn',
      'ko',
      'zh-Hans',
      'zh-Hant',
      'fr',
      'de',
      'es',
      'es-419',
      'it',
    ]) {
      const catalog = JSON.parse(readFileSync(`public/locales/catalog/${code}.json`, 'utf8'))
      expect(catalog.locale).toBe(code)
      expect(Object.keys(catalog.species).length).toBe(1025)
      for (let id = 1; id <= 1025; id++) expect(catalog.species[id].name.length).toBeGreaterThan(0)
      if (code === 'ja') {
        expect(catalog.species['6'].name).toBe('リザードン')
        expect(catalog.species['1025'].name).toBe('モモワロウ')
        expect(catalog.species['1025'].description).toBeUndefined()
      }
      if (code === 'ja-Latn') expect(catalog.species['6'].description).toBeUndefined()
    }
  })
})

describe('names can be searched independently of UI language', () => {
  test('source names, accents, scripts, kana and localized numbers find their own species', () => {
    for (const [query, id] of [
      ['Dracaufeu', 6],
      ['Glurak', 6],
      ['リザードン', 6],
      ['りざーどん', 6],
      ['ﾘｻﾞｰﾄﾞﾝ', 6],
      ['喷火龙', 6],
      ['噴火龍', 6],
      ['리자몽', 6],
      ['Pêchaminus', 1025],
      ['Pechaminus', 1025],
      ['＃００２５', 25],
      ['#٠٠٢٥', 25],
      ['००२५', 25],
      ['০০২৫', 25],
      ['๒๕', 25],
    ] as const)
      expect(filterPokemon(query, 0, '', null).map((p) => p.id)).toEqual([id])
    expect(normalizeSearch('  POKÉMON  ')).toBe('pokemon')
    expect(filterPokemon('Glurak', 2, '', null)).toEqual([])
    expect(filterPokemon('Dracaufeu', 1, 'fire', new Set([6])).map((p) => p.id)).toEqual([6])
  })
})
