import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import * as THREE from 'three/webgpu'
import type { ModelEntry, Pokemon, ViewerHandle, ViewerSettings } from './types'

interface ViewerProps {
  pokemon: Pokemon
  model: ModelEntry | undefined
  settings: ViewerSettings
  onLoad: (animationNames: string[]) => void
  onError: (message: string) => void
  onLoading: (loading: boolean) => void
}

interface LoadedModel {
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
  content: LoadedModel | null
  target: THREE.Vector3
  distance: number
  framingPositions: Float32Array
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
  const points: number[] = []
  const directions: number[][] = []
  for (const x of [-1, 0, 1])
    for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) if (x || y || z) directions.push([x, y, z])
  const scores = new Float64Array(directions.length)
  const extrema = new Float32Array(directions.length * 3)
  function recordPose() {
    scene.updateMatrixWorld(true)
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
        mesh.getVertexPosition(index, vertex).applyMatrix4(mesh.matrixWorld)
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
    const samples = Math.min(32, Math.max(8, Math.ceil(clip.duration * 8)))
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

function clearModel(runtime: Runtime) {
  const model = runtime.content
  if (!model) return
  model.mixer.stopAllAction()
  model.mixer.uncacheRoot(model.scene)
  runtime.scene.remove(model.group)
  disposeObject(model.group)
  runtime.content = null
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
      },
      async capture() {
        const current = runtime.current
        if (!current?.content) throw new Error('The model is not ready for capture.')
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
    let renderer: THREE.WebGPURenderer | undefined
    let draco: DRACOLoader | undefined
    let scene: THREE.Scene | undefined
    let environment: THREE.RenderTarget | undefined
    let forestTexture: THREE.Texture | undefined
    let controls: OrbitControls | undefined

    async function initialize() {
      latest.current.onLoading(true)
      try {
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
        activeRenderer.domElement.setAttribute(
          'aria-label',
          `${latest.current.pokemon.name} interactive 3D model`,
        )
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
        activeControls.enableDamping = true
        activeControls.dampingFactor = 0.075
        activeControls.target.set(0, 1.3, 0)
        activeControls.minDistance = 2.1
        activeControls.maxDistance = 15
        activeControls.maxPolarAngle = Math.PI * 0.49
        activeControls.autoRotateSpeed = 0.65
        activeControls.update()

        const hemisphere = new THREE.HemisphereLight('#ffffff', '#99a087', 1.5)
        const key = new THREE.DirectionalLight('#ffffff', 3.4)
        key.position.set(-4, 7, 5)
        key.castShadow = true
        key.shadow.mapSize.set(1024, 1024)
        key.shadow.camera.left = key.shadow.camera.bottom = -5
        key.shadow.camera.right = key.shadow.camera.top = 5
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
        const shadow = contactShadow()
        const stars = nightSky()
        stars.visible = false
        activeScene.add(ground, shadow, stars)

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

        draco = new DRACOLoader().setDecoderPath('/draco/')
        draco.setWorkerLimit(2)
        const loader = new GLTFLoader().setDRACOLoader(draco)
        const current: Runtime = {
          renderer: activeRenderer,
          scene: activeScene,
          camera,
          controls: activeControls,
          loader,
          content: null,
          target: new THREE.Vector3(0, 1.3, 0),
          distance: 7.5,
          framingPositions: new Float32Array(),
        }
        runtime.current = current
        let lastQuality = ''
        let lastHabitat = ''
        let lastWireframe: boolean | undefined
        let forestReady = false
        forestTexture = new THREE.TextureLoader().load('/habitat.webp', (texture) => {
          if (cancelled) {
            texture.dispose()
            return
          }
          forestReady = true
          lastHabitat = ''
          resize()
        })
        forestTexture.colorSpace = THREE.SRGBColorSpace
        const resize = () => {
          const { width, height } = host.getBoundingClientRect()
          if (!width || !height) return
          activeRenderer.setSize(width, height, false)
          camera.aspect = width / height
          camera.setViewOffset(width, height, 0, Math.min(85, height * 0.25) / 2, width, height)
          camera.updateProjectionMatrix()
          if (current.content) {
            const offset = camera.position.clone().sub(activeControls.target)
            const distance = fittedDistance(current, offset.clone().normalize())
            camera.position
              .copy(activeControls.target)
              .add(offset.multiplyScalar(distance / current.distance))
            current.distance = distance
            activeControls.update()
          }
          const image = forestTexture?.image as HTMLImageElement | undefined
          if (forestTexture && image?.naturalWidth) {
            const imageAspect = image.naturalWidth / image.naturalHeight
            const x = Math.min(1, camera.aspect / imageAspect)
            const y = Math.min(1, imageAspect / camera.aspect)
            forestTexture.repeat.set(x, y)
            forestTexture.offset.set((1 - x) / 2, (1 - y) / 2)
            forestTexture.updateMatrix()
          }
        }
        resizeObserver = new ResizeObserver(resize)
        resizeObserver.observe(host)
        resize()
        let previousTime = performance.now()
        let failed = false
        const tick = (time: number) => {
          if (cancelled) return
          frame = requestAnimationFrame(tick)
          const delta = Math.min((time - previousTime) / 1000, 0.05)
          previousTime = time
          if (document.hidden || failed) return
          const settings = latest.current.settings
          if (lastQuality !== settings.quality) {
            activeRenderer.setPixelRatio(
              Math.min(window.devicePixelRatio, settings.quality === 'high' ? 2 : 1.25),
            )
            resize()
            lastQuality = settings.quality
          }
          if (lastHabitat !== settings.habitat) {
            const night = settings.habitat === 'night'
            const woods = settings.habitat === 'forest'
            const background = night ? '#17252c' : woods ? '#243022' : '#1b241c'
            activeScene.background =
              woods && forestReady && forestTexture ? forestTexture : new THREE.Color(background)
            ;(activeScene.fog as THREE.Fog).color.set(background)
            groundMaterial.color.set(night ? '#1f3034' : '#1c251d')
            ground.visible = !woods
            key.color.set(night ? '#b6d5ff' : woods ? '#fff5e5' : '#ffffff')
            key.intensity = woods ? 2.6 : 3.4
            hemisphere.color.set(night ? '#adc5de' : '#ffffff')
            hemisphere.groundColor.set(night ? '#233d45' : woods ? '#7f9a66' : '#99a087')
            stars.visible = night
            activeScene.environmentIntensity = night ? 0.22 : woods ? 0.3 : 0.45
            lastHabitat = settings.habitat
          }
          const brightness = THREE.MathUtils.clamp(settings.light, 0.2, 2.5)
          activeRenderer.toneMappingExposure = brightness * (settings.habitat === 'night' ? 0.82 : 1)
          activeControls.autoRotate = settings.rotate
          activeControls.update(delta)
          const content = current.content
          if (content) {
            if (settings.playing) {
              content.elapsed += delta * settings.speed
              for (const material of content.flames) {
                material.emissiveIntensity =
                  1.2 + Math.sin(content.elapsed * 11) * 0.12 + Math.sin(content.elapsed * 17) * 0.06
              }
            }
            if (lastWireframe !== settings.wireframe) {
              content.scene.traverse((object) => {
                if (!(object as THREE.Mesh).isMesh) return
                const mesh = object as THREE.Mesh
                for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
                  if ('wireframe' in material) material.wireframe = settings.wireframe
                }
              })
              lastWireframe = settings.wireframe
            }
            if (content.clips.length) {
              const selection = Math.min(Math.max(settings.animation, 0), content.clips.length - 1)
              if (content.activeClip !== selection) {
                content.mixer.stopAllAction()
                content.mixer.clipAction(content.clips[selection]).reset().play()
                content.activeClip = selection
              }
              if (settings.playing) content.mixer.update(delta * settings.speed)
            } else if (settings.playing) {
              content.group.scale.y = 1 + Math.sin(content.elapsed * 2) * 0.006
            }
          } else {
            lastWireframe = undefined
          }
          try {
            activeRenderer.render(activeScene, camera)
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
      controls?.dispose()
      if (runtime.current) clearModel(runtime.current)
      runtime.current = null
      draco?.dispose()
      if (scene) disposeObject(scene)
      environment?.dispose()
      forestTexture?.dispose()
      if (renderer) {
        renderer.domElement.remove()
        if (renderer.hasInitialized()) renderer.dispose()
      }
    }
  }, [])

  useEffect(() => {
    const active = runtime.current
    if (rendererFailed) {
      if (active) clearModel(active)
      latest.current.onLoading(false)
      latest.current.onError(rendererUnavailable)
      return
    }
    if (!ready || !active) return
    const current = active
    let cancelled = false
    const abort = new AbortController()
    clearModel(current)
    latest.current.onLoad([])
    if (!modelUrl) {
      latest.current.onLoading(false)
      latest.current.onError('A 3D model is not available for this Pokémon yet.')
      return () => {
        cancelled = true
        abort.abort()
      }
    }
    latest.current.onLoading(true)
    current.renderer.domElement.setAttribute(
      'aria-label',
      `${latest.current.pokemon.name} interactive 3D model`,
    )
    const url = new URL(modelUrl, window.location.href)
    async function load() {
      try {
        const response = await fetch(url, { signal: abort.signal })
        if (!response.ok) throw new Error(`Model request failed: ${response.status}`)
        const data = await response.arrayBuffer()
        if (cancelled) return
        const gltf = await current.loader.parseAsync(data, new URL('.', url).href)
        if (cancelled) {
          disposeObject(gltf.scene)
          return
        }
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
              new THREE.BooleanKeyframeTrack(
                `${object.uuid}.visible`,
                times as number[],
                values as boolean[],
              ),
            )
          })
        }
        const mixer = new THREE.AnimationMixer(gltf.scene)
        const initialClip = Math.min(
          Math.max(latest.current.settings.animation, 0),
          gltf.animations.length - 1,
        )
        const { bounds, points } = measureMotion(gltf.scene, mixer, gltf.animations)
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
        motion.name = `pokemon-${props.pokemon.id}`
        motion.add(normalization)
        const flames: THREE.MeshStandardMaterial[] = []
        let fineBump: THREE.Texture | undefined
        let fineRoughness: THREE.Texture | undefined
        gltf.scene.traverse((object) => {
          const mesh = object as THREE.Mesh
          if (!mesh.isMesh) return
          mesh.castShadow = true
          mesh.receiveShadow = true
          for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
            if ('wireframe' in material) material.wireframe = latest.current.settings.wireframe
            if (material instanceof THREE.MeshStandardMaterial) {
              const stencil = material.userData.homeStencil
              if (stencil?.role === 'mask' || stencil?.role === 'core') {
                const mask = stencil.role === 'mask'
                material.colorWrite = !mask
                material.depthWrite = false
                material.stencilWrite = true
                material.stencilRef = stencil.ref
                material.stencilFunc = mask ? THREE.AlwaysStencilFunc : THREE.EqualStencilFunc
                material.stencilZPass = mask ? THREE.ReplaceStencilOp : THREE.KeepStencilOp
                material.stencilWriteMask = mask ? 0xff : 0
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
              if (props.pokemon.id === 6 && /^Material_1[56]$/.test(material.name) && material.map) {
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
        current.content = {
          group: motion,
          scene: gltf.scene,
          mixer,
          clips: gltf.animations,
          activeClip: initialClip,
          elapsed: 0,
          flames,
        }
        current.scene.add(motion)
        current.target.set(0, size.y * scale * 0.5, 0)
        current.framingPositions = new Float32Array(points.length)
        for (let index = 0; index < points.length; index += 3) {
          current.framingPositions[index] = (points[index] - center.x) * scale
          current.framingPositions[index + 1] = (points[index + 1] - bounds.min.y) * scale
          current.framingPositions[index + 2] = (points[index + 2] - center.z) * scale
        }
        const direction = new THREE.Vector3(0.65, 0.34, 1).normalize()
        current.distance = fittedDistance(current, direction)
        current.controls.target.copy(current.target)
        current.camera.position.copy(current.target).add(direction.multiplyScalar(current.distance))
        current.controls.update()
        latest.current.onLoad(gltf.animations.map((clip, index) => clip.name || `Animation ${index + 1}`))
        latest.current.onLoading(false)
      } catch (error) {
        if (cancelled || (error instanceof DOMException && error.name === 'AbortError')) return
        latest.current.onLoading(false)
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
  }, [modelUrl, props.pokemon.id, ready, rendererFailed])

  return <div ref={container} className="viewer-canvas" style={{ position: 'absolute', inset: 0 }} />
})

export default Viewer
