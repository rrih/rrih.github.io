#!/usr/bin/env node
/** Decode every prepared form, its textures and actual native skinned motion in Three.js. */
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
const directory = process.argv[2] ?? path.join(root, 'public/models/forms')
const reportFile = process.argv[3] ?? path.join(root, 'scripts/data/form-runtime-audit.json')
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
})
const report = []
const normalAudit = JSON.parse(
  await fs.readFile(path.join(root, 'scripts/data/form-home-normal-audit.json'), 'utf8'),
)
const external = JSON.parse(
  await fs.readFile(path.join(root, 'scripts/data/form-external-sources.json'), 'utf8'),
)
const expectations = new Map()
for (const item of normalAudit) {
  for (const suffix of ['', '-shiny']) {
    expectations.set(`${item.formId}${suffix}.glb`, {
      name: 'HOME Idle',
      hidden: item.animation.hiddenMeshes ?? [],
      channels: item.animation.tracks,
    })
  }
}
for (const item of external) expectations.set(`${item.id}.glb`, { name: item.animationName, hidden: [] })
for (const [file, expected] of expectations) {
  const document = await io.read(path.join(directory, file))
  const sourceAnimations = document.getRoot().listAnimations()
  if (sourceAnimations.length !== 1 || sourceAnimations[0].getName() !== expected.name)
    throw new Error(`Incorrect native clip: ${file}`)
  if (expected.channels !== undefined && sourceAnimations[0].listChannels().length !== expected.channels)
    throw new Error(`Converted native channel count changed: ${file}`)
  for (const name of expected.hidden) {
    if (
      document
        .getRoot()
        .listNodes()
        .some((node) => node.getName() === name && node.getMesh())
    )
      throw new Error(`Hidden alternate mesh reappeared: ${file} ${name}`)
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
  const clip = loaded.animations.find((clip) => clip.name === expected.name)
  if (!clip?.tracks.length || !(clip.duration > 0)) throw new Error(`Invalid idle clip: ${file}`)
  if (expected.name === 'HOME Idle') {
    const duration = sourceAnimations[0].getExtras().homeDuration
    if (!Number.isFinite(duration) || duration <= 0 || duration > clip.duration + 1e-5)
      throw new Error(`Invalid original loop duration: ${file}`)
    clip.duration = duration
  }
  const scene = loaded.scene
  scene.traverse((object) => {
    const visibility = object.userData.homeVisibility
    if (visibility) {
      if (
        !Array.isArray(visibility.times) ||
        visibility.times.length !== visibility.values?.length ||
        !visibility.values.every((value) => typeof value === 'boolean') ||
        !visibility.times.every(
          (time, index) =>
            Number.isFinite(time) && time >= 0 && (index === 0 || time > visibility.times[index - 1]),
        )
      )
        throw new Error(`Invalid source visibility metadata: ${file}`)
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
  const firstVertices = new Map()
  const vertex = new Vector3()
  let maximumVertexDisplacement = 0
  for (const portion of [0, 0.25, 0.5, 0.75, 0.99]) {
    mixer.setTime(clip.duration * portion)
    scene.updateMatrixWorld(true)
    scene.traverse((object) => {
      if (!object.isMesh || !object.geometry.getAttribute('position')) return
      for (let parent = object; parent; parent = parent.parent) if (!parent.visible) return
      const count = object.geometry.getAttribute('position').count
      if (!firstVertices.has(object.uuid)) {
        firstVertices.set(object.uuid, new Float64Array(count * 3))
        for (let index = 0; index < count; index++) {
          object.getVertexPosition(index, vertex).applyMatrix4(object.matrixWorld)
          vertex.toArray(firstVertices.get(object.uuid), index * 3)
        }
      } else {
        const first = firstVertices.get(object.uuid)
        for (let index = 0; index < count; index++) {
          object.getVertexPosition(index, vertex).applyMatrix4(object.matrixWorld)
          maximumVertexDisplacement = Math.max(
            maximumVertexDisplacement,
            Math.hypot(
              vertex.x - first[index * 3],
              vertex.y - first[index * 3 + 1],
              vertex.z - first[index * 3 + 2],
            ),
          )
        }
      }
    })
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
  if (!(maximumVertexDisplacement > 1e-7))
    throw new Error(`Native idle has no measured vertex motion: ${file}`)
  report.push({
    file,
    animation: expected.name,
    textures: textureCount,
    tracks: clip.tracks.length,
    duration: clip.duration,
    maximumSizeRatio,
    maximumVertexDisplacement,
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
