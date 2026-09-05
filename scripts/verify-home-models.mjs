#!/usr/bin/env node
/** Decode prepared models and evaluate their actual skinned motion in Three.js. */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import draco3d from 'draco3dgltf'
import sharp from 'sharp'
import { AnimationMixer, BooleanKeyframeTrack, Box3, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const directory = process.argv[2] ?? path.join(root, 'public/models/home')
const reportFile = process.argv[3] ?? path.join(root, 'scripts/data/home-runtime-audit.json')
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
})
const report = []
// Visual regression anchors from ordinary idle appearances. These independently
// catch reversed HOME visibility semantics (a finite tongue-only Gengar passed
// geometry-only bounds checks before this guard was added).
const visibilityAnchors = new Map([
  [
    94,
    {
      visible: ['CusAnimVis_pm0094_00_00_BodySkin', 'CusAnimVis_pm0094_00_00_NormalTongueSkin'],
      hidden: ['CusAnimVis_pm0094_00_00_LongTongueSkin'],
    },
  ],
  [
    936,
    {
      visible: ['CusAnimVis_pm0936_00_00_FireSkin', 'CusAnimVis_pm0936_00_00_ShoulderarmorASkin'],
      hidden: ['CusAnimVis_pm0936_00_00_ShoulderarmorBSkin'],
    },
  ],
  [
    1025,
    {
      visible: ['CusAnimVis_pm1025_00_00_LeftOpenshellSkin', 'CusAnimVis_pm1025_00_00_RightOpenshellSkin'],
      hidden: ['CusAnimVis_pm1025_00_00_ClosedshellSkin'],
    },
  ],
])
const sourceAudit = JSON.parse(
  await fs.readFile(path.join(root, 'scripts/data/home-animation-audit.json'), 'utf8'),
)
const hiddenBySpecies = new Map(sourceAudit.map((item) => [item.id, item.hiddenMeshes ?? []]))
for (const file of (await fs.readdir(directory)).filter((file) => file.endsWith('.glb'))) {
  const document = await io.read(path.join(directory, file))
  for (const name of hiddenBySpecies.get(Number.parseInt(file, 10)) ?? []) {
    if (
      document
        .getRoot()
        .listNodes()
        .some((node) => node.getName() === name && node.getMesh())
    ) {
      throw new Error(`Hidden alternate mesh reappeared: ${file} ${name}`)
    }
  }
  const anchor = visibilityAnchors.get(Number.parseInt(file, 10))
  const hasMesh = (name) =>
    document
      .getRoot()
      .listNodes()
      .some((node) => node.getName() === name && node.getMesh())
  if (anchor && (anchor.visible.some((name) => !hasMesh(name)) || anchor.hidden.some(hasMesh))) {
    throw new Error(`Idle appearance visibility regression: ${file}`)
  }
  for (const animation of document.getRoot().listAnimations()) {
    const targets = new Set()
    for (const channel of animation.listChannels()) {
      const binding = `${channel.getTargetNode().getName()}:${channel.getTargetPath()}`
      if (targets.has(binding)) throw new Error(`Duplicate animation binding: ${file} ${binding}`)
      targets.add(binding)
      const sampler = channel.getSampler()
      const times = sampler.getInput().getArray()
      if (
        !Array.from(times).every(
          (time, index) => Number.isFinite(time) && (index === 0 || time > times[index - 1]),
        )
      ) {
        throw new Error(`Invalid animation timestamps: ${file} ${binding}`)
      }
      if (!Array.from(sampler.getOutput().getArray()).every(Number.isFinite)) {
        throw new Error(`Nonfinite animation values: ${file} ${binding}`)
      }
    }
  }
  const textures = document.getRoot().listTextures()
  // prune() losslessly folds uniform textures into baseColorFactor (Regice).
  if (!textures.length && !document.getRoot().listMaterials().length) {
    throw new Error(`No restored color materials: ${file}`)
  }
  for (const material of document.getRoot().listMaterials()) {
    if (!material.getBaseColorFactor().every(Number.isFinite))
      throw new Error(`Invalid material color: ${file}`)
  }
  for (const texture of textures) {
    const data = texture.getImage()
    if (!data) throw new Error(`Missing embedded image: ${file}`)
    const { width, height } = await sharp(data).metadata()
    if (!width || !height) throw new Error(`Undecodable image: ${file}`)
  }
  const textureCount = textures.length
  // Rendering materials are irrelevant to the skeletal calculation. Removing
  // them allows the same Three.js GLTFLoader to run without a browser canvas.
  for (const texture of textures) texture.dispose()
  for (const extension of document.getRoot().listExtensionsUsed()) extension.dispose()
  const binary = await io.writeBinary(document)
  const loaded = await new Promise((resolve, reject) =>
    new GLTFLoader().parse(
      binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength),
      '',
      resolve,
      reject,
    ),
  )
  const clip = loaded.animations.find((clip) => clip.name === 'HOME Idle')
  const sourceDuration = document
    .getRoot()
    .listAnimations()
    .find((item) => item.getName() === 'HOME Idle')
    ?.getExtras().homeDuration
  if (Number.isFinite(sourceDuration) && sourceDuration > 0 && sourceDuration <= clip.duration + 1e-5)
    clip.duration = sourceDuration
  else throw new Error(`Invalid original loop duration: ${file}`)
  if (!clip?.tracks.length || !(clip.duration > 0)) throw new Error(`Invalid idle clip: ${file}`)
  const scene = loaded.scene
  scene.traverse((object) => {
    const visibility = object.userData.homeVisibility
    if (visibility) {
      clip.tracks.push(
        new BooleanKeyframeTrack(`${object.uuid}.visible`, visibility.times, visibility.values),
      )
      object.visible = visibility.values[0]
    }
  })
  scene.updateMatrixWorld(true)
  const base = new Box3().setFromObject(scene, true).getSize(new Vector3()).length()
  const mixer = new AnimationMixer(scene)
  mixer.clipAction(clip).play()
  const frames = []
  for (const portion of [0, 0.25, 0.5, 0.75, 0.99]) {
    mixer.setTime(clip.duration * portion)
    scene.updateMatrixWorld(true)
    const box = new Box3().setFromObject(scene, true)
    const size = box.getSize(new Vector3())
    if (![...box.min, ...box.max, ...size].every(Number.isFinite) || size.length() <= 0) {
      throw new Error(`Invalid animated geometry: ${file} at ${portion}`)
    }
    frames.push({
      time: portion * clip.duration,
      size: size.toArray(),
      center: box.getCenter(new Vector3()).toArray(),
    })
  }
  const maximumSizeRatio = Math.max(...frames.map((frame) => Math.hypot(...frame.size))) / base
  if (maximumSizeRatio > 3) throw new Error(`Unexpected bone deformation: ${file} (${maximumSizeRatio})`)
  report.push({
    id: Number.parseInt(file, 10),
    textures: textureCount,
    tracks: clip.tracks.length,
    duration: clip.duration,
    maximumSizeRatio,
    frames,
  })
  mixer.stopAllAction()
  scene.traverse((object) => {
    object.geometry?.dispose()
    if (Array.isArray(object.material))
      object.material.forEach((material) => {
        material.dispose()
      })
    else object.material?.dispose()
  })
  if (report.length % 50 === 0) console.log(`Verified ${report.length} models`)
}
await fs.writeFile(reportFile, JSON.stringify(report, null, 2))
console.log(`Verified ${report.length} models, embedded textures, and ${report.length * 5} animated poses`)
