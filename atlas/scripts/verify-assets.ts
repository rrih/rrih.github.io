import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { models } from '../src/catalog'

export function verifyLocalModels() {
  let count = 0
  let bytes = 0
  let shinyCount = 0
  const assets = Object.entries(models).flatMap(([id, model]) => [
    { id, url: model.url, shiny: false },
    ...(model.shiny ? [{ id: `${id} shiny`, url: model.shiny, shiny: true }] : []),
  ])
  for (const asset of assets) {
    const { id } = asset
    const prefix = asset.shiny ? '/atlas/models/shiny-home/' : '/atlas/models/home/'
    if (!asset.url.startsWith(prefix) || !/^\d+\.glb$/.test(asset.url.slice(prefix.length)))
      throw new Error(`Unbundled model ${id}`)
    const path = resolve(import.meta.dir, '../public', asset.url.slice('/atlas/'.length))
    if (!existsSync(path)) throw new Error(`Missing model ${id}`)
    const data = readFileSync(path)
    if (
      data.toString('utf8', 0, 4) !== 'glTF' ||
      data.readUInt32LE(4) !== 2 ||
      data.readUInt32LE(8) !== data.byteLength
    )
      throw new Error(`Invalid model ${id}`)
    const document = JSON.parse(data.toString('utf8', 20, 20 + data.readUInt32LE(12)))
    if (!document.meshes?.length || !document.nodes?.length) throw new Error(`Empty model ${id}`)
    const bakedColor = document.materials?.some(
      (material: { pbrMetallicRoughness?: { baseColorFactor?: number[] } }) =>
        material.pbrMetallicRoughness?.baseColorFactor?.slice(0, 3).some((value) => value < 1),
    )
    if (!document.images?.length && !bakedColor) throw new Error(`Missing surface colors in model ${id}`)
    if (!document.animations?.some((animation: { channels?: unknown[] }) => animation.channels?.length))
      throw new Error(`Missing character motion in model ${id}`)
    if (document.animations.length !== 1 || document.animations[0].name !== 'HOME Idle')
      throw new Error(`Missing native HOME idle in model ${id}`)
    for (const buffer of document.buffers || []) {
      if (buffer.uri && !buffer.uri.startsWith('data:')) throw new Error(`Unbundled geometry in model ${id}`)
    }
    for (const image of document.images || []) {
      if (image.uri && !image.uri.startsWith('data:')) throw new Error(`Unbundled image in model ${id}`)
    }
    for (const animation of document.animations || []) {
      for (const channel of animation.channels) {
        if (!document.nodes[channel.target.node] || !animation.samplers[channel.sampler])
          throw new Error(`Invalid motion in model ${id}`)
      }
    }
    if (asset.shiny) shinyCount++
    else count++
    bytes += data.byteLength
  }
  return { count, shinyCount, bytes }
}
if (import.meta.main) console.log(verifyLocalModels())
