import * as THREE from 'three/webgpu'
import { createForest } from './Forest'

export const ENVIRONMENT_KEYS = [
  'studio',
  'forest',
  'night',
  'coast',
  'snow',
  'desert',
  'meadow',
  'mountain',
  'cave',
  'underwater',
  'volcano',
  'wetland',
  'sakura',
  'custom',
] as const
export type EnvironmentKey = (typeof ENVIRONMENT_KEYS)[number]

interface Appearance {
  background: string
  ground: string
  fogNear: number
  fogFar: number
  exposure: number
  keyColor: string
  keyIntensity: number
  groundLight: string
  environmentIntensity: number
}

const appearance = (background: string, ground: string, extra: Partial<Appearance> = {}): Appearance => ({
  background,
  ground,
  fogNear: 20,
  fogFar: 65,
  exposure: 1,
  keyColor: '#ffffff',
  keyIntensity: 3.1,
  groundLight: '#99a087',
  environmentIntensity: 0.4,
  ...extra,
})

export const ENVIRONMENT_APPEARANCE: Record<EnvironmentKey, Appearance> = {
  studio: appearance('#1b241c', '#1c251d', {
    fogNear: 16,
    fogFar: 42,
    keyIntensity: 3.4,
    environmentIntensity: 0.45,
  }),
  forest: appearance('#243022', '#40503a', {
    fogNear: 16,
    fogFar: 42,
    keyColor: '#fff5e5',
    keyIntensity: 2.6,
    groundLight: '#7f9a66',
    environmentIntensity: 0.3,
  }),
  night: appearance('#17252c', '#1f3034', {
    fogNear: 16,
    fogFar: 42,
    exposure: 0.82,
    keyColor: '#b6d5ff',
    groundLight: '#233d45',
    environmentIntensity: 0.22,
  }),
  coast: appearance('#8bb8c4', '#c5b28d', { groundLight: '#aaa995' }),
  snow: appearance('#a3b8c6', '#d1dce0', { exposure: 0.9, groundLight: '#b8c9d4' }),
  desert: appearance('#c5a885', '#bd965f', { keyColor: '#fff4df', groundLight: '#ab8d61' }),
  meadow: appearance('#91ada6', '#6c8050', { groundLight: '#92a06d' }),
  mountain: appearance('#8da0b2', '#686f65', { fogNear: 28, fogFar: 90 }),
  cave: appearance('#202631', '#414649', {
    fogNear: 14,
    fogFar: 45,
    exposure: 0.88,
    keyIntensity: 2.7,
    environmentIntensity: 0.28,
  }),
  underwater: appearance('#245b67', '#6f9990', {
    fogNear: 9,
    fogFar: 44,
    keyColor: '#def8ff',
    groundLight: '#42767a',
    keyIntensity: 2.6,
  }),
  volcano: appearance('#493c3c', '#49423d', {
    fogNear: 20,
    fogFar: 64,
    groundLight: '#876b55',
    exposure: 0.92,
  }),
  wetland: appearance('#79958b', '#57674e', { fogNear: 16, fogFar: 53, groundLight: '#819a71' }),
  sakura: appearance('#acb2ae', '#40503a', {
    keyColor: '#fff4f0',
    groundLight: '#8e9d78',
    keyIntensity: 2.7,
  }),
  custom: appearance('#1b241c', '#303730', {
    fogNear: 28,
    fogFar: 65,
    keyIntensity: 3.4,
    environmentIntensity: 0.45,
  }),
}

interface HabitatScene {
  group: THREE.Group
  update: (elapsed: number) => void
  dispose: () => void
}
interface Instance {
  position: THREE.Vector3
  scale: THREE.Vector3
  rotation: THREE.Quaternion
  color: THREE.Color
  phase: number
}

