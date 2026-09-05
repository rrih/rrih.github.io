import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { models, pokemon } from '../src/catalog'
import {
  MAX_MEMBERS,
  MAX_SCENES,
  parseScene,
  readStudio,
  type SavedScene,
  type StudioState,
  writeStudio,
} from '../src/sceneStudio'

const key = 'atlas-scenes-v1'
const scene = (): SavedScene => ({
  id: 'scene-1',
  name: 'A quiet afternoon',
  members: [{ key: 'member-1', speciesId: 6, shiny: false, x: 0, z: 0, rotation: 0, scale: 1 }],
  settings: {
    playing: true,
    rotate: false,
    speed: 1,
    light: 1,
    habitat: 'studio',
    wireframe: false,
    shiny: false,
    quality: 'high',
    animation: 0,
  },
  camera: { position: [4, 3, 7], target: [0, 1, 0] },
})
const state = (): StudioState => ({ version: 1, active: true, draft: scene(), saved: [scene()] })
const empty: StudioState = { version: 1, active: false, draft: null, saved: [] }

describe('portable scene validation', () => {
  test('validates all actual species and their actual shiny availability', () => {
    for (const pokemonEntry of pokemon) {
      const candidate = scene()
      candidate.members[0].speciesId = pokemonEntry.id
      expect(parseScene(candidate)?.members[0].speciesId).toBe(pokemonEntry.id)
      candidate.members[0].shiny = true
      expect(parseScene(candidate) !== null).toBe(Boolean(models[pokemonEntry.id].shiny))
    }
  })
  test('allows repeated species, but not repeated member keys or overfull scenes', () => {
    const candidate = scene()
    candidate.members = Array.from({ length: MAX_MEMBERS }, (_, index) => ({
      ...candidate.members[0],
      key: `member-${index}`,
    }))
    expect(parseScene(candidate)?.members).toHaveLength(6)
    candidate.members[1].key = candidate.members[0].key
    expect(parseScene(candidate)).toBeNull()
    candidate.members[1].key = 'different'
    candidate.members.push({ ...candidate.members[0], key: 'seventh' })
    expect(parseScene(candidate)).toBeNull()
    candidate.members = []
    expect(parseScene(candidate)).toBeNull()
  })
  test('rejects unknown IDs, non-finite numbers, and values outside placement bounds', () => {
    for (const speciesId of [0, -1, 1026, 1.5, NaN, Infinity, '6']) {
      const candidate = scene()
      Object.assign(candidate.members[0], { speciesId })
      expect(parseScene(candidate)).toBeNull()
    }
    for (const [field, values] of Object.entries({
      x: [-4.01, 4.01, NaN, Infinity, '0'],
      z: [-4.01, 4.01, NaN, -Infinity, null],
      rotation: [-181, 181, NaN, Infinity],
      scale: [0, 0.39, 1.61, NaN, Infinity],
      shiny: [0, 'false', null],
      key: ['', '   ', 'k'.repeat(129)],
    })) {
      for (const value of values) {
        const candidate = scene()
        Object.assign(candidate.members[0], { [field]: value })
        expect(parseScene(candidate)).toBeNull()
      }
    }
    const boundary = scene()
    Object.assign(boundary.members[0], { x: -4, z: 4, rotation: -180, scale: 0.4 })
    expect(parseScene(boundary)).not.toBeNull()
    Object.assign(boundary.members[0], { x: 4, z: -4, rotation: 180, scale: 1.6 })
    expect(parseScene(boundary)).not.toBeNull()
  })
  test('validates settings, scene names, and camera geometry', () => {
    for (const [field, value] of Object.entries({
      playing: 'true',
      rotate: 1,
      speed: 0,
      light: 2,
      habitat: 'space',
      wireframe: null,
      shiny: 'false',
      quality: 'ultra',
      animation: 256,
    })) {
      const candidate = scene()
      Object.assign(candidate.settings, { [field]: value })
      expect(parseScene(candidate)).toBeNull()
    }
    for (const name of ['', '   ', 'あ'.repeat(61)]) expect(parseScene({ ...scene(), name })).toBeNull()
    for (const animation of [0, 82, 255]) {
      const candidate = scene()
      candidate.settings.animation = animation
      expect(parseScene(candidate)?.settings.animation).toBe(animation)
    }
    for (const animation of [-1, 0.5, NaN, Infinity]) {
      const candidate = scene()
      candidate.settings.animation = animation
      expect(parseScene(candidate)).toBeNull()
    }
    expect(parseScene({ ...scene(), name: 'あ'.repeat(60) })?.name).toHaveLength(60)
    for (const camera of [
      null,
      {},
      { position: [0, 0], target: [0, 0, 0] },
      { position: [0, NaN, 1], target: [0, 0, 0] },
      { position: [0, Infinity, 1], target: [0, 0, 0] },
      { position: [0, 0, 0], target: [0, 0, 0] },
      { position: [101, 0, 0], target: [100, 0, 0] },
      { position: [100, 0, 0], target: [-100, 0, 0] },
    ])
      expect(parseScene({ ...scene(), camera })).toBeNull()
    const withoutCamera = scene()
    delete withoutCamera.camera
    expect(parseScene(withoutCamera)).toEqual(withoutCamera)
  })
  test('copies validated values and strips URLs and unrelated imported fields', () => {
    const original = scene()
    const parsed = parseScene({
      ...original,
      modelUrl: 'https://untrusted.invalid/model.glb',
      members: original.members.map((member) => ({ ...member, url: 'https://untrusted.invalid/model.glb' })),
      settings: { ...original.settings, secret: 'unrelated' },
    })
    expect(parsed).toEqual(original)
    expect(parsed).not.toBe(original)
    expect(parsed?.members[0]).not.toBe(original.members[0])
    expect(parsed?.camera?.position).not.toBe(original.camera?.position)
    for (const value of [null, undefined, [], 1, 'scene', {}, { ...scene(), members: [null] }])
      expect(parseScene(value)).toBeNull()
    expect(
      parseScene({
        get id() {
          throw new Error('Malformed input')
        },
      }),
    ).toBeNull()
  })
})

