import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Level, Mat } from './physics'

export interface Shared {
  time: { value: number }
  night: { value: number }
  glow: { value: number }
}

export function glassify(m: THREE.MeshStandardMaterial, boost = 1) {
  m.onBeforeCompile = (s) => {
    s.fragmentShader = s.fragmentShader.replace(
      '#include <opaque_fragment>',
      `
      float refl = dot(reflectedLight.indirectSpecular + reflectedLight.directSpecular, vec3(0.333)) * ${boost.toFixed(2)};
      gl_FragColor = vec4(outgoingLight, clamp(diffuseColor.a + refl, 0.0, 1.0));`
    )
  }
  m.customProgramCacheKey = () => 'glassify' + boost
}

export function emissiveFromDiffuse(m: THREE.MeshStandardMaterial, glow: { value: number }) {
  m.onBeforeCompile = (s) => {
    s.uniforms.uGlow = glow
    s.fragmentShader =
      'uniform float uGlow;\n' + s.fragmentShader.replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance = diffuseColor.rgb * uGlow;')
  }
  m.customProgramCacheKey = () => 'emDiffuse'
}

export function sway(m: THREE.Material, time: { value: number }, amp: number) {
  m.onBeforeCompile = (s) => {
    s.uniforms.uTime = time
    s.vertexShader =
      'uniform float uTime;\n' +
      s.vertexShader.replace(
        '#include <begin_vertex>',
        `vec3 transformed = vec3(position);
        float sw = max(position.y, 0.0);
        #ifdef USE_INSTANCING
        vec2 ip = instanceMatrix[3].xz;
        #else
        vec2 ip = vec2(0.0);
        #endif
        transformed.x += sin(uTime*1.3 + ip.x*0.15 + ip.y*0.11 + position.y*0.5)*sw*${amp.toFixed(3)};
        transformed.z += cos(uTime*1.1 + ip.y*0.13 + position.y*0.4)*sw*${(amp * 0.7).toFixed(3)};`
      )
  }
  m.customProgramCacheKey = () => 'sway' + amp
}

export type Mats = Record<string, THREE.Material>

