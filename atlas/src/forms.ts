import { models } from './catalog'
import data from './data/forms.json'
import { assetPath } from './routes'
import type { ModelEntry, Pokemon } from './types'

export interface PokemonForm {
  id: string
  speciesId: number
  kind: 'mega' | 'regional'
  region?: 'alola' | 'galar' | 'hisui' | 'paldea'
  variant?: 'x' | 'y' | 'z'
  name: string
  names: Record<string, string>
  model: ModelEntry
  pokemonId: number
  types: string[]
  height: number
  weight: number
  stats: number[]
}
export const forms = (data as PokemonForm[]).map((form) => ({
  ...form,
  model: {
    ...form.model,
    url: assetPath(form.model.url),
    ...(form.model.shiny ? { shiny: assetPath(form.model.shiny) } : {}),
  },
}))
export const formsFor = (id: number) => forms.filter((form) => form.speciesId === id)
export const findForm = (id: number, formId?: string | null) =>
  forms.find((form) => form.speciesId === id && form.id === formId)
export const modelFor = (id: number, formId?: string) => findForm(id, formId)?.model || models[id]
export function formLabel(form: PokemonForm, t: (key: string) => string): string {
  if (form.kind === 'mega')
    return `${t('Mega Evolution')}${form.variant ? ` ${form.variant.toUpperCase()}` : ''}`
  const region = t(
    { alola: 'Alolan form', galar: 'Galarian form', hisui: 'Hisuian form', paldea: 'Paldean form' }[
      form.region || 'alola'
    ],
  )
  const extra = form.id.endsWith('-zen')
    ? 'Zen Mode'
    : form.id.endsWith('-combat-breed')
      ? 'Combat Breed'
      : form.id.endsWith('-blaze-breed')
        ? 'Blaze Breed'
        : form.id.endsWith('-aqua-breed')
          ? 'Aqua Breed'
          : ''
  return extra ? `${region} · ${t(extra)}` : region
}
export function formPokemon(entry: Pokemon, form?: PokemonForm): Pokemon {
  return form
    ? { ...entry, types: form.types, height: form.height, weight: form.weight, stats: form.stats }
    : entry
}
