import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { DOME, POND, HILL, POND_Y, G, terrainHeight as th, rng, domeDist } from './consts'
import type { Ctx } from './ctx'
import { glassify, sway } from './builder'
import { signTexture } from './textures'
import { mergeSimple } from './ocean'
import * as F from './furniture'
import type { Player } from './physics'

const tmp = new THREE.Object3D()
const VIVID = [0xff5fa8, 0xffd23a, 0x5fd8ff, 0xb87bff, 0xff8a3a, 0x7dff6a, 0xff6a6a, 0xffffff]

export class Dome {
  fallPos = new THREE.Vector3()
  onChime: (i: number) => void = () => {}
  onSplash: () => void = () => {}
  onMsg: (s: string) => void = () => {}
  fallTex: THREE.Texture
  flowers: { x: number; y: number; z: number; pulse: number; base: THREE.Color; i: number }[] = []
  flowerHeads: THREE.InstancedMesh
  mush: { x: number; z: number; pulse: number; cool: number; base: THREE.Color }[] = []
  mushCaps: THREE.InstancedMesh
  butter: THREE.InstancedMesh
  butData: { home: THREE.Vector3; ph: number; sp: number }[] = []
  koi: THREE.InstancedMesh
  koiData: { a: number; r: number; sp: number; ph: number }[] = []
  koiAttract = 0
  lanterns: THREE.InstancedMesh
  lanData: THREE.Vector3[] = []
  spores: THREE.Points
  sporeV: Float32Array
  mist: THREE.Points
  mistT: Float32Array
  butterTime = { value: 0 }
  chimes: THREE.Mesh[] = []
  pavY = 0

