import inventory from './data/previews.json'
import { assetPath } from './routes'

const species = new Set<number>(inventory.species)
const forms = new Set<string>(inventory.forms)

export function previewPath(id: number, formId?: string): string | undefined {
  if (formId) return forms.has(formId) ? assetPath(`/previews/forms/${formId}.webp`) : undefined
  return species.has(id) ? assetPath(`/previews/${id}.webp`) : undefined
}

export const previewImage = (id: number, formId?: string) =>
  previewPath(id, formId) || assetPath(`/artwork/${id}.webp`)
