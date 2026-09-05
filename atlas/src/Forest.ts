import * as THREE from 'three/webgpu'

interface Placement {
  position: THREE.Vector3
  rotation: THREE.Quaternion
  scale: THREE.Vector3
  color: THREE.Color
  phase: number
}

/** A clearing with solid, instanced vegetation; the viewer supplies its floor and lighting. */
export function createForest(options: { blossoms?: boolean } = {}): {
  group: THREE.Group
  update: (elapsed: number) => void
  dispose: () => void
} {
  const group = new THREE.Group()
  group.name = options.blossoms ? 'Cherry blossom garden' : 'Forest clearing'
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const meshes: THREE.InstancedMesh[] = []
  const up = new THREE.Vector3(0, 1, 0)
  const matrix = new THREE.Matrix4()
  const quaternion = new THREE.Quaternion()
  const breeze = new THREE.Quaternion()
  const euler = new THREE.Euler()
  const position = new THREE.Vector3()
  let seed = 73129
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
  const range = (min: number, max: number) => min + random() * (max - min)
  const palette = (colors: string[]) => new THREE.Color(colors[Math.floor(random() * colors.length)])
  const barkColors = ['#655441', '#736049', '#574b3d', '#796851']
  const leafColors = options.blossoms
    ? ['#e6b8c5', '#f0cbd2', '#db9bae', '#f3d7da', '#c993ab']
    : ['#5e7946', '#6b824c', '#4d6b40', '#72874f', '#537345']
  const rockColors = ['#6e7464', '#818273', '#616c60', '#777465']
  const at = (radius: number, angle: number, y = 0) =>
    new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius)
  const groundHeight = (x: number, z: number) => {
    const radius = Math.hypot(x, z)
    if (radius <= 7.4 || radius >= 24) return 0
    const angle = Math.atan2(z, x)
    const edge = Math.min((radius - 7.4) / 2.7, 1) * Math.min((24 - radius) / 4, 1)
    const rise = 0.5 + Math.sin(angle * 3 + radius * 0.5) * 0.27 + Math.cos(angle * 5 - radius * 0.8) * 0.18
    return edge * (0.08 + rise * 0.42)
  }
  const material = (doubleSided = false) => {
    const result = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.98,
      metalness: 0,
      vertexColors: true,
      side: doubleSided ? THREE.DoubleSide : THREE.FrontSide,
      envMapIntensity: 0.35,
    })
    materials.add(result)
    return result
  }
  const placement = (
    point: THREE.Vector3,
    scale: THREE.Vector3,
    color: THREE.Color,
    rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, range(0, Math.PI * 2), 0)),
  ): Placement => ({ position: point, rotation, scale, color, phase: range(0, Math.PI * 2) })
  const batch = (
    name: string,
    geometry: THREE.BufferGeometry,
    surface: THREE.Material,
    items: Placement[],
    shadow = false,
    animated = false,
  ) => {
    const mesh = new THREE.InstancedMesh(geometry, surface, items.length)
    mesh.name = name
    mesh.castShadow = shadow
    mesh.receiveShadow = true
    if (animated) mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    for (const [index, item] of items.entries()) {
      mesh.setMatrixAt(index, matrix.compose(item.position, item.rotation, item.scale))
      mesh.setColorAt(index, item.color)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
    if (mesh.boundingSphere && animated) mesh.boundingSphere.radius += 0.3
    geometries.add(geometry)
    meshes.push(mesh)
    group.add(mesh)
    return mesh
  }

  // Grayscale vertex variation preserves the muted instance palette under PBR lighting.
  const weathered = (geometry: THREE.BufferGeometry, stone: boolean) => {
    const vertices = geometry.getAttribute('position')
    const colors: number[] = []
    for (let index = 0; index < vertices.count; index++) {
      position.fromBufferAttribute(vertices, index)
      const ridges = Math.sin(Math.atan2(position.z, position.x) * 9 + position.y * 0.7)
      if (stone) position.multiplyScalar(0.9 + 0.12 * Math.sin(position.x * 7 + position.z * 9))
      else {
        position.x *= 1 + ridges * 0.065
        position.z *= 1 + ridges * 0.065
      }
      vertices.setXYZ(index, position.x, position.y, position.z)
      const shade = stone ? 0.75 + (position.y + 1) * 0.11 : 0.82 + ridges * 0.12
      colors.push(shade, shade, shade)
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    geometry.computeVertexNormals()
    return geometry
  }
  const barkGeometry = weathered(new THREE.CylinderGeometry(0.66, 1, 1, 9, 2), false)
  const rockGeometry = weathered(new THREE.IcosahedronGeometry(1, 1), true)
  const barkMaterial = material()
  const vegetationMaterial = material(true)
  const stoneMaterial = material()

  // A folded five-vertex leaf has a real silhouette and midrib, without alpha textures.
  const leaves: number[] = []
  const leafColorsAttribute: number[] = []
  const leafIndices: number[] = []
  const appendLeaf = (
    positions: number[],
    colors: number[],
    indices: number[],
    origin: THREE.Vector3,
    orientation: THREE.Quaternion,
    length: number,
    width: number,
  ) => {
    const start = positions.length / 3
    const shade = range(0.76, 1)
    const shape = [
      [0, 0, 0],
      [0.45, 0.025, width],
      [1, 0.055, 0],
      [0.45, 0.025, -width],
      [0.45, 0.1, 0],
    ]
    for (const [x, y, z] of shape) {
      position
        .set((x - 0.45) * length, y * length, z * length)
        .applyQuaternion(orientation)
        .add(origin)
      positions.push(position.x, position.y, position.z)
      colors.push(shade, shade, shade)
    }
    for (let edge = 0; edge < 4; edge++) indices.push(start + edge, start + ((edge + 1) % 4), start + 4)
  }
  const leafNormal = new THREE.Vector3()
  for (let index = 0; index < 72; index++) {
    const y = 1 - (2 * (index + 0.5)) / 72
    const angle = index * 2.399963229728653
    const ring = Math.sqrt(1 - y * y)
    const origin = new THREE.Vector3(Math.cos(angle) * ring, y * 0.62, Math.sin(angle) * ring).multiplyScalar(
      range(0.6, 1.05),
    )
    leafNormal.copy(origin).normalize().lerp(up, 0.45).normalize()
    quaternion.setFromUnitVectors(up, leafNormal)
    quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(up, range(0, Math.PI * 2)))
    appendLeaf(leaves, leafColorsAttribute, leafIndices, origin, quaternion, range(0.35, 0.62), 0.24)
  }
  const geometryFrom = (positions: number[], colors: number[], indices: number[]) => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    return geometry
  }
  const foliageGeometry = geometryFrom(leaves, leafColorsAttribute, leafIndices)
  const timber: Placement[] = []
  const shadowTimber: Placement[] = []
  const crowns: Placement[] = []
  const rocks: Placement[] = []
  const stems = (
    items: Placement[],
    from: THREE.Vector3,
    to: THREE.Vector3,
    radius: number,
    color: THREE.Color,
  ) => {
    const direction = new THREE.Vector3().subVectors(to, from)
    items.push(
      placement(
        new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5),
        new THREE.Vector3(radius, direction.length() + 0.035, radius),
        color,
        new THREE.Quaternion().setFromUnitVectors(up, direction.normalize()),
      ),
    )
  }
  const keepClearing = (point: THREE.Vector3, size: number) => {
    const radius = Math.hypot(point.x, point.z)
    const minimum = 7.45 + size * 1.5
    if (radius < minimum) {
      point.x *= minimum / radius
      point.z *= minimum / radius
    }
  }
  const crown = (point: THREE.Vector3, size: number, squash = 1) => {
    keepClearing(point, size)
    crowns.push(
      placement(
        point,
        new THREE.Vector3(size, size * range(0.7, 1) * squash, size * range(0.85, 1.1)),
        palette(leafColors),
      ),
    )
  }
  for (let tree = 0; tree < 16; tree++) {
    const angle = (tree / 16) * Math.PI * 2 + range(-0.075, 0.075)
    const base = at(10.8 + (tree % 3) * 2.1 + range(0, 0.9), angle)
    base.y = groundHeight(base.x, base.z)
    const young = tree % 4 === 1
    const height = young ? range(4.5, 5.8) : range(6.8, 8.8)
    const radius = young ? range(0.23, 0.35) : range(0.31, 0.53)
    const color = palette(barkColors)
    const wood = tree % 5 === 2 ? shadowTimber : timber
    const lean = at(range(0.2, 0.7), angle)
    const joints = [0, 0.35, 0.69, 1].map((fraction) =>
      base
        .clone()
        .addScaledVector(lean, fraction)
        .setY(base.y + height * fraction),
    )
    for (let segment = 0; segment < 3; segment++) {
      stems(wood, joints[segment], joints[segment + 1], radius * 0.67 ** segment, color)
    }
    for (let root = 0; root < 4; root++) {
      const direction = angle + (root / 4) * Math.PI * 2 + range(-0.3, 0.3)
      stems(
        wood,
        base.clone().setY(base.y + 0.28),
        base.clone().add(at(range(0.9, 1.7), direction, 0.015)),
        radius * 0.3,
        color,
      )
    }
    crown(joints[3].clone().setY(base.y + height - 0.25), range(1.45, 1.95))
    for (let branch = 0; branch < 4; branch++) {
      const low = branch < 2
      const branchAngle = angle + branch * 2.399963229728653 + range(-0.3, 0.3)
      const from = base
        .clone()
        .addScaledVector(lean, 0.5)
        .setY(base.y + (low ? range(1.3, 1.8) : height * range(0.42, 0.62)))
      const elbow = base
        .clone()
        .add(at(range(1.1, 1.7), branchAngle))
        .setY(base.y + (low ? range(1.9, 2.5) : height * range(0.66, 0.79)))
      const tip = base
        .clone()
        .add(at(range(2.1, 3), branchAngle))
        .setY(base.y + (low ? range(2.5, 3.2) : height * range(0.8, 0.96)))
      const size = range(1.3, 1.85)
      keepClearing(tip, size)
      stems(wood, from, elbow, radius * 0.42, color)
      stems(wood, elbow, tip, radius * 0.24, color)
      crown(tip, size)
      if (!low) {
        crown(
          tip
            .clone()
            .lerp(joints[3], 0.45)
            .add(new THREE.Vector3(0, 0.35, 0)),
          range(1.4, 1.9),
        )
      }
    }
    // Reuse the two former high crowns as a layered shrub in the eye-level background.
    const shrub = at(range(9.1, 10.2), angle + 0.13)
    shrub.y = groundHeight(shrub.x, shrub.z)
    const lower = shrub.clone().add(new THREE.Vector3(0, 0.95, 0))
    const upper = shrub.clone().add(at(0.4, angle + 0.5, 1.65))
    crown(lower, range(0.95, 1.12), 0.85)
    crown(upper, range(0.85, 1.05), 0.85)
    stems(timber, shrub, lower, 0.06, color)
    stems(timber, lower, upper, 0.035, color)
    rocks.push(
      placement(
        base.clone().add(at(range(0.7, 1.4), angle + 1, 0.1)),
        new THREE.Vector3(0.7, 0.34, 0.6),
        palette(rockColors),
      ),
    )
  }
  for (let log = 0; log < 3; log++) {
    const center = at(range(10, 15), range(0, Math.PI * 2), 0.13)
    center.y += groundHeight(center.x, center.z)
    const offset = at(range(1.1, 1.6), range(0, Math.PI * 2))
    stems(
      timber,
      center.clone().sub(offset),
      center
        .clone()
        .add(offset)
        .setY(center.y + 0.11),
      0.22,
      palette(barkColors),
    )
  }
  for (let rock = 0; rock < 46; rock++) {
    const size = range(0.18, 0.66)
    const point = at(range(8.2, 19), range(0, Math.PI * 2), size * 0.16)
    point.y += groundHeight(point.x, point.z)
    rocks.push(
      placement(
        point,
        new THREE.Vector3(size * range(1, 1.6), size * range(0.45, 0.8), size),
        palette(rockColors),
      ),
    )
  }

  const fernPositions: number[] = []
  const fernColors: number[] = []
  const fernIndices: number[] = []
  for (let frond = 0; frond < 6; frond++) {
    const angle = (frond / 6) * Math.PI * 2
    for (let pair = 0; pair < 7; pair++) {
      const t = (pair + 1) / 8
      const origin = at(t * 0.65, angle, Math.sin(t * Math.PI * 0.7) * 0.62)
      for (const side of [-1, 1]) {
        quaternion.setFromEuler(new THREE.Euler(-0.2, -angle + side * 0.9, side * 0.13))
        appendLeaf(fernPositions, fernColors, fernIndices, origin, quaternion, 0.34 * (1 - t * 0.72), 0.2)
      }
    }
  }
  const fernGeometry = geometryFrom(fernPositions, fernColors, fernIndices)
  const grassPositions: number[] = []
  const grassColors: number[] = []
  const grassIndices: number[] = []
  for (let blade = 0; blade < 12; blade++) {
    const angle = range(0, Math.PI * 2)
    const center = at(range(0, 0.26), angle)
    const height = range(0.18, 0.55)
    const width = range(0.013, 0.029)
    const start = grassPositions.length / 3
    for (const [y, taper, bend] of [
      [0, 1, 0],
      [0.55, 0.7, 0.04],
      [1, 0, 0.17],
    ]) {
      for (const side of [-1, 1]) {
        grassPositions.push(
          center.x + Math.cos(angle) * width * taper * side + Math.sin(angle) * bend,
          y * height,
          center.z - Math.sin(angle) * width * taper * side + Math.cos(angle) * bend,
        )
        const shade = 0.65 + y * 0.3
        grassColors.push(shade, shade, shade)
      }
    }
    grassIndices.push(
      start,
      start + 1,
      start + 2,
      start + 1,
      start + 3,
      start + 2,
      start + 2,
      start + 3,
      start + 4,
    )
  }
  const grassGeometry = geometryFrom(grassPositions, grassColors, grassIndices)
  const ferns: Placement[] = []
  const grasses: Placement[] = []
  for (let clump = 0; clump < 260; clump++) {
    const point = at(range(8, 20), range(0, Math.PI * 2), 0.008)
    point.y += groundHeight(point.x, point.z)
    const size = range(0.65, 1.35)
    const undergrowth = options.blossoms ? ['#65764e', '#76855a', '#566f46'] : leafColors
    grasses.push(placement(point, new THREE.Vector3(size, size, size), palette(undergrowth)))
    if (clump < 34)
      ferns.push(placement(point.clone(), new THREE.Vector3(size, size, size), palette(undergrowth)))
  }
  batch('Trunks, roots and fallen wood', barkGeometry, barkMaterial, timber)
  batch('Three shadow-casting trees', barkGeometry, barkMaterial, shadowTimber, true)
  const foliage = batch('Individual canopy leaves', foliageGeometry, vegetationMaterial, crowns, false, true)
  batch('Weathered rocks', rockGeometry, stoneMaterial, rocks)
  batch('Fern fronds', fernGeometry, vegetationMaterial, ferns)
  batch('Meadow grasses', grassGeometry, vegetationMaterial, grasses)

  const earthPositions: number[] = []
  const earthColors: number[] = []
  const earthIndices: number[] = []
  const edgeColor = new THREE.Color('#40503a')
  const mossColor = new THREE.Color('#374e30')
  const soilColor = new THREE.Color('#4b4b32')
  const groundColor = new THREE.Color()
  const rings = 16
  const segments = 96
  for (let ring = 0; ring <= rings; ring++) {
    const radius = 7.4 + (ring / rings) * 16.6
    for (let segment = 0; segment <= segments; segment++) {
      const angle = (segment / segments) * Math.PI * 2
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      const height = groundHeight(x, z)
      earthPositions.push(x, height - 0.006, z)
      groundColor.copy(mossColor).lerp(soilColor, 0.3 + 0.3 * Math.sin(angle * 4 + radius))
      groundColor.lerp(edgeColor, ring === 0 || ring === rings ? 1 : 0.15)
      earthColors.push(groundColor.r, groundColor.g, groundColor.b)
      if (ring < rings && segment < segments) {
        const current = ring * (segments + 1) + segment
        const next = current + segments + 1
        earthIndices.push(current, current + 1, next, current + 1, next + 1, next)
      }
    }
  }
  batch(
    'Low earth banks around the clearing',
    geometryFrom(earthPositions, earthColors, earthIndices),
    stoneMaterial,
    [
      placement(
        new THREE.Vector3(),
        new THREE.Vector3(1, 1, 1),
        new THREE.Color(0xffffff),
        new THREE.Quaternion(),
      ),
    ],
  )

  let lastUpdate = -Infinity
  let disposed = false
  return {
    group,
    update(elapsed) {
      if (disposed || !Number.isFinite(elapsed)) return
      if (elapsed >= lastUpdate && elapsed - lastUpdate < 1 / 30) return
      lastUpdate = elapsed
      for (let index = 0; index < crowns.length; index++) {
        const item = crowns[index]
        const wave = Math.sin(elapsed * 0.68 + item.phase)
        const ripple = Math.sin(elapsed * 1.17 + item.phase * 1.7)
        position.copy(item.position)
        position.x += wave * 0.035
        position.y += ripple * 0.012
        position.z += ripple * 0.025
        breeze.setFromEuler(euler.set(ripple * 0.013, 0, wave * 0.019))
        quaternion.copy(item.rotation).multiply(breeze)
        foliage.setMatrixAt(index, matrix.compose(position, quaternion, item.scale))
      }
      foliage.instanceMatrix.needsUpdate = true
    },
    dispose() {
      if (disposed) return
      disposed = true
      group.removeFromParent()
      for (const mesh of meshes) mesh.dispose()
      for (const geometry of geometries) geometry.dispose()
      for (const surface of materials) surface.dispose()
      group.clear()
    },
  }
}
