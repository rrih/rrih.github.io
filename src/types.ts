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
  evolvesFrom: number | null
}

export interface ModelEntry {
  url: string
  shiny?: string
  animations?: number
  textured?: boolean | null
}

export type Habitat = 'studio' | 'forest' | 'night'
export interface ViewerSettings {
  playing: boolean
  rotate: boolean
  speed: number
  light: number
  habitat: Habitat
  wireframe: boolean
  shiny: boolean
  quality: 'standard' | 'high'
  animation: number
}
export interface ViewerHandle {
  view: (angle: 'front' | 'side' | 'back' | 'top' | 'reset') => void
  zoom: (direction: number) => void
  capture: () => Promise<void>
}
