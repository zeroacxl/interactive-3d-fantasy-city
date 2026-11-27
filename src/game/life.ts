import * as THREE from 'three'
import { G, rng, ISLAND_R } from './consts'
import type { Ctx } from './ctx'
import { mergeSimple } from './ocean'
import type { Mats } from './builder'

const tmp = new THREE.Object3D()

function colored(g: THREE.BufferGeometry, color: number) {
  const c = new THREE.Color(color)
  const n = g.attributes.position.count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r
    arr[i * 3 + 1] = c.g
    arr[i * 3 + 2] = c.b
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  if (!g.index) {
    const idx = new Uint32Array(n)
    for (let i = 0; i < n; i++) idx[i] = i
    g.setIndex(new THREE.BufferAttribute(idx, 1))
  }
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k)
  return g
}
function merge(list: THREE.BufferGeometry[]) {
  // todas indexadas com position/normal/uv/color
  const out = mergeGeos(list)
  return out
}
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
function mergeGeos(list: THREE.BufferGeometry[]) {
  return mergeGeometries(list, false)!
}

function treeGeos() {
  const jit = (g: THREE.IcosahedronGeometry, a: number) => {
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) {
      const k = 1 + Math.sin(p.getX(i) * 5 + p.getY(i) * 3) * a + Math.cos(p.getZ(i) * 4) * a
      p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k)
    }
    g.computeVertexNormals()
    return g
  }
  // árvore redonda
  const r: THREE.BufferGeometry[] = []
  const trunk = new THREE.CylinderGeometry(0.2, 0.34, 3.2, 7)
  trunk.translate(0, 1.6, 0)
  r.push(colored(trunk, 0x8a5a36))
  for (const [x, y, z, s, c] of [
    [0, 4.4, 0, 1.9, 0x3fb34a],
    [1.1, 3.8, 0.3, 1.4, 0x56c85a],
    [-1, 4.0, -0.4, 1.5, 0x2fa04a],
    [0.1, 5.5, 0.2, 1.2, 0x6bd462],
  ] as number[][]) {
    const g = jit(new THREE.IcosahedronGeometry(s, 1), 0.07)
    g.translate(x, y, z)
    r.push(colored(g, c))
  }
  // palmeira
  const p: THREE.BufferGeometry[] = []
  let ox = 0,
    oy = 0,
    tilt = 0
  for (let i = 0; i < 8; i++) {
    const seg = new THREE.CylinderGeometry(0.17 - i * 0.008, 0.2 - i * 0.008, 1.0, 7)
    seg.translate(0, 0.5, 0)
    seg.rotateZ(-tilt)
    seg.translate(ox, oy, 0)
    p.push(colored(seg, i % 2 ? 0x9a7048 : 0xa87c52))
    ox += Math.sin(tilt) * 1.0
    oy += Math.cos(tilt) * 1.0
    tilt += 0.045
  }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2
    const f = new THREE.ConeGeometry(0.55, 4.6, 4)
    f.scale(0.12, 1, 1)
    f.translate(0, 2.3, 0)
    f.rotateZ(-1.15 - (i % 2) * 0.25)
    f.rotateY(a)
    f.translate(ox, oy, 0)
    p.push(colored(f, i % 2 ? 0x3cae4a : 0x58c850))
  }
  for (let i = 0; i < 3; i++) {
    const n = new THREE.SphereGeometry(0.22, 6, 5)
    n.translate(ox + Math.cos(i * 2.1) * 0.3, oy - 0.2, Math.sin(i * 2.1) * 0.3)
    p.push(colored(n, 0x6a4a2a))
  }
  // arbusto
  const b: THREE.BufferGeometry[] = []
  for (const [x, y, z, s, c] of [
    [0, 0.6, 0, 0.8, 0x3cae4a],
    [0.7, 0.5, 0.2, 0.6, 0x4fc058],
    [-0.6, 0.5, -0.2, 0.65, 0x2f9a48],
    [0.1, 0.9, -0.3, 0.55, 0x62cf5e],
  ] as number[][]) {
    const g = jit(new THREE.IcosahedronGeometry(s, 1), 0.08)
    g.translate(x, y, z)
    b.push(colored(g, c))
  }
  for (let i = 0; i < 7; i++) {
    const g = new THREE.SphereGeometry(0.1, 6, 5)
    const a = i * 0.9
    g.translate(Math.cos(a) * 0.8, 0.9 + (i % 3) * 0.2, Math.sin(a) * 0.8)
    b.push(colored(g, [0xff7ab8, 0xffe05a, 0xffffff][i % 3]))
  }
  return { round: merge(r), palm: merge(p), bush: merge(b) }
}