export function makeMaterials(T: Record<string, THREE.Texture>, sh: Shared) {
  const rep = (t: THREE.Texture) => t
  const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ vertexColors: true, ...p })
  const M: Mats = {}
  M.plaster = std({ map: rep(T.plaster), roughness: 0.75 })
  M.concrete = std({ map: rep(T.plaster), roughness: 0.6, metalness: 0.05 })
  M.tile = std({ map: rep(T.tiles), roughness: 0.14, metalness: 0.05, envMapIntensity: 0.9 })
  M.plaza = std({ map: rep(T.plaza), roughness: 0.22, envMapIntensity: 0.7 })
  M.marble = std({ map: rep(T.marble), roughness: 0.1, metalness: 0.05, envMapIntensity: 1 })
  M.wood = std({ map: rep(T.wood), roughness: 0.5 })
  M.roof = std({ map: rep(T.roof), roughness: 0.55 })
  M.frame = std({ roughness: 0.3, metalness: 0.3, envMapIntensity: 1.3 })
  M.fabric = std({ roughness: 0.92 })
  M.gloss = std({ roughness: 0.12, metalness: 0.0, envMapIntensity: 1.2 })
  M.leaf = std({ roughness: 0.55, side: THREE.DoubleSide })
  M.bark = std({ roughness: 0.9 })
  M.rug = std({ map: rep(T.rug), roughness: 1 })
  M.road = std({ map: rep(T.road), roughness: 0.4, metalness: 0.1, envMapIntensity: 0.8 })
  M.grassy = std({ map: rep(T.grass), roughness: 0.95 })
  M.neon = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })
  M.screen = new THREE.MeshBasicMaterial({ map: T.bliss, toneMapped: false })
  M.water = new THREE.MeshStandardMaterial({
    vertexColors: true,
    color: 0xffffff,
    transparent: true,
    opacity: 0.78,
    roughness: 0.05,
    envMapIntensity: 1.4,
  })

  const glass = new THREE.MeshStandardMaterial({
    map: T.glass,
    emissiveMap: T.glassEm,
    emissive: 0xffffff,
    emissiveIntensity: 0,
    vertexColors: true,
    transparent: true,
    roughness: 0.04,
    metalness: 0.0,
    envMapIntensity: 1.6,
    depthWrite: false,
  })
  glassify(glass, 1.3)
  M.glass = glass
  const solid = new THREE.MeshStandardMaterial({
    map: T.solid,
    emissiveMap: T.solidEm,
    emissive: 0xffffff,
    emissiveIntensity: 0,
    vertexColors: true,
    roughness: 0.08,
    metalness: 0.35,
    envMapIntensity: 1.5,
  })
  M.solid = solid
  const pane = new THREE.MeshStandardMaterial({
    color: 0xbfeaff,
    vertexColors: true,
    transparent: true,
    opacity: 0.22,
    roughness: 0.03,
    envMapIntensity: 1.6,
    depthWrite: false,
  })
  glassify(pane, 1.5)
  M.pane = pane
  const tint = new THREE.MeshStandardMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.3,
    roughness: 0.03,
    envMapIntensity: 1.6,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  glassify(tint, 1.4)
  M.tint = tint
  const orb = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.2, metalness: 0.0, envMapIntensity: 1.4 })
  emissiveFromDiffuse(orb, sh.glow)
  M.glowy = orb
  const orbI = new THREE.MeshStandardMaterial({ roughness: 0.2, envMapIntensity: 1.4 })
  emissiveFromDiffuse(orbI, sh.glow)
  M.glowyI = orbI
  M.leafP = new THREE.MeshStandardMaterial({ roughness: 0.55, side: THREE.DoubleSide })
  M.frameP = new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.3, envMapIntensity: 1.3 })
  M.plazaP = new THREE.MeshStandardMaterial({ map: rep(T.plaza), roughness: 0.22, envMapIntensity: 0.7 })
  M.treeLeaf = std({ roughness: 0.6, flatShading: false })
  sway(M.treeLeaf, sh.time, 0.012)
  return M
}

export function boxGeo(w: number, h: number, d: number, tile = 4, uo = 0, vo = 0) {
  const g = new THREE.BoxGeometry(w, h, d)
  const uv = g.attributes.uv
  const dims = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ]
  for (let f = 0; f < 6; f++)
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i
      uv.setXY(k, (uv.getX(k) * dims[f][0]) / tile + uo, (uv.getY(k) * dims[f][1]) / tile + vo)
    }
  return g
}

export function prismGeo(len: number, depth: number, rise: number, tile = 4) {
  // prisma triangular (cumeeira ao longo de X)
  const s = new THREE.Shape()
  s.moveTo(-depth / 2, 0)
  s.lineTo(depth / 2, 0)
  s.lineTo(0, rise)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false })
  g.translate(0, 0, -len / 2)
  g.rotateY(Math.PI / 2)
  const uv = g.attributes.uv
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / tile, uv.getY(i) / tile)
  return g
}

export class Batcher {
  buckets = new Map<string, THREE.BufferGeometry[]>()
  add(mat: string, geo: THREE.BufferGeometry, color: THREE.ColorRepresentation = 0xffffff) {
    for (const n of Object.keys(geo.attributes)) if (n !== 'position' && n !== 'normal' && n !== 'uv') geo.deleteAttribute(n)
    const cnt = geo.attributes.position.count
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(cnt * 2), 2))
    if (!geo.index) {
      const idx = new Uint32Array(cnt)
      for (let i = 0; i < cnt; i++) idx[i] = i
      geo.setIndex(new THREE.BufferAttribute(idx, 1))
    }
    const c = new THREE.Color(color)
    const arr = new Float32Array(cnt * 3)
    for (let i = 0; i < cnt; i++) {
      arr[i * 3] = c.r
      arr[i * 3 + 1] = c.g
      arr[i * 3 + 2] = c.b
    }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3))
    let l = this.buckets.get(mat)
    if (!l) this.buckets.set(mat, (l = []))
    l.push(geo)
  }
  finish(parent: THREE.Object3D, M: Mats) {
    for (const [k, list] of this.buckets) {
      const g = mergeGeometries(list, false)
      list.forEach((x) => x.dispose())
      if (!g) continue
      const mat = M[k]
      const mesh = new THREE.Mesh(g, mat)
      const tr = (mat as THREE.Material).transparent
      mesh.castShadow = !tr && k !== 'neon' && k !== 'water'
      mesh.receiveShadow = !tr
      mesh.name = 'batch_' + k
      parent.add(mesh)
    }
    this.buckets.clear()
  }
}

