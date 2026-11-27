import * as THREE from 'three'
import { Local, prismGeo, type Opening } from './builder'
import { G, rng, DOME, TUBE } from './consts'
import type { Ctx } from './ctx'
import * as F from './furniture'
import { signTexture } from './textures'

const FH = 4
const PASTEL = [0xffc2d9, 0xc2f0ff, 0xd5ffc2, 0xfff3b0, 0xe3c9ff, 0xffd6b0, 0xb8ffe6]

function addSign(c: Ctx, L: Local, text: string, sub: string, x: number, y: number, z: number, w: number, h: number, ry = 0, a = '#27b6f0', b = '#7be04a') {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: signTexture(text, sub, a, b), toneMapped: false, transparent: true }))
  const [wx, wz] = L.w(x, z)
  m.position.set(wx, L.oy + y, wz)
  m.rotation.y = L.rot + ry
  c.scene.add(m)
}

function road(c: Ctx, x0: number, z0: number, x1: number, z1: number, mat = 'road', lift = 0, surface = true) {
  const w = x1 - x0,
    d = z1 - z0
  const W = c.W
  if (mat === 'road') {
    const ns = d >= w
    if (ns) W.box('road', (x0 + x1) / 2, G, (z0 + z1) / 2, w, 0.08 + lift, d, 0xffffff, w)
    else W.box('road', (x0 + x1) / 2, G, (z0 + z1) / 2, d, 0.08 + lift, w, 0xffffff, d, Math.PI / 2)
  } else W.box(mat, (x0 + x1) / 2, G, (z0 + z1) / 2, w, 0.08 + lift, d, 0xffffff, 6)
  if (surface) c.lv.surfaces.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, y: G + 0.08 + lift, mat: 'tile' })
}

export function lampPost(c: Ctx, x: number, z: number, color = 0xbff6ff) {
  const W = c.W
  W.cyl('frame', x, G, z, 0.09, 0.14, 5.2, 0xffffff, 8)
  W.sph('neon', x, G + 5.5, z, 0.5, color, 1, 10, 8)
  W.cyl('frame', x, G + 5.1, z, 0.3, 0.1, 0.18, 0xffffff, 8)
  c.lv.lamps.push({ x, y: G + 5.3, z, color, intensity: 30, night: true })
  c.lv.discs.push({ x, z, r: 0.25, y0: G - 1, y1: G + 6 })
}

// -------------------------------------------------------------------------
export interface OfficeOpts {
  w: number
  d: number
  floors: number
  kind: 'office' | 'mall' | 'lounge'
  seed: number
  name: string
  sub: string
  tint?: number
  a?: string
  b?: string
}

