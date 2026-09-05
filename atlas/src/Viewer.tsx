import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { type GLTF, GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import * as THREE from 'three/webgpu'
import { createEnvironments, ENVIRONMENT_APPEARANCE, type EnvironmentKey } from './Environments'
import { modelFor } from './forms'
import { assetPath } from './routes'
import type { CameraPose, SceneMember } from './sceneStudio'
import { beginModelObservation } from './telemetry'
import type { ModelEntry, Pokemon, ViewerHandle, ViewerSettings } from './types'

interface ViewerProps {
  pokemon: Pokemon
  label: string
  model: ModelEntry | undefined
  settings: ViewerSettings
  members?: SceneMember[]
  backgroundUrl?: string
  onBackgroundError?: () => void
  onCameraChange?: (pose: CameraPose) => void
  onLoad: (animationNames: string[]) => void
  onError: (message: string) => void
  onLoading: (loading: boolean) => void
}

interface LoadedModel {
  key: string
  url: string
  points: Float32Array
  normalization: THREE.Group
  baseScale: number
  stencilBit: number
  group: THREE.Group
  scene: THREE.Group
  mixer: THREE.AnimationMixer
  clips: THREE.AnimationClip[]
  activeClip: number
  elapsed: number
  flames: THREE.MeshStandardMaterial[]
}

interface Runtime {
  renderer: THREE.WebGPURenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  loader: GLTFLoader
  contents: Map<string, LoadedModel>
  target: THREE.Vector3
  distance: number
  framingPositions: Float32Array
  dirty: boolean
}

function fittedDistance(current: Runtime, direction: THREE.Vector3) {
  const viewport = current.renderer.getSize(new THREE.Vector2())
  const reserved = Math.min(85, viewport.y * 0.25)
  const available = viewport.y - reserved
  const top = 1 - (2 * available * 0.125) / viewport.y - reserved / viewport.y
  const bottom = 1 - (2 * available * 0.875) / viewport.y - reserved / viewport.y
  const halfFov = Math.tan(THREE.MathUtils.degToRad(current.camera.fov / 2))
  const right = new THREE.Vector3(direction.z, 0, -direction.x).normalize()
  const up = new THREE.Vector3().crossVectors(direction, right)
  let distance = 2.6
  const points = current.framingPositions
  for (let index = 0; index < points.length; index += 3) {
    const x = points[index] - current.target.x
    const y = points[index + 1] - current.target.y
    const z = points[index + 2] - current.target.z
    const depth = x * direction.x + y * direction.y + z * direction.z
    const horizontal =
      Math.abs(x * right.x + y * right.y + z * right.z) / (halfFov * current.camera.aspect * 0.8)
    const vertical = x * up.x + y * up.y + z * up.z
    distance = Math.max(
      distance,
      depth + horizontal,
      depth + vertical / (halfFov * (vertical >= 0 ? top : bottom)),
    )
  }
  return distance
}

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

function disposeObject(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const textures = new Set<THREE.Texture>()
  const skeletons = new Set<THREE.Skeleton>()
  root.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (mesh.geometry) geometries.add(mesh.geometry)
    if (mesh.material) {
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        materials.add(material)
        for (const value of Object.values(material)) {
          if (value instanceof THREE.Texture) textures.add(value)
        }
      }
    }
    if ((object as THREE.SkinnedMesh).isSkinnedMesh) skeletons.add((object as THREE.SkinnedMesh).skeleton)
  })
  for (const geometry of geometries) geometry.dispose()
  for (const material of materials) material.dispose()
  for (const texture of textures) {
    const image: unknown = texture.source.data
    if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) image.close()
    texture.dispose()
  }
  for (const skeleton of skeletons) skeleton.dispose()
}

function removeContent(runtime: Runtime, key: string) {
  const model = runtime.contents.get(key)
  if (!model) return
  model.mixer.stopAllAction()
  model.mixer.uncacheRoot(model.scene)
  runtime.scene.remove(model.group)
  disposeObject(model.group)
  runtime.contents.delete(key)
}

function clearModel(runtime: Runtime) {
  for (const key of runtime.contents.keys()) removeContent(runtime, key)
}

