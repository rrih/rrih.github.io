import { parseScene, type SavedScene } from './sceneStudio'

const MAX_TOKEN_LENGTH = 4096

/** A bounded, versioned layout. Names, local IDs and background images never enter URLs. */
export function encodeSceneLink(scene: SavedScene): string | null {
  const parsed = parseScene(scene)
  if (!parsed) return null
  const { backgroundId: _backgroundId, ...settings } = parsed.settings
  if (settings.habitat === 'custom') settings.habitat = 'studio'
  const payload = {
    v: 1,
    m: parsed.members.map((member) => [
      member.speciesId,
      member.formId || '',
      member.shiny,
      member.x,
      member.z,
      member.rotation,
      member.scale,
    ]),
    s: settings,
    ...(parsed.camera ? { c: parsed.camera } : {}),
  }
  const token = btoa(JSON.stringify(payload)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
  return token.length <= MAX_TOKEN_LENGTH ? token : null
}

export function decodeSceneLink(token: string | null): SavedScene | null {
  if (!token || token.length > MAX_TOKEN_LENGTH || !/^[A-Za-z0-9_-]+$/.test(token)) return null
  try {
    const value = JSON.parse(atob(token.replaceAll('-', '+').replaceAll('_', '/')))
    if (
      value?.v !== 1 ||
      !Array.isArray(value.m) ||
      value.m.length < 1 ||
      value.m.length > 6 ||
      !value.s ||
      typeof value.s !== 'object' ||
      'backgroundId' in value.s ||
      value.s.habitat === 'custom' ||
      !value.m.every((member: unknown) => Array.isArray(member) && member.length === 7)
    )
      return null
    return parseScene({
      id: 'shared-scene',
      name: 'Shared scene',
      members: value.m.map((member: unknown[], index: number) => ({
        key: `shared-${index}`,
        speciesId: member[0],
        ...(member[1] !== '' ? { formId: member[1] } : {}),
        shiny: member[2],
        x: member[3],
        z: member[4],
        rotation: member[5],
        scale: member[6],
      })),
      settings: value.s,
      ...(value.c !== undefined ? { camera: value.c } : {}),
    })
  } catch {
    return null
  }
}