export function office(c: Ctx, ox: number, oz: number, rot: number, o: OfficeOpts) {
  const { B, lv } = c
  const L = new Local(B, lv, ox, G, oz, rot)
  const { w, d, floors } = o
  const R = rng(o.seed)
  const hw = w / 2,
    hd = d / 2,
    th = 0.3,
    H = floors * FH
  const tint = o.tint ?? 0xffffff
  const uo = Math.floor(R() * 8) / 8
  const SW = 2.6,
    zHi = hd - 5.5,
    zLo = zHi - 10

  L.box('tile', 0, 0, 0, w + 0.8, 0.1, d + 0.8, 0xffffff, 4)
  L.surf(-hw - 0.4, -hd - 0.4, hw + 0.4, hd + 0.4, 0.1, 'tile')
  const door: Opening = { c: 0, w: 4.6, sill: 0, top: 3.6, kind: 'door' }
  const wl = (a: [number, number], b: [number, number], open?: Opening[]) => L.wall({ mat: 'glass', a, b, y0: 0.1, y1: H, th, open, color: tint, tile: 32, uo })
  wl([-hw - th, hd + th / 2], [hw + th, hd + th / 2], [door])
  wl([-hw - th, -hd - th / 2], [hw + th, -hd - th / 2])
  wl([-hw - th / 2, -hd], [-hw - th / 2, hd])
  wl([hw + th / 2, -hd], [hw + th / 2, hd])
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) L.box('frame', sx * (hw + th / 2), 0, sz * (hd + th / 2), 0.8, H + 0.5, 0.8, 0xffffff)
  // marquise + letreiro
  L.box('frame', 0, 3.75, hd + 1.8, 8, 0.2, 3.6, 0xffffff)
  L.box('neon', 0, 3.7, hd + 3.55, 7.8, 0.08, 0.08, o.b ? new THREE.Color(o.b) : 0x7ee8ff)
  for (const sx of [-3.6, 3.6]) L.box('frame', sx, 0, hd + 3.4, 0.14, 3.75, 0.14, 0xffffff)
  addSign(c, L, o.name, o.sub, 0, Math.min(H - 1.6, 5.8), hd + th + 0.08, 7, 2.2, 0, o.a, o.b)
  L.lamp(0, 3.4, hd + 2, 0xaaf4ff, 14, false)
  L.zone(-hw, -hd, hw, hd, 0, H - 0.05)

  // lajes + escadas
  const slabRects = (left: boolean): [number, number, number, number][] => {
    const sx0 = left ? -hw : hw - SW,
      sx1 = left ? -hw + SW : hw
    const A: [number, number, number, number] = left ? [sx1, -hd, hw, hd] : [-hw, -hd, sx0, hd]
    return [A, [sx0, -hd, sx1, zLo], [sx0, zHi, sx1, hd]]
  }
  for (let k = 1; k <= floors; k++) {
    const left = (k - 1) % 2 === 0
    const y = k * FH
    for (const [x0, z0, x1, z1] of slabRects(left)) {
      L.box(k === floors ? 'plaza' : 'tile', (x0 + x1) / 2, y - 0.35, (z0 + z1) / 2, x1 - x0, 0.35, z1 - z0, 0xffffff, 4)
      L.surf(x0, z0, x1, z1, y, 'tile')
    }
  }
  for (let k = 0; k < floors; k++) {
    const left = k % 2 === 0
    const y0 = k === 0 ? 0.1 : k * FH
    const yU = (k + 1) * FH
    const sx0 = left ? -hw : hw - SW,
      sx1 = left ? -hw + SW : hw
    const N = 18,
      dz = (zHi - zLo) / N
    for (let i = 0; i < N; i++) {
      const zc = left ? zHi - (i + 0.5) * dz : zLo + (i + 0.5) * dz
      const top = y0 + ((i + 1) * (yU - y0)) / N
      L.box('plaza', (sx0 + sx1) / 2, top - 0.22, zc, SW, 0.22, dz + 0.02, 0xffffff, 2)
      L.box('pane', left ? sx1 - 0.04 : sx0 + 0.04, top, zc, 0.05, 1.0, dz + 0.02, 0xffffff)
    }
    L.surf(sx0, zLo, sx1, zHi, (_lx, lz) => (left ? y0 + (yU - y0) * ((zHi - lz) / (zHi - zLo)) : y0 + (yU - y0) * ((lz - zLo) / (zHi - zLo))), 'tile')
    // guarda-corpos no andar de cima
    const ex = left ? sx1 : sx0
    L.col(ex - 0.06, zLo, ex + 0.06, zHi, yU, yU + 1.3)
    L.box('pane', ex, yU, (zLo + zHi) / 2, 0.05, 1.1, zHi - zLo, 0xffffff)
    L.box('frame', ex, yU + 1.08, (zLo + zHi) / 2, 0.08, 0.05, zHi - zLo, 0xffffff)
    const cz = left ? zHi : zLo
    L.col(sx0, cz - 0.06, sx1, cz + 0.06, yU, yU + 1.3)
    L.box('pane', (sx0 + sx1) / 2, yU, cz, SW, 1.1, 0.05, 0xffffff)
    L.box('frame', (sx0 + sx1) / 2, yU + 1.08, cz, SW, 0.05, 0.08, 0xffffff)
  }

  // telhado: parapeito + jardim
  L.col(-hw - 0.4, hd, hw + 0.4, hd + 0.4, H, H + 1.3)
  L.col(-hw - 0.4, -hd - 0.4, hw + 0.4, -hd, H, H + 1.3)
  L.col(-hw - 0.4, -hd, -hw, hd, H, H + 1.3)
  L.col(hw, -hd, hw + 0.4, hd, H, H + 1.3)
  L.box('pane', 0, H, hd + 0.2, w + 0.8, 1.1, 0.06, 0xffffff)
  L.box('pane', 0, H, -hd - 0.2, w + 0.8, 1.1, 0.06, 0xffffff)
  L.box('pane', -hw - 0.2, H, 0, 0.06, 1.1, d, 0xffffff)
  L.box('pane', hw + 0.2, H, 0, 0.06, 1.1, d, 0xffffff)
  L.box('frame', 0, H + 1.08, hd + 0.2, w + 0.8, 0.06, 0.1, 0xffffff)
  L.box('frame', 0, H + 1.08, -hd - 0.2, w + 0.8, 0.06, 0.1, 0xffffff)
  L.box('frame', -hw - 0.2, H + 1.08, 0, 0.1, 0.06, d, 0xffffff)
  L.box('frame', hw + 0.2, H + 1.08, 0, 0.1, 0.06, d, 0xffffff)
  const roofLeft = (floors - 1) % 2 === 0
  const rxa = roofLeft ? -hw + SW + 2 : -hw + 2,
    rxb = roofLeft ? hw - 2 : hw - SW - 2
  for (let i = 0; i < 4; i++) {
    const px = rxa + R() * (rxb - rxa),
      pz = -hd + 3 + R() * (d - 8)
    L.box('grassy', px, H, pz, 3, 0.5, 2, 0xffffff, 3)
    L.col(px - 1.5, pz - 1, px + 1.5, pz + 1, H, H + 0.5)
    F.plant(L, px - 0.7, H + 0.5, pz, 1.2)
    F.plant(L, px + 0.8, H + 0.5, pz + 0.2, 0.9, 0x6ad04a)
  }
  F.bench(L, (rxa + rxb) / 2, H, -hd + 2, 0)
  F.bench(L, (rxa + rxb) / 2 + 6, H, hd - 3, Math.PI)
  L.lamp((rxa + rxb) / 2, H + 2, 0, 0xbff6ff, 20, true)
  L.cyl('neon', rxb - 1, H, hd - 2, 0.2, 0.2, 0.5, 0xbff6ff, 8)
  L.lamp(rxb - 1, H + 1, hd - 2, 0xbff6ff, 12, true)

  // interior
  const xa = (left: boolean) => (left ? -hw + SW + 1.8 : -hw + 1.8)
  const xb = (left: boolean) => (left ? hw - 1.8 : hw - SW - 1.8)
  for (let k = 0; k < floors; k++) {
    const y = k === 0 ? 0.1 : k * FH
    const a = k === 0 ? xa(true) : -hw + SW + 1.8
    const b = k === 0 ? xb(true) : hw - SW - 1.8
    // painéis de teto
    let n = 0
    for (let x = a + 2; x <= b - 2; x += 7)
      for (let z = -hd + 4; z <= hd - 6; z += 7) F.ceilingPanel(L, x, y + FH - 0.42, z, 2.8, 1, n++ % 3 === 0)
    if (k === 0) {
      // saguão
      F.counter(L, 3.5, y, hd - 11, o.kind === 'mall' ? 8 : 6, 1.2, 0, 0x5fd7f7)
      F.sofa(L, -8, y, hd - 2.8, Math.PI, 0xff7fb0)
      F.sofa(L, 8, y, hd - 2.8, Math.PI, 0x7fe08a)
      F.table(L, -8, y, hd - 5, 1.2, 0.8, 0.45, 0xffffff, 'gloss')
      F.table(L, 8, y, hd - 5, 1.2, 0.8, 0.45, 0xffffff, 'gloss')
      F.tankAt(c, L, (a + b) / 2, y, -hd + 1.4, Math.min(10, b - a - 4), 2, 1.1)
      for (const [px, pz] of [
        [a, hd - 1.2],
        [b, hd - 1.2],
        [a, -hd + 1.2],
        [b, -hd + 1.2],
      ])
        F.plant(L, px, y, pz, 1.4)
      if (o.kind === 'mall') {
        // fonte central + lojas
        L.cyl('tile', 0, y, 0, 4.2, 4.4, 0.55, 0xffffff, 24)
        L.cyl('water', 0, y + 0.3, 0, 3.8, 3.8, 0.4, 0x4fd8ff, 24)
        L.sph('gloss', 0, y + 1.6, 0, 0.9, 0x7fe9ff, 1, 14, 10)
        L.sph('gloss', 0.3, y + 2.9, 0.1, 0.55, 0xc8ff7a, 1, 12, 8)
        L.lamp(0, y + 3, 0, 0x7fe9ff, 16, false)
        c.lv.discs.push({ x: L.w(0, 0)[0], z: L.w(0, 0)[1], r: 4.4, y0: y, y1: y + 1 })
        const cols = [0xff8ac2, 0xffd34a, 0x62e0ff, 0x8aff7a]
        for (let i = 0; i < 4; i++) {
          const px = -hw + 6 + i * ((w - 12) / 3)
          F.counter(L, px, y, -hd + 5, 5, 1.2, 0, cols[i])
          L.box('neon', px, y + 2.2, -hd + 0.5, 5, 1.2, 0.08, cols[i])
        }
        F.tankAt(c, L, hw - 6, y, 8, 1.2, 2, 9, Math.PI / 2)
      } else {
        for (let x = a + 4; x < b - 3; x += 5.5) F.desk(L, x, y, -4.5, 0, [0xffa0c8, 0x8ae6ff, 0xb8ff8a, 0xffe27a][Math.floor(R() * 4)])
      }
    } else {
      const kk = o.kind
      if (kk === 'lounge') {
        for (let z = -hd + 4; z < hd - 7; z += 7)
          for (let x = a + 3; x < b - 2; x += 8) {
            F.sofa(L, x, y, z, Math.PI * (R() < 0.5 ? 0 : 1), PASTEL[Math.floor(R() * PASTEL.length)])
            F.table(L, x, y, z + (R() < 0.5 ? 1.5 : -1.5), 1, 1, 0.45, 0xffffff)
          }
      } else if (kk === 'mall') {
        for (let x = a + 3; x < b - 2; x += 7) F.counter(L, x, y, -hd + 4, 4.5, 1.2, 0, PASTEL[Math.floor(R() * PASTEL.length)])
        for (let x = a + 4; x < b - 2; x += 9) F.bench(L, x, y, 3, 0)
      } else {
        for (let z = -hd + 4; z < hd - 5; z += 5.5)
          for (let x = a + 2.5; x < b - 1.5; x += 4.6) F.desk(L, x, y, z, (R() < 0.5 ? 0 : 0) as number, [0xffa0c8, 0x8ae6ff, 0xb8ff8a, 0xffe27a, 0xd9b8ff][Math.floor(R() * 5)])
      }
      for (let i = 0; i < 4; i++) F.plant(L, a + R() * (b - a), y, -hd + 1 + R() * (d - 2), 1 + R() * 0.6)
    }
  }
}