function normalizedPoints(points: number[], normalization: THREE.Group) {
  normalization.updateMatrix()
  const values = new Float32Array(points.length)
  const point = new THREE.Vector3()
  for (let index = 0; index < points.length; index += 3) {
    point.fromArray(points, index).applyMatrix4(normalization.matrix).toArray(values, index)
  }
  return values
}

function frameContents(current: Runtime, moveCamera: boolean) {
  current.dirty = true
  const positions: number[] = []
  const bounds = new THREE.Box3()
  const point = new THREE.Vector3()
  for (const model of current.contents.values()) {
    model.group.updateMatrix()
    for (let index = 0; index < model.points.length; index += 3) {
      point.fromArray(model.points, index).applyMatrix4(model.group.matrix)
      positions.push(point.x, point.y, point.z)
      bounds.expandByPoint(point)
    }
  }
  if (bounds.isEmpty()) return
  bounds.getCenter(current.target)
  current.framingPositions = new Float32Array(positions)
  if (!moveCamera) return
  const direction = current.camera.position.clone().sub(current.controls.target).normalize()
  current.distance = fittedDistance(current, direction)
  current.controls.target.copy(current.target)
  current.camera.position.copy(current.target).add(direction.multiplyScalar(current.distance))
  current.controls.update()
}

function applyLayout(current: Runtime, members?: SceneMember[]) {
  current.dirty = true
  for (const [key, content] of current.contents) {
    const member = members?.find((item) => item.key === key)
    content.group.position.set(member?.x || 0, 0, member?.z || 0)
    content.group.rotation.y = THREE.MathUtils.degToRad(member?.rotation || 0)
    content.baseScale = member?.scale || 1
    content.group.scale.setScalar(content.baseScale)
  }
}

function contactShadow() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const context = canvas.getContext('2d')
  if (context) {
    const gradient = context.createRadialGradient(64, 64, 4, 64, 64, 64)
    gradient.addColorStop(0, 'rgba(32, 43, 28, .3)')
    gradient.addColorStop(0.35, 'rgba(32, 43, 28, .14)')
    gradient.addColorStop(1, 'rgba(32, 43, 28, 0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, 128, 128)
  }
  const texture = new THREE.CanvasTexture(canvas)
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(4.3, 3.3),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.008
  return shadow
}

function nightSky() {
  const positions = new Float32Array(120 * 3)
  for (let i = 0; i < 120; i++) {
    const angle = i * 2.39996
    const height = 2 + ((i * 17) % 29)
    positions.set([Math.sin(angle) * 29, height, Math.cos(angle) * 29], i * 3)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color: '#dce7ff', size: 0.035, transparent: true, opacity: 0.85 }),
  )
}

function surfaceTexture(roughness: boolean) {
  const size = 128
  const pixels = new Uint8Array(size * size * 4)
  for (let index = 0; index < size * size; index++) {
    const noise = ((Math.imul(index + 1, 1597334677) ^ Math.imul(index + 37, 3812015801)) >>> 0) % 23
    const value = (roughness ? 232 : 117) + noise
    pixels.set([value, value, value, 255], index * 4)
  }
  const texture = new THREE.DataTexture(pixels, size, size)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(12, 12)
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.anisotropy = 4
  texture.needsUpdate = true
  return texture
}

