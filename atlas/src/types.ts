import type { CameraPose } from './sceneStudio'

export interface Pokemon {
  id: number
  slug: string
  name: string
  ja: string
  gen: number
  types: string[]
  height: number
  weight: number
  stats: number[]
  description: string
  genus: string
  sourceURL?: string
  sourceLabel?: string
  sourceVersion?: string
  descriptionKind?: 'source-entry' | 'atlas-summary' | 'atlas-facts'
  verifiedAt?: string
  evolvesFrom: number | null
}

export interface ModelEntry {
  url: string
  shiny?: string
  animations?: number
  textured?: boolean | null
}

export const habitats = [
  'studio',
  'forest',
  'night',
  'coast',
  'snow',
  'desert',
  'meadow',
  'mountain',
  'cave',
  'underwater',
  'volcano',
  'wetland',
  'sakura',
  'custom',
] as const
export type Habitat = (typeof habitats)[number]
export const habitatNames: Record<Habitat, string> = {
  studio: 'Studio',
  forest: 'Forest',
  night: 'Midnight',
  coast: 'Coast',
  snow: 'Snowfield',
  desert: 'Desert',
  meadow: 'Meadow',
  mountain: 'Mountains',
  cave: 'Cave',
  underwater: 'Underwater',
  volcano: 'Volcano',
  wetland: 'Wetland',
  sakura: 'Cherry blossoms',
  custom: 'Custom background',
}
export const isHabitat = (value: unknown): value is Habitat =>
  typeof value === 'string' && habitats.includes(value as Habitat)
export interface ViewerSettings {
  playing: boolean
  rotate: boolean
  speed: number
  light: number
  backgroundId?: string
  habitat: Habitat
  wireframe: boolean
  shiny: boolean
  quality: 'standard' | 'high'
  animation: number
}
export interface ViewerHandle {
  view: (angle: 'front' | 'side' | 'back' | 'top' | 'reset') => void
  zoom: (direction: number) => void
  getCamera: () => CameraPose | undefined
  restoreCamera: (pose: CameraPose) => void
  capture: () => Promise<void>
}