// -------------------------------------------------------------------------
export function house(c: Ctx, ox: number, oz: number, rot: number, seed: number) {
  const R = rng(seed)
  const L = new Local(c.B, c.lv, ox, G, oz, rot)
  const w = 11 + Math.floor(R() * 3),
    d = 10 + Math.floor(R() * 2),
    h = 3.3,
    th = 0.25
  const hw = w / 2,
    hd = d / 2
  const hue = R()
  const wallC = new THREE.Color().setHSL(hue, 0.6, 0.84)
  const roofC = new THREE.Color().setHSL((hue + 0.45 + R() * 0.1) % 1, 0.55, 0.55)
  L.box('wood', 0, 0, 0, w, 0.1, d, 0xffffff, 3)
  L.surf(-hw, -hd, hw, hd, 0.1, 'wood')
  const doorX = -hw + 3
  const win = (cc: number, ww = 2.4): Opening => ({ c: cc, w: ww, sill: 0.9, top: 2.4, kind: 'window' })
  const wl = (a: [number, number], b: [number, number], open: Opening[]) => L.wall({ mat: 'plaster', a, b, y0: 0.1, y1: h, th, open, color: wallC, tile: 4 })
  wl([-hw - th, hd + th / 2], [hw + th, hd + th / 2], [{ c: doorX, w: 1.8, sill: 0, top: 3.0, kind: 'door' }, win(hw - 3.2), win(0.8, 2)])
  wl([-hw - th, -hd - th / 2], [hw + th, -hd - th / 2], [win(-hw + 3), win(0), win(hw - 3)])
  wl([-hw - th / 2, -hd], [-hw - th / 2, hd], [win(-1.5), win(2.5)])
  wl([hw + th / 2, -hd], [hw + th / 2, hd], [win(-1.5), win(2.5)])
  wl([0, -hd], [0, hd], [{ c: hd - 3.5, w: 1.6, sill: 0, top: 3.0, kind: 'door' }]) // divisória
  L.box('frame', doorX, 0.1, hd + th + 0.05, 2.1, 0.08, 0.08, 0xffffff)
  L.box('plaster', 0, h, 0, w + 0.7, 0.22, d + 0.7, 0xffffff, 4)
  L.geo('roof', prismGeo(w + 1.4, d + 1.8, 2.6, 4), 0, h + 0.22, 0, roofC)
  L.box('plaster', hw - 2, h + 0.2, -1.5, 0.9, 3.4, 0.9, 0xd9a07a, 2)
  L.zone(-hw, -hd, hw, hd, 0, h - 0.05)

  // sala
  const lx = -hw / 2
  F.tvUnit(L, lx, 0.1, -hd + 0.5, 0)
  F.sofa(L, lx, 0.1, 1.2, Math.PI, PASTEL[Math.floor(R() * PASTEL.length)])
  F.rug(L, lx, 0.1, 0, 3.4, 2.8, [0xffb0d0, 0xb0e8ff, 0xd0ffb0][Math.floor(R() * 3)])
  F.table(L, lx, 0.1, -0.7, 1.1, 0.7, 0.4, 0xffffff)
  F.floorLamp(L, -hw + 0.6, 0.1, -hd + 0.6)
  F.plant(L, -hw + 0.7, 0.1, 1.5, 1.2)
  F.ceilingPanel(L, lx, h - 0.1, 0, 1.6, 0.8, true, 0xffe2b8)
  // quarto
  const rx = hw / 2
  F.bed(L, hw - 1.5, 0.1, -hd + 2.3, 0, PASTEL[Math.floor(R() * PASTEL.length)])
  F.desk(L, rx - 0.6, 0.1, -hd + 0.55, 0, [0x7fe0ff, 0xff9fd0, 0xb8ff8a][Math.floor(R() * 3)])
  F.floorLamp(L, 0.7, 0.1, hd - 0.7, 0xffd0e8, 5)
  F.plant(L, hw - 0.7, 0.1, hd - 0.8, 1.1, 0x58c860)
  L.box('wood', rx + 0.5, 0.1, hd - 0.5, 2.2, 2.3, 0.6, 0xffffff, 3)
  L.col(rx - 0.6, hd - 0.8, rx + 1.6, hd - 0.2, 0.1, 2.4)
  F.ceilingPanel(L, rx, h - 0.1, 0, 1.6, 0.8, true, 0xffd8f0)

  // quintal
  const fz = hd + 6.5
  const gapC = doorX
  const fx0 = -hw - 1.6,
    fx1 = hw + 1.6
  const picket = (x: number, z: number, ry: number) => L.box('plaster', x, 0, z, 0.09, 0.95, 0.05, 0xffffff, 1, ry)
  for (let x = fx0; x <= fx1; x += 0.36) if (Math.abs(x - gapC) > 1.25) picket(x, fz, 0)
  for (let z = hd + 1.5; z <= fz; z += 0.36) {
    picket(fx0, z, Math.PI / 2)
    picket(fx1, z, Math.PI / 2)
  }
  L.box('plaster', (fx0 + gapC - 1.25) / 2, 0.25, fz, gapC - 1.25 - fx0, 0.05, 0.05, 0xffffff)
  L.box('plaster', (fx1 + gapC + 1.25) / 2, 0.25, fz, fx1 - gapC - 1.25, 0.05, 0.05, 0xffffff)
  L.col(fx0, fz - 0.05, gapC - 1.25, fz + 0.05, 0, 0.95)
  L.col(gapC + 1.25, fz - 0.05, fx1, fz + 0.05, 0, 0.95)
  L.col(fx0 - 0.05, hd + 1.5, fx0 + 0.05, fz, 0, 0.95)
  L.col(fx1 - 0.05, hd + 1.5, fx1 + 0.05, fz, 0, 0.95)
  L.box('tile', doorX, 0, hd + 3.6, 1.5, 0.07, 7.2, 0xffffff, 2)
  for (let i = 0; i < 9; i++) {
    const fxp = -hw + 1 + R() * (w - 2)
    L.sph('leaf', fxp, 0.35, hd + 0.9, 0.3, 0x3fb34a, 0.9, 8, 6)
    L.sph('glowy', fxp + 0.1, 0.62, hd + 0.9, 0.12, PASTEL[Math.floor(R() * PASTEL.length)], 1, 6, 5)
  }
  // caixa de correio
  L.cyl('frame', gapC + 1.8, 0, fz + 0.4, 0.04, 0.04, 1, 0xffffff, 6)
  L.box('gloss', gapC + 1.8, 1, fz + 0.4, 0.3, 0.25, 0.4, 0xff6a8a)
  const [tx, tz] = L.w(hw + 4.5, hd + 3)
  c.trees.push({ x: tx, z: tz, y: G, s: 0.8 + R() * 0.6, type: R() < 0.7 ? 'round' : 'palm' })
  const [bx, bz] = L.w(-hw - 2.5, hd + 3)
  c.trees.push({ x: bx, z: bz, y: G, s: 0.8 + R() * 0.5, type: 'bush' })
  const [lx2, lz2] = L.w(gapC - 2.2, fz + 0.3)
  c.lv.lamps.push({ x: lx2, y: G + 2.2, z: lz2, color: 0xffe0a8, intensity: 12, night: true })
  L.cyl('frame', gapC - 2.2, 0, fz + 0.3, 0.04, 0.05, 2, 0xffffff, 6)
  L.sph('neon', gapC - 2.2, 2.1, fz + 0.3, 0.18, 0xffe0a8, 1, 8, 6)
}