export class Life {
  group = new THREE.Group()
  spray: { pts: THREE.Points; base: THREE.Vector3; ph: Float32Array }[] = []
  wheel = new THREE.Group()
  gondolas: THREE.Group[] = []
  monoCars: THREE.Group[] = []
  bubbles: THREE.InstancedMesh
  bubData: { p: THREE.Vector3; v: THREE.Vector3; s: number }[] = []
  birds: THREE.InstancedMesh
  birdData: { r: number; y: number; a: number; sp: number; cx: number; cz: number }[] = []
  birdTime = { value: 0 }
  sparkle: THREE.Points
  sparkV: Float32Array
  swooshes: THREE.Mesh[] = []
  swTime = { value: 0 }
  tankFish: THREE.InstancedMesh | null = null
  tankData: { tank: number; ph: number; sp: number; fy: number }[] = []
  tanks: Ctx['tanks'] = []
  monoAng = 0
  swMat: THREE.MeshBasicMaterial
  bubMat: THREE.MeshPhysicalMaterial
  sparkMat: THREE.PointsMaterial
  wheelPos = new THREE.Vector3(122, G + 46, 172)

  constructor(c: Ctx, scene: THREE.Scene, T: Record<string, THREE.Texture>, M: Mats) {
    scene.add(this.group)
    const R = rng(55)
    const geos = treeGeos()
    const types: ('round' | 'palm' | 'bush')[] = ['round', 'palm', 'bush']
    for (const ty of types) {
      const list = c.trees.filter((t) => t.type === ty)
      const im = new THREE.InstancedMesh(geos[ty], M.treeLeaf, Math.max(1, list.length))
      im.castShadow = true
      im.receiveShadow = true
      list.forEach((t, i) => {
        tmp.position.set(t.x, t.y, t.z)
        tmp.rotation.set(0, R() * 6.28, 0)
        tmp.scale.setScalar(t.s)
        tmp.updateMatrix()
        im.setMatrixAt(i, tmp.matrix)
        const k = 0.82 + R() * 0.3
        im.setColorAt(i, new THREE.Color(k, k + (R() - 0.5) * 0.1, k - R() * 0.1))
      })
      im.count = list.length
      this.group.add(im)
    }

    // fontes
    for (const f of c.fountains) {
      const n = 180
      const pos = new Float32Array(n * 3)
      const ph = new Float32Array(n)
      for (let i = 0; i < n; i++) ph[i] = R()
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      const pts = new THREE.Points(g, new THREE.PointsMaterial({ map: T.glow, size: 0.45, color: 0xcff6ff, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }))
      pts.frustumCulled = false
      this.group.add(pts)
      this.spray.push({ pts, base: f, ph })
    }

    // roda gigante
    const wp = this.wheelPos
    const wheelRoot = new THREE.Group()
    wheelRoot.position.copy(wp)
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.6, envMapIntensity: 1.3 })
    for (const z of [-1.6, 1.6]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(38, 0.55, 8, 72), rimMat)
      rim.position.z = z
      this.wheel.add(rim)
      const rim2 = new THREE.Mesh(new THREE.TorusGeometry(26, 0.3, 6, 56), rimMat)
      rim2.position.z = z
      this.wheel.add(rim2)
    }
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 38, 5), rimMat)
      sp.position.set(Math.cos(a) * 19, Math.sin(a) * 19, 0)
      sp.rotation.z = a - Math.PI / 2
      this.wheel.add(sp)
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 4.2, 18).rotateX(Math.PI / 2), rimMat)
    this.wheel.add(hub)
    const lights = new THREE.InstancedMesh(new THREE.SphereGeometry(0.4, 8, 6), new THREE.MeshBasicMaterial({ toneMapped: false }), 48)
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2
      tmp.position.set(Math.cos(a) * 38, Math.sin(a) * 38, i % 2 ? 1.6 : -1.6)
      tmp.rotation.set(0, 0, 0)
      tmp.scale.setScalar(1)
      tmp.updateMatrix()
      lights.setMatrixAt(i, tmp.matrix)
      lights.setColorAt(i, new THREE.Color().setHSL(i / 48, 1, 0.65))
    }
    this.wheel.add(lights)
    wheelRoot.add(this.wheel)
    const gMat = new THREE.MeshStandardMaterial({ color: 0xb8ecff, transparent: true, opacity: 0.4, roughness: 0.05, envMapIntensity: 2, side: THREE.DoubleSide })
    for (let i = 0; i < 16; i++) {
      const gg = new THREE.Group()
      const cab = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 2.2, 14), gMat)
      cab.position.y = -3
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 1.9, 0.7, 14), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(i / 16, 0.85, 0.6), roughness: 0.3 }))
      roof.position.y = -1.7
      const flo = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.2, 14), rimMat)
      flo.position.y = -4.1
      gg.add(cab, roof, flo)
      this.gondolas.push(gg)
      wheelRoot.add(gg)
    }
    for (const s of [-1, 1])
      for (const z of [-4, 4]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 47, 8), rimMat)
        leg.position.set(wp.x + s * 8, G + 22.5, wp.z + z)
        leg.rotation.z = -s * Math.atan(16 / 46)
        this.group.add(leg)
        c.lv.discs.push({ x: wp.x + s * 16, z: wp.z + z, r: 1.2, y0: G, y1: G + 6 })
      }
    this.group.add(wheelRoot)
    c.lv.lamps.push({ x: wp.x, y: G + 8, z: wp.z + 8, color: 0xff9ad0, intensity: 40, night: true })

    // monotrilho
    const trackR = 358
    const track = new THREE.Mesh(new THREE.TorusGeometry(trackR, 1.1, 6, 260).rotateX(Math.PI / 2), M.frameP)
    track.position.y = 16
    track.castShadow = true
    this.group.add(track)
    const pil = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.9, 1.3, 15, 8), M.frameP, 48)
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2
      tmp.position.set(Math.cos(a) * trackR, G + 7.5, Math.sin(a) * trackR)
      tmp.rotation.set(0, 0, 0)
      tmp.scale.setScalar(1)
      tmp.updateMatrix()
      pil.setMatrixAt(i, tmp.matrix)
    }
    this.group.add(pil)
    const carBody = new THREE.CapsuleGeometry(1.7, 10, 6, 14).rotateZ(Math.PI / 2)
    const carM = new THREE.MeshStandardMaterial({ color: 0xf4fcff, roughness: 0.12, metalness: 0.2, envMapIntensity: 1.5 })
    const stripeM = new THREE.MeshBasicMaterial({ color: 0x4fd8ff, toneMapped: false })
    const winM = new THREE.MeshStandardMaterial({ color: 0x103a55, roughness: 0.05, metalness: 0.6, envMapIntensity: 2 })
    for (let i = 0; i < 5; i++) {
      const g = new THREE.Group()
      const b = new THREE.Mesh(carBody, carM)
      b.scale.set(1, 0.85, 1)
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(11, 0.25, 3.45), stripeM)
      stripe.position.y = -0.2
      const win = new THREE.Mesh(new THREE.BoxGeometry(9, 0.8, 3.5), winM)
      win.position.y = 0.55
      g.add(b, stripe, win)
      this.monoCars.push(g)
      this.group.add(g)
    }

    // bolhas aero
    this.bubMat = new THREE.MeshPhysicalMaterial({ color: 0xbff0ff, transparent: true, opacity: 0.2, roughness: 0, metalness: 0, iridescence: 1, iridescenceIOR: 1.5, envMapIntensity: 3, depthWrite: false })
    const NB = 110
    this.bubbles = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 20, 14), this.bubMat, NB)
    this.bubbles.frustumCulled = false
    for (let i = 0; i < NB; i++) {
      this.bubData.push({
        p: new THREE.Vector3((R() - 0.5) * 300, 3 + R() * 110, (R() - 0.5) * 300),
        v: new THREE.Vector3((R() - 0.5) * 1.2, 0.3 + R() * 0.8, (R() - 0.5) * 1.2),
        s: R() < 0.12 ? 5 + R() * 8 : 0.5 + R() * 2.2,
      })
    }
    this.group.add(this.bubbles)

    // pássaros
    const bg = new THREE.BufferGeometry()
    bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0.1, -1.3, 0, -0.3, -0.7, 0, 0.5, 0, 0, 0.1, 0.7, 0, 0.5, 1.3, 0, -0.3]), 3))
    const bm = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, fog: true })
    bm.onBeforeCompile = (s) => {
      s.uniforms.uTime = this.birdTime
      s.vertexShader =
        'uniform float uTime;\n' +
        s.vertexShader.replace(
          '#include <begin_vertex>',
          `vec3 transformed = vec3(position); float ph = 0.0;
          #ifdef USE_INSTANCING
          ph = instanceMatrix[3].x*0.05;
          #endif
          transformed.y += abs(position.x)*sin(uTime*7.0+ph)*0.6;`
        )
    }
    this.birds = new THREE.InstancedMesh(bg, bm, 26)
    this.birds.frustumCulled = false
    for (let i = 0; i < 26; i++) this.birdData.push({ r: 60 + R() * 200, y: 45 + R() * 70, a: R() * 6.28, sp: (0.05 + R() * 0.05) * (R() < 0.7 ? 1 : -1), cx: (R() - 0.5) * 120, cz: (R() - 0.5) * 120 })
    this.group.add(this.birds)

    // brilhos
    const NS = 260
    const sp = new Float32Array(NS * 3)
    this.sparkV = new Float32Array(NS)
    for (let i = 0; i < NS; i++) {
      sp[i * 3] = (R() - 0.5) * 60
      sp[i * 3 + 1] = R() * 20
      sp[i * 3 + 2] = (R() - 0.5) * 60
      this.sparkV[i] = 0.2 + R() * 0.6
    }
    const sg = new THREE.BufferGeometry()
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3))
    this.sparkMat = new THREE.PointsMaterial({ map: T.glow, size: 0.35, color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending })
    this.sparkle = new THREE.Points(sg, this.sparkMat)
    this.sparkle.frustumCulled = false
    this.group.add(this.sparkle)

    // swooshes
    this.swMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })
    this.swMat.onBeforeCompile = (s) => {
      s.uniforms.uTime = this.swTime
      s.vertexShader = 'uniform float uTime;\n' + s.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = vec3(position); transformed.y += sin(uTime*0.4 + position.x*0.012 + position.z*0.01)*7.0;')
    }
    for (let k = 0; k < 6; k++) {
      const pts: THREE.Vector3[] = []
      const r0 = 280 + R() * 300,
        a0 = R() * 6.28,
        y0 = 90 + R() * 260
      for (let i = 0; i < 12; i++) {
        const a = a0 + i * 0.14
        pts.push(new THREE.Vector3(Math.cos(a) * (r0 + i * 8), y0 + Math.sin(i * 0.5 + k) * 50 + i * 6, Math.sin(a) * (r0 + i * 8)))
      }
      const curve = new THREE.CatmullRomCurve3(pts)
      const seg = 90
      const pos: number[] = [],
        col: number[] = [],
        idx: number[] = []
      const up = new THREE.Vector3(0, 1, 0)
      const cc = new THREE.Color()
      for (let i = 0; i <= seg; i++) {
        const t = i / seg
        const p = curve.getPointAt(t)
        const tg = curve.getTangentAt(t)
        const bn = new THREE.Vector3().crossVectors(tg, up).normalize()
        const nn = new THREE.Vector3().crossVectors(tg, bn).normalize()
        const tw = t * 5 + k
        const w = new THREE.Vector3().addScaledVector(bn, Math.cos(tw)).addScaledVector(nn, Math.sin(tw))
        const width = Math.sin(t * Math.PI) * (10 + k * 2)
        cc.setHSL(0.5 - t * 0.2 + k * 0.02, 0.9, 0.55).multiplyScalar(Math.sin(t * Math.PI) * 0.9)
        for (const s of [-1, 1]) {
          pos.push(p.x + w.x * width * s, p.y + w.y * width * s, p.z + w.z * width * s)
          const edge = s < 0 ? 1 : 0.3
          col.push(cc.r * edge, cc.g * edge, cc.b * edge)
        }
        if (i < seg) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2)
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
      g.setIndex(idx)
      const m = new THREE.Mesh(g, this.swMat)
      m.frustumCulled = false
      this.swooshes.push(m)
      this.group.add(m)
    }

    // peixes de aquário
    this.tanks = c.tanks
    if (c.tanks.length) {
      const fg: THREE.BufferGeometry[] = []
      const body = new THREE.SphereGeometry(0.5, 8, 6)
      body.scale(1, 0.45, 0.28)
      fg.push(body)
      const tail = new THREE.ConeGeometry(0.22, 0.45, 4)
      tail.rotateZ(-Math.PI / 2)
      tail.scale(1, 1, 0.25)
      tail.translate(-0.68, 0, 0)
      fg.push(tail)
      const per = 5
      this.tankFish = new THREE.InstancedMesh(mergeSimple(fg), new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.3 }), c.tanks.length * per)
      this.tankFish.frustumCulled = false
      c.tanks.forEach((_t, ti) => {
        for (let k = 0; k < per; k++) {
          this.tankData.push({ tank: ti, ph: R() * 6.28, sp: 0.3 + R() * 0.5, fy: R() })
          this.tankFish!.setColorAt(ti * per + k, new THREE.Color([0xff8a2a, 0xffd23a, 0x35c8ff, 0xff4f8a, 0x6dff9a][k % 5]))
        }
      })
      this.group.add(this.tankFish)
    }
    void ISLAND_R
  }

  update(dt: number, t: number, pp: THREE.Vector3, st: { day: number; night: number; storm: number; underwater: number; outdoors: number }) {
    this.birdTime.value = t
    this.swTime.value = t
    // fontes
    for (const s of this.spray) {
      if (pp.distanceTo(s.base) > 120) {
        s.pts.visible = false
        continue
      }
      s.pts.visible = true
      const a = s.pts.geometry.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < a.count; i++) {
        const u = (t * 0.55 + s.ph[i]) % 1
        const ang = s.ph[i] * 40
        const sp = 1.2 + (s.ph[i] * 7 % 1) * 2.2
        const h = u * 1.9
        a.setXYZ(i, s.base.x + Math.cos(ang) * sp * u, s.base.y + 1.2 + 6 * h * (1 - h * 0.55) - 1.2 + 0.0, s.base.z + Math.sin(ang) * sp * u)
      }
      a.needsUpdate = true
    }
    // roda
    this.wheel.rotation.z = t * 0.06
    this.gondolas.forEach((g, i) => {
      const a = (i / 16) * Math.PI * 2 + this.wheel.rotation.z
      g.position.set(Math.cos(a) * 38, Math.sin(a) * 38, 0)
    })
    // monotrilho
    this.monoAng = t * 0.05
    this.monoCars.forEach((g, i) => {
      const a = this.monoAng - i * 0.037
      g.position.set(Math.cos(a) * 358, 16 + 2.4, Math.sin(a) * 358)
      g.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a)) * 1
    })
    // bolhas
    const vis = st.underwater < 0.5
    this.bubbles.visible = vis
    if (vis) {
      this.bubMat.opacity = 0.14 + 0.1 * st.day
      for (let i = 0; i < this.bubData.length; i++) {
        const b = this.bubData[i]
        b.p.x += b.v.x * dt
        b.p.y += b.v.y * dt
        b.p.z += b.v.z * dt
        if (b.p.x - pp.x > 160) b.p.x -= 320
        if (b.p.x - pp.x < -160) b.p.x += 320
        if (b.p.z - pp.z > 160) b.p.z -= 320
        if (b.p.z - pp.z < -160) b.p.z += 320
        if (b.p.y > pp.y + 130) b.p.y = Math.max(2, pp.y - 30)
        if (b.p.y < pp.y - 60 && pp.y > 60) b.p.y = pp.y + 80
        tmp.position.copy(b.p)
        tmp.rotation.set(0, 0, 0)
        tmp.scale.setScalar(b.s * (1 + Math.sin(t * 1.5 + i) * 0.04))
        tmp.updateMatrix()
        this.bubbles.setMatrixAt(i, tmp.matrix)
      }
      this.bubbles.instanceMatrix.needsUpdate = true
    }
    // pássaros
    this.birds.visible = st.day > 0.3 && st.storm < 0.5 && st.underwater < 0.5
    if (this.birds.visible) {
      for (let i = 0; i < this.birdData.length; i++) {
        const b = this.birdData[i]
        const a = b.a + t * b.sp
        tmp.position.set(b.cx + Math.cos(a) * b.r, b.y + Math.sin(t * 0.3 + i) * 4, b.cz + Math.sin(a) * b.r)
        tmp.rotation.set(0, Math.atan2(-Math.cos(a) * Math.sign(b.sp), Math.sin(a) * Math.sign(b.sp)) + Math.PI, Math.sin(t * 0.5 + i) * 0.2)
        tmp.scale.setScalar(1.6)
        tmp.updateMatrix()
        this.birds.setMatrixAt(i, tmp.matrix)
      }
      this.birds.instanceMatrix.needsUpdate = true
    }
    // brilhos
    this.sparkle.visible = st.underwater < 0.5
    if (this.sparkle.visible) {
      const a = this.sparkle.geometry.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < a.count; i++) {
        let x = a.getX(i) + Math.sin(t * 0.7 + i) * dt * 0.8
        let y = a.getY(i) + this.sparkV[i] * dt * 0.7
        let z = a.getZ(i) + Math.cos(t * 0.6 + i * 1.3) * dt * 0.8
        if (x - pp.x > 30) x -= 60
        if (x - pp.x < -30) x += 60
        if (z - pp.z > 30) z -= 60
        if (z - pp.z < -30) z += 60
        if (y - pp.y > 22) y = pp.y - 4
        if (y - pp.y < -6) y = pp.y + 16
        a.setXYZ(i, x, y, z)
      }
      a.needsUpdate = true
      this.sparkMat.color.setHex(st.night > 0.5 ? 0xe8ff7a : 0xffffff)
      this.sparkMat.size = 0.25 + st.night * 0.35
      this.sparkMat.opacity = (0.35 + 0.4 * st.night) * st.outdoors
    }
    this.swMat.opacity = (0.12 + 0.35 * st.day) * (st.underwater < 0.5 ? 1 : 0) * (1 - st.storm * 0.7)

    // peixes de aquário
    if (this.tankFish) {
      for (let i = 0; i < this.tankData.length; i++) {
        const d = this.tankData[i]
        const tk = this.tanks[d.tank]
        const u = 0.5 + 0.5 * Math.sin(t * d.sp + d.ph)
        const du = Math.cos(t * d.sp + d.ph)
        tmp.position.set(tk.x0 + (tk.x1 - tk.x0) * u, tk.y0 + (tk.y1 - tk.y0) * (0.2 + 0.6 * d.fy + 0.12 * Math.sin(t * 0.9 + d.ph)), tk.z0 + (tk.z1 - tk.z0) * (0.5 + 0.5 * Math.sin(t * d.sp * 0.7 + d.ph * 2)))
        tmp.rotation.set(0, du >= 0 ? 0 : Math.PI, 0)
        tmp.scale.setScalar(0.28)
        tmp.updateMatrix()
        this.tankFish.setMatrixAt(i, tmp.matrix)
      }
      this.tankFish.instanceMatrix.needsUpdate = true
    }
  }
}