describe('device storage and data preservation', () => {
  let data: Map<string, string>
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  beforeEach(() => {
    data = new Map()
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (name: string) => data.get(name) ?? null,
        setItem: (name: string, value: string) => {
          data.set(name, value)
        },
      },
    })
  })
  afterEach(() => {
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  })
  test('starts empty and round-trips the active draft and 12 saved scenes', () => {
    expect(readStudio()).toEqual(empty)
    const full = state()
    full.saved = Array.from({ length: MAX_SCENES }, (_, index) => ({ ...scene(), id: `scene-${index}` }))
    expect(writeStudio(full)).toBe(true)
    expect(readStudio()).toEqual(full)
    expect(data.size).toBe(1)
    full.saved.push({ ...scene(), id: 'overflow' })
    const previous = data.get(key)
    expect(writeStudio(full)).toBe(false)
    expect(data.get(key)).toBe(previous)
  })
  test('does not overwrite corrupt data or unsupported versions after a fallback read', () => {
    for (const raw of [
      '{broken',
      'null',
      '[]',
      JSON.stringify({ ...state(), version: 2 }),
      JSON.stringify({ ...state(), saved: [{}] }),
      JSON.stringify({ ...state(), active: true, draft: null }),
      JSON.stringify({ ...state(), saved: [scene(), scene()] }),
    ]) {
      data.set(key, raw)
      expect(readStudio()).toEqual(empty)
      expect(writeStudio(readStudio())).toBe(false)
      expect(data.get(key)).toBe(raw)
    }
  })
  test('refuses invalid writes without changing a valid existing record', () => {
    expect(writeStudio(state())).toBe(true)
    const original = data.get(key)
    const bad = state()
    if (bad.draft) bad.draft.members[0].x = NaN
    expect(writeStudio(bad)).toBe(false)
    expect(data.get(key)).toBe(original)
    expect(writeStudio({ ...state(), saved: [scene(), scene()] })).toBe(false)
    expect(data.get(key)).toBe(original)
  })
  test('storage denial and quota exhaustion are reported without throwing', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('Access denied')
      },
    })
    expect(readStudio()).toEqual(empty)
    expect(writeStudio(state())).toBe(false)
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => {
          throw new DOMException('Storage full', 'QuotaExceededError')
        },
      },
    })
    expect(writeStudio(state())).toBe(false)
  })
})