// -------------------------------------------------------------------------
export function skyTower(c: Ctx, x: number, z: number, w: number, d: number, h: number, seed: number) {
  const R = rng(seed)
  const W = c.W
  const tint = [0xffffff, 0xd6fff0, 0xe0ecff, 0xfff0f8, 0xd6f4ff][Math.floor(R() * 5)]
  const uo = Math.floor(R() * 8) / 8
  W.box('solid', x, G, z, w, h, d, tint, 32, 0, uo, 0)
  let top = h
  if (R() < 0.6) {
    W.box('solid', x, G + h, z, w * 0.7, h * 0.15, d * 0.7, tint, 32, 0, uo, 0)
    top = h * 1.15
  }
  W.box('frame', x, G + top, z, w * 0.75 + 0.6, 0.5, d * 0.75 + 0.6, 0xffffff)
  const neonC = [0x7ee8ff, 0xb8ff7a, 0xff9ad0, 0xffe27a][Math.floor(R() * 4)]
  for (const sx of [-1, 1]) W.box('neon', x + (sx * w) / 2, G + 2, z + d / 2 + 0.06, 0.28, h - 3, 0.12, neonC)
  if (R() < 0.5) {
    W.sph('tint', x, G + top + 3, z, 4.5, 0x9fe8ff, 1, 14, 10)
    W.sph('neon', x, G + top + 3, z, 1.2, neonC, 1, 8, 6)
  } else {
    W.cyl('frame', x, G + top, z, 0.12, 0.35, 16, 0xffffff, 6)
    W.sph('neon', x, G + top + 16, z, 0.5, 0xff4a4a, 1, 8, 6)
  }
  c.lv.boxes.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, y0: G - 2, y1: G + h + 5 })
}