  constructor(
    c: Ctx,
    waterMat: THREE.Material,
    sh: { time: { value: number } }
  ) {
    const { B, lv, M, T, scene } = c
    const R = rng(909)
    const rr = DOME.r,
      cx = DOME.x,
      cz = DOME.z

    // ---------- vidro ----------
    const sg = new THREE.SphereGeometry(rr, 96, 24, 0, Math.PI * 2, 0, Math.PI / 2)
    const idx = sg.index!
    const pos = sg.attributes.position
    const keep: number[] = []
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i),
        b = idx.getX(i + 1),
        d = idx.getX(i + 2)
      const mx = (pos.getX(a) + pos.getX(b) + pos.getX(d)) / 3,
        my = (pos.getY(a) + pos.getY(b) + pos.getY(d)) / 3,
        mz = (pos.getZ(a) + pos.getZ(b) + pos.getZ(d)) / 3
      const ang = Math.atan2(mz, mx)
      const da = Math.abs(Math.atan2(Math.sin(ang - Math.PI), Math.cos(ang - Math.PI)))
      if (da < 0.05 && my < 5) continue
      keep.push(a, b, d)
    }
    sg.setIndex(keep)
    const uv = sg.attributes.uv
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 22, uv.getY(i) * 5)
    const gm = new THREE.MeshStandardMaterial({ map: T.hexglass, color: 0xd8f4ff, transparent: true, roughness: 0.02, envMapIntensity: 2.4, side: THREE.DoubleSide, depthWrite: false })
    glassify(gm, 2.2)
    const dome = new THREE.Mesh(sg, gm)
    dome.position.set(cx, G, cz)
    dome.renderOrder = 1
    scene.add(dome)

    // costelas
    const toWorld = (g: THREE.BufferGeometry) => g.translate(cx, G, cz)
    for (let k = 0; k < 28; k++) {
      const phi = (k / 28) * Math.PI * 2
      const az = -phi
      if (Math.abs(Math.atan2(Math.sin(az - Math.PI), Math.cos(az - Math.PI))) < 0.1) continue
      B.add('frame', toWorld(new THREE.TorusGeometry(rr, 0.45, 6, 28, Math.PI / 2).rotateY(phi)), 0xffffff)
    }
    for (const e of [12, 24, 38, 54, 70]) {
      const a = (e * Math.PI) / 180
      B.add('frame', toWorld(new THREE.TorusGeometry(rr * Math.cos(a), 0.35, 6, 96).rotateX(Math.PI / 2).translate(0, rr * Math.sin(a), 0)), 0xffffff)
    }
    const gap = 0.14
    B.add('frame', toWorld(new THREE.TorusGeometry(rr, 0.7, 6, 96, Math.PI * 2 - gap).rotateX(Math.PI / 2).rotateY(Math.PI - gap / 2).translate(0, 0.4, 0)), 0xffffff)
    B.add('neon', toWorld(new THREE.TorusGeometry(rr - 0.4, 0.12, 6, 96, Math.PI * 2 - gap).rotateX(Math.PI / 2).rotateY(Math.PI - gap / 2).translate(0, 0.9, 0)), 0xb8ff7a)
    // porta
    const dx = cx - rr * 0.998
    for (const s of [-1, 1]) {
      c.W.box('frame', dx, G, cz + s * 6.4, 1.4, 6.8, 1.4, 0xffffff)
      c.W.sph('neon', dx, G + 7.2, cz + s * 6.4, 0.6, 0xb8ff7a, 1, 8, 6)
    }
    c.W.box('frame', dx, G + 6.6, cz, 1.6, 1.2, 14.2, 0xffffff)
    const sgn = new THREE.Mesh(new THREE.PlaneGeometry(13, 3.6), new THREE.MeshBasicMaterial({ map: signTexture('JARDIM EXÓTICO', 'Domo de Cristal · espécies do mundo todo', '#4ee06a', '#27b6f0', 768, 220), toneMapped: false, transparent: true, side: THREE.DoubleSide }))
    sgn.position.set(dx - 1.2, G + 10.2, cz)
    sgn.rotation.y = -Math.PI / 2
    scene.add(sgn)
    lv.rings.push({ x: cx, z: cz, r: rr - 1.2, thick: 1.4, y0: G - 2, y1: G + 60, gapA: Math.PI, gapW: 11.5 })
    lv.zones.push({ kind: 'dome', test: (x, _y, z) => domeDist(x, z) < rr - 1.5 })
    lv.lamps.push({ x: dx + 6, y: G + 5, z: cz, color: 0xb8ffc8, intensity: 26, night: false })

    // ---------- lagoa ----------
    const pond = new THREE.Mesh(new THREE.CircleGeometry(25, 48).rotateX(-Math.PI / 2), waterMat)
    pond.position.set(POND.x, POND_Y, POND.z)
    pond.renderOrder = 2
    scene.add(pond)
    // rochas na margem
    const rockG = new THREE.IcosahedronGeometry(1, 1)
    const rocks = new THREE.InstancedMesh(rockG, new THREE.MeshStandardMaterial({ roughness: 0.85 }), 60)
    const col = new THREE.Color()
    let ri = 0
    for (let i = 0; i < 28; i++) {
      const a = R() * 6.28,
        r = 15.5 + R() * 4
      const x = POND.x + Math.cos(a) * r,
        z = POND.z + Math.sin(a) * r
      if (Math.abs(z - POND.z) < 4.5 && Math.abs(x - POND.x) > 12) continue
      const s = 0.7 + R() * 1.4
      tmp.position.set(x, th(x, z) + s * 0.2, z)
      tmp.rotation.set(R() * 3, R() * 3, R() * 3)
      tmp.scale.set(s, s * 0.7, s)
      tmp.updateMatrix()
      rocks.setMatrixAt(ri, tmp.matrix)
      rocks.setColorAt(ri++, col.setHSL(0.08 + R() * 0.06, 0.15, 0.4 + R() * 0.2))
      lv.discs.push({ x, z, r: s * 0.8, y0: -5, y1: th(x, z) + 1 })
    }
    // rochas do riacho
    const dirx = POND.x - HILL.x,
      dirz = POND.z - HILL.z
    const dl = Math.hypot(dirx, dirz)
    const ux = dirx / dl,
      uz = dirz / dl
    const px = -uz,
      pz = ux
    let tEnd = 6
    for (let t = 6; t < dl; t += 1) {
      const x = HILL.x + ux * t,
        z = HILL.z + uz * t
      if (th(x, z) < POND_Y + 0.4) break
      tEnd = t
    }
    for (let i = 0; i < 30 && ri < 60; i++) {
      const t = 5 + R() * (tEnd - 5),
        side = R() < 0.5 ? -1 : 1
      const x = HILL.x + ux * t + px * side * (3.5 + R() * 2),
        z = HILL.z + uz * t + pz * side * (3.5 + R() * 2)
      const s = 0.6 + R() * 1.1
      tmp.position.set(x, th(x, z) + s * 0.1, z)
      tmp.rotation.set(R() * 3, R() * 3, R() * 3)
      tmp.scale.set(s, s * 0.7, s)
      tmp.updateMatrix()
      rocks.setMatrixAt(ri, tmp.matrix)
      rocks.setColorAt(ri++, col.setHSL(0.08 + R() * 0.06, 0.15, 0.35 + R() * 0.2))
    }
    rocks.count = ri
    scene.add(rocks)

    // cachoeira
    const N = Math.max(8, Math.floor(tEnd - 5))
    const fp: number[] = [],
      fu: number[] = [],
      fi: number[] = []
    for (let i = 0; i <= N; i++) {
      const t = 5 + ((tEnd - 5) * i) / N
      for (const s of [-1, 1]) {
        const x = HILL.x + ux * t + px * s * 2.3,
          z = HILL.z + uz * t + pz * s * 2.3
        fp.push(x, th(x, z) + 0.28, z)
        fu.push(s < 0 ? 0 : 1, t / 5)
      }
      if (i < N) fi.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2)
    }
    const fg = new THREE.BufferGeometry()
    fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3))
    fg.setAttribute('uv', new THREE.Float32BufferAttribute(fu, 2))
    fg.setIndex(fi)
    this.fallTex = T.fall.clone()
    this.fallTex.needsUpdate = true
    const fall = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ map: this.fallTex, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, color: 0xdff8ff }))
    fall.renderOrder = 1
    scene.add(fall)
    const ex = HILL.x + ux * tEnd,
      ez = HILL.z + uz * tEnd
    this.fallPos.set(ex, POND_Y, ez)
    // névoa da cachoeira
    const nm = 70
    const mp = new Float32Array(nm * 3)
    this.mistT = new Float32Array(nm)
    for (let i = 0; i < nm; i++) {
      this.mistT[i] = R()
      mp[i * 3] = ex + (R() - 0.5) * 7
      mp[i * 3 + 1] = POND_Y + R() * 4
      mp[i * 3 + 2] = ez + (R() - 0.5) * 7
    }
    const mg = new THREE.BufferGeometry()
    mg.setAttribute('position', new THREE.BufferAttribute(mp, 3))
    this.mist = new THREE.Points(mg, new THREE.PointsMaterial({ map: T.glow, size: 4.5, transparent: true, opacity: 0.28, depthWrite: false, color: 0xe8fbff }))
    this.mist.frustumCulled = false
    scene.add(this.mist)

    // ---------- ponte ----------
    const bx0 = POND.x - 19,
      bx1 = POND.x + 19
    const yBase = Math.max(th(bx0, POND.z), th(bx1, POND.z)) + 0.12
    const by = (x: number) => yBase + 1.7 * (1 - ((x - POND.x) / 19) ** 2)
    lv.surfaces.push({ minX: bx0, maxX: bx1, minZ: POND.z - 1.5, maxZ: POND.z + 1.5, y: (x) => by(x), mat: 'wood' })
    for (let x = bx0; x < bx1; x += 0.55) {
      c.W.box('wood', x + 0.27, by(x + 0.27) - 0.18, POND.z, 0.5, 0.18, 3.2, 0xffffff, 2)
    }
    for (let x = bx0; x < bx1 - 0.1; x += 1.9) {
      for (const s of [-1, 1]) {
        c.W.box('frame', x + 0.95, by(x + 0.95), POND.z + s * 1.6, 0.14, 1.1, 0.14, 0xffffff)
        c.W.box('frame', x + 0.95, by(x + 0.95) + 1.05, POND.z + s * 1.6, 1.95, 0.07, 0.07, 0xffffff)
        c.W.box('neon', x + 0.95, by(x + 0.95) + 0.6, POND.z + s * 1.6, 1.9, 0.04, 0.04, 0x9ff6ff)
        lv.boxes.push({ minX: x, maxX: x + 1.95, minZ: POND.z + s * 1.6 - 0.1, maxZ: POND.z + s * 1.6 + 0.1, y0: by(x + 0.95) - 0.3, y1: by(x + 0.95) + 1.2 })
      }
    }
    lv.lamps.push({ x: POND.x, y: yBase + 4, z: POND.z, color: 0xc8ffe8, intensity: 24, night: false })

    // ---------- pavilhão ----------
    const py = th(HILL.x, HILL.z) + 0.06
    this.pavY = py
    const pr = 5.6
    lv.surfaces.push({ minX: HILL.x - pr, maxX: HILL.x + pr, minZ: HILL.z - pr, maxZ: HILL.z + pr, cx: HILL.x, cz: HILL.z, rOut: pr, y: py, mat: 'tile' })
    c.W.cyl('plaza', HILL.x, py - 0.3, HILL.z, pr, pr + 0.3, 0.36, 0xffffff, 32)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      c.W.cyl('frame', HILL.x + Math.cos(a) * (pr - 0.4), py, HILL.z + Math.sin(a) * (pr - 0.4), 0.14, 0.14, 4.6, 0xffffff, 8)
      lv.discs.push({ x: HILL.x + Math.cos(a) * (pr - 0.4), z: HILL.z + Math.sin(a) * (pr - 0.4), r: 0.2, y0: py - 1, y1: py + 5 })
    }
    B.add('tint', toNew(new THREE.SphereGeometry(pr + 0.4, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2), HILL.x, py + 4.6, HILL.z), 0xbfffe0)
    B.add('frame', toNew(new THREE.TorusGeometry(pr - 0.3, 0.12, 6, 32).rotateX(Math.PI / 2), HILL.x, py + 4.6, HILL.z), 0xffffff)
    B.add('neon', toNew(new THREE.TorusGeometry(pr - 0.5, 0.06, 6, 32).rotateX(Math.PI / 2), HILL.x, py + 4.3, HILL.z), 0xb8ff7a)
    F.bench(c.W, HILL.x + 2.5, py, HILL.z + 2, -2.2)
    F.bench(c.W, HILL.x - 2.5, py, HILL.z - 1.5, 0.9)
    lv.lamps.push({ x: HILL.x, y: py + 3.6, z: HILL.z, color: 0xd8ffe0, intensity: 20, night: false })
    const chimeCols = [0xff8ac2, 0x8ae6ff, 0xb8ff7a, 0xffe27a, 0xd8b8ff]
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.4 + i * 0.12, 8), new THREE.MeshStandardMaterial({ color: chimeCols[i], metalness: 0.6, roughness: 0.2 }))
      m.position.set(HILL.x + Math.cos(a) * 1.4, py + 3.4, HILL.z + Math.sin(a) * 1.4)
      scene.add(m)
      this.chimes.push(m)
    }
    lv.interact.push({
      x: HILL.x,
      y: py,
      z: HILL.z,
      r: 7,
      label: () => 'E — Tocar os sinos de vento',
      run: () => {
        for (let i = 0; i < 6; i++) setTimeout(() => this.onChime(i * 2 + 1), i * 130)
      },
    })
    lv.interact.push({ x: POND.x - 14, y: G, z: POND.z - 6, r: 9, label: () => 'E — Alimentar as carpas', run: () => this.feed() })
    lv.interact.push({ x: POND.x + 14, y: G, z: POND.z + 6, r: 9, label: () => 'E — Alimentar as carpas', run: () => this.feed() })

    // ---------- caminho de pedras ----------
    const path = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(cx - rr + 3, 0, cz),
        new THREE.Vector3(cx - 66, 0, cz + 14),
        new THREE.Vector3(cx - 46, 0, cz + 6),
        new THREE.Vector3(POND.x - 26, 0, POND.z + 1),
        new THREE.Vector3(POND.x - 20, 0, POND.z),
      ],
      false
    )
    const path2 = new THREE.CatmullRomCurve3(
      [new THREE.Vector3(POND.x + 20, 0, POND.z), new THREE.Vector3(POND.x + 28, 0, POND.z - 8), new THREE.Vector3(HILL.x - 14, 0, HILL.z + 16), new THREE.Vector3(HILL.x - 7, 0, HILL.z + 6)],
      false
    )
    const stoneG = new THREE.CylinderGeometry(0.55, 0.6, 0.12, 10)
    const stones = new THREE.InstancedMesh(stoneG, M.plazaP, 260)
    let si = 0
    const pathPts: THREE.Vector3[] = []
    for (const cv of [path, path2]) {
      const len = cv.getLength()
      for (let d = 0; d < len && si < 260; d += 1.5) {
        const p = cv.getPointAt(d / len)
        pathPts.push(p)
        const x = p.x + (R() - 0.5) * 0.4,
          z = p.z + (R() - 0.5) * 0.4
        if (th(x, z) < POND_Y + 0.4) continue
        tmp.position.set(x, th(x, z) + 0.05, z)
        tmp.rotation.set(0, R() * 3, 0)
        tmp.scale.set(1, 1, 1)
        tmp.updateMatrix()
        stones.setMatrixAt(si, tmp.matrix)
        stones.setColorAt(si++, col.setHex(0xffffff))
      }
    }
    stones.count = si
    stones.receiveShadow = true
    scene.add(stones)
    for (let i = 0; i < 7; i++) {
      const p = pathPts[Math.floor(R() * pathPts.length)]
      F.bench(c.W, p.x + 2.2, th(p.x + 2.2, p.z), p.z + (R() < 0.5 ? 2 : -2), R() * 6)
    }
    for (let i = 0; i < 9; i++) {
      const p = pathPts[Math.floor(((i + 0.5) / 9) * pathPts.length)]
      c.W.cyl('frame', p.x + 1.8, th(p.x + 1.8, p.z + 1), p.z + 1, 0.05, 0.07, 2.4, 0xffffff, 6)
      c.W.sph('neon', p.x + 1.8, th(p.x + 1.8, p.z + 1) + 2.5, p.z + 1, 0.26, 0xb8ffc0, 1, 8, 6)
      lv.lamps.push({ x: p.x + 1.8, y: th(p.x + 1.8, p.z + 1) + 2.4, z: p.z + 1, color: 0xb8ffc8, intensity: 16, night: true })
    }

    // ---------- flora ----------
    const spot = (minR = 0): { x: number; z: number } => {
      for (let k = 0; k < 40; k++) {
        const a = R() * 6.283,
          r = Math.sqrt(R()) * (rr - 12)
        const x = cx + Math.cos(a) * r,
          z = cz + Math.sin(a) * r
        if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 6 + minR) continue
        if (Math.hypot(x - HILL.x, z - HILL.z) < 8) continue
        if (x < cx - rr + 34 && Math.abs(z - cz) < 8) continue
        if (Math.abs(z - POND.z) < 3.5 && Math.abs(x - POND.x) < 22) continue
        return { x, z }
      }
      return { x: cx, z: cz + 30 }
    }
    for (let i = 0; i < 26; i++) {
      const p = spot(2)
      const s = 1.9 + R() * 1.7
      c.trees.push({ x: p.x, z: p.z, y: th(p.x, p.z), s, type: 'palm' })
      lv.discs.push({ x: p.x, z: p.z, r: 0.6 * s * 0.5 + 0.3, y0: -5, y1: th(p.x, p.z) + 8 })
    }
    for (let i = 0; i < 9; i++) {
      const p = spot(4)
      const s = 1.8 + R() * 1.0
      c.trees.push({ x: p.x, z: p.z, y: th(p.x, p.z), s, type: 'round' })
      lv.discs.push({ x: p.x, z: p.z, r: 0.9, y0: -5, y1: th(p.x, p.z) + 8 })
    }
    for (let i = 0; i < 34; i++) {
      const p = spot()
      c.trees.push({ x: p.x, z: p.z, y: th(p.x, p.z), s: 1.3 + R() * 1.0, type: 'bush' })
    }

    // flores gigantes
    const NF = 80
    const stemG = new THREE.CylinderGeometry(0.05, 0.08, 1, 6)
    stemG.translate(0, 0.5, 0)
    const stems = new THREE.InstancedMesh(stemG, new THREE.MeshStandardMaterial({ color: 0x3fb04a, roughness: 0.6 }), NF)
    const petals: THREE.BufferGeometry[] = []
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2
      const g = new THREE.SphereGeometry(0.5, 8, 6)
      g.scale(0.55, 0.12, 0.2)
      g.translate(0.4, 0, 0)
      g.rotateZ(0.35)
      g.rotateY(a)
      g.translate(0, 1.0, 0)
      petals.push(g)
    }
    const core = new THREE.SphereGeometry(0.16, 8, 6)
    core.translate(0, 1.04, 0)
    petals.push(core)
    this.flowerHeads = new THREE.InstancedMesh(mergeSimple(petals), M.glowyI, NF)
    for (let i = 0; i < NF; i++) {
      const p = spot(-6)
      const s = 1.4 + R() * 3.6
      const y = th(p.x, p.z)
      tmp.position.set(p.x, y, p.z)
      tmp.rotation.set((R() - 0.5) * 0.25, R() * 6, (R() - 0.5) * 0.25)
      tmp.scale.set(s, s, s)
      tmp.updateMatrix()
      stems.setMatrixAt(i, tmp.matrix)
      this.flowerHeads.setMatrixAt(i, tmp.matrix)
      const fcol = new THREE.Color(VIVID[Math.floor(R() * VIVID.length)])
      this.flowerHeads.setColorAt(i, fcol)
      if (i < 16) {
        this.flowers.push({ x: p.x, y, z: p.z, pulse: 0, base: fcol, i })
        const k = i
        lv.interact.push({
          x: p.x,
          y,
          z: p.z,
          r: 2.6,
          label: () => 'E — Tocar a flor-sino',
          run: () => {
            this.flowers[k].pulse = 1
            this.onChime(k)
          },
        })
      }
    }
    scene.add(stems, this.flowerHeads)

    // cogumelos luminosos
    const NM = 56
    const capG = new THREE.SphereGeometry(0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2)
    capG.translate(0, 0.55, 0)
    this.mushCaps = new THREE.InstancedMesh(capG, M.glowyI, NM)
    const mstemG = new THREE.CylinderGeometry(0.1, 0.16, 0.6, 8)
    mstemG.translate(0, 0.3, 0)
    const mstems = new THREE.InstancedMesh(mstemG, new THREE.MeshStandardMaterial({ color: 0xfff4e0, roughness: 0.7 }), NM)
    const mcols = [0x6af0ff, 0xff7ad0, 0x9dff6a, 0xb08aff, 0xffd84a]
    for (let i = 0; i < NM; i++) {
      let x: number, z: number
      if (i < 30 && pathPts.length) {
        const p = pathPts[Math.floor(R() * pathPts.length)]
        const a = R() * 6.28
        x = p.x + Math.cos(a) * (2.2 + R() * 2.5)
        z = p.z + Math.sin(a) * (2.2 + R() * 2.5)
        if (th(x, z) < POND_Y + 0.6) {
          const q = spot()
          x = q.x
          z = q.z
        }
      } else {
        const q = spot()
        x = q.x
        z = q.z
      }
      const s = 0.6 + R() * R() * 2.6
      tmp.position.set(x, th(x, z), z)
      tmp.rotation.set(0, R() * 6, 0)
      tmp.scale.set(s, s, s)
      tmp.updateMatrix()
      this.mushCaps.setMatrixAt(i, tmp.matrix)
      mstems.setMatrixAt(i, tmp.matrix)
      const bc = new THREE.Color(mcols[Math.floor(R() * mcols.length)])
      this.mushCaps.setColorAt(i, bc)
      this.mush.push({ x, z, pulse: 0, cool: 0, base: bc })
    }
    scene.add(this.mushCaps, mstems)

    // samambaias
    const NFN = 2400
    const fa = new THREE.PlaneGeometry(2.6, 3.0)
    fa.translate(0, 1.5, 0)
    const fb = fa.clone().rotateY(Math.PI / 2)
    const fernG = mergeGeometries([fa, fb])!
    const fernM = new THREE.MeshStandardMaterial({ map: T.fern, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8 })
    sway(fernM, sh.time, 0.06)
    const ferns = new THREE.InstancedMesh(fernG, fernM, NFN)
    for (let i = 0; i < NFN; i++) {
      const p = spot(-8)
      const s = 0.5 + R() * 1.4
      tmp.position.set(p.x, th(p.x, p.z) - 0.05, p.z)
      tmp.rotation.set(0, R() * 6, 0)
      tmp.scale.set(s, s * (0.8 + R() * 0.6), s)
      tmp.updateMatrix()
      ferns.setMatrixAt(i, tmp.matrix)
      ferns.setColorAt(i, col.setHSL(0.27 + R() * 0.1, 0.65, 0.3 + R() * 0.2))
    }
    scene.add(ferns)

    // lanternas flutuantes
    const NL = 26
    this.lanterns = new THREE.InstancedMesh(new THREE.SphereGeometry(0.7, 10, 8), M.glowyI, NL)
    for (let i = 0; i < NL; i++) {
      const a = R() * 6.28,
        r = 8 + R() * 62
      const x = cx + Math.cos(a) * r,
        z = cz + Math.sin(a) * r
      const maxY = Math.sqrt(Math.max(0, rr * rr - r * r)) * 0.75
      const y = th(x, z) + 8 + R() * Math.max(6, maxY - 14)
      this.lanData.push(new THREE.Vector3(x, y, z))
      this.lanterns.setColorAt(i, col.setHex(VIVID[Math.floor(R() * VIVID.length)]))
      if (i % 4 === 0) lv.lamps.push({ x, y, z, color: VIVID[i % VIVID.length], intensity: 18, night: true })
    }
    scene.add(this.lanterns)

    // borboletas
    const NB = 40
    const bg = new THREE.BufferGeometry()
    const bv = new Float32Array([0, 0, -0.15, -0.55, 0, -0.32, -0.55, 0, 0.25, 0, 0, -0.15, -0.55, 0, 0.25, 0, 0, 0.15, 0, 0, -0.15, 0.55, 0, 0.25, 0.55, 0, -0.32, 0, 0, -0.15, 0, 0, 0.15, 0.55, 0, 0.25])
    bg.setAttribute('position', new THREE.BufferAttribute(bv, 3))
    const bm = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false })
    bm.onBeforeCompile = (s) => {
      s.uniforms.uTime = this.butterTime
      s.vertexShader =
        'uniform float uTime;\n' +
        s.vertexShader.replace(
          '#include <begin_vertex>',
          `vec3 transformed = vec3(position); float ph = 0.0;
          #ifdef USE_INSTANCING
          ph = instanceMatrix[3].x*0.7;
          #endif
          transformed.y += abs(position.x)*sin(uTime*18.0+ph)*1.1;`
        )
    }
    this.butter = new THREE.InstancedMesh(bg, bm, NB)
    this.butter.frustumCulled = false
    for (let i = 0; i < NB; i++) {
      const p = i < 14 ? { x: cx - rr + 20 + R() * 30, z: cz + (R() - 0.5) * 14 } : spot(-8)
      this.butData.push({ home: new THREE.Vector3(p.x, th(p.x, p.z) + 2 + R() * 3, p.z), ph: R() * 6.28, sp: 0.5 + R() * 0.6 })
      this.butter.setColorAt(i, col.setHex([0xffa23a, 0x5fd8ff, 0xff6aa8, 0xffe54a, 0xc08aff][i % 5]))
    }
    scene.add(this.butter)

    // carpas
    const kg: THREE.BufferGeometry[] = []
    const b0 = new THREE.SphereGeometry(0.5, 10, 8)
    b0.scale(1.3, 0.38, 0.4)
    kg.push(b0)
    const t0 = new THREE.ConeGeometry(0.3, 0.6, 4)
    t0.rotateZ(-Math.PI / 2)
    t0.scale(1, 1, 0.25)
    t0.translate(-0.85, 0, 0)
    kg.push(t0)
    this.koi = new THREE.InstancedMesh(mergeSimple(kg), new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.2 }), 12)
    for (let i = 0; i < 12; i++) {
      this.koiData.push({ a: R() * 6.28, r: 3 + R() * 9, sp: (0.15 + R() * 0.2) * (R() < 0.5 ? -1 : 1), ph: R() * 6 })
      this.koi.setColorAt(i, col.setHex([0xff7a2a, 0xffffff, 0xffb02a, 0xff4a4a, 0xfff0d0][i % 5]))
    }
    this.koi.frustumCulled = false
    scene.add(this.koi)
    // vitórias-régias
    const lily = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2), M.leafP, 30)
    const lflw = new THREE.InstancedMesh(new THREE.SphereGeometry(0.28, 8, 6), M.glowyI, 30)
    for (let i = 0; i < 30; i++) {
      const a = R() * 6.28,
        r = 3 + R() * 11
      const s = 0.7 + R() * 0.9
      tmp.position.set(POND.x + Math.cos(a) * r, POND_Y + 0.04, POND.z + Math.sin(a) * r)
      if (Math.abs(tmp.position.z - POND.z) < 3) tmp.position.z += 4
      tmp.rotation.set(0, R() * 6, 0)
      tmp.scale.set(s, 1, s)
      tmp.updateMatrix()
      lily.setMatrixAt(i, tmp.matrix)
      lily.setColorAt(i, col.setHSL(0.33, 0.6, 0.35))
      tmp.position.y += 0.15
      tmp.scale.set(1, 1, 1)
      tmp.updateMatrix()
      lflw.setMatrixAt(i, tmp.matrix)
      lflw.setColorAt(i, col.setHex(i % 3 ? 0xff9ad0 : 0xffffff))
    }
    scene.add(lily, lflw)

    // esporos / vagalumes
    const NS = 320
    const sp = new Float32Array(NS * 3)
    this.sporeV = new Float32Array(NS)
    for (let i = 0; i < NS; i++) {
      const p = spot(-10)
      sp[i * 3] = p.x
      sp[i * 3 + 1] = th(p.x, p.z) + 1 + R() * 30
      sp[i * 3 + 2] = p.z
      this.sporeV[i] = 0.2 + R() * 0.5
    }
    const sgm = new THREE.BufferGeometry()
    sgm.setAttribute('position', new THREE.BufferAttribute(sp, 3))
    this.spores = new THREE.Points(sgm, new THREE.PointsMaterial({ map: T.glow, size: 0.9, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xcfffe0 }))
    this.spores.frustumCulled = false
    scene.add(this.spores)
  }

  feed() {
    this.koiAttract = 1
    this.onSplash()
    this.onMsg('As carpas vieram nadar até você 🐟')
  }

  update(dt: number, t: number, pl: Player, night: number) {
    this.butterTime.value = t
    this.fallTex.offset.y -= dt * 1.1
    const dd = domeDist(pl.pos.x, pl.pos.z)
    const inside = dd < DOME.r + 20
    if (!inside) {
      return
    }
    this.koiAttract = Math.max(0, this.koiAttract - dt * 0.07)
    // flores
    let fc = false
    for (const f of this.flowers) {
      if (f.pulse > 0) {
        f.pulse = Math.max(0, f.pulse - dt * 0.8)
        this.flowerHeads.setColorAt(f.i, new THREE.Color().copy(f.base).multiplyScalar(1 + f.pulse * 3))
        fc = true
      }
    }
    if (fc && this.flowerHeads.instanceColor) this.flowerHeads.instanceColor.needsUpdate = true
    // cogumelos
    let mc = false
    for (let i = 0; i < this.mush.length; i++) {
      const m = this.mush[i]
      m.cool -= dt
      const dx = pl.pos.x - m.x,
        dz = pl.pos.z - m.z
      if (m.cool <= 0 && dx * dx + dz * dz < 2.6 * 2.6 && Math.abs(pl.pos.y - th(m.x, m.z)) < 3) {
        m.pulse = 1
        m.cool = 1.8
        this.onChime(i * 3)
      }
      if (m.pulse > 0 || m.cool > 1.6) {
        m.pulse = Math.max(0, m.pulse - dt * 1.1)
        this.mushCaps.setColorAt(i, new THREE.Color().copy(m.base).multiplyScalar(1 + m.pulse * 2.5))
        mc = true
      }
    }
    if (mc && this.mushCaps.instanceColor) this.mushCaps.instanceColor.needsUpdate = true

    // lanternas
    for (let i = 0; i < this.lanData.length; i++) {
      const p = this.lanData[i]
      tmp.position.set(p.x + Math.sin(t * 0.3 + i) * 1.2, p.y + Math.sin(t * 0.6 + i * 2) * 0.9, p.z + Math.cos(t * 0.25 + i) * 1.2)
      tmp.rotation.set(0, 0, 0)
      tmp.scale.setScalar(1)
      tmp.updateMatrix()
      this.lanterns.setMatrixAt(i, tmp.matrix)
    }
    this.lanterns.instanceMatrix.needsUpdate = true

    // borboletas
    const v = new THREE.Vector3()
    for (let i = 0; i < this.butData.length; i++) {
      const b = this.butData[i]
      const f = (tt: number, out: THREE.Vector3) =>
        out.set(b.home.x + Math.sin(tt * 0.6 * b.sp + b.ph) * 7, b.home.y + Math.sin(tt * 1.1 + b.ph) * 1.2, b.home.z + Math.cos(tt * 0.5 * b.sp + b.ph * 1.3) * 7)
      f(t, tmp.position)
      f(t + 0.1, v)
      v.sub(tmp.position)
      tmp.rotation.set(0, Math.atan2(v.x, v.z), 0)
      tmp.scale.setScalar(1)
      tmp.updateMatrix()
      this.butter.setMatrixAt(i, tmp.matrix)
    }
    this.butter.instanceMatrix.needsUpdate = true

    // carpas
    const tx = THREE.MathUtils.clamp(pl.pos.x - POND.x, -9, 9),
      tz = THREE.MathUtils.clamp(pl.pos.z - POND.z, -9, 9)
    for (let i = 0; i < this.koiData.length; i++) {
      const k = this.koiData[i]
      k.a += k.sp * dt
      const f = (a: number, out: THREE.Vector3) => {
        const ox = Math.cos(a) * k.r,
          oz = Math.sin(a) * k.r * 0.8
        out.set(POND.x + ox + (tx - ox) * this.koiAttract * 0.85 + Math.sin(t + k.ph) * 0.4, POND_Y - 0.45 - (i % 3) * 0.3, POND.z + oz + (tz - oz) * this.koiAttract * 0.85)
      }
      f(k.a, tmp.position)
      f(k.a + 0.05 * Math.sign(k.sp), v)
      v.sub(tmp.position)
      tmp.rotation.set(0, Math.atan2(-v.z, v.x), Math.sin(t * 2 + k.ph) * 0.05)
      tmp.scale.setScalar(0.9 + (i % 4) * 0.12)
      tmp.updateMatrix()
      this.koi.setMatrixAt(i, tmp.matrix)
    }
    this.koi.instanceMatrix.needsUpdate = true

    // esporos
    const sa = this.spores.geometry.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < sa.count; i++) {
      let y = sa.getY(i) + this.sporeV[i] * dt
      const x = sa.getX(i) + Math.sin(t * 0.5 + i) * dt * 0.6
      const z = sa.getZ(i) + Math.cos(t * 0.4 + i * 1.7) * dt * 0.6
      if (y > th(x, z) + 36) y = th(x, z) + 0.5
      sa.setXYZ(i, x, y, z)
    }
    sa.needsUpdate = true
    ;(this.spores.material as THREE.PointsMaterial).color.setHex(night > 0.5 ? 0xd8ff80 : 0xcfffe0)
    ;(this.spores.material as THREE.PointsMaterial).size = 0.7 + night * 0.7
    // névoa
    const ma = this.mist.geometry.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < ma.count; i++) {
      this.mistT[i] += dt * 0.25
      if (this.mistT[i] > 1) this.mistT[i] = 0
      ma.setY(i, POND_Y + this.mistT[i] * 6)
    }
    ma.needsUpdate = true
    this.chimes.forEach((m, i) => (m.rotation.z = Math.sin(t * 1.3 + i) * 0.06))
  }
}

function toNew(g: THREE.BufferGeometry, x: number, y: number, z: number) {
  return g.translate(x, y, z)
}
