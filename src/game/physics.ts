import * as THREE from 'three'
import { terrainHeight, ISLAND_R, POND_Y } from './consts'

export type Mat = 'tile' | 'grass' | 'wood' | 'metal' | 'sand' | 'water' | 'glass'
export interface Box {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  y0: number
  y1: number
}
export interface Disc {
  x: number
  z: number
  r: number
  y0: number
  y1: number
  on?: () => boolean
}
export interface Ring {
  x: number
  z: number
  r: number
  thick: number
  y0: number
  y1: number
  gapA: number
  gapW: number
}
export interface Surface {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  cx?: number
  cz?: number
  rIn?: number
  rOut?: number
  y: number | ((x: number, z: number) => number)
  mat: Mat
}
export interface Zone {
  test: (x: number, y: number, z: number) => boolean
  kind: 'indoor' | 'dome' | 'tube'
}
export interface Conveyor {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  vx: number
  vz: number
}
export interface Interactable {
  x: number
  y: number
  z: number
  r: number
  label: () => string | null
  run: () => void
}
export interface Lamp {
  x: number
  y: number
  z: number
  color: number
  intensity: number
  night: boolean
}

export class Level {
  boxes: Box[] = []
  discs: Disc[] = []
  rings: Ring[] = []
  bounds: Disc[] = []
  surfaces: Surface[] = []
  zones: Zone[] = []
  conveyors: Conveyor[] = []
  interact: Interactable[] = []
  lamps: Lamp[] = []

  groundAt(x: number, z: number, feet: number): { y: number; mat: Mat } {
    let y = terrainHeight(x, z)
    let mat: Mat = Math.hypot(x, z) > ISLAND_R - 4 ? 'sand' : 'grass'
    if (y < POND_Y + 0.2 && Math.hypot(x, z) < ISLAND_R) mat = 'water'
    const lim = feet + 0.6
    for (const s of this.surfaces) {
      if (x < s.minX || x > s.maxX || z < s.minZ || z > s.maxZ) continue
      if (s.rOut !== undefined) {
        const d = Math.hypot(x - s.cx!, z - s.cz!)
        if (d > s.rOut || d < (s.rIn ?? 0)) continue
      }
      const sy = typeof s.y === 'number' ? s.y : s.y(x, z)
      if (sy <= lim && sy > y) {
        y = sy
        mat = s.mat
      }
    }
    return { y, mat }
  }

  zoneAt(x: number, y: number, z: number): Zone['kind'] | null {
    let best: Zone['kind'] | null = null
    for (const zn of this.zones) if (zn.test(x, y, z)) best = zn.kind === 'indoor' || !best ? zn.kind : best
    return best
  }
}

const TAU = Math.PI * 2
function angDiff(a: number, b: number) {
  let d = (a - b) % TAU
  if (d > Math.PI) d -= TAU
  if (d < -Math.PI) d += TAU
  return d
}

export interface Input {
  fx: number
  fz: number
  sprint: boolean
  jump: boolean
}

export class Player {
  pos = new THREE.Vector3()
  vel = new THREE.Vector3()
  yaw = 0
  pitch = 0
  grounded = false
  eye = 1.7
  radius = 0.36
  mat: Mat = 'grass'
  stepAcc = 0
  landed = false
  jumped = false
  speedNow = 0

