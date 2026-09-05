import { describe, expect, test } from 'bun:test'
import { assetPath, atlasPath, parseAtlasRoute, SEO_LOCALES, seoLocale } from '../src/routes'
import { buildIndexSeo, buildPokemonSeo } from '../src/seo'

describe('Atlas page identity', () => {
  test('keeps the personal home separate and round-trips each localized Atlas home', () => {
    expect(parseAtlasRoute('/')).toBeNull()
    for (const locale of SEO_LOCALES) {
      const path = atlasPath({ kind: 'home' }, locale)
      expect(parseAtlasRoute(path)).toEqual({ kind: 'home', locale })
      const seo = buildIndexSeo({ kind: 'home' }, locale)
      expect(seo.canonical).toBe(`https://rrih.github.io${path}`)
      expect(seo.title).not.toContain('Charizard')
      expect(seo.alternates).toHaveLength(SEO_LOCALES.length + 1)
    }
  })

  test('uses a distinct canonical and breadcrumb for a Mega form', () => {
    const seo = buildPokemonSeo({
      pokemon: { id: 6, name: 'Charizard', types: ['fire', 'dragon'], height: 1.7, weight: 110.5 },
      localized: { name: 'メガリザードンX' },
      locale: 'ja',
      form: { id: 'charizard-mega-x' },
      baseName: 'リザードン',
      typeNames: ['ほのお', 'ドラゴン'],
    })
    expect(seo.canonical).toBe('https://rrih.github.io/atlas/ja/pokemon/6/forms/charizard-mega-x/')
    expect(parseAtlasRoute(new URL(seo.canonical).pathname)).toEqual({
      kind: 'pokemon',
      locale: 'ja',
      id: 6,
      formId: 'charizard-mega-x',
    })
    expect(seo.breadcrumbs.at(-2)?.href).toBe('/atlas/ja/pokemon/6/')
    expect(seo.description).toContain('ドラゴン')
    expect(seo.imageAlt).toBe('リザードン · 通常のすがた')
    expect(seo.canonical).not.toContain('#')
  })

  test('keeps English metadata identical before and after the interface loads', () => {
    const input = {
      pokemon: { id: 6, name: 'Charizard', types: ['fire', 'flying'], height: 1.7, weight: 90.5 },
      localized: { name: 'Charizard' },
      locale: 'en',
    }
    const staticSeo = buildPokemonSeo({ ...input, typeNames: ['Fire', 'Flying'] })
    const renderedSeo = buildPokemonSeo({ ...input, typeNames: ['fire', 'flying'] })
    expect(renderedSeo).toEqual(staticSeo)
    expect(renderedSeo.description).toContain('Fire / Flying')
    expect(buildPokemonSeo({ ...input, locale: 'fa', typeNames: ['آتش', 'پرواز'] })).toEqual(staticSeo)
  })

  test('rejects unknown routes and out-of-range indexes instead of selecting another Pokémon', () => {
    for (const path of [
      '/atlas/no-such-page/',
      '/atlas/pokemon/0/',
      '/atlas/pokemon/1026/',
      '/atlas/pokemon/page/0/',
      '/atlas/pokemon/page/19/',
      '/atlas/types/invalid/',
      '/atlas/generations/10/',
    ])
      expect(parseAtlasRoute(path)).toBeNull()
    expect(parseAtlasRoute('/atlas/pokemon/page/18/')).toEqual({ kind: 'catalog', locale: 'en', page: 18 })
  })

  test('keeps UI-only language preferences out of canonical paths', () => {
    expect(seoLocale('es-419')).toBe('es')
    expect(atlasPath({ kind: 'pokemon', id: 753 }, 'es-419')).toBe('/atlas/es/pokemon/753/')
    expect(atlasPath({ kind: 'pokemon', id: 753 }, 'fa')).toBe('/atlas/pokemon/753/')
    expect(atlasPath({ kind: 'help' }, 'fr')).toBe('/atlas/help/')
    expect(seoLocale('zh-TW')).toBe('zh-Hant')
  })

  test('normalizes asset paths once and retains user-local blob URLs', () => {
    expect(assetPath('/models/home/6.glb')).toBe('/atlas/models/home/6.glb')
    expect(assetPath('/atlas/models/home/6.glb')).toBe('/atlas/models/home/6.glb')
    expect(assetPath('artwork/6.webp')).toBe('/atlas/artwork/6.webp')
    expect(assetPath('blob:https://rrih.github.io/background')).toBe('blob:https://rrih.github.io/background')
    expect(assetPath('data:image/png;base64,a')).toBe('data:image/png;base64,a')
  })
})