function prepareContent(
  gltf: GLTF,
  id: number,
  key: string,
  url: string,
  animation: number,
  wireframe: boolean,
  stencilBit: number,
): LoadedModel {
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
  const mixer = new THREE.AnimationMixer(gltf.scene)
  const initialClip = Math.min(Math.max(animation, 0), gltf.animations.length - 1)
  const { bounds, points } = measureMotion(
    gltf.scene,
    mixer,
    initialClip >= 0 ? [gltf.animations[initialClip]] : [],
  )
  if (initialClip >= 0) {
    mixer.clipAction(gltf.animations[initialClip]).reset().play()
    mixer.setTime(0)
  }
  gltf.scene.updateMatrixWorld(true)
  const size = bounds.getSize(new THREE.Vector3())
  const longestSide = Math.max(size.x, size.y, size.z)
  if (!Number.isFinite(longestSide) || longestSide <= 0) {
    disposeObject(gltf.scene)
    throw new Error('Empty model')
  }
  const center = bounds.getCenter(new THREE.Vector3())
  const scale = 3 / longestSide
  const normalization = new THREE.Group()
  normalization.add(gltf.scene)
  normalization.scale.setScalar(scale)
  normalization.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale)
  const motion = new THREE.Group()
  motion.name = `pokemon-${id}`
  motion.add(normalization, contactShadow())
  const flames: THREE.MeshStandardMaterial[] = []
  let fineBump: THREE.Texture | undefined
  let fineRoughness: THREE.Texture | undefined
  gltf.scene.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = true
    mesh.receiveShadow = true
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if ('wireframe' in material) material.wireframe = wireframe
      if (material instanceof THREE.MeshStandardMaterial) {
        const stencil = material.userData.homeStencil
        if (stencil?.role === 'mask' || stencil?.role === 'core') {
          const mask = stencil.role === 'mask'
          material.colorWrite = !mask
          material.depthWrite = false
          material.stencilWrite = true
          material.stencilRef = stencilBit
          material.stencilFuncMask = stencilBit
          material.stencilFunc = mask ? THREE.AlwaysStencilFunc : THREE.EqualStencilFunc
          material.stencilZPass = mask ? THREE.ReplaceStencilOp : THREE.KeepStencilOp
          material.stencilWriteMask = mask ? stencilBit : 0
          mesh.renderOrder = mask ? 2 : 3
          mesh.castShadow = false
          mesh.receiveShadow = false
        }
        if (material.userData.homeBlend === 'additive') {
          material.blending = THREE.AdditiveBlending
          material.transparent = true
          material.depthWrite = false
          mesh.castShadow = false
          mesh.receiveShadow = false
        }
        material.envMapIntensity = 0.65
        const opaqueBody =
          /body|skin|shell|scales|fur/i.test(material.name) &&
          !/eye|mouth|fire|flame|mask|bodytra|transparent/i.test(material.name) &&
          !material.transparent &&
          material.opacity === 1 &&
          !material.alphaTest
        if (opaqueBody && mesh.geometry.hasAttribute('uv')) {
          if (!material.normalMap && !material.bumpMap) {
            fineBump ??= surfaceTexture(false)
            material.bumpMap = fineBump
            material.bumpScale = 0.0006
          }
          if (!material.roughnessMap) {
            fineRoughness ??= surfaceTexture(true)
            material.roughnessMap = fineRoughness
            material.roughness = Math.max(material.roughness, 0.62)
          }
        }
        // This source omits Charizard's flame material settings; its two masks are not body textures.
        if (id === 6 && /^Material_1[56]$/.test(material.name) && material.map) {
          material.color.set(material.name === 'Material_15' ? '#ffca38' : '#ff731d')
          material.emissive.set(material.name === 'Material_15' ? '#ffb526' : '#ff4d0d')
          material.emissiveMap = material.map
          material.alphaMap = material.map
          material.emissiveIntensity = 1.2
          material.transparent = true
          material.depthWrite = false
          material.alphaTest = 0.08
          mesh.castShadow = false
          mesh.receiveShadow = false
          flames.push(material)
        }
      }
    }
  })

  return {
    key,
    url,
    group: motion,
    scene: gltf.scene,
    mixer,
    clips: gltf.animations,
    activeClip: initialClip,
    elapsed: 0,
    flames,
    normalization,
    baseScale: 1,
    stencilBit,
    points: normalizedPoints(points, normalization),
  }
}

const rendererUnavailable =
  '3D viewing is unavailable in this browser. Try updating your browser or enabling graphics acceleration.'

