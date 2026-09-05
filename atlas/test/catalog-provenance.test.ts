import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import entries from '../src/data/catalog.json'

const seoLocales = ['en', 'ja', 'fr', 'de', 'es', 'it', 'ko', 'zh-Hans', 'zh-Hant']
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'))

test('every search language has readable species text and a correctly scoped source', () => {
  const official = read('scripts/data/official-japanese-provenance.json').species
  for (const locale of seoLocales) {
    const catalog = read(`public/locales/catalog/${locale}.json`)
    for (const entry of entries) {
      const record = catalog.species[entry.id]
      expect(record.name?.trim().length).toBeGreaterThan(0)
      expect(record.description?.trim().length).toBeGreaterThan(0)
      expect(record.description).not.toMatch(/<[^>]+>/)
      expect(record.sourceLabel?.trim().length).toBeGreaterThan(0)
      expect(record.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      const source = new URL(record.sourceURL)
      expect(source.protocol).toBe('https:')
      if (record.descriptionKind === 'source-entry') {
        expect(source.hostname).toBe('pokeapi.co')
        expect(source.pathname).toBe(`/api/v2/pokemon-species/${entry.id}/`)
        expect(record.sourceVersion.length).toBeGreaterThan(0)
      } else if (record.descriptionKind === 'atlas-summary') {
        expect(locale).toBe('ja')
        expect(source.hostname).toBe('zukan.pokemon.co.jp')
        expect(official[entry.id].name).toBe(record.name)
        expect(official[entry.id].sourceVersion).toBe(record.sourceVersion)
        expect(record.sourceLabel).toContain('要約')
      } else {
        expect(record.descriptionKind).toBe('atlas-facts')
        expect(source.hostname).toBe('pokeapi.co')
        expect(source.pathname).toBe(`/api/v2/pokemon/${entry.id}/`)
        expect(record.sourceVersion).toBeUndefined()
        expect(record.description).toContain(record.name)
        for (const type of entry.types) expect(record.description).toContain(catalog.types[type])
      }
    }
  }
})

test('Japanese names and classifications cover the entire catalog without an English fallback', () => {
  const catalog = read('public/locales/catalog/ja.json')
  for (const entry of entries) {
    const record = catalog.species[entry.id]
    expect(record.name).toMatch(/[\u3040-\u30ff\u3400-\u9fff]/)
    expect(record.genus).toMatch(/[\u3040-\u30ff\u3400-\u9fff]/)
    expect(record.description).toMatch(/[\u3040-\u30ff\u3400-\u9fff]/)
  }
  expect(catalog.species['1011'].genus).toBe('りんごあめポケモン')
  expect(catalog.species['1017'].genus).toBe('おめんポケモン')
})

test('the base English catalog and localized English keep matching descriptions and sources', () => {
  const catalog = read('public/locales/catalog/en.json')
  for (const entry of entries) {
    const record = catalog.species[entry.id]
    for (const key of [
      'description',
      'descriptionKind',
      'sourceURL',
      'sourceLabel',
      'sourceVersion',
      'verifiedAt',
    ] as const)
      expect(entry[key]).toBe(record[key])
  }
})
