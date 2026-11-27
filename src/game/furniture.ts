import * as THREE from 'three'
import type { Local } from './builder'
import type { Ctx } from './ctx'

const quarter = (ry: number) => Math.abs(Math.sin(ry * 2)) < 0.01

export function plant(L: Local, x: number, y: number, z: number, s = 1, col = 0x3fb34a) {
  L.cyl('gloss', x, y, z, 0.3 * s, 0.22 * s, 0.45 * s, 0xffffff, 12)
  L.sph('leaf', x, y + 0.85 * s, z, 0.42 * s, col, 1.3, 10, 8)
  L.sph('leaf', x + 0.18 * s, y + 1.25 * s, z + 0.05 * s, 0.3 * s, new THREE.Color(col).offsetHSL(0.02, 0, 0.1), 1.2, 10, 8)
  L.sph('leaf', x - 0.2 * s, y + 1.05 * s, z - 0.1 * s, 0.28 * s, new THREE.Color(col).offsetHSL(-0.02, 0, -0.05), 1.2, 10, 8)
}

export function sofa(L: Local, x: number, y: number, z: number, ry: number, color: number) {
  const F = L.sub(x, y, z, ry)
  F.box('fabric', 0, 0.12, 0, 2.2, 0.38, 0.95, color)
  F.box('fabric', 0, 0.45, -0.38, 2.2, 0.55, 0.22, color)
  F.box('fabric', -1.03, 0.3, 0, 0.18, 0.35, 0.95, new THREE.Color(color).multiplyScalar(0.85))
  F.box('fabric', 1.03, 0.3, 0, 0.18, 0.35, 0.95, new THREE.Color(color).multiplyScalar(0.85))
  F.box('frame', -0.95, 0, 0.35, 0.08, 0.12, 0.08, 0xffffff)
  F.box('frame', 0.95, 0, 0.35, 0.08, 0.12, 0.08, 0xffffff)
  if (quarter(ry)) F.col(-1.1, -0.5, 1.1, 0.5, 0, 0.9)
}

export function table(L: Local, x: number, y: number, z: number, w: number, d: number, h: number, color = 0xffffff, mat = 'gloss', ry = 0) {
  const F = L.sub(x, y, z, ry)
  F.box(mat, 0, h - 0.06, 0, w, 0.06, d, color)
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) F.box('frame', sx * (w / 2 - 0.08), 0, sz * (d / 2 - 0.08), 0.06, h - 0.06, 0.06, 0xdfe9ee)
  if (quarter(ry)) F.col(-w / 2, -d / 2, w / 2, d / 2, 0, h)
}

export function screen(F: Local, x: number, y: number, z: number, w: number, h: number) {
  F.geo('screen', new THREE.PlaneGeometry(w, h), x, y, z)
}

export function tvUnit(L: Local, x: number, y: number, z: number, ry: number) {
  const F = L.sub(x, y, z, ry)
  F.box('wood', 0, 0, 0, 1.8, 0.5, 0.5, 0xffffff)
  F.box('frame', 0, 0.5, 0, 1.2, 0.7, 0.07, 0x1a2530)
  screen(F, 0, 0.85, 0.04, 1.1, 0.6)
  if (quarter(ry)) F.col(-0.9, -0.25, 0.9, 0.25, 0, 1.2)
}

export function imac(F: Local, x: number, y: number, z: number, color: number) {
  F.box('gloss', x, y, z, 0.5, 0.45, 0.42, color)
  F.box('frame', x, y, z + 0.05, 0.3, 0.05, 0.3, 0xffffff)
  screen(F, x, y + 0.24, z + 0.215, 0.38, 0.3)
}

export function desk(L: Local, x: number, y: number, z: number, ry: number, color: number) {
  const F = L.sub(x, y, z, ry)
  F.box('wood', 0, 0.72, 0, 1.7, 0.05, 0.8, 0xffffff)
  F.box('frame', -0.78, 0, 0, 0.06, 0.72, 0.7, 0xe2eef5)
  F.box('frame', 0.78, 0, 0, 0.06, 0.72, 0.7, 0xe2eef5)
  imac(F, 0.1, 0.77, -0.1, color)
  F.box('gloss', -0.45, 0.77, 0.1, 0.4, 0.02, 0.16, 0xffffff)
  // cadeira
  F.cyl('fabric', 0, 0.0, 0.8, 0.05, 0.05, 0.45, 0x888888, 6)
  F.box('fabric', 0, 0.45, 0.8, 0.5, 0.08, 0.5, color)
  F.box('fabric', 0, 0.55, 1.05, 0.5, 0.5, 0.07, color)
  if (quarter(ry)) F.col(-0.9, -0.4, 0.9, 0.4, 0, 1.0)
}

