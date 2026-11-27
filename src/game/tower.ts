import * as THREE from 'three'
import { G, lerp } from './consts'
import type { Ctx } from './ctx'
import * as F from './furniture'
import { glassify } from './builder'
import { signTexture } from './textures'
import type { Player } from './physics'

export const ELEV_NAMES = ['Térreo · Saguão Cristal', 'Aqua Lounge · 170 m', 'Jardim do Céu · 360 m', 'Coroa de Vidro · 540 m', 'Terraço Celeste · 620 m']

function taperedTube(points: THREE.Vector3[], r0: number, r1: number, segs = 40, radial = 12) {
  const curve = new THREE.CatmullRomCurve3(points)
  const frames = curve.computeFrenetFrames(segs, false)
  const pos: number[] = [],
    nor: number[] = [],
    uv: number[] = [],
    idx: number[] = []
  for (let i = 0; i <= segs; i++) {
    const t = i / segs
    const p = curve.getPointAt(t)
    const r = lerp(r0, r1, t)
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2
      const n = new THREE.Vector3().addScaledVector(frames.normals[i], Math.cos(a)).addScaledVector(frames.binormals[i], Math.sin(a))
      pos.push(p.x + n.x * r, p.y + n.y * r, p.z + n.z * r)
      nor.push(n.x, n.y, n.z)
      uv.push(j / radial, t * 8)
    }
  }
  for (let i = 0; i < segs; i++)
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j,
        b = a + radial + 1
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  return g
}

export class Tower {
  floors = [G + 0.1, G + 170, G + 360, G + 540, G + 620]
  car = { y: G + 0.1, moving: false, t: 0, T: 1, y0: 0, y1: 0, at: 0, target: 0, playerOn: false, vel: 0 }
  carGroup = new THREE.Group()
  doors: THREE.Mesh[] = []
  panelCv: HTMLCanvasElement
  panelTex: THREE.CanvasTexture
  beaconMat = new THREE.MeshBasicMaterial({ color: 0xff3030, toneMapped: false })
  beamGroup = new THREE.Group()
  beamMat = new THREE.MeshBasicMaterial({ color: 0xaaf0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })
  carLamp: { x: number; y: number; z: number }
  onDing: (up: boolean) => void = () => {}
  onZoom: () => void = () => {}
  onMsg: (s: string) => void = () => {}

