import names from '../public/locales/search.json'
import raw from './data/catalog.json'
import modelData from './data/models.json'
import { normalizeSearch } from './locales'
import type { ModelEntry, Pokemon } from './types'

export const pokemon = raw as Pokemon[]
export const models = modelData as Record<string, ModelEntry>
export const generations = [
  'All generations',
  'Generation I',
  'Generation II',
  'Generation III',
  'Generation IV',
  'Generation V',
  'Generation VI',
  'Generation VII',
  'Generation VIII',
  'Generation IX',
]
export const typeColors: Record<string, string> = {
  normal: '#9da59a',
  fire: '#e89b72',
  water: '#86b0df',
  electric: '#e0ca68',
  grass: '#a6c87b',
  ice: '#8bcfc4',
  fighting: '#d39783',
  poison: '#bc96cb',
  ground: '#c4aa7d',
  flying: '#afaddc',
  psychic: '#d994b0',
  bug: '#bfca73',
  rock: '#c5b187',
  ghost: '#a29ac8',
  dragon: '#9b9ad7',
  dark: '#aa9f96',
  steel: '#a1bdc0',
  fairy: '#dab0ce',
}
const searchIndex = new Map(
  pokemon.map((p) => [
    p.id,
    normalizeSearch(
      [p.slug, p.name, p.ja, ...((names as Record<string, string[]>)[String(p.id)] || [])].join(' '),
    ),
  ]),
)

export function filterPokemon(query: string, gen: number, type: string, favorites: Set<number> | null) {
  const q = normalizeSearch(query).replace(/^#?0*/, '')
  return pokemon.filter(
    (p) =>
      (!gen || p.gen === gen) &&
      (!type || p.types.includes(type)) &&
      (!favorites || favorites.has(p.id)) &&
      (!q || String(p.id) === q || searchIndex.get(p.id)?.includes(q)),
  )
}
export const art = (id: number) => `/artwork/${id}.webp`
export function readFavorites(): Set<number> {
  try {
    const data: unknown = JSON.parse(localStorage.getItem('atlas-favorites') || '[]')
    return new Set(
      Array.isArray(data)
        ? data.filter((id) => Number.isInteger(id) && pokemon.some((p) => p.id === id))
        : [],
    )
  } catch {
    return new Set()
  }
}