export function bed(L: Local, x: number, y: number, z: number, ry: number, color: number) {
  const F = L.sub(x, y, z, ry)
  F.box('wood', 0, 0.12, 0, 1.6, 0.3, 2.1, 0xffffff)
  F.box('fabric', 0, 0.42, 0.1, 1.5, 0.22, 1.85, color)
  F.box('fabric', 0, 0.62, -0.75, 1.2, 0.18, 0.4, 0xffffff)
  F.box('wood', 0, 0.12, -1.1, 1.7, 0.9, 0.1, 0xffffff)
  if (quarter(ry)) F.col(-0.85, -1.15, 0.85, 1.05, 0, 0.8)
}

export function floorLamp(L: Local, x: number, y: number, z: number, color = 0xffd9a0, intensity = 7) {
  L.cyl('frame', x, y, z, 0.2, 0.2, 0.05, 0xffffff, 10)
  L.cyl('frame', x, y, z, 0.025, 0.025, 1.6, 0xffffff, 6)
  L.cyl('neon', x, y + 1.5, z, 0.2, 0.3, 0.3, color, 10)
  L.lamp(x, y + 1.6, z, color, intensity, false)
}

export function ceilingPanel(L: Local, x: number, y: number, z: number, w: number, d: number, lamp = false, color = 0xfff0d8) {
  L.box('neon', x, y, z, w, 0.06, d, 0xffffff)
  if (lamp) L.lamp(x, y - 0.4, z, color, 12, false)
}

export function counter(L: Local, x: number, y: number, z: number, w: number, d: number, ry: number, color: number) {
  const F = L.sub(x, y, z, ry)
  F.box('gloss', 0, 0, 0, w, 1.05, d, color)
  F.box('tile', 0, 1.05, 0, w + 0.1, 0.07, d + 0.12, 0xffffff)
  F.box('neon', 0, 0.12, d / 2 + 0.01, w * 0.9, 0.06, 0.02, 0x9ff6ff)
  if (quarter(ry)) F.col(-w / 2, -d / 2, w / 2, d / 2, 0, 1.1)
}

export function bench(L: Local, x: number, y: number, z: number, ry: number, color = 0xffffff) {
  const F = L.sub(x, y, z, ry)
  F.box('wood', 0, 0.45, 0, 1.8, 0.07, 0.5, 0xffffff)
  F.box('wood', 0, 0.75, -0.22, 1.8, 0.4, 0.06, 0xffffff)
  for (const sx of [-0.8, 0.8]) F.box('frame', sx, 0, 0, 0.07, 0.45, 0.45, color)
  if (quarter(ry)) F.col(-0.9, -0.3, 0.9, 0.3, 0, 0.8)
}

export function tankAt(c: Ctx, L: Local, x: number, y: number, z: number, w: number, h: number, d: number, ry = 0) {
  const F = L.sub(x, y, z, ry)
  F.box('gloss', 0, 0, 0, w + 0.3, 0.8, d + 0.3, 0xf2fbff)
  F.box('tint', 0, 0.8, 0, w, h, d, 0x58d8ff)
  F.box('gloss', 0, 0.8 + h, 0, w + 0.3, 0.12, d + 0.3, 0xf2fbff)
  F.box('neon', 0, 0.8 + h - 0.02, 0, w * 0.9, 0.04, d * 0.8, 0xbdf4ff)
  F.box('leaf', -w * 0.25, 0.82, 0, 0.6, 0.9, 0.12, 0x2ea84a)
  F.box('leaf', w * 0.2, 0.82, d * 0.1, 0.4, 0.7, 0.1, 0x38c05a)
  F.sph('gloss', -w * 0.1, 0.95, -d * 0.1, 0.25, 0xe8896a, 0.7, 8, 6)
  if (quarter(ry)) F.col(-w / 2 - 0.15, -d / 2 - 0.15, w / 2 + 0.15, d / 2 + 0.15, 0, 0.8 + h)
  const [x0, z0] = L.w(x, z)
  const hw = (Math.abs(Math.sin(ry + L.rot)) < 0.5 ? w : d) / 2 - 0.35
  const hd = (Math.abs(Math.sin(ry + L.rot)) < 0.5 ? d : w) / 2 - 0.35
  c.tanks.push({ x0: x0 - hw, x1: x0 + hw, z0: z0 - hd, z1: z0 + hd, y0: L.oy + y + 1.0, y1: L.oy + y + 0.8 + h - 0.2 })
  L.lamp(x, y + 1.4, z, 0x7fe6ff, 6, false)
}

export function rug(L: Local, x: number, y: number, z: number, w: number, d: number, color: number) {
  L.box('rug', x, y, z, w, 0.03, d, color, Math.max(w, d))
}
