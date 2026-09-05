import { describe, expect, test } from 'bun:test'
import assert from 'node:assert/strict'
import { decodeSceneLink, encodeSceneLink } from '../src/sceneLink'
import type { SavedScene } from '../src/sceneStudio'

const scene = (): SavedScene => ({
  id: 'private-local-id',
  name: 'Private scene name',
  members: Array.from({ length: 6 }, (_, i) => ({
    key: `private-${i}`,
    speciesId: i % 2 ? 1 : 6,
    ...(i === 0 ? { formId: 'charizard-mega-x' } : {}),
    shiny: i === 0,
    x: -4 + i,
    z: 4 - i,
    rotation: -180 + i * 60,
    scale: 0.4 + i * 0.2,
  })),
  settings: {
    playing: true,
    rotate: false,
    speed: 1.5,
    light: 1.2,
    habitat: 'forest',
    wireframe: false,
    shiny: false,
    quality: 'high',
    animation: 0,
  },
  camera: { position: [4, 3, 7], target: [0, 1, 0] },
})
const raw = (value: unknown) =>
  btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
describe('shared scene URL', () => {
  test('six members, forms, appearances, settings and camera round trip without private names or keys', () => {
    const source = scene()
    const token = encodeSceneLink(source)
    assert(token)
    expect(token.length).toBeLessThan(2048)
    const restored = decodeSceneLink(token)
    assert(restored)
    expect(restored.members.map(({ key: _, ...member }) => member)).toEqual(
      source.members.map(({ key: _, ...member }) => member),
    )
    expect(restored.settings).toEqual(source.settings)
    expect(restored.camera).toEqual(source.camera)
    expect(atob(token.replaceAll('-', '+').replaceAll('_', '/'))).not.toContain('private')
    expect(atob(token.replaceAll('-', '+').replaceAll('_', '/'))).not.toContain('Private scene name')
  })
  test('local images never travel in URLs and cannot be referenced by a received layout', () => {
    const source = scene()
    source.settings.habitat = 'custom'
    source.settings.backgroundId = '550e8400-e29b-41d4-a716-446655440000'
    const token = encodeSceneLink(source)
    assert(token)
    const restored = decodeSceneLink(token)
    assert(restored)
    expect(restored.settings.habitat).toBe('studio')
    expect(restored.settings.backgroundId).toBeUndefined()
    const value = JSON.parse(atob(token.replaceAll('-', '+').replaceAll('_', '/')))
    value.s.backgroundId = source.settings.backgroundId
    expect(decodeSceneLink(raw(value))).toBeNull()
  })
  test('rejects malformed, excessive, unsupported and unsafe inputs', () => {
    for (const token of [null, '', '?', 'x'.repeat(4097), raw({ v: 2 }), raw({ v: 1, m: [], s: {} })])
      expect(decodeSceneLink(token)).toBeNull()
    const token = encodeSceneLink(scene())
    assert(token)
    const value = JSON.parse(atob(token.replaceAll('-', '+').replaceAll('_', '/')))
    for (const edit of [
      (v: typeof value) => v.m.push(v.m[0]),
      (v: typeof value) => (v.m[0][0] = 1026),
      (v: typeof value) => (v.m[0][1] = 'https://example.com/model.glb'),
      (v: typeof value) => (v.m[0][3] = 1e99),
      (v: typeof value) => (v.c.target = v.c.position),
    ]) {
      const changed = structuredClone(value)
      edit(changed)
      expect(decodeSceneLink(raw(changed))).toBeNull()
    }
  })
})
