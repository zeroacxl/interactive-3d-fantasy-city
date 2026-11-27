import * as THREE from 'three'
import { terrainHeight, ISLAND_R, DOME, domeDist, fbm, smooth, G, POND_Y } from './consts'

export function createTerrain(T: Record<string, THREE.Texture>) {
  const SIZE = 1700,
    SEG = 425
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG)
  geo.rotateX(-Math.PI / 2)
  const p = geo.attributes.position
  const col = new Float32Array(p.count * 3)
  const sand = new Float32Array(p.count)
  const c = new THREE.Color()
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      z = p.getZ(i)
    const h = terrainHeight(x, z)
    p.setY(i, h)
    const r = Math.hypot(x, z)
    let s = smooth(ISLAND_R - 22, ISLAND_R - 4, r)
    if (h < POND_Y + 0.8 && domeDist(x, z) < DOME.r) s = Math.max(s, 0.7)
    sand[i] = s
    const n = 0.85 + fbm(x * 0.05, z * 0.05) * 0.35
    c.setRGB(n, n, n)
    if (h < 0) {
      const d = smooth(0, -30, h)
      c.lerp(new THREE.Color(0.28, 0.55, 0.68), d * 0.85)
    }
    if (domeDist(x, z) < DOME.r) c.multiplyScalar(1.08).lerp(new THREE.Color(0.7, 1.15, 0.7), 0.35)
    col[i * 3] = c.r
    col[i * 3 + 1] = c.g
    col[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  geo.setAttribute('aSand', new THREE.BufferAttribute(sand, 1))
  geo.computeVertexNormals()
  const g = T.grass.clone()
  g.repeat.set(SIZE / 7, SIZE / 7)
  g.needsUpdate = true
  const sandT = T.sand.clone()
  sandT.repeat.copy(g.repeat)
  sandT.needsUpdate = true
  const mat = new THREE.MeshStandardMaterial({ map: g, vertexColors: true, roughness: 0.95 })
  mat.onBeforeCompile = (s) => {
    s.uniforms.uSand = { value: sandT }
    s.vertexShader = 'attribute float aSand; varying float vSand;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvSand = aSand;')
    s.fragmentShader =
      'uniform sampler2D uSand; varying float vSand;\n' +
      s.fragmentShader.replace('#include <map_fragment>', 'vec4 gt = texture2D(map, vMapUv); vec4 stt = texture2D(uSand, vMapUv); diffuseColor *= mix(gt, stt, vSand);')
  }
  const mesh = new THREE.Mesh(geo, mat)
  mesh.receiveShadow = true
  mesh.name = 'terrain'

  const far = new THREE.Mesh(
    new THREE.PlaneGeometry(20000, 20000).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x2f7c94, roughness: 1 })
  )
  far.position.y = -39.4
  return { mesh, far, G }
}