  constructor(c: Ctx) {
    const { B, lv, scene } = c
    const W = c.W
    const decks = [
      { y: this.floors[1], R: 26 },
      { y: this.floors[2], R: 17 },
      { y: this.floors[3], R: 11 },
    ]
    const topY = this.floors[4]

    // ---------- saguão circular ----------
    const gap = 12 / 26
    const lobbyGlass = new THREE.CylinderGeometry(26, 26, 14, 72, 1, true, gap / 2, Math.PI * 2 - gap)
    lobbyGlass.translate(0, G + 7, 0)
    B.add('tint', lobbyGlass, 0x9fe8ff)
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2
      if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < gap / 2 + 0.03) continue
      W.box('frame', Math.cos(a) * 26, G, Math.sin(a) * 26, 0.35, 14, 0.35, 0xffffff, 2, -a)
    }
    lv.rings.push({ x: 0, z: 0, r: 26, thick: 0.9, y0: G - 1, y1: G + 14, gapA: Math.PI / 2, gapW: 12 })
    for (const s of [-1, 1]) {
      const a = Math.PI / 2 + s * (gap / 2)
      W.box('frame', Math.cos(a) * 26, G, Math.sin(a) * 26, 0.9, 14, 0.9, 0xffffff)
    }
    W.box('frame', 0, G + 11.5, 26, 14, 1.4, 1.2, 0xffffff)
    W.box('neon', 0, G + 11.4, 26.7, 13, 0.1, 0.05, 0x7ee8ff)
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(10, 3.1), new THREE.MeshBasicMaterial({ map: signTexture('TORRE CRISTAL', 'o céu é o limite · 620 m', '#27b6f0', '#7be04a', 768, 240), toneMapped: false, transparent: true }))
    sg.position.set(0, G + 16.2, 26.8)
    scene.add(sg)
    const roof = new THREE.CylinderGeometry(28, 28, 0.9, 64)
    roof.translate(0, G + 14.45, 0)
    B.add('plaza', roof, 0xffffff)
    W.geo('neon', new THREE.RingGeometry(14, 14.4, 64).rotateX(Math.PI / 2), 0, G + 13.97, 0, 0x7ee8ff)
    W.geo('neon', new THREE.RingGeometry(21, 21.4, 64).rotateX(Math.PI / 2), 0, G + 13.97, 0, 0xb8ff7a)
    const floorG = new THREE.CylinderGeometry(26, 26, 0.12, 72)
    floorG.translate(0, G + 0.04, 0)
    B.add('marble', floorG, 0xffffff)
    lv.surfaces.push({ minX: -26, maxX: 26, minZ: -26, maxZ: 26, cx: 0, cz: 0, rOut: 26, y: G + 0.1, mat: 'tile' })
    lv.zones.push({ kind: 'indoor', test: (x, y, z) => Math.hypot(x, z) < 26 && y < G + 14 && y > G - 1 })
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.5
      const px = Math.cos(a) * 17,
        pz = Math.sin(a) * 17
      W.cyl('gloss', px, G + 0.1, pz, 1.2, 1.3, 0.7, 0xf4fbff, 16)
      c.trees.push({ x: px, z: pz, y: G + 0.8, s: 0.7, type: i % 2 ? 'palm' : 'bush' })
      lv.discs.push({ x: px, z: pz, r: 1.3, y0: G, y1: G + 3 })
      lv.lamps.push({ x: Math.cos(a + 0.5) * 20, y: G + 11, z: Math.sin(a + 0.5) * 20, color: 0xcff8ff, intensity: 22, night: false })
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4
      F.sofa(W, Math.cos(a) * 9, G + 0.1, Math.sin(a) * 9, -a - Math.PI / 2, [0x7fe08a, 0xff8ac2, 0x7fd8ff, 0xffe27a][i])
    }
    F.counter(W, 0, G + 0.1, 20, 10, 1.3, 0, 0x5fd7f7)
    lv.lamps.push({ x: 0, y: G + 4, z: 0, color: 0xffffff, intensity: 28, night: false })

    // ---------- pernas ----------
    for (let i = 0; i < 3; i++) {
      const a = Math.PI / 6 + (i * Math.PI * 2) / 3
      const p = (r: number, y: number) => new THREE.Vector3(Math.cos(a) * r, G + y, Math.sin(a) * r)
      B.add('frame', taperedTube([p(46, 0), p(36, 55), p(20, 112), p(9, 150)], 3.4, 1.5, 50, 14), 0xffffff)
      W.cyl('frame', Math.cos(a) * 46, G - 1, Math.sin(a) * 46, 5.5, 6.5, 3.2, 0xffffff, 20)
      W.sph('neon', Math.cos(a) * 46, G + 3.4, Math.sin(a) * 46, 1.1, 0x7ee8ff, 1, 10, 8)
      lv.discs.push({ x: Math.cos(a) * 46, z: Math.sin(a) * 46, r: 6, y0: G - 2, y1: G + 40 })
      lv.lamps.push({ x: Math.cos(a) * 40, y: G + 6, z: Math.sin(a) * 40, color: 0x7ee8ff, intensity: 30, night: true })
    }

    // ---------- eixo do elevador ----------
    const shaftH = topY - G + 4
    const shaft = new THREE.CylinderGeometry(3.4, 3.4, shaftH, 24, 1, true)
    shaft.translate(0, G + shaftH / 2, 0)
    B.add('tint', shaft, 0xbff4ff)
    for (let y = G + 6; y < topY + 3; y += 12) W.cyl('frame', 0, y, 0, 3.55, 3.55, 0.3, 0xffffff, 24)
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4
      W.box('frame', Math.cos(a) * 3.45, G, Math.sin(a) * 3.45, 0.3, shaftH, 0.3, 0xffffff, 2, -a)
    }
    for (const hy of [265, 450]) {
      B.add('neon', new THREE.TorusGeometry(14, 0.3, 8, 64).rotateX(Math.PI / 2).translate(0, G + hy, 0), 0x7ee8ff)
      B.add('neon', new THREE.TorusGeometry(10, 0.2, 8, 64).rotateX(Math.PI / 2).translate(0, G + hy + 7, 0), 0xb8ff7a)
    }

    // ---------- esferas e decks ----------
    decks.forEach((d, di) => {
      const sphere = new THREE.SphereGeometry(d.R, 56, 36)
      sphere.translate(0, d.y, 0)
      B.add('tint', sphere, di === 1 ? 0xb8ffc8 : di === 2 ? 0xe0c8ff : 0x9fe8ff)
      for (let m = 0; m < 10; m++) B.add('frame', new THREE.TorusGeometry(d.R, 0.12, 6, 64).rotateY((m / 10) * Math.PI).translate(0, d.y, 0), 0xffffff)
      for (const lat of [-0.7, -0.35, 0.35, 0.7]) {
        const rr = d.R * Math.cos(lat * 1.1)
        B.add('frame', new THREE.TorusGeometry(rr, 0.1, 6, 64).rotateX(Math.PI / 2).translate(0, d.y + d.R * Math.sin(lat * 1.1), 0), 0xffffff)
      }
      B.add('neon', new THREE.TorusGeometry(d.R - 0.45, 0.14, 8, 72).rotateX(Math.PI / 2).translate(0, d.y + 0.05, 0), di === 1 ? 0xb8ff7a : 0x7ee8ff)
      this.addDeck(c, d.y, d.R)
      lv.bounds.push({ x: 0, z: 0, r: d.R - 0.6, y0: d.y - 0.6, y1: d.y + d.R * 0.8 })
      // mobília
      const ring = d.R - 3.5
      const nb = Math.floor((ring * Math.PI * 2) / 7)
      for (let i = 0; i < nb; i++) {
        const a = (i / nb) * Math.PI * 2
        if (di === 0) F.bench(W, Math.cos(a) * ring, d.y, Math.sin(a) * ring, -a - Math.PI / 2 + Math.PI)
        else if (di === 1) {
          W.cyl('grassy', Math.cos(a) * ring, d.y, Math.sin(a) * ring, 1.4, 1.5, 0.6, 0xffffff, 12)
          c.trees.push({ x: Math.cos(a) * ring, z: Math.sin(a) * ring, y: d.y + 0.6, s: 0.55, type: i % 3 === 0 ? 'palm' : i % 3 === 1 ? 'bush' : 'round' })
          lv.discs.push({ x: Math.cos(a) * ring, z: Math.sin(a) * ring, r: 1.5, y0: d.y, y1: d.y + 1 })
        } else this.telescope(c, Math.cos(a) * (d.R - 2), d.y, Math.sin(a) * (d.R - 2), i)
      }
      if (di === 0) {
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + 0.3
          F.counter(W, Math.cos(a) * 11, d.y, Math.sin(a) * 11, 5, 1.2, -a - Math.PI / 2, [0xff8ac2, 0x62e0ff, 0xb8ff7a, 0xffe27a, 0xd8b8ff][i])
          F.plant(W, Math.cos(a + 0.6) * 15, d.y, Math.sin(a + 0.6) * 15, 1.5)
        }
      }
      if (di === 1)
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + 0.5
          F.sofa(W, Math.cos(a) * 8, d.y, Math.sin(a) * 8, -a - Math.PI / 2 + Math.PI, [0xffb0d0, 0xb0e8ff, 0xd0ffb0][i % 3])
        }
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.8
        lv.lamps.push({ x: Math.cos(a) * (d.R * 0.6), y: d.y + 3, z: Math.sin(a) * (d.R * 0.6), color: di === 1 ? 0xc8ffc8 : 0xc8f4ff, intensity: 22, night: false })
      }
      const zr = d.R
      lv.zones.push({ kind: 'indoor', test: (x, y, z) => Math.hypot(x, z) < zr - 0.5 && y > d.y - 0.5 && y < d.y + 2.5 })
      // letreiro do deck
      const sgn = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.9), new THREE.MeshBasicMaterial({ map: signTexture(['LOUNGE', 'JARDIM', 'COROA'][di], ELEV_NAMES[di + 1].split('·')[1].trim(), '#27b6f0', '#7be04a'), toneMapped: false, transparent: true, side: THREE.DoubleSide }))
      sgn.position.set(0, d.y + 4.2, -5)
      scene.add(sgn)
    })

    // ---------- terraço superior ----------
    this.addDeck(c, topY, 9)
    lv.bounds.push({ x: 0, z: 0, r: 8.5, y0: topY - 0.6, y1: topY + 1.4 })
    const rail = new THREE.CylinderGeometry(8.7, 8.7, 1.2, 48, 1, true)
    rail.translate(0, topY + 0.6, 0)
    B.add('tint', rail, 0xbff4ff)
    B.add('frame', new THREE.TorusGeometry(8.7, 0.07, 6, 48).rotateX(Math.PI / 2).translate(0, topY + 1.2, 0), 0xffffff)
    B.add('neon', new THREE.TorusGeometry(8.5, 0.12, 8, 48).rotateX(Math.PI / 2).translate(0, topY + 0.05, 0), 0xb8ff7a)
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4
      lv.lamps.push({ x: Math.cos(a) * 6, y: topY + 3, z: Math.sin(a) * 6, color: 0xc8f4ff, intensity: 26, night: false })
    }
    this.telescope(c, 6.5, topY, 0, 1)
    this.telescope(c, -6.5, topY, 0, 2)
    this.telescope(c, 0, topY, 6.5, 3)
    lv.zones.push({ kind: 'indoor', test: (x, y, z) => Math.hypot(x, z) < 3.4 && y > topY - 0.5 && y < topY + 3 })
    const cap = new THREE.CylinderGeometry(3.6, 3.6, 0.5, 24)
    cap.translate(0, topY + 3.6, 0)
    B.add('frame', cap, 0xffffff)
    const needle = new THREE.ConeGeometry(1.1, 150, 10)
    needle.translate(0, topY + 3.8 + 75, 0)
    B.add('frame', needle, 0xffffff)
    for (const dy of [40, 80, 110]) B.add('neon', new THREE.SphereGeometry(1.1 - dy * 0.005, 10, 8).translate(0, topY + 4 + dy, 0), 0x7ee8ff)
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 10), this.beaconMat)
    beacon.position.set(0, topY + 155, 0)
    scene.add(beacon)
    lv.lamps.push({ x: 0, y: topY + 150, z: 0, color: 0xff4040, intensity: 40, night: true })
    // feixes
    for (let i = 0; i < 2; i++) {
      const g = new THREE.CylinderGeometry(16, 0.3, 380, 18, 1, true)
      g.translate(0, 190, 0)
      g.rotateZ(-(Math.PI / 2 - 0.3))
      const m = new THREE.Mesh(g, this.beamMat)
      m.rotation.y = i * Math.PI
      this.beamGroup.add(m)
    }
    this.beamGroup.position.set(0, topY + 120, 0)
    scene.add(this.beamGroup)

    // ---------- cabine ----------
    const carMat = new THREE.MeshStandardMaterial({ color: 0xe8fbff, roughness: 0.15, metalness: 0.3 })
    const floorD = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.2, 32), carMat)
    floorD.position.y = -0.1
    const ceil = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.7, 0.2, 32), carMat)
    ceil.position.y = 2.9
    const cglass = new THREE.MeshStandardMaterial({ color: 0xcff6ff, transparent: true, opacity: 0.18, roughness: 0.03, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 2 })
    glassify(cglass, 1.4)
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.7, 2.8, 32, 1, true), cglass)
    wall.position.y = 1.4
    const neonRing = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.05, 6, 40).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xb8ff7a, toneMapped: false }))
    neonRing.position.y = 2.75
    this.panelCv = document.createElement('canvas')
    this.panelCv.width = 256
    this.panelCv.height = 128
    this.panelTex = new THREE.CanvasTexture(this.panelCv)
    this.panelTex.colorSpace = THREE.SRGBColorSpace
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), new THREE.MeshBasicMaterial({ map: this.panelTex, toneMapped: false }))
    panel.position.set(2.62, 1.7, 0)
    panel.rotation.y = -Math.PI / 2
    this.carGroup.add(floorD, ceil, wall, neonRing, panel)
    scene.add(this.carGroup)
    this.carLamp = { x: 0, y: 0, z: 0 }
    const cl = { x: 0, y: this.car.y + 2.4, z: 0, color: 0xdff8ff, intensity: 14, night: false }
    lv.lamps.push(cl)
    this.carLamp = cl
    this.drawPanel()

    // portas por andar (guarda) + superfícies
    const doorMat = new THREE.MeshBasicMaterial({ color: 0x7ee8ff, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false })
    for (let i = 1; i < 5; i++) {
      const fy = this.floors[i]
      const m = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 2.9, 3, 24, 1, true), doorMat)
      m.position.y = fy + 1.5
      scene.add(m)
      this.doors.push(m)
      lv.discs.push({ x: 0, z: 0, r: 3.0, y0: fy - 0.2, y1: fy + 3, on: () => !(this.car.at === i && !this.car.moving) && !this.car.playerOn })
    }
    lv.surfaces.push({ minX: -2.7, maxX: 2.7, minZ: -2.7, maxZ: 2.7, cx: 0, cz: 0, rOut: 2.6, y: () => this.car.y, mat: 'metal' })
    lv.bounds.push({ x: 0, z: 0, r: 2.45, y0: -1000, y1: 1e5, on: () => this.car.moving && this.car.playerOn })

    // interações
    for (let i = 0; i < 5; i++) {
      lv.interact.push({
        x: 0,
        y: this.floors[i],
        z: 0,
        r: 10,
        label: () => {
          if (this.car.moving) return null
          if (this.car.playerOn) return null
          if (this.car.at === i) return 'Entre na cabine do elevador'
          return 'E — Chamar elevador'
        },
        run: () => {
          if (!this.car.playerOn && this.car.at !== i) this.go(i)
        },
      })
    }
  }

  telescope(c: Ctx, x: number, y: number, z: number, seed: number) {
    const W = c.W
    W.cyl('frame', x, y, z, 0.08, 0.14, 1.3, 0xffffff, 8)
    const t = new THREE.CylinderGeometry(0.16, 0.22, 1, 10)
    t.rotateZ(Math.PI / 2 + 0.3)
    t.translate(x, y + 1.45, z)
    c.B.add('gloss', t, 0xffd34a)
    c.lv.discs.push({ x, z, r: 0.3, y0: y, y1: y + 2 })
    c.lv.interact.push({ x, y, z, r: 2.6, label: () => 'E — Olhar pelo telescópio', run: () => this.onZoom() })
    void seed
  }

  addDeck(c: Ctx, y: number, R: number) {
    const { B, lv } = c
    const rIn = 2.5
    const top = new THREE.RingGeometry(rIn, R, 72, 1).rotateX(-Math.PI / 2)
    const uv = top.attributes.uv
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * R * 0.33, uv.getY(i) * R * 0.33)
    top.translate(0, y, 0)
    B.add('plaza', top, 0xffffff)
    B.add('frame', new THREE.RingGeometry(rIn, R, 72, 1).rotateX(Math.PI / 2).translate(0, y - 0.7, 0), 0xffffff)
    B.add('frame', new THREE.CylinderGeometry(R, R * 0.97, 0.7, 72, 1, true).translate(0, y - 0.35, 0), 0xffffff)
    lv.surfaces.push({ minX: -R, maxX: R, minZ: -R, maxZ: R, cx: 0, cz: 0, rIn, rOut: R, y, mat: 'tile' })
    // pontos de luz no piso
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      B.add('neon', new THREE.CylinderGeometry(0.18, 0.18, 0.04, 8).translate(Math.cos(a) * (R * 0.55), y + 0.03, Math.sin(a) * (R * 0.55)), 0xb8ff7a)
    }
  }

  drawPanel() {
    const c = this.panelCv.getContext('2d')!
    const g = c.createLinearGradient(0, 0, 0, 128)
    g.addColorStop(0, '#0d3c58')
    g.addColorStop(1, '#06202f')
    c.fillStyle = g
    c.fillRect(0, 0, 256, 128)
    c.strokeStyle = '#7ee8ff'
    c.lineWidth = 4
    c.strokeRect(3, 3, 250, 122)
    c.fillStyle = '#9ff6ff'
    c.font = 'bold 54px Verdana'
    c.textAlign = 'center'
    const alt = Math.max(0, Math.round(this.car.y - G))
    c.fillText(`${alt} m`, 128, 62)
    c.font = '20px Verdana'
    c.fillStyle = '#b8ff7a'
    c.fillText(this.car.moving ? (this.car.y1 > this.car.y0 ? '▲ subindo' : '▼ descendo') : ELEV_NAMES[this.car.at].split('·')[0].trim(), 128, 100)
    this.panelTex.needsUpdate = true
  }

  go(i: number) {
    const c = this.car
    if (c.moving || i === c.at) return
    c.y0 = c.y
    c.y1 = this.floors[i]
    c.T = Math.max(3.2, Math.abs(c.y1 - c.y0) / 42 + 2.4)
    c.t = 0
    c.moving = true
    c.target = i
    this.onMsg(`Indo para: ${ELEV_NAMES[i]}`)
  }

  select(i: number) {
    if (this.car.playerOn) this.go(i)
  }

  update(dt: number, pl: Player, night: number, time: number) {
    const c = this.car
    c.playerOn = Math.hypot(pl.pos.x, pl.pos.z) < 2.55 && Math.abs(pl.pos.y - c.y) < 0.9
    let lastY = c.y
    if (c.moving) {
      c.t += dt
      const u = Math.min(1, c.t / c.T)
      const e = u * u * u * (u * (u * 6 - 15) + 10)
      c.y = lerp(c.y0, c.y1, e)
      if (u >= 1) {
        c.moving = false
        c.at = c.target
        c.y = c.y1
        this.onDing(c.y1 > c.y0)
      }
      if (c.playerOn) {
        pl.pos.y = c.y
        pl.vel.y = 0
        pl.grounded = true
      }
    }
    c.vel = Math.abs(c.y - lastY) / Math.max(dt, 1e-4)
    lastY = c.y
    this.carGroup.position.y = c.y
    this.carLamp.y = c.y + 2.4
    if (c.moving || Math.abs(c.y - this.floors[c.at]) < 0.01) if (((time * 10) | 0) % 2 === 0 || !c.moving) this.drawPanel()
    this.doors.forEach((m, k) => {
      const i = k + 1
      m.visible = !(c.at === i && !c.moving) && !c.playerOn
    })
    this.beaconMat.color.setRGB(1, 0.15, 0.15).multiplyScalar(0.3 + 1.2 * (0.5 + 0.5 * Math.sin(time * 3.3)))
    this.beamGroup.rotation.y = time * 0.35
    this.beamMat.opacity = 0.11 * night
    this.beamGroup.visible = night > 0.05
  }
}