const Viewer = forwardRef<ViewerHandle, ViewerProps>(function Viewer(props, ref) {
  const container = useRef<HTMLDivElement>(null)
  const runtime = useRef<Runtime | null>(null)
  const latest = useRef(props)
  latest.current = props
  const [ready, setReady] = useState(false)
  const [rendererFailed, setRendererFailed] = useState(false)
  const modelUrl = props.settings.shiny && props.model?.shiny ? props.model.shiny : props.model?.url
  const entries = props.members?.length
    ? props.members.map((member) => ({
        key: member.key,
        speciesId: member.speciesId,
        url: member.shiny
          ? modelFor(member.speciesId, member.formId)?.shiny
          : modelFor(member.speciesId, member.formId)?.url,
      }))
    : [{ key: 'solo', speciesId: props.pokemon.id, url: modelUrl }]
  const identity = JSON.stringify(entries)
  const viewMode = props.members ? 'together' : 'solo'
  const firstRequest = useRef<{
    identity: string
    url: string
    data?: Promise<ArrayBuffer>
    abort: AbortController
    finish: (outcome: 'ready' | 'failed') => void
  } | null>(null)

  useEffect(() => {
    const desired = JSON.parse(identity) as { key: string; speciesId: number; url?: string }[]
    const first = desired[0]
    const finish = beginModelObservation(viewMode)
    if (!first?.url) {
      finish('failed')
      return
    }
    const abort = new AbortController()
    const existing = runtime.current?.contents.get(first.key)
    const data =
      existing?.url === first.url
        ? Promise.resolve(new ArrayBuffer(0))
        : fetch(first.url, { signal: abort.signal }).then((response) => {
            if (!response.ok) throw new Error('Model unavailable')
            return response.arrayBuffer()
          })
    // The fetch can finish before the renderer. Its error is handled by the load effect.
    void data.catch(() => {})
    firstRequest.current = { identity, url: first.url, data, abort, finish }
    return () => {
      abort.abort()
      if (firstRequest.current?.identity === identity) firstRequest.current = null
    }
  }, [identity, viewMode])

  useImperativeHandle(
    ref,
    () => ({
      view(angle) {
        const current = runtime.current
        if (!current) return
        const { camera, controls, target } = current
        const offsets = {
          front: new THREE.Vector3(0, 0.45, 1),
          side: new THREE.Vector3(1, 0.23, 0),
          back: new THREE.Vector3(0, 0.3, -1),
          top: new THREE.Vector3(0, 1, 0.001),
          reset: new THREE.Vector3(0.65, 0.34, 1),
        }
        const direction = offsets[angle].normalize()
        const distance = fittedDistance(current, direction)
        current.distance = distance
        controls.target.copy(target)
        camera.position.copy(target).add(direction.multiplyScalar(distance))
        controls.update()
        latest.current.onCameraChange?.({
          position: camera.position.toArray(),
          target: controls.target.toArray(),
        })
      },
      zoom(direction) {
        const current = runtime.current
        if (!current) return
        const offset = current.camera.position.clone().sub(current.controls.target)
        const distance = THREE.MathUtils.clamp(
          offset.length() * (direction > 0 ? 0.82 : 1.22),
          current.controls.minDistance,
          current.controls.maxDistance,
        )
        current.camera.position.copy(current.controls.target).add(offset.setLength(distance))
        current.controls.update()
        latest.current.onCameraChange?.({
          position: current.camera.position.toArray(),
          target: current.controls.target.toArray(),
        })
      },
      getCamera(): CameraPose | undefined {
        const current = runtime.current
        if (!current) return
        return { position: current.camera.position.toArray(), target: current.controls.target.toArray() }
      },
      restoreCamera(pose: CameraPose) {
        const current = runtime.current
        if (!current) return
        current.camera.position.fromArray(pose.position)
        current.controls.target.fromArray(pose.target)
        current.distance = current.camera.position.distanceTo(current.controls.target)
        current.controls.update()
      },
      async capture() {
        const current = runtime.current
        if (!current?.contents.size) throw new Error('The model is not ready for capture.')
        current.renderer.render(current.scene, current.camera)
        const blob = await new Promise<Blob | null>((resolve) =>
          current.renderer.domElement.toBlob(resolve, 'image/png'),
        )
        if (!blob) throw new Error('Your image could not be saved. Please try again.')
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `pokemon-atlas-${latest.current.pokemon.slug}.png`
        link.click()
        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      },
    }),
    [],
  )

  useEffect(() => {
    const element = container.current
    if (!element) return
    const host = element
    let cancelled = false
    let frame = 0
    let resizeObserver: ResizeObserver | undefined
    let visibilityObserver: IntersectionObserver | undefined
    let inViewport = true
    const decoderPreloads: HTMLLinkElement[] = []
    let renderer: THREE.WebGPURenderer | undefined
    let draco: DRACOLoader | undefined
    let scene: THREE.Scene | undefined
    let environment: THREE.RenderTarget | undefined
    let habitats: ReturnType<typeof createEnvironments> | undefined
    let backgroundTexture: THREE.Texture | undefined
    let backgroundRequest = 0
    let controls: OrbitControls | undefined
    const visible = () => {
      if (!document.hidden && runtime.current) runtime.current.dirty = true
    }
    document.addEventListener('visibilitychange', visible)

    async function initialize() {
      latest.current.onLoading(true)
      try {
        // Fetch decoder assets alongside renderer initialization and the first GLB.
        for (const file of typeof WebAssembly === 'object'
          ? ['draco_wasm_wrapper.js', 'draco_decoder.wasm']
          : ['draco_decoder.js']) {
          const link = document.createElement('link')
          link.rel = 'preload'
          link.as = 'fetch'
          link.crossOrigin = 'anonymous'
          link.href = assetPath(`/draco/${file}`)
          document.head.append(link)
          decoderPreloads.push(link)
        }
        renderer = new THREE.WebGPURenderer({ antialias: true, alpha: false, stencil: true })
        try {
          await renderer.init()
        } catch {
          if (renderer.hasInitialized()) renderer.dispose()
          if (cancelled) return
          renderer = new THREE.WebGPURenderer({
            antialias: true,
            alpha: false,
            stencil: true,
            forceWebGL: true,
          })
          await renderer.init()
        }
        if (cancelled) {
          renderer.dispose()
          return
        }
        const activeRenderer = renderer
        activeRenderer.toneMapping = THREE.ACESFilmicToneMapping
        activeRenderer.outputColorSpace = THREE.SRGBColorSpace
        activeRenderer.shadowMap.enabled = true
        activeRenderer.shadowMap.type = THREE.PCFSoftShadowMap
        activeRenderer.domElement.setAttribute('aria-label', latest.current.label)
        activeRenderer.domElement.setAttribute('role', 'img')
        activeRenderer.domElement.style.width = '100%'
        activeRenderer.domElement.style.height = '100%'
        activeRenderer.domElement.style.display = 'block'
        activeRenderer.domElement.style.touchAction = 'none'
        host.appendChild(activeRenderer.domElement)

        const activeScene = new THREE.Scene()
        scene = activeScene
        activeScene.background = new THREE.Color('#1b241c')
        activeScene.fog = new THREE.Fog('#1b241c', 16, 42)
        const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 120)
        camera.position.set(4.3, 3.6, 6.6)
        const activeControls = new OrbitControls(camera, activeRenderer.domElement)
        controls = activeControls
        activeControls.addEventListener('end', () =>
          latest.current.onCameraChange?.({
            position: camera.position.toArray(),
            target: activeControls.target.toArray(),
          }),
        )
        activeControls.enableDamping = true
        activeControls.dampingFactor = 0.075
        activeControls.target.set(0, 1.3, 0)
        activeControls.minDistance = 2.1
        activeControls.maxDistance = 55
        activeControls.maxPolarAngle = Math.PI * 0.49
        activeControls.autoRotateSpeed = 0.65
        activeControls.update()

        const hemisphere = new THREE.HemisphereLight('#ffffff', '#99a087', 1.5)
        const key = new THREE.DirectionalLight('#ffffff', 3.4)
        key.position.set(-4, 7, 5)
        key.castShadow = true
        key.shadow.mapSize.set(1024, 1024)
        key.shadow.camera.left = key.shadow.camera.bottom = -8
        key.shadow.camera.right = key.shadow.camera.top = 8
        key.shadow.camera.near = 0.1
        key.shadow.camera.far = 25
        key.shadow.bias = -0.00015
        key.shadow.normalBias = 0.025
        key.shadow.radius = 3
        const rim = new THREE.DirectionalLight('#e9f0ff', 2.8)
        rim.position.set(4, 4, -5)
        const fill = new THREE.DirectionalLight('#ffffff', 0.7)
        fill.position.set(4, 1, 5)
        activeScene.add(hemisphere, key, rim, fill)

        const groundMaterial = new THREE.MeshStandardMaterial({
          color: '#1c251d',
          roughness: 1,
          metalness: 0,
        })
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), groundMaterial)
        ground.rotation.x = -Math.PI / 2
        ground.position.y = -0.012
        ground.receiveShadow = true
        const stars = nightSky()
        stars.visible = false
        activeScene.add(ground, stars)

        const room = new RoomEnvironment()
        const generator = new THREE.PMREMGenerator(activeRenderer)
        try {
          environment = generator.fromScene(room, 0.04, 0.1, 100, { size: 128 })
          activeScene.environment = environment.texture
          activeScene.environmentIntensity = 0.45
        } finally {
          room.dispose()
          generator.dispose()
        }

        draco = new DRACOLoader().setDecoderPath(assetPath('/draco/'))
        draco.setWorkerLimit(2)
        const loader = new GLTFLoader().setDRACOLoader(draco)
        const current: Runtime = {
          renderer: activeRenderer,
          scene: activeScene,
          camera,
          controls: activeControls,
          loader,
          contents: new Map(),
          target: new THREE.Vector3(0, 1.3, 0),
          distance: 7.5,
          framingPositions: new Float32Array(),
          dirty: true,
        }
        activeControls.addEventListener('change', () => {
          current.dirty = true
        })
        runtime.current = current
        let lastQuality = ''
        let lastHabitat = ''
        let lastWireframe: boolean | undefined
        habitats = createEnvironments()
        activeScene.add(habitats.group)
        let currentAppearance = ENVIRONMENT_APPEARANCE.studio
        let lastBackgroundUrl: string | undefined
        const coverBackground = () => {
          if (!backgroundTexture) return
          const image = backgroundTexture.image as { width: number; height: number }
          const aspect = host.clientWidth / Math.max(1, host.clientHeight)
          const imageAspect = image.width / image.height
          const x = Math.min(1, aspect / imageAspect)
          const y = Math.min(1, imageAspect / aspect)
          backgroundTexture.repeat.set(x, y)
          backgroundTexture.offset.set((1 - x) / 2, (1 - y) / 2)
          backgroundTexture.updateMatrix()
        }
        const changeBackground = (url: string | undefined) => {
          const request = ++backgroundRequest
          activeScene.background = new THREE.Color(currentAppearance.background)
          backgroundTexture?.dispose()
          backgroundTexture = undefined
          if (!url) return
          // Backgrounds are object URLs generated from local uploads, never remote URLs.
          if (!url.startsWith('blob:')) {
            latest.current.onBackgroundError?.()
            return
          }
          const texture = new THREE.TextureLoader().load(
            url,
            (loaded) => {
              if (cancelled || request !== backgroundRequest) {
                loaded.dispose()
                return
              }
              backgroundTexture = loaded
              loaded.colorSpace = THREE.SRGBColorSpace
              loaded.mapping = THREE.UVMapping
              coverBackground()
              activeScene.background = loaded
              current.dirty = true
            },
            undefined,
            () => {
              texture.dispose()
              if (!cancelled && request === backgroundRequest) latest.current.onBackgroundError?.()
            },
          )
        }
        const resize = () => {
          const { width, height } = host.getBoundingClientRect()
          if (!width || !height) return
          current.dirty = true
          activeRenderer.setSize(width, height, false)
          camera.aspect = width / height
          camera.setViewOffset(width, height, 0, Math.min(85, height * 0.25) / 2, width, height)
          camera.updateProjectionMatrix()
          coverBackground()
          if (current.contents.size) {
            const offset = camera.position.clone().sub(activeControls.target)
            const distance = fittedDistance(current, offset.clone().normalize())
            camera.position
              .copy(activeControls.target)
              .add(offset.multiplyScalar(distance / current.distance))
            current.distance = distance
            activeControls.update()
          }
        }
        resizeObserver = new ResizeObserver(resize)
        resizeObserver.observe(host)
        resize()
        if (typeof IntersectionObserver !== 'undefined') {
          visibilityObserver = new IntersectionObserver(([entry]) => {
            inViewport = entry.isIntersecting
            if (inViewport) current.dirty = true
          })
          visibilityObserver.observe(host)
        }
        let previousTime = performance.now()
        let landscapeTime = 0
        let failed = false
        let lastSettings: ViewerSettings | undefined
        let lastBackground: string | undefined
        const tick = (time: number) => {
          if (cancelled) return
          frame = requestAnimationFrame(tick)
          const delta = Math.min((time - previousTime) / 1000, 0.05)
          previousTime = time
          if (document.hidden || failed || !inViewport) return
          const settings = latest.current.settings
          const settingsChanged = lastSettings !== settings || lastBackground !== latest.current.backgroundUrl
          if (settingsChanged) current.dirty = true
          lastSettings = settings
          lastBackground = latest.current.backgroundUrl
          if (lastQuality !== settings.quality) {
            activeRenderer.setPixelRatio(
              Math.min(window.devicePixelRatio, settings.quality === 'high' ? 2 : 1.25),
            )
            resize()
            lastQuality = settings.quality
          }
          if (lastHabitat !== settings.habitat) {
            const night = settings.habitat === 'night'
            const habitat = settings.habitat as EnvironmentKey
            currentAppearance = habitats?.setHabitat(habitat) ?? ENVIRONMENT_APPEARANCE.studio
            activeScene.background = new THREE.Color(currentAppearance.background)
            activeScene.fog = new THREE.Fog(
              currentAppearance.background,
              currentAppearance.fogNear,
              currentAppearance.fogFar,
            )
            groundMaterial.color.set(currentAppearance.ground)
            const custom = habitat === 'custom'
            groundMaterial.transparent = custom
            groundMaterial.opacity = custom ? 0.3 : 1
            groundMaterial.depthWrite = !custom
            groundMaterial.needsUpdate = true
            ground.visible = true
            key.color.set(currentAppearance.keyColor)
            key.intensity = currentAppearance.keyIntensity
            hemisphere.color.set(night ? '#adc5de' : '#ffffff')
            hemisphere.groundColor.set(currentAppearance.groundLight)
            stars.visible = night
            activeScene.environmentIntensity = currentAppearance.environmentIntensity
            lastHabitat = settings.habitat
            // Reapply an already decoded image when returning to its habitat.
            if (custom && backgroundTexture) activeScene.background = backgroundTexture
          }
          const backgroundUrl = settings.habitat === 'custom' ? latest.current.backgroundUrl : undefined
          if (backgroundUrl !== lastBackgroundUrl) {
            changeBackground(backgroundUrl)
            lastBackgroundUrl = backgroundUrl
          }
          const brightness = THREE.MathUtils.clamp(settings.light, 0.2, 2.5)
          activeRenderer.toneMappingExposure = brightness * currentAppearance.exposure
          activeControls.autoRotate = settings.rotate
          activeControls.update(delta)
          if (!settings.playing && !settings.rotate && !current.dirty) return
          if (settings.playing) {
            landscapeTime += delta
            habitats?.update(landscapeTime)
          }
          const changedWireframe = lastWireframe !== settings.wireframe
          for (const content of current.contents.values()) {
            if (settings.playing) {
              content.elapsed += delta * settings.speed
              for (const material of content.flames) {
                material.emissiveIntensity =
                  1.2 + Math.sin(content.elapsed * 11) * 0.12 + Math.sin(content.elapsed * 17) * 0.06
              }
            }
            if (changedWireframe) {
              content.scene.traverse((object) => {
                if (!(object as THREE.Mesh).isMesh) return
                const mesh = object as THREE.Mesh
                for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
                  if ('wireframe' in material) material.wireframe = settings.wireframe
                }
              })
            }
            if (content.clips.length) {
              const selection = Math.min(Math.max(settings.animation, 0), content.clips.length - 1)
              if (content.activeClip !== selection) {
                const measured = measureMotion(content.scene, content.mixer, [content.clips[selection]])
                content.points = normalizedPoints(measured.points, content.normalization)
                content.mixer.clipAction(content.clips[selection]).reset().play()
                frameContents(current, true)
                content.activeClip = selection
              }
              if (settings.playing) content.mixer.update(delta * settings.speed)
            } else if (settings.playing) {
              content.group.scale.y = content.baseScale * (1 + Math.sin(content.elapsed * 2) * 0.006)
            }
          }
          lastWireframe = settings.wireframe
          try {
            activeRenderer.render(activeScene, camera)
            current.dirty = false
          } catch {
            failed = true
            setRendererFailed(true)
          }
        }
        frame = requestAnimationFrame(tick)
        setReady(true)
      } catch {
        if (!cancelled) setRendererFailed(true)
      }
    }
    void initialize()

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      resizeObserver?.disconnect()
      visibilityObserver?.disconnect()
      document.removeEventListener('visibilitychange', visible)
      for (const link of decoderPreloads) link.remove()
      controls?.dispose()
      if (runtime.current) clearModel(runtime.current)
      runtime.current = null
      draco?.dispose()
      habitats?.dispose()
      ++backgroundRequest
      backgroundTexture?.dispose()
      if (scene) disposeObject(scene)
      environment?.dispose()
      if (renderer) {
        renderer.domElement.remove()
        if (renderer.hasInitialized()) renderer.dispose()
      }
    }
  }, [])

  useEffect(() => {
    const active = runtime.current
    if (rendererFailed) {
      firstRequest.current?.abort.abort()
      firstRequest.current?.finish('failed')
      if (active) clearModel(active)
      latest.current.onLoading(false)
      latest.current.onError(rendererUnavailable)
      return
    }
    if (!ready || !active) return
    const current = active
    const desired = JSON.parse(identity) as { key: string; speciesId: number; url?: string }[]
    const abort = new AbortController()
    let cancelled = false
    for (const [key, content] of current.contents) {
      if (!desired.some((entry) => entry.key === key && entry.url === content.url))
        removeContent(current, key)
    }
    latest.current.onLoad([])
    latest.current.onLoading(true)
    current.renderer.domElement.setAttribute('aria-label', latest.current.label)

    async function load() {
      try {
        // Load sequentially to limit simultaneous decoders and mobile memory use.
        for (const entry of desired) {
          if (cancelled) return
          if (current.contents.has(entry.key)) continue
          if (!entry.url) throw new Error('Unavailable model')
          const url = new URL(entry.url, location.href)
          const prepared = firstRequest.current
          const pending =
            prepared?.identity === identity && prepared.url === entry.url && entry.key === desired[0].key
              ? prepared.data
              : undefined
          const data = pending
            ? await pending
            : await fetch(url, { signal: abort.signal }).then((response) => {
                if (!response.ok) throw new Error('Model unavailable')
                return response.arrayBuffer()
              })
          if (pending && prepared) prepared.data = undefined
          if (cancelled) return
          const gltf = await current.loader.parseAsync(data, new URL('.', url).href)
          if (cancelled) {
            disposeObject(gltf.scene)
            return
          }
          const settings = latest.current.settings
          // Separate stencil bits keep overlapping flames and smoke within their own character.
          const usedBits = new Set(Array.from(current.contents.values(), (content) => content.stencilBit))
          const stencilBit = [1, 2, 4, 8, 16, 32].find((bit) => !usedBits.has(bit)) || 64
          const content = prepareContent(
            gltf,
            entry.speciesId,
            entry.key,
            entry.url,
            settings.animation,
            settings.wireframe,
            stencilBit,
          )
          current.contents.set(entry.key, content)
          current.scene.add(content.group)
          applyLayout(current, latest.current.members)
          frameContents(current, true)
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        }
        if (cancelled) return
        const first = current.contents.get(desired[0].key)
        latest.current.onLoad(first?.clips.map((clip, index) => clip.name || `Animation ${index + 1}`) || [])
        latest.current.onLoading(false)
        firstRequest.current?.finish('ready')
      } catch (error) {
        if (cancelled || (error instanceof DOMException && error.name === 'AbortError')) return
        latest.current.onLoading(false)
        firstRequest.current?.finish('failed')
        latest.current.onError(
          navigator.onLine
            ? 'This 3D model could not be loaded. Check your connection and try another Pokémon.'
            : 'Connect to the internet to open this Pokémon for the first time.',
        )
      }
    }
    void load()
    return () => {
      cancelled = true
      abort.abort()
    }
  }, [identity, ready, rendererFailed])

  useEffect(() => {
    runtime.current?.renderer.domElement.setAttribute('aria-label', props.label)
  }, [props.label])

  useEffect(() => {
    const current = runtime.current
    if (!current) return
    applyLayout(current, props.members)
    frameContents(current, false)
  }, [props.members])

  return <div ref={container} className="viewer-canvas" style={{ position: 'absolute', inset: 0 }} />
})

export default Viewer
