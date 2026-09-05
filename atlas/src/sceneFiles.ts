import { loadBackground, saveBackground } from './backgroundStore'
import { parseScene, type SavedScene } from './sceneStudio'

export async function exportScene(scene: SavedScene): Promise<string> {
  let background: string | undefined
  const exported = { ...scene, settings: { ...scene.settings } }
  if (scene.settings.habitat !== 'custom') delete exported.settings.backgroundId
  if (exported.settings.backgroundId) {
    const stored = await loadBackground(exported.settings.backgroundId)
    if (!stored) throw new Error('Missing background')
    try {
      const blob = await (await fetch(stored.url)).blob()
      background = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    } finally {
      URL.revokeObjectURL(stored.url)
    }
  }
  return JSON.stringify({ version: 1, scene: exported, ...(background ? { background } : {}) }, null, 2)
}

export async function readSceneFile(file: File): Promise<SavedScene> {
  if (file.size > 6 * 1024 * 1024) throw new Error('Oversized scene')
  const data = JSON.parse(await file.text())
  const scene = data?.version === 1 ? parseScene(data.scene) : null
  if (!scene) throw new Error('Invalid scene')
  if (data.background !== undefined) {
    if (
      typeof data.background !== 'string' ||
      !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(data.background)
    )
      throw new Error('Invalid background')
    const [header, encoded] = data.background.split(',')
    const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0))
    if (bytes.byteLength > 4 * 1024 * 1024) throw new Error('Oversized background')
    const image = await saveBackground(
      new File([bytes], 'background', { type: header.slice(5, header.indexOf(';')) }),
    )
    scene.settings.backgroundId = image.id
    URL.revokeObjectURL(image.url)
  }
  scene.id = crypto.randomUUID()
  return scene
}
