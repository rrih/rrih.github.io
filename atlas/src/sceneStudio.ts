import { models, pokemon } from './catalog'
import { findForm, modelFor } from './forms'
import { isHabitat, type ViewerSettings } from './types'

export type SceneMember = {
  key: string
  speciesId: number
  formId?: string
  shiny: boolean
  x: number
  z: number
  rotation: number
  scale: number
}
export type CameraPose = {
  position: [number, number, number]
  target: [number, number, number]
}
export type SavedScene = {
  id: string
  name: string
  members: SceneMember[]
  settings: ViewerSettings
  camera?: CameraPose
}
export type StudioState = {
  version: 1
  active: boolean
  draft: SavedScene | null
  saved: SavedScene[]
}

export const MAX_MEMBERS = 6
export const MAX_SCENES = 12
const storageKey = 'atlas-scenes-v1'
const speciesIds = new Set(pokemon.map(({ id }) => id))
const emptyState = (): StudioState => ({ version: 1, active: false, draft: null, saved: [] })
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const finite = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
const identifier = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 128 && value.trim().length > 0

function parseMember(value: unknown): SceneMember | null {
  if (
    !record(value) ||
    !identifier(value.key) ||
    typeof value.speciesId !== 'number' ||
    !Number.isInteger(value.speciesId) ||
    !speciesIds.has(value.speciesId) ||
    !models[value.speciesId] ||
    typeof value.shiny !== 'boolean' ||
    (value.formId !== undefined &&
      (typeof value.formId !== 'string' || !findForm(value.speciesId, value.formId))) ||
    (value.shiny && !modelFor(value.speciesId, value.formId as string | undefined)?.shiny) ||
    !finite(value.x, -4, 4) ||
    !finite(value.z, -4, 4) ||
    !finite(value.rotation, -180, 180) ||
    !finite(value.scale, 0.4, 1.6)
  )
    return null
  return {
    key: value.key,
    speciesId: value.speciesId,
    ...(typeof value.formId === 'string' ? { formId: value.formId } : {}),
    shiny: value.shiny,
    x: value.x,
    z: value.z,
    rotation: value.rotation,
    scale: value.scale,
  }
}

function parseSettings(value: unknown): ViewerSettings | null {
  if (
    !record(value) ||
    typeof value.playing !== 'boolean' ||
    typeof value.rotate !== 'boolean' ||
    !finite(value.speed, 0.25, 2) ||
    !finite(value.light, 0.5, 1.8) ||
    !isHabitat(value.habitat) ||
    (value.backgroundId !== undefined &&
      (typeof value.backgroundId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          value.backgroundId,
        ))) ||
    typeof value.wireframe !== 'boolean' ||
    typeof value.shiny !== 'boolean' ||
    (value.quality !== 'standard' && value.quality !== 'high') ||
    !finite(value.animation, 0, 255) ||
    !Number.isInteger(value.animation)
  )
    return null
  return {
    playing: value.playing,
    rotate: value.rotate,
    speed: value.speed,
    light: value.light,
    habitat: value.habitat,
    ...(typeof value.backgroundId === 'string' ? { backgroundId: value.backgroundId } : {}),
    wireframe: value.wireframe,
    shiny: value.shiny,
    quality: value.quality,
    animation: value.animation,
  }
}

function parseCamera(value: unknown): CameraPose | null {
  if (!record(value)) return null
  const { position, target } = value
  if (
    !Array.isArray(position) ||
    position.length !== 3 ||
    !position.every((coordinate) => finite(coordinate, -100, 100)) ||
    !Array.isArray(target) ||
    target.length !== 3 ||
    !target.every((coordinate) => finite(coordinate, -100, 100))
  )
    return null
  const distance = Math.hypot(...position.map((coordinate, index) => coordinate - target[index]))
  if (!finite(distance, 0.1, 100)) return null
  return { position: [...position] as CameraPose['position'], target: [...target] as CameraPose['target'] }
}

/** Accept only known species and settings; model URLs and extra imported fields are never retained. */
export function parseScene(value: unknown): SavedScene | null {
  try {
    if (
      !record(value) ||
      !identifier(value.id) ||
      typeof value.name !== 'string' ||
      !value.name.trim() ||
      Array.from(value.name.trim()).length > 60 ||
      !Array.isArray(value.members) ||
      value.members.length < 1 ||
      value.members.length > MAX_MEMBERS
    )
      return null
    const members: SceneMember[] = []
    const keys = new Set<string>()
    for (const raw of value.members) {
      const member = parseMember(raw)
      if (!member || keys.has(member.key)) return null
      keys.add(member.key)
      members.push(member)
    }
    const settings = parseSettings(value.settings)
    if (!settings) return null
    const scene: SavedScene = { id: value.id, name: value.name.trim(), members, settings }
    if (value.camera !== undefined) {
      const camera = parseCamera(value.camera)
      if (!camera) return null
      scene.camera = camera
    }
    return scene
  } catch {
    return null
  }
}

function parseState(value: unknown): StudioState | null {
  if (
    !record(value) ||
    value.version !== 1 ||
    typeof value.active !== 'boolean' ||
    !Array.isArray(value.saved) ||
    value.saved.length > MAX_SCENES
  )
    return null
  const draft = value.draft === null ? null : parseScene(value.draft)
  if ((value.draft !== null && !draft) || (value.active && !draft)) return null
  const saved: SavedScene[] = []
  const ids = new Set<string>()
  for (const raw of value.saved) {
    const scene = parseScene(raw)
    if (!scene || ids.has(scene.id)) return null
    ids.add(scene.id)
    saved.push(scene)
  }
  return { version: 1, active: value.active, draft, saved }
}

export function readStudio(): StudioState {
  try {
    const raw = localStorage.getItem(storageKey)
    return raw === null ? emptyState() : parseState(JSON.parse(raw)) || emptyState()
  } catch {
    return emptyState()
  }
}

export function writeStudio(state: StudioState): boolean {
  try {
    const parsed = parseState(state)
    if (!parsed) return false
    const existing = localStorage.getItem(storageKey)
    // A fallback UI must not erase malformed data or data written by a newer app version.
    if (existing !== null && !parseState(JSON.parse(existing))) return false
    localStorage.setItem(storageKey, JSON.stringify(parsed))
    return true
  } catch {
    return false
  }
}
