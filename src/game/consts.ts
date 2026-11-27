// Constantes do mundo + funções de terreno compartilhadas
export const G = 1.0 // nível do chão da ilha
export const ISLAND_R = 380
export const DOME = { x: 215, z: -70, r: 95 }
export const POND = { x: DOME.x - 10, z: DOME.z + 8, r: 15 }
export const HILL = { x: DOME.x + 28, z: DOME.z - 28 }
export const TUBE = { zStart: 690, zFlat: 600, zUp: 385, zEnd: 330 }
export const WATER_Y = 0
export const POND_Y = G - 0.9

export const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const sm01 = (t: number) => {
  t = clamp(t, 0, 1)
  return t * t * (3 - 2 * t)
}
export const smooth = (a: number, b: number, x: number) => sm01((x - a) / (b - a))

export function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash2(ix: number, iz: number) {
  let h = (ix * 374761393 + iz * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
export function vnoise(x: number, z: number) {
  const ix = Math.floor(x),
    iz = Math.floor(z)
  const fx = sm01(x - ix),
    fz = sm01(z - iz)
  const a = hash2(ix, iz),
    b = hash2(ix + 1, iz),
    c = hash2(ix, iz + 1),
    d = hash2(ix + 1, iz + 1)
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fz)
}
export function fbm(x: number, z: number, oct = 4) {
  let a = 0.5,
    s = 0,
    n = 0
  for (let i = 0; i < oct; i++) {
    s += a * vnoise(x, z)
    n += a
    x *= 2.03
    z *= 2.03
    a *= 0.5
  }
  return s / n
}

// altura do piso do tubo (eixo z)
export function tubeY(z: number) {
  if (z >= TUBE.zFlat) return -34
  if (z <= TUBE.zUp) return G + 0.25
  const t = (TUBE.zFlat - z) / (TUBE.zFlat - TUBE.zUp)
  const s = t * t * (3 - 2 * t)
  return -34 + (G + 0.25 + 34) * s
}

export function domeDist(x: number, z: number) {
  return Math.hypot(x - DOME.x, z - DOME.z)
}

export function seabed(x: number, z: number) {
  const r = Math.hypot(x, z)
  const f = sm01((Math.abs(x) - 12) / 50)
  const w = smooth(420, 470, r)
  return -39 + (fbm(x * 0.012, z * 0.012) - 0.5) * 9 * w * f
}

export function terrainHeight(x: number, z: number) {
  const r = Math.hypot(x, z)
  let h: number
  if (r < ISLAND_R) h = G
  else if (r < 410) h = G - 7 * sm01((r - ISLAND_R) / 30)
  else if (r < 455) h = G - 7 - 33 * sm01((r - 410) / 45)
  else h = -39
  if (r >= 410) {
    const f = sm01((Math.abs(x) - 12) / 50)
    h += (fbm(x * 0.012, z * 0.012) - 0.5) * 9 * smooth(420, 470, r) * f
  }
  // jardim do domo: colinas, lagoa e cachoeira
  const dd = domeDist(x, z)
  if (dd < DOME.r) {
    const w = 1 - smooth(DOME.r - 32, DOME.r - 9, dd)
    if (w > 0) {
      const dp = Math.hypot(x - POND.x, z - POND.z)
      let add = (fbm(x * 0.035 + 7, z * 0.035 + 3) - 0.5) * 5 * smooth(14, 45, dp)
      const dh = Math.max(0, Math.hypot(x - HILL.x, z - HILL.z) - 6)
      add += 10 * Math.exp(-((dh / 13) ** 2))
      add -= 3.8 * Math.exp(-((dp / 13) ** 2))
      // corredor plano de entrada
      const door = 1 - smooth(8, 24, Math.hypot(x - (DOME.x - DOME.r + 6), z - DOME.z))
      add *= 1 - door
      h += add * w
    }
  }
  return h
}