export interface Opening {
  c: number
  w: number
  sill: number
  top: number
  kind: 'door' | 'window'
}

export class Local {
  c: number
  s: number
  constructor(
    public B: Batcher,
    public lv: Level,
    public ox: number,
    public oy: number,
    public oz: number,
    public rot: number
  ) {
    this.c = Math.cos(rot)
    this.s = Math.sin(rot)
  }
  w(lx: number, lz: number): [number, number] {
    return [this.ox + lx * this.c + lz * this.s, this.oz - lx * this.s + lz * this.c]
  }
  sub(x: number, y: number, z: number, rot = 0) {
    const [wx, wz] = this.w(x, z)
    return new Local(this.B, this.lv, wx, this.oy + y, wz, this.rot + rot)
  }
  // caixa: (x,z) centro, y base
  box(mat: string, x: number, y: number, z: number, w: number, h: number, d: number, color: THREE.ColorRepresentation = 0xffffff, tile = 4, ry = 0, uo = 0, vo = 0) {
    const g = boxGeo(w, h, d, tile, uo, vo)
    g.rotateY(ry + this.rot)
    const [wx, wz] = this.w(x, z)
    g.translate(wx, this.oy + y + h / 2, wz)
    this.B.add(mat, g, color)
  }
  cyl(mat: string, x: number, y: number, z: number, rTop: number, rBot: number, h: number, color: THREE.ColorRepresentation = 0xffffff, seg = 14) {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, seg)
    const [wx, wz] = this.w(x, z)
    g.translate(wx, this.oy + y + h / 2, wz)
    this.B.add(mat, g, color)
  }
  sph(mat: string, x: number, y: number, z: number, r: number, color: THREE.ColorRepresentation = 0xffffff, sy = 1, ws = 12, hs = 8) {
    const g = new THREE.SphereGeometry(r, ws, hs)
    g.scale(1, sy, 1)
    const [wx, wz] = this.w(x, z)
    g.translate(wx, this.oy + y, wz)
    this.B.add(mat, g, color)
  }
  geo(mat: string, g: THREE.BufferGeometry, x: number, y: number, z: number, color: THREE.ColorRepresentation = 0xffffff, ry = 0) {
    g.rotateY(ry + this.rot)
    const [wx, wz] = this.w(x, z)
    g.translate(wx, this.oy + y, wz)
    this.B.add(mat, g, color)
  }
  col(x0: number, z0: number, x1: number, z1: number, y0: number, y1: number) {
    const [ax, az] = this.w(x0, z0)
    const [bx, bz] = this.w(x1, z1)
    this.lv.boxes.push({ minX: Math.min(ax, bx), maxX: Math.max(ax, bx), minZ: Math.min(az, bz), maxZ: Math.max(az, bz), y0: this.oy + y0, y1: this.oy + y1 })
  }
  toLocal(wx: number, wz: number): [number, number] {
    const dx = wx - this.ox,
      dz = wz - this.oz
    return [dx * this.c - dz * this.s, dx * this.s + dz * this.c]
  }
  // y: número ou função em coordenadas LOCAIS
  surf(x0: number, z0: number, x1: number, z1: number, y: number | ((lx: number, lz: number) => number), mat: Mat = 'tile') {
    const [ax, az] = this.w(x0, z0)
    const [bx, bz] = this.w(x1, z1)
    const oy = this.oy
    this.lv.surfaces.push({
      minX: Math.min(ax, bx),
      maxX: Math.max(ax, bx),
      minZ: Math.min(az, bz),
      maxZ: Math.max(az, bz),
      y:
        typeof y === 'number'
          ? oy + y
          : (wx: number, wz: number) => {
              const [lx, lz] = this.toLocal(wx, wz)
              return oy + y(lx, lz)
            },
      mat,
    })
  }
  lamp(x: number, y: number, z: number, color: number, intensity: number, night = false) {
    const [wx, wz] = this.w(x, z)
    this.lv.lamps.push({ x: wx, y: this.oy + y, z: wz, color, intensity, night })
  }
  zone(x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, kind: 'indoor' = 'indoor') {
    const [ax, az] = this.w(x0, z0)
    const [bx, bz] = this.w(x1, z1)
    const minX = Math.min(ax, bx),
      maxX = Math.max(ax, bx),
      minZ = Math.min(az, bz),
      maxZ = Math.max(az, bz)
    const a = this.oy + y0,
      b = this.oy + y1
    this.lv.zones.push({ kind, test: (x, y, z) => x > minX && x < maxX && z > minZ && z < maxZ && y > a && y < b })
  }

  // parede ao longo de X (z0==z1) ou Z (x0==x1), com aberturas
  wall(o: { mat: string; a: [number, number]; b: [number, number]; y0: number; y1: number; th: number; open?: Opening[]; color?: THREE.ColorRepresentation; glass?: string; tile?: number; uo?: number; vo?: number; collide?: boolean }) {
    const alongX = Math.abs(o.a[1] - o.b[1]) < 1e-6
    const s0 = alongX ? Math.min(o.a[0], o.b[0]) : Math.min(o.a[1], o.b[1])
    const s1 = alongX ? Math.max(o.a[0], o.b[0]) : Math.max(o.a[1], o.b[1])
    const fixed = alongX ? o.a[1] : o.a[0]
    const color = o.color ?? 0xffffff
    const tile = o.tile ?? 4
    const th = o.th
    const seg = (p0: number, p1: number, ya: number, yb: number, mat: string, t = th) => {
      if (p1 - p0 < 0.01 || yb - ya < 0.01) return
      if (alongX) this.box(mat, (p0 + p1) / 2, ya, fixed, p1 - p0, yb - ya, t, color, tile, 0, (o.uo ?? 0) + p0 / tile, (o.vo ?? 0) + (ya - o.y0) / tile)
      else this.box(mat, fixed, ya, (p0 + p1) / 2, t, yb - ya, p1 - p0, color, tile, 0, (o.uo ?? 0) + p0 / tile, (o.vo ?? 0) + (ya - o.y0) / tile)
    }
    const col = (p0: number, p1: number, ya: number, yb: number) => {
      if (o.collide === false || p1 - p0 < 0.01) return
      if (alongX) this.col(p0, fixed - th / 2, p1, fixed + th / 2, ya, yb)
      else this.col(fixed - th / 2, p0, fixed + th / 2, p1, ya, yb)
    }
    const ops = (o.open ?? []).slice().sort((p, q) => p.c - q.c)
    let cur = s0
    for (const op of ops) {
      const st = op.c - op.w / 2,
        en = op.c + op.w / 2
      seg(cur, st, o.y0, o.y1, o.mat)
      col(cur, st, o.y0, o.y1)
      seg(st, en, o.y0, o.y0 + op.sill, o.mat)
      seg(st, en, o.y0 + op.top, o.y1, o.mat)
      if (op.kind === 'window') {
        seg(st, en, o.y0 + op.sill, o.y0 + op.top, o.glass ?? 'pane', 0.06)
        col(st, en, o.y0, o.y1)
      } else col(st, en, o.y0 + op.top, o.y1)
      cur = en
    }
    seg(cur, s1, o.y0, o.y1, o.mat)
    col(cur, s1, o.y0, o.y1)
  }
}