/** Instanced, solid scenery surrounds an unobstructed seven-unit clearing. */
function makeLandscape(kind: EnvironmentKey): HabitatScene {
  const group = new THREE.Group()
  group.name = `${kind} landscape`
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const instances: THREE.InstancedMesh[] = []
  const animations: ((time: number) => void)[] = []
  const matrix = new THREE.Matrix4()
  const point = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)
  let seed = 41731 + ENVIRONMENT_KEYS.indexOf(kind) * 907
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
  const range = (min: number, max: number) => min + random() * (max - min)
  const at = (radius: number, angle: number, y = 0) =>
    new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius)
  const color = (palette: string[]) => palette[Math.floor(random() * palette.length)]
  const place = (
    position: THREE.Vector3,
    x: number,
    y: number,
    z: number,
    shade: string,
    yaw = range(0, Math.PI * 2),
  ): Instance => ({
    position,
    scale: new THREE.Vector3(x, y, z),
    color: new THREE.Color(shade),
    rotation: new THREE.Quaternion().setFromAxisAngle(up, yaw),
    phase: range(0, Math.PI * 2),
  })
  const surface = (options: THREE.MeshStandardMaterialParameters = {}) => {
    const material = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.94,
      metalness: 0,
      ...options,
    })
    materials.add(material)
    return material
  }
  const matte = surface()
  const foliage = surface({ side: THREE.DoubleSide })
  const stone = new THREE.IcosahedronGeometry(1, 1)
  const cylinder = new THREE.CylinderGeometry(0.65, 1, 1, 7, 1)
  const cone = new THREE.ConeGeometry(1, 1, 9, 2)
  // Every preallocated geometry is tracked, including unused ones in a particular habitat.
  for (const geometry of [stone, cylinder, cone]) geometries.add(geometry)
  const batch = (
    name: string,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    items: Instance[],
    sway = 0,
  ) => {
    geometries.add(geometry)
    if (!items.length) return
    const mesh = new THREE.InstancedMesh(geometry, material, items.length)
    mesh.name = name
    mesh.receiveShadow = true
    if (sway) mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    for (const [index, item] of items.entries()) {
      mesh.setMatrixAt(index, matrix.compose(item.position, item.rotation, item.scale))
      mesh.setColorAt(index, item.color)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
    if (mesh.boundingSphere) mesh.boundingSphere.radius += Math.abs(sway) * 2
    if (sway)
      animations.push((time) => {
        for (const [index, item] of items.entries()) {
          point.copy(item.position)
          point.x += Math.sin(time * 0.75 + item.phase) * sway
          point.z += Math.cos(time * 0.6 + item.phase) * sway * 0.4
          mesh.setMatrixAt(index, matrix.compose(point, item.rotation, item.scale))
        }
        mesh.instanceMatrix.needsUpdate = true
      })
    instances.push(mesh)
    group.add(mesh)
    return mesh
  }
  const rod = (items: Instance[], from: THREE.Vector3, to: THREE.Vector3, radius: number, shade: string) => {
    const offset = new THREE.Vector3().subVectors(to, from)
    const item = place(from.clone().add(to).multiplyScalar(0.5), radius, offset.length(), radius, shade)
    item.rotation.setFromUnitVectors(up, offset.normalize())
    items.push(item)
  }
  // Each strip is curved through space, giving reeds, palm fronds and kelp a real edge.
  const blade = (width: number, bend: number) => {
    const vertices: number[] = []
    const indices: number[] = []
    for (let step = 0; step <= 6; step++) {
      const t = step / 6
      const halfWidth = width * Math.sin(Math.PI * (t * 0.94 + 0.03))
      vertices.push(-halfWidth, t, bend * t * t, halfWidth, t, bend * t * t)
      if (step < 6) {
        const n = step * 2
        indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2)
      }
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    return geometry
  }
  const ring = (
    name: string,
    inner: number,
    outer: number,
    shade: string,
    height: (r: number, a: number) => number,
    material = matte,
    animated = false,
  ) => {
    const vertices: number[] = []
    const indices: number[] = []
    const colors: number[] = []
    const rings = 18
    const segments = 112
    for (let row = 0; row <= rings; row++) {
      const radius = inner + ((outer - inner) * row) / rings
      for (let segment = 0; segment <= segments; segment++) {
        const angle = (segment / segments) * Math.PI * 2
        vertices.push(Math.cos(angle) * radius, height(radius, angle), Math.sin(angle) * radius)
        const value = 0.88 + 0.1 * Math.sin(radius * 0.9 + angle * 4)
        colors.push(value, value, value)
        if (row < rings && segment < segments) {
          const n = row * (segments + 1) + segment
          indices.push(n, n + 1, n + segments + 1, n + 1, n + segments + 2, n + segments + 1)
        }
      }
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    const ringMaterial = material.clone()
    ringMaterial.vertexColors = true
    materials.add(ringMaterial)
    batch(name, geometry, ringMaterial, [place(new THREE.Vector3(), 1, 1, 1, shade, 0)])
    if (animated) {
      const original = new Float32Array(vertices)
      const attribute = geometry.getAttribute('position')
      animations.push((time) => {
        for (let i = 0; i < attribute.count; i++) {
          const x = original[i * 3]
          const z = original[i * 3 + 2]
          attribute.setY(i, original[i * 3 + 1] + Math.sin(Math.hypot(x, z) * 1.9 - time * 1.2) * 0.045)
        }
        attribute.needsUpdate = true
        geometry.computeVertexNormals()
      })
    }
  }
  const rocks: Instance[] = []
  const stems: Instance[] = []
  const leaves: Instance[] = []
  const cones: Instance[] = []
  const accents: Instance[] = []
  const floor = ENVIRONMENT_APPEARANCE[kind].ground
  const rolling = kind === 'desert' ? 1.8 : kind === 'snow' ? 0.7 : 0.5
  const height = (radius: number, angle: number) => {
    const edge = Math.min((radius - 7.4) / 4, 1) * Math.min((32 - radius) / 5, 1)
    return (
      Math.max(0, edge) *
      (0.25 +
        rolling *
          (0.55 + Math.sin(angle * 4 + radius * 0.4) * 0.3 + Math.cos(angle * 7 - radius * 0.6) * 0.15))
    )
  }
  const landHeight = (position: THREE.Vector3) =>
    height(Math.hypot(position.x, position.z), Math.atan2(position.z, position.x))
  if (!['coast', 'wetland', 'volcano'].includes(kind)) ring('Sculpted ground', 7.4, 32, floor, height)
  for (let index = 0; index < 48; index++) {
    const size = range(0.15, 0.65)
    const position = at(range(8.3, 24), range(0, Math.PI * 2))
    position.y = ['coast', 'wetland', 'volcano'].includes(kind) ? 0.1 : landHeight(position)
    rocks.push(
      place(
        position,
        size * 1.4,
        size * 0.75,
        size,
        kind === 'snow' ? '#a8bec9' : kind === 'desert' ? '#997348' : '#71756c',
      ),
    )
  }

  if (kind === 'coast' || kind === 'wetland') {
    ring(
      'Shallow water',
      kind === 'coast' ? 11.8 : 8.2,
      58,
      kind === 'coast' ? '#377f89' : '#486e67',
      () => 0.05,
      surface({ roughness: 0.3, metalness: 0.18 }),
      true,
    )
    ring(
      'Raised shoreline',
      7.4,
      kind === 'coast' ? 13 : 9.1,
      floor,
      (r, a) =>
        Math.sin(((r - 7.4) / (kind === 'coast' ? 5.6 : 1.7)) * Math.PI) * (0.18 + Math.sin(a * 7) * 0.04),
    )
    if (kind === 'coast') {
      const foam: Instance[] = []
      for (let index = 0; index < 100; index++) {
        const angle = (index / 100) * Math.PI * 2
        foam.push(
          place(at(12.7 + Math.sin(angle * 9) * 0.15, angle, 0.15), 0.6, 0.025, 0.06, '#c6d9d0', -angle),
        )
      }
      batch('Shore foam', stone, matte, foam, 0.04)
      for (let tree = 0; tree < 8; tree++) {
        const angle = (tree / 8) * Math.PI * 2 + 0.2
        const base = at(10.1, angle)
        const tip = base.clone().add(at(0.65, angle, range(3.6, 5.2)))
        const middle = base.clone().lerp(tip, 0.5).add(at(-0.2, angle))
        rod(stems, base, middle, 0.18, '#7b684b')
        rod(stems, middle, tip, 0.14, '#7b684b')
        for (let frond = 0; frond < 8; frond++) {
          const item = place(tip.clone(), 1, range(1.6, 2.3), 1, color(['#5f7945', '#758c50']))
          item.rotation.setFromEuler(new THREE.Euler(1.22, (frond / 8) * Math.PI * 2, 0, 'YXZ'))
          leaves.push(item)
        }
      }
      batch('Palm fronds', blade(0.24, 0.28), foliage, leaves, 0.055)
    } else {
      const seedHeads: Instance[] = []
      for (let index = 0; index < 150; index++) {
        const position = at(range(8.5, 19), range(0, Math.PI * 2), 0.08)
        const tall = range(0.7, 1.9)
        leaves.push(place(position, 0.65, tall, 0.7, color(['#6f8650', '#83975c', '#506a43'])))
        if (index % 3 === 0) {
          const top = position.clone().setY(tall)
          rod(stems, position, top, 0.023, '#748357')
          seedHeads.push(place(top, 0.07, 0.24, 0.07, '#5b4535'))
        }
      }
      batch('Reed leaves', blade(0.045, 0.2), foliage, leaves, 0.04)
      batch('Cattails', cylinder, matte, seedHeads, 0.025)
      const pads: Instance[] = []
      for (let index = 0; index < 40; index++)
        pads.push(place(at(range(9.4, 21), range(0, Math.PI * 2), 0.15), 0.33, 0.025, 0.3, '#52724d'))
      batch('Water lily leaves', stone, matte, pads, 0.015)
    }
  }
  if (kind === 'snow') {
    for (let tree = 0; tree < 18; tree++) {
      const angle = (tree / 18) * Math.PI * 2
      const base = at(range(11, 19), angle)
      base.y = landHeight(base)
      const tall = range(3.1, 6)
      rod(stems, base, base.clone().setY(base.y + tall), 0.2, '#625b4b')
      for (let layer = 0; layer < 4; layer++) {
        const width = (1 - layer * 0.18) * 1.7
        const position = base.clone().setY(base.y + 1.1 + layer * tall * 0.19)
        cones.push(place(position, width, tall * 0.48, width, '#49685b'))
        accents.push(
          place(
            position.clone().add(new THREE.Vector3(0, tall * 0.055, 0)),
            width * 0.86,
            tall * 0.41,
            width * 0.86,
            '#d6e1e3',
          ),
        )
      }
    }
    batch('Snow laden fir branches', cone, matte, cones)
    batch('Snow caps', cone, matte, accents)
  }
  if (kind === 'desert') {
    for (let index = 0; index < 12; index++) {
      const base = at(range(10.2, 19), (index / 12) * Math.PI * 2)
      base.y = landHeight(base)
      const tall = range(1.5, 3.6)
      rod(stems, base, base.clone().setY(base.y + tall), 0.2, '#5f7951')
      for (const side of [-1, 1]) {
        const elbow = base.clone().add(new THREE.Vector3(side * 0.65, tall * 0.5, 0))
        rod(stems, base.clone().setY(base.y + tall * 0.5), elbow, 0.13, '#5f7951')
        rod(stems, elbow, elbow.clone().add(new THREE.Vector3(0, tall * 0.38, 0)), 0.13, '#5f7951')
      }
    }
    for (let index = 0; index < 14; index++) {
      const p = at(range(20, 31), (index / 14) * Math.PI * 2)
      p.y = range(1, 2.2)
      accents.push(
        place(p, range(1.5, 3.3), range(2.3, 5.5), range(1.3, 2.8), color(['#a9784c', '#bc8b5a', '#926947'])),
      )
    }
    batch('Sandstone outcrops', stone, matte, accents)
  }
  if (kind === 'meadow') {
    const blossoms: Instance[] = []
    for (let index = 0; index < 420; index++) {
      const p = at(range(7.9, 25), range(0, Math.PI * 2))
      p.y = landHeight(p)
      const tall = range(0.22, 0.65)
      leaves.push(place(p, 0.75, tall, 0.7, color(['#71814a', '#809153', '#5c7b45'])))
      if (index % 3 === 0)
        blossoms.push(
          place(
            p.clone().add(new THREE.Vector3(0, tall, 0)),
            0.085,
            0.035,
            0.085,
            color(['#dec569', '#d9d5ba', '#ac93b4', '#bd9cbd']),
          ),
        )
    }
    batch('Meadow grass', blade(0.065, 0.22), foliage, leaves, 0.035)
    batch('Wildflowers', new THREE.IcosahedronGeometry(1, 0), matte, blossoms, 0.035)
  }
  if (kind === 'mountain' || kind === 'volcano' || kind === 'cave') {
    for (let index = 0; index < 22; index++) {
      const angle = (index / 22) * Math.PI * 2
      const cave = kind === 'cave'
      const radius = cave ? range(16, 21) : range(22, 34)
      const tall = cave ? range(5.5, 9) : range(4, 10)
      const position = at(radius, angle, tall * 0.43)
      const width = cave ? range(2, 3.2) : range(3.3, 5.5)
      accents.push(
        place(
          position,
          width,
          tall * 0.65,
          width * 0.8,
          color(kind === 'volcano' ? ['#504641', '#615044', '#443f3b'] : ['#737a79', '#677271', '#586364']),
        ),
      )
      if (kind === 'mountain')
        cones.push(
          place(position.clone().setY(tall * 0.91), width * 0.49, tall * 0.36, width * 0.46, '#c1ced0'),
        )
      if (cave) {
        const hanging = place(
          at(range(11.5, 18), angle, range(6.5, 8.5)),
          0.65,
          range(1.4, 3),
          0.65,
          '#657273',
        )
        hanging.rotation.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI)
        cones.push(hanging)
        cones.push(place(at(range(9, 14), angle, 0.8), 0.4, range(0.8, 2), 0.4, '#778280'))
      }
    }
    batch('Layered stone ridges', stone, matte, accents)
    batch(kind === 'cave' ? 'Stalactites and stalagmites' : 'Distant snow peaks', cone, matte, cones)
    if (kind === 'cave') {
      ring(
        'Vaulted cave ceiling',
        8.5,
        28,
        '#424f52',
        (r, a) => 9 + Math.sin(a * 5 + r * 0.3) * 0.8,
        surface({ side: THREE.DoubleSide }),
      )
      const crystals: Instance[] = []
      for (let i = 0; i < 40; i++)
        crystals.push(
          place(
            at(range(8.5, 14), range(0, Math.PI * 2), 0.25),
            range(0.09, 0.2),
            range(0.5, 1.2),
            0.13,
            color(['#6cabbd', '#8ba9c7', '#96b5af']),
          ),
        )
      batch(
        'Mineral crystals',
        new THREE.OctahedronGeometry(1),
        surface({ roughness: 0.4, metalness: 0.15, emissive: '#456378', emissiveIntensity: 0.12 }),
        crystals,
      )
    }
    if (kind === 'volcano') {
      ring(
        'Molten lava beyond the rock island',
        10,
        39,
        '#b7481c',
        (r, a) => 0.05 + Math.sin(r * 3 + a * 9) * 0.03,
        surface({ roughness: 0.5, emissive: '#ed641e', emissiveIntensity: 0.75 }),
        true,
      )
      ring(
        'Basalt island rim',
        7.4,
        11,
        floor,
        (r, a) => Math.sin(((r - 7.4) / 3.6) * Math.PI) * (0.4 + Math.sin(a * 13) * 0.2),
      )
      const crust: Instance[] = []
      for (let i = 0; i < 130; i++)
        crust.push(
          place(
            at(range(11, 35), range(0, Math.PI * 2), 0.11),
            range(0.2, 1.2),
            0.08,
            range(0.4, 1.4),
            '#483d34',
          ),
        )
      batch('Drifting lava crust', stone, matte, crust, 0.04)
    }
  }
  if (kind === 'underwater') {
    for (let index = 0; index < 36; index++) {
      const base = at(range(8.8, 20), (index / 36) * Math.PI * 2)
      base.y = landHeight(base)
      const shade = color(['#b57b75', '#ad8763', '#9c789b', '#7caaa2'])
      const tip = base.clone().add(new THREE.Vector3(0, range(0.9, 2.1), 0))
      rod(stems, base, tip, 0.085, shade)
      for (let branch = 0; branch < 4; branch++) {
        const fork = base.clone().lerp(tip, range(0.4, 0.9))
        const end = fork.clone().add(at(range(0.35, 0.8), (branch / 4) * Math.PI * 2, 0.5))
        rod(stems, fork, end, 0.065, shade)
        rod(stems, end, end.clone().add(new THREE.Vector3(0.12, 0.25, 0)), 0.035, shade)
      }
      for (let bladeIndex = 0; bladeIndex < 4; bladeIndex++) {
        const p = base.clone().add(at(1.2, (bladeIndex / 4) * Math.PI * 2))
        leaves.push(place(p, 1, range(1.4, 3.5), 1, color(['#597f58', '#77986a', '#527d67'])))
      }
    }
    batch('Swaying kelp', blade(0.12, 0.15), foliage, leaves, 0.085)
  }
  if (kind === 'snow' || kind === 'underwater' || kind === 'volcano') {
    const particles: Instance[] = []
    for (let i = 0; i < 64; i++) {
      const size = kind === 'underwater' ? range(0.04, 0.085) : range(0.018, 0.035)
      particles.push(
        place(
          at(range(8, 23), range(0, Math.PI * 2), range(0.3, 7)),
          size,
          size,
          size,
          kind === 'volcano' ? '#ed9b45' : '#c4dce0',
        ),
      )
    }
    const particleMaterial =
      kind === 'volcano'
        ? surface({ emissive: '#e99b45', emissiveIntensity: 0.7 })
        : surface({ roughness: 0.3, metalness: 0.12 })
    const mesh = batch('Drifting particles', new THREE.IcosahedronGeometry(1, 0), particleMaterial, particles)
    if (mesh) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      mesh.frustumCulled = false
      animations.push((time) => {
        for (const [i, item] of particles.entries()) {
          point.copy(item.position)
          point.y = ((((item.position.y + time * (kind === 'snow' ? -0.22 : 0.25)) % 7) + 7) % 7) + 0.1
          point.x += Math.sin(time * 0.4 + item.phase) * 0.15
          mesh.setMatrixAt(i, matrix.compose(point, item.rotation, item.scale))
        }
        mesh.instanceMatrix.needsUpdate = true
      })
    }
  }
  batch('Scattered stones', stone, matte, rocks)
  batch(
    kind === 'underwater' ? 'Branching coral' : kind === 'desert' ? 'Cacti' : 'Tree trunks and stems',
    cylinder,
    matte,
    stems,
  )
  // A single tracked clock is advanced by Viewer only while playback is enabled.
  let lastUpdate = -Infinity
  let disposed = false
  return {
    group,
    update(elapsed) {
      if (disposed || !Number.isFinite(elapsed) || (elapsed >= lastUpdate && elapsed - lastUpdate < 1 / 24))
        return
      lastUpdate = elapsed
      for (const animate of animations) animate(elapsed)
    },
    dispose() {
      if (disposed) return
      disposed = true
      group.removeFromParent()
      for (const mesh of instances) mesh.dispose()
      for (const geometry of geometries) geometry.dispose()
      for (const material of materials) material.dispose()
      group.clear()
    },
  }
}

/** Construct only the selected habitat. Switching releases every old GPU resource. */
export function createEnvironments() {
  const group = new THREE.Group()
  group.name = 'Surrounding landscape'
  let current: HabitatScene | undefined
  let key: EnvironmentKey | undefined
  let disposed = false
  return {
    group,
    setHabitat(next: EnvironmentKey): Appearance {
      if (disposed || next === key) return ENVIRONMENT_APPEARANCE[next]
      current?.dispose()
      current = undefined
      key = next
      if (next === 'forest' || next === 'sakura') current = createForest({ blossoms: next === 'sakura' })
      else if (next !== 'studio' && next !== 'night' && next !== 'custom') current = makeLandscape(next)
      if (current) group.add(current.group)
      return ENVIRONMENT_APPEARANCE[next]
    },
    update(elapsed: number) {
      if (!disposed) current?.update(elapsed)
    },
    dispose() {
      if (disposed) return
      disposed = true
      current?.dispose()
      current = undefined
      group.removeFromParent()
      group.clear()
    },
  }
}