// -------------------------------------------------------------------------
export function buildCity(c: Ctx) {
  const W = c.W
  const R = rng(2003)
  const lv = c.lv

  // ruas
  road(c, -12, 75, 12, 265, 'road', 0.01)
  road(c, -22, 75, -12, 265, 'plaza')
  road(c, 12, 75, 22, 265, 'plaza')
  road(c, -240, 187, 130, 203, 'road', 0.03)
  road(c, -240, -108, 100, -92, 'road', 0.03)
  road(c, -148, -205, -132, 205, 'road', 0.06)
  road(c, -238, -205, -222, 205, 'road', 0.06)
  road(c, 75, -76, 124, -64, 'plaza', 0.02)
  // plaza da torre
  W.box('plaza', 0, G, 0, 150, 0.08, 150, 0xffffff, 6)
  lv.surfaces.push({ minX: -75, maxX: 75, minZ: -75, maxZ: 75, y: G + 0.08, mat: 'tile' })
  // plaza do portal
  W.box('plaza', 0, G, 300, 80, 0.08, 70, 0xffffff, 6)
  lv.surfaces.push({ minX: -40, maxX: 40, minZ: 265, maxZ: 335, y: G + 0.08, mat: 'tile' })
  for (const [r, col] of [
    [28, 0x7ee8ff],
    [46, 0xb8ff7a],
    [64, 0x7ee8ff],
  ] as [number, number][]) W.geo('neon', new THREE.RingGeometry(r, r + 0.4, 96).rotateX(-Math.PI / 2), 0, G + 0.1, 0, col)
  W.geo('neon', new THREE.RingGeometry(24, 24.5, 64).rotateX(-Math.PI / 2), 0, G + 0.1, 300, 0x7ee8ff)

  // portal de entrada (saída do tubo)
  const zg = TUBE.zEnd
  for (const sx of [-1, 1]) {
    W.box('frame', sx * 6.2, G, zg - 1, 1.2, 11, 1.2, 0xffffff)
    W.sph('neon', sx * 6.2, G + 11.4, zg - 1, 0.7, 0xb8ff7a, 1, 10, 8)
  }
  W.box('frame', 0, G + 10, zg - 1, 14, 1.2, 1.4, 0xffffff)
  W.box('neon', 0, G + 9.8, zg - 0.2, 12, 0.12, 0.1, 0x7ee8ff)
  addSign(c, W, 'AQUA CITY', 'Seja bem-vindo(a) · Cidade Frutiger Aero', 0, G + 12.6, zg - 1, 12, 3.4, 0)
  addSign(c, W, 'AQUA CITY', 'Volte sempre ♥', 0, G + 12.6, zg - 1.1, 12, 3.4, Math.PI, '#7be04a', '#27b6f0')
  lv.lamps.push({ x: 0, y: G + 6, z: zg - 6, color: 0x9ff6ff, intensity: 24, night: false })
  lv.discs.push({ x: -6.2, z: zg - 1, r: 0.8, y0: G, y1: G + 12 }, { x: 6.2, z: zg - 1, r: 0.8, y0: G, y1: G + 12 })

  // fontes
  for (const sx of [-18, 18]) {
    W.cyl('tile', sx, G, 300, 5.2, 5.4, 0.8, 0xffffff, 28)
    W.cyl('water', sx, G + 0.5, 300, 4.8, 4.8, 0.4, 0x4fd8ff, 28)
    W.sph('gloss', sx, G + 1.6, 300, 0.9, 0x7fe9ff, 1, 14, 10)
    c.lv.discs.push({ x: sx, z: 300, r: 5.4, y0: G, y1: G + 1.2 })
    c.fountains.push(new THREE.Vector3(sx, G + 1, 300))
    lv.lamps.push({ x: sx, y: G + 3, z: 300, color: 0x7fe9ff, intensity: 18, night: true })
  }
  c.fountains.push(new THREE.Vector3(0, G + 1, 0))

  // postes + palmeiras ao longo do bulevar
  for (let z = 80; z <= 330; z += 25) {
    lampPost(c, -13, z)
    lampPost(c, 13, z)
  }
  for (let z = 70; z <= 330; z += 14) {
    c.trees.push({ x: -17, z, y: G, s: 1 + R() * 0.3, type: 'palm' })
    c.trees.push({ x: 17, z: z + 7, y: G, s: 1 + R() * 0.3, type: 'palm' })
  }
  // anel de postes na plaza da torre
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    lampPost(c, Math.cos(a) * 52, Math.sin(a) * 52, i % 2 ? 0xbff6ff : 0xd8ffa8)
    c.trees.push({ x: Math.cos(a + 0.2) * 68, z: Math.sin(a + 0.2) * 68, y: G, s: 1.1, type: 'palm' })
  }
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) / 8) * Math.PI * 2
    F.bench(W, Math.cos(a) * 36, G + 0.08, Math.sin(a) * 36, -a + Math.PI / 2 + Math.PI)
  }

  // prédios do bulevar
  const names = [
    ['AQUA TELECOM', 'conectando você ao mundo'],
    ['CAFÉ BOLHA', 'sucos · smoothies · wifi'],
    ['VIDRO & CIA', 'arquitetura cristalina'],
    ['NETSPHERE', 'portal · chat · e-mail'],
    ['SPA ORBITAL', 'relax aqua'],
    ['AZUL TECH', 'inovação 2003'],
    ['PIXEL BANK', 'seu banco digital'],
    ['LIMÃO ARCADE', 'jogos · fliperama'],
    ['SKYLINE FM', 'a rádio da cidade'],
    ['ECO LAB', 'pesquisa verde'],
    ['SUSHI ONDA', 'sabor oceânico'],
    ['MEGA WEB', 'hospedagem'],
    ['CINEMA ORBE', 'em cartaz'],
    ['AQUA MALL', 'compras · fontes · aquários'],
  ]
  const slots = [305, 275, 245, 215, 175, 145, 115, 85]
  const gradients: [string, string][] = [
    ['#27b6f0', '#7be04a'],
    ['#7be04a', '#27b6f0'],
    ['#ff7ab8', '#ffb347'],
    ['#8a7bff', '#27d3f0'],
  ]
  const tints = [0xffffff, 0xd8ffee, 0xffe8f4, 0xe6efff, 0xfff6d8]
  const lk: ('office' | 'lounge')[] = ['office', 'lounge', 'office', 'office', 'lounge', 'office', 'office', 'lounge']
  const lf = [3, 2, 4, 3, 2, 5, 3, 2]
  slots.forEach((z, i) => {
    const d = 30
    const g = gradients[i % 4]
    office(c, -22 - d / 2, z, Math.PI / 2, { w: 24, d, floors: lf[i], kind: lk[i], seed: 100 + i, name: names[i][0], sub: names[i][1], tint: tints[i % 5], a: g[0], b: g[1] })
  })
  // lado direito: shopping + prédios
  office(c, 22 + 20, 290, -Math.PI / 2, { w: 54, d: 40, floors: 3, kind: 'mall', seed: 300, name: 'AQUA MALL', sub: names[13][1], tint: 0xe6f4ff, a: '#27b6f0', b: '#7be04a' })
  const rk: ('office' | 'lounge')[] = ['office', 'office', 'lounge', 'office', 'office', 'lounge']
  const rf = [4, 3, 2, 4, 3, 2]
  slots.slice(2).forEach((z, i) => {
    const d = 30
    const g = gradients[(i + 1) % 4]
    office(c, 22 + d / 2, z, -Math.PI / 2, { w: 24, d, floors: rf[i], kind: rk[i], seed: 200 + i, name: names[8 + i][0], sub: names[8 + i][1], tint: tints[(i + 2) % 5], a: g[0], b: g[1] })
  })

  // bairro residencial
  let hs = 1
  for (const sx of [-140, -230]) {
    for (let z = -176; z <= 176; z += 32) {
      if (Math.abs(z - 195) < 20) continue
      const off = 8 + 2 + 6.5 + 5.5
      house(c, sx - off, z, Math.PI / 2, hs++)
      house(c, sx + off, z + 6, -Math.PI / 2, hs++)
    }
  }

  // arranha-céus ao norte (não visitáveis)
  let ts = 1
  for (let x = -110; x <= 170; x += 46)
    for (let z = -340; z <= -128; z += 46) {
      const px = x + (R() - 0.5) * 14,
        pz = z + (R() - 0.5) * 14
      if (Math.hypot(px, pz) > 325) continue
      if (Math.hypot(px - DOME.x, pz - DOME.z) < DOME.r + 30) continue
      const w = 20 + R() * 12,
        d = 20 + R() * 12,
        h = 60 + R() * R() * 170 + (Math.hypot(px, pz) < 220 ? 40 : 0)
      skyTower(c, px, pz, w, d, h, ts++)
    }
  // torres ao sul-leste e oeste
  for (const [px, pz] of [
    [-100, 330],
    [100, 330],
    [-60, 360],
    [60, 365],
    [150, 120],
    [200, 150],
    [180, 230],
    [-110, 20],
    [-110, -40],
  ] as [number, number][]) {
    if (Math.hypot(px, pz) > 360) continue
    skyTower(c, px, pz, 22 + R() * 8, 22 + R() * 8, 45 + R() * 80, ts++)
  }

  // parques & vegetação
  const park = (x0: number, x1: number, z0: number, z1: number, n: number, avoid?: (x: number, z: number) => boolean) => {
    for (let i = 0; i < n; i++) {
      const x = x0 + R() * (x1 - x0),
        z = z0 + R() * (z1 - z0)
      if (Math.abs(z - 195) < 13 || Math.abs(z + 100) < 13 || Math.abs(x + 140) < 12 || Math.abs(x + 230) < 12) continue
      if (Math.abs(x) < 25 && z > 60 && z < 335) continue
      if (avoid && avoid(x, z)) continue
      c.trees.push({ x, z, y: G, s: 0.8 + R() * 0.9, type: R() < 0.55 ? 'round' : R() < 0.5 ? 'palm' : 'bush' })
    }
  }
  park(-112, -56, 100, 300, 45)
  park(68, 140, 100, 262, 40, (x, z) => Math.hypot(x - 120, z - 170) < 14)
  park(68, 140, 262, 330, 10, () => false)
  park(-108, -84, -90, 90, 14, (x, z) => Math.abs(x) < 80 && Math.abs(z) < 80)
  park(-340, -264, -190, 190, 40, (x, z) => Math.hypot(x, z) > 340)
  park(-200, -172, -190, 190, 40)
  for (let i = 0; i < 60; i++) {
    const a = R() * Math.PI * 2,
      r = 340 + R() * 32
    c.trees.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, y: G, s: 1 + R() * 0.7, type: 'palm' })
  }
  // bancos e flores nos parques
  for (let i = 0; i < 14; i++) {
    const x = -105 + R() * 46,
      z = 110 + R() * 180
    F.bench(W, x, G, z, R() * 6.28)
  }
  for (let i = 0; i < 160; i++) {
    const x = R() < 0.5 ? -112 + R() * 56 : 56 + R() * 84,
      z = 100 + R() * 220
    W.sph('glowy', x, G + 0.25, z, 0.18 + R() * 0.12, PASTEL[Math.floor(R() * PASTEL.length)], 1, 6, 5)
  }
  // caminhos nos parques
  road(c, -92, 100, -80, 300, 'plaza', 0.02)
  road(c, 90, 100, 102, 320, 'plaza', 0.02)
  road(c, 66, 164, 140, 176, 'plaza', 0.04)

  // colisão dos troncos
  for (const t of c.trees) lv.discs.push({ x: t.x, z: t.z, r: t.type === 'bush' ? 0.7 * t.s : 0.45, y0: G - 1, y1: G + 6 })
}
