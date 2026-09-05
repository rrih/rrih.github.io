import { describe, expect, test } from 'bun:test'
import { filterPokemon, models, pokemon } from '../src/catalog'

describe('complete, usable collection', () => {
  test('all numbered species have details, valid evolution references, and a 3D source', () => {
    expect(pokemon.length).toBe(1025)
    expect(Object.keys(models).length).toBe(pokemon.length)
    const ids = new Set(pokemon.map((p) => p.id))
    for (const [i, p] of pokemon.entries()) {
      expect(p.id).toBe(i + 1)
      expect(p.name.length).toBeGreaterThan(0)
      expect(p.ja.length).toBeGreaterThan(0)
      expect(p.description.length).toBeGreaterThan(0)
      expect(p.stats.length).toBe(6)
      expect(p.stats.every((n) => Number.isFinite(n) && n > 0 && n <= 255)).toBe(true)
      expect(p.types.length).toBeGreaterThan(0)
      expect(p.gen).toBeGreaterThanOrEqual(1)
      expect(p.gen).toBeLessThanOrEqual(9)
      expect(p.height).toBeGreaterThan(0)
      expect(p.weight).toBeGreaterThan(0)
      if (p.evolvesFrom !== null) expect(ids.has(p.evolvesFrom)).toBe(true)
      expect(models[p.id].url.endsWith('.glb')).toBe(true)
    }
  })
  test('search handles Japanese, case, leading-zero numbers, and combined filters', () => {
    expect(filterPokemon('ピカチュウ', 0, '', null).map((p) => p.id)).toEqual([25])
    expect(filterPokemon('  CHARIZARD ', 0, '', null).map((p) => p.id)).toEqual([6])
    expect(filterPokemon('#0025', 0, '', null).map((p) => p.id)).toEqual([25])
    expect(filterPokemon('Pikachu', 9, '', null)).toEqual([])
    expect(filterPokemon('', 1, 'fire', new Set([4, 6, 25])).map((p) => p.id)).toEqual([4, 6])
    expect(filterPokemon('no-such-pokemon', 0, '', null)).toEqual([])
    expect(filterPokemon('', 0, '', new Set())).toEqual([])
    expect(filterPokemon('', 9, '', null).some((p) => p.id === 1025)).toBe(true)
  })
})