  collide(lv: Level) {
    const r = this.radius
    const feet = this.pos.y
    for (let it = 0; it < 2; it++) {
      let px = this.pos.x,
        pz = this.pos.z
      for (const b of lv.boxes) {
        if (px < b.minX - r || px > b.maxX + r || pz < b.minZ - r || pz > b.maxZ + r) continue
        if (feet + 0.4 >= b.y1 || feet + 1.7 <= b.y0) continue
        const cx = Math.max(b.minX, Math.min(px, b.maxX))
        const cz = Math.max(b.minZ, Math.min(pz, b.maxZ))
        let dx = px - cx,
          dz = pz - cz
        const d2 = dx * dx + dz * dz
        if (d2 >= r * r) continue
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2)
          px = cx + (dx / d) * r
          pz = cz + (dz / d) * r
        } else {
          const l = px - b.minX,
            rr = b.maxX - px,
            t = pz - b.minZ,
            bt = b.maxZ - pz
          const m = Math.min(l, rr, t, bt)
          if (m === l) px = b.minX - r
          else if (m === rr) px = b.maxX + r
          else if (m === t) pz = b.minZ - r
          else pz = b.maxZ + r
        }
        dx = 0
        dz = 0
      }
      for (const d of lv.discs) {
        if (d.on && !d.on()) continue
        if (feet + 0.4 >= d.y1 || feet + 1.7 <= d.y0) continue
        const dx = px - d.x,
          dz = pz - d.z
        const dist = Math.hypot(dx, dz)
        if (dist < d.r + r) {
          const k = (d.r + r) / (dist || 1e-5)
          px = d.x + dx * k
          pz = d.z + dz * k
        }
      }
      for (const rg of lv.rings) {
        if (feet + 0.4 >= rg.y1 || feet + 1.7 <= rg.y0) continue
        const dx = px - rg.x,
          dz = pz - rg.z
        const dist = Math.hypot(dx, dz)
        if (Math.abs(dist - rg.r) > rg.thick / 2 + r) continue
        if (rg.gapW > 0 && Math.abs(angDiff(Math.atan2(dz, dx), rg.gapA)) * rg.r < rg.gapW / 2) continue
        const target = dist >= rg.r ? rg.r + rg.thick / 2 + r : rg.r - rg.thick / 2 - r
        const k = target / (dist || 1e-5)
        px = rg.x + dx * k
        pz = rg.z + dz * k
      }
      for (const b of lv.bounds) {
        if (b.on && !b.on()) continue
        if (feet < b.y0 || feet > b.y1) continue
        const dx = px - b.x,
          dz = pz - b.z
        const dist = Math.hypot(dx, dz)
        if (dist > b.r - r) {
          const k = (b.r - r) / dist
          px = b.x + dx * k
          pz = b.z + dz * k
        }
      }
      this.pos.x = px
      this.pos.z = pz
    }
  }

  update(dt: number, inp: Input, lv: Level, speedMul = 1) {
    dt = Math.max(0, Math.min(dt, 0.05))
    const sy = Math.sin(this.yaw),
      cy = Math.cos(this.yaw)
    // frente = (-sin, -cos); direita = (cos, -sin)
    let wx = -sy * inp.fz + cy * inp.fx
    let wz = -cy * inp.fz - sy * inp.fx
    const l = Math.hypot(wx, wz)
    if (l > 1) {
      wx /= l
      wz /= l
    }
    const inWater = this.mat === 'water'
    const sp = (inp.sprint ? 9.5 : 5.2) * speedMul * (inWater ? 0.6 : 1)
    const k = 1 - Math.exp(-(this.grounded ? 12 : 2.5) * dt)
    this.vel.x += (wx * sp - this.vel.x) * k
    this.vel.z += (wz * sp - this.vel.z) * k

    let cvx = 0,
      cvz = 0
    if (this.grounded)
      for (const c of lv.conveyors)
        if (this.pos.x > c.minX && this.pos.x < c.maxX && this.pos.z > c.minZ && this.pos.z < c.maxZ) {
          cvx += c.vx
          cvz += c.vz
        }
    const sx = this.pos.x,
      sz = this.pos.z
    this.pos.x += (this.vel.x + cvx) * dt
    this.pos.z += (this.vel.z + cvz) * dt
    this.collide(lv)

    this.landed = false
    this.jumped = false
    if (this.grounded && inp.jump) {
      this.vel.y = 5.7
      this.grounded = false
      this.jumped = true
    }
    const wasGrounded = this.grounded
    this.vel.y -= 15 * dt
    this.pos.y += this.vel.y * dt
    const g = lv.groundAt(this.pos.x, this.pos.z, this.pos.y)
    if (this.vel.y <= 0 && this.pos.y <= g.y + (wasGrounded ? 0.5 : 0)) {
      if (!wasGrounded && this.vel.y < -4) this.landed = true
      this.pos.y = g.y
      this.vel.y = 0
      this.grounded = true
      this.mat = g.mat
    } else this.grounded = false
    if (this.pos.y < -80) this.pos.y = -80

    const moved = Math.hypot(this.pos.x - sx - cvx * dt, this.pos.z - sz - cvz * dt)
    this.speedNow = moved / Math.max(dt, 1e-4)
    if (this.grounded) this.stepAcc += moved
  }
}
