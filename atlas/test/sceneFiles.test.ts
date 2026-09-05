import { expect, test } from 'bun:test'
import { exportScene, readSceneFile } from '../src/sceneFiles'
import type { SavedScene } from '../src/sceneStudio'

const scene: SavedScene = {
  id: 'scene',
  name: 'Scene',
  members: [{ key: 'one', speciesId: 6, shiny: false, x: 0, z: 0, rotation: 0, scale: 1 }],
  settings: {
    playing: true,
    rotate: false,
    speed: 1,
    light: 1,
    habitat: 'forest',
    backgroundId: 'caaf9e76-66de-47ec-b630-2cad2c0cfe70',
    wireframe: false,
    shiny: false,
    quality: 'high',
    animation: 0,
  },
}
test('export does not include a private photograph that is no longer displayed', async () => {
  const text = await exportScene(scene)
  const data = JSON.parse(text)
  expect(data.background).toBeUndefined()
  expect(data.scene.settings.backgroundId).toBeUndefined()
  expect(scene.settings.backgroundId).toBeDefined()
  expect(data.scene.settings.habitat).toBe('forest')
})
test('import rejects remote, scripted, malformed and oversized images without fetching them', async () => {
  for (const background of [
    'https://example.com/private.png',
    'data:image/svg+xml;base64,PHN2Zy8+',
    'javascript:alert(1)',
    'data:image/png;base64,not base64',
    42,
  ]) {
    const file = new File([JSON.stringify({ version: 1, scene, background })], 'scene.json', {
      type: 'application/json',
    })
    await expect(readSceneFile(file)).rejects.toThrow()
  }
  await expect(readSceneFile(new File([new Uint8Array(6 * 1024 * 1024 + 1)], 'scene.json'))).rejects.toThrow(
    'Oversized scene',
  )
})
