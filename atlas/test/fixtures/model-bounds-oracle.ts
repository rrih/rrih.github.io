// Frozen source excerpts. Keep these function bodies identical to the recorded revision.
// Source: ef25889c60f099aa864bed11042f4054827a78c4:atlas/src/Viewer.tsx
import * as THREE from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'

// BEGIN baseline measureMotion
function measureMotion(scene: THREE.Group, mixer: THREE.AnimationMixer, clips: THREE.AnimationClip[]) {
  const bounds = new THREE.Box3()
  const poseBounds = new THREE.Box3()
  const vertex = new THREE.Vector3()
  const parentInverse = new THREE.Matrix4()
  const points: number[] = []
  const directions: number[][] = []
  for (const x of [-1, 0, 1])
    for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) if (x || y || z) directions.push([x, y, z])
  const scores = new Float64Array(directions.length)
  const extrema = new Float32Array(directions.length * 3)
  function recordPose() {
    scene.updateWorldMatrix(true, true)
    if (scene.parent) parentInverse.copy(scene.parent.matrixWorld).invert()
    else parentInverse.identity()
    poseBounds.makeEmpty()
    scores.fill(-Infinity)
    scene.traverseVisible((object) => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      if (
        materials.every(
          (material) => !material.visible || material.opacity <= 0 || !!material.userData.homeStencil,
        )
      )
        return
      const positions = mesh.geometry.getAttribute('position')
      if (!positions) return
      for (let index = 0; index < positions.count; index++) {
        mesh.getVertexPosition(index, vertex).applyMatrix4(mesh.matrixWorld).applyMatrix4(parentInverse)
        poseBounds.expandByPoint(vertex)
        for (let direction = 0; direction < directions.length; direction++) {
          const [x, y, z] = directions[direction]
          const score = vertex.x * x + vertex.y * y + vertex.z * z
          if (score > scores[direction]) {
            scores[direction] = score
            extrema[direction * 3] = vertex.x
            extrema[direction * 3 + 1] = vertex.y
            extrema[direction * 3 + 2] = vertex.z
          }
        }
      }
    })
    if (poseBounds.isEmpty()) return
    bounds.union(poseBounds)
    points.push(...extrema)
  }
  if (!clips.length) recordPose()
  for (const clip of clips) {
    mixer.stopAllAction()
    mixer.clipAction(clip).reset().play()
    const samples = Math.min(12, Math.max(8, Math.ceil(clip.duration * 4)))
    for (let sample = 0; sample <= samples; sample++) {
      mixer.setTime((clip.duration * sample) / (samples + 1))
      recordPose()
    }
  }
  mixer.stopAllAction()
  return { bounds, points }
}
// END baseline measureMotion

// BEGIN baseline normalizedPoints
function normalizedPoints(points: number[], normalization: THREE.Group) {
  normalization.updateMatrix()
  const values = new Float32Array(points.length)
  const point = new THREE.Vector3()
  for (let index = 0; index < points.length; index += 3) {
    point.fromArray(points, index).applyMatrix4(normalization.matrix).toArray(values, index)
  }
  return values
}
// END baseline normalizedPoints

function prepareMeasurement(gltf: GLTF) {
  const homeIdle = gltf.animations.find((clip) => clip.name === 'HOME Idle')
  if (homeIdle) {
    const duration = gltf.parser.json.animations?.find(
      (animation: { name?: string }) => animation.name === 'HOME Idle',
    )?.extras?.homeDuration
    if (
      typeof duration === 'number' &&
      Number.isFinite(duration) &&
      duration > 0 &&
      duration <= homeIdle.duration
    )
      homeIdle.duration = duration
    gltf.scene.traverse((object) => {
      const visibility = object.userData.homeVisibility
      if (!visibility || !Array.isArray(visibility.times) || !Array.isArray(visibility.values)) return
      const { times, values } = visibility as { times: unknown[]; values: unknown[] }
      if (
        times.length !== values.length ||
        !times.length ||
        !times.every(
          (value, index) =>
            typeof value === 'number' &&
            Number.isFinite(value) &&
            value >= 0 &&
            (!index || value >= Number(times[index - 1])),
        ) ||
        !values.every((value) => typeof value === 'boolean')
      )
        return
      homeIdle.tracks.push(
        new THREE.BooleanKeyframeTrack(`${object.uuid}.visible`, times as number[], values as boolean[]),
      )
    })
  }
}

export { THREE, measureMotion, normalizedPoints, prepareMeasurement }
export { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
export { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
