#!/usr/bin/env node
/** Compress prepared HOME GLBs without reducing texture resolution or animation. */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Logger, NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, draco, prune, textureCompress } from '@gltf-transform/functions'
import draco3d from 'draco3dgltf'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const directory = process.argv[2] ?? path.join(root, 'public/models/home')
const reportFile = process.argv[3] ?? path.join(root, 'scripts/data/home-optimization-audit.json')
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.encoder': await draco3d.createEncoderModule(),
  'draco3d.decoder': await draco3d.createDecoderModule(),
})
const report = []
for (const name of (await fs.readdir(directory)).filter((name) => name.endsWith('.glb'))) {
  const file = path.join(directory, name)
  const before = (await fs.stat(file)).size
  const document = await io.read(file)
  document.setLogger(new Logger(Logger.Verbosity.ERROR))
  const animations = document.getRoot().listAnimations().length
  const animationMetadata = JSON.stringify(
    document
      .getRoot()
      .listAnimations()
      .map((animation) => [animation.getName(), animation.getExtras()]),
  )
  const channels = document
    .getRoot()
    .listAnimations()
    .reduce((total, animation) => total + animation.listChannels().length, 0)
  const visibilitySnapshot = (document) =>
    JSON.stringify(
      document
        .getRoot()
        .listNodes()
        .filter((node) => node.getExtras().homeVisibility)
        .map((node) => [node.getName(), node.getExtras().homeVisibility])
        .sort((left, right) => left[0].localeCompare(right[0])),
    )
  const visibility = visibilitySnapshot(document)
  const materialMetadataSnapshot = (document) =>
    JSON.stringify(
      document
        .getRoot()
        .listNodes()
        .filter((node) => node.getMesh())
        .flatMap((node) =>
          node
            .getMesh()
            .listPrimitives()
            .flatMap((primitive, index) => {
              const extras = primitive.getMaterial()?.getExtras()
              return extras && Object.keys(extras).length ? [[node.getName(), index, extras]] : []
            }),
        )
        .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
    )
  const materialMetadata = materialMetadataSnapshot(document)
  if (!animations) throw new Error(`Missing prepared animation: ${name}`)
  await document.transform(
    prune(),
    dedup(),
    draco({ method: 'edgebreaker', quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', lossless: true, effort: 50 }),
  )
  const binary = await io.writeBinary(document)
  const verified = await io.readBinary(binary)
  if (
    verified.getRoot().listAnimations().length !== animations ||
    verified
      .getRoot()
      .listAnimations()
      .reduce((total, animation) => total + animation.listChannels().length, 0) !== channels
  ) {
    throw new Error(`Animation changed while optimizing ${name}`)
  }
  if (
    JSON.stringify(
      verified
        .getRoot()
        .listAnimations()
        .map((animation) => [animation.getName(), animation.getExtras()]),
    ) !== animationMetadata
  )
    throw new Error(`Animation metadata changed: ${name}`)
  if (visibilitySnapshot(verified) !== visibility) throw new Error(`Visibility metadata changed: ${name}`)
  if (materialMetadataSnapshot(verified) !== materialMetadata)
    throw new Error(`Material metadata changed: ${name}`)
  const temporary = `${file}.tmp`
  await fs.writeFile(temporary, binary)
  await fs.rename(temporary, file)
  report.push({
    id: Number.parseInt(name, 10),
    before,
    after: binary.byteLength,
    animations,
    channels,
    visibilityTracks: JSON.parse(visibility).length,
  })
  if (report.length % 25 === 0) console.log(`Optimized ${report.length} models`)
}
const total = report.reduce((sum, item) => sum + item.after, 0)
if (total > 900_000_000) throw new Error(`Model payload exceeds the 900 MB publication budget: ${total}`)
await fs.writeFile(reportFile, JSON.stringify({ totalBytes: total, models: report }, null, 2))
console.log(`Verified ${report.length} models: ${(total / 1e6).toFixed(1)} MB`)
