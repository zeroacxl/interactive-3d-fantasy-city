import * as THREE from 'three'
import { rng } from './consts'

type Ctx = CanvasRenderingContext2D
function mk(w: number, h: number, draw: (c: Ctx, w: number, h: number) => void, o: { srgb?: boolean; repeat?: boolean } = {}) {
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const c = cv.getContext('2d')!
  draw(c, w, h)
  const t = new THREE.CanvasTexture(cv)
  t.wrapS = t.wrapT = o.repeat === false ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping
  t.colorSpace = o.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace
  t.anisotropy = 8
  t.needsUpdate = true
  return t
}

// ruído periódico (tileável)
function pnoise(N: number, cells: number, seed: number) {
  const r = rng(seed)
  const g = new Float32Array(cells * cells)
  for (let i = 0; i < g.length; i++) g[i] = r()
  const out = new Float32Array(N * N)
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const fx = (x / N) * cells,
        fy = (y / N) * cells
      const x0 = Math.floor(fx),
        y0 = Math.floor(fy)
      let tx = fx - x0,
        ty = fy - y0
      tx = tx * tx * (3 - 2 * tx)
      ty = ty * ty * (3 - 2 * ty)
      const X0 = x0 % cells,
        X1 = (x0 + 1) % cells,
        Y0 = y0 % cells,
        Y1 = (y0 + 1) % cells
      const a = g[Y0 * cells + X0],
        b = g[Y0 * cells + X1],
        c = g[Y1 * cells + X0],
        d = g[Y1 * cells + X1]
      out[y * N + x] = (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty
    }
  return out
}
function fbmP(N: number, oct: number, seed: number, base = 4) {
  const out = new Float32Array(N * N)
  let amp = 0.5,
    tot = 0
  for (let o = 0; o < oct; o++) {
    const n = pnoise(N, base * 2 ** o, seed + o * 17)
    for (let i = 0; i < out.length; i++) out[i] += n[i] * amp
    tot += amp
    amp *= 0.5
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot
  return out
}

function speckle(c: Ctx, w: number, h: number, n: number, colors: string[], size: number, seed: number) {
  const r = rng(seed)
  for (let i = 0; i < n; i++) {
    c.fillStyle = colors[Math.floor(r() * colors.length)]
    c.fillRect(r() * w, r() * h, size * (0.5 + r()), size * (0.5 + r()))
  }
}

export function makeTextures() {
  const T: Record<string, THREE.Texture> = {}

  T.grass = mk(512, 512, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, h)
    g.addColorStop(0, '#5cc83c')
    g.addColorStop(1, '#3fae3a')
    c.fillStyle = g
    c.fillRect(0, 0, w, h)
    const n = pnoise(128, 8, 3)
    const id = c.getImageData(0, 0, w, h)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const v = (n[(y >> 2) * 128 + (x >> 2)] - 0.5) * 50
        const i = (y * w + x) * 4
        id.data[i] += v * 0.7
        id.data[i + 1] += v
        id.data[i + 2] += v * 0.4
      }
    c.putImageData(id, 0, 0)
    const r = rng(5)
    for (let i = 0; i < 2600; i++) {
      const x = r() * w,
        y = r() * h
      c.strokeStyle = `hsla(${90 + r() * 30},70%,${30 + r() * 35}%,0.55)`
      c.lineWidth = 1
      c.beginPath()
      c.moveTo(x, y)
      c.lineTo(x + (r() - 0.5) * 5, y - 4 - r() * 9)
      c.stroke()
    }
  })

  T.sand = mk(256, 256, (c, w, h) => {
    c.fillStyle = '#f2e2b0'
    c.fillRect(0, 0, w, h)
    speckle(c, w, h, 2500, ['#e8d49a', '#fff3cc', '#dcc58a', '#f7ebc0'], 2, 9)
  })

  T.tiles = mk(256, 256, (c, w, h) => {
    c.fillStyle = '#9fdcf0'
    c.fillRect(0, 0, w, h)
    const n = 4,
      s = w / n
    const r = rng(11)
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const g = c.createLinearGradient(x * s, y * s, (x + 1) * s, (y + 1) * s)
        const k = 238 + Math.floor(r() * 14)
        g.addColorStop(0, `rgb(${k},${k + 6},255)`)
        g.addColorStop(1, `rgb(${k - 22},${k - 8},${k})`)
        c.fillStyle = g
        c.fillRect(x * s + 2, y * s + 2, s - 4, s - 4)
        c.fillStyle = 'rgba(255,255,255,.55)'
        c.fillRect(x * s + 4, y * s + 4, s - 8, 3)
      }
  })

  T.plaza = mk(256, 256, (c, w) => {
    const n = 8,
      s = w / n
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        c.fillStyle = (x + y) % 2 ? '#e6f6ff' : '#bfe6f7'
        c.fillRect(x * s, y * s, s, s)
        c.strokeStyle = 'rgba(80,170,210,.5)'
        c.strokeRect(x * s + 0.5, y * s + 0.5, s - 1, s - 1)
      }
  })

  T.road = mk(128, 256, (c, w, h) => {
    c.fillStyle = '#5d7080'
    c.fillRect(0, 0, w, h)
    speckle(c, w, h, 900, ['#68798a', '#506372', '#738595'], 2, 4)
    c.fillStyle = '#ffffff'
    c.fillRect(w / 2 - 2, 20, 4, 90)
    c.fillStyle = '#8be6ff'
    c.fillRect(4, 0, 3, h)
    c.fillRect(w - 7, 0, 3, h)
  })

  T.wood = mk(256, 256, (c, w, h) => {
    const r = rng(2)
    for (let i = 0; i < 8; i++) {
      const k = 150 + Math.floor(r() * 40)
      c.fillStyle = `rgb(${k + 40},${k},${k - 60})`
      c.fillRect(0, (i * h) / 8, w, h / 8)
      c.strokeStyle = 'rgba(90,50,20,.35)'
      for (let j = 0; j < 6; j++) {
        c.beginPath()
        c.moveTo(0, (i * h) / 8 + r() * (h / 8))
        c.lineTo(w, (i * h) / 8 + r() * (h / 8))
        c.stroke()
      }
      c.fillStyle = 'rgba(60,30,10,.55)'
      c.fillRect(0, (i * h) / 8, w, 1.5)
    }
  })

  T.plaster = mk(128, 128, (c, w, h) => {
    c.fillStyle = '#fafafa'
    c.fillRect(0, 0, w, h)
    speckle(c, w, h, 500, ['#f0f0f0', '#e6e6e6', '#ffffff'], 2, 6)
  })

  T.roof = mk(256, 256, (c, w, h) => {
    c.fillStyle = '#ffffff'
    c.fillRect(0, 0, w, h)
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        const ox = y % 2 ? 16 : 0
        c.fillStyle = `rgba(0,0,0,${0.04 + ((x * 7 + y * 3) % 5) * 0.025})`
        c.fillRect(x * 32 + ox, y * 32, 30, 30)
        c.fillStyle = 'rgba(0,0,0,.25)'
        c.fillRect(x * 32 + ox, y * 32 + 29, 32, 3)
      }
  })

  T.marble = mk(512, 512, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, h)
    g.addColorStop(0, '#f4fbff')
    g.addColorStop(1, '#d8eef8')
    c.fillStyle = g
    c.fillRect(0, 0, w, h)
    const n = fbmP(128, 4, 31)
    const id = c.getImageData(0, 0, w, h)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const v = n[(y >> 2) * 128 + (x >> 2)]
        const vein = Math.exp(-Math.pow((v - 0.5) * 14, 2)) * 70
        const i = (y * w + x) * 4
        id.data[i] -= vein * 0.9
        id.data[i + 1] -= vein * 0.5
        id.data[i + 2] -= vein * 0.2
      }
    c.putImageData(id, 0, 0)
    c.strokeStyle = 'rgba(90,170,210,.6)'
    c.lineWidth = 2
    c.strokeRect(1, 1, w - 2, h - 2)
    c.strokeRect(w / 2, 0, 0.1, h)
    c.strokeRect(0, h / 2, w, 0.1)
  })

  // fachadas de vidro 8x8 células (uma célula = 4m)
  const facade = (opaque: boolean) => {
    const map = mk(512, 512, (c, w, h) => {
      const s = w / 8
      const r = rng(opaque ? 77 : 78)
      c.clearRect(0, 0, w, h)
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++) {
          const g = c.createLinearGradient(x * s, y * s, x * s + s, y * s + s)
          const v = r()
          if (opaque) {
            g.addColorStop(0, `rgb(${110 + v * 40},${210 + v * 30},255)`)
            g.addColorStop(1, `rgb(${20 + v * 30},${110 + v * 30},${190 + v * 20})`)
          } else {
            g.addColorStop(0, `rgba(190,240,255,${0.3 + v * 0.1})`)
            g.addColorStop(1, `rgba(90,190,235,${0.16 + v * 0.1})`)
          }
          c.fillStyle = g
          c.fillRect(x * s, y * s, s, s)
          c.fillStyle = opaque ? 'rgba(255,255,255,.28)' : 'rgba(255,255,255,.2)'
          c.beginPath()
          c.moveTo(x * s + s * 0.1, y * s + s * 0.8)
          c.lineTo(x * s + s * 0.55, y * s + s * 0.1)
          c.lineTo(x * s + s * 0.75, y * s + s * 0.1)
          c.lineTo(x * s + s * 0.3, y * s + s * 0.8)
          c.fill()
          // espaçador (laje)
          c.fillStyle = 'rgba(245,250,252,0.97)'
          c.fillRect(x * s, y * s + s - 8, s, 8)
          c.fillStyle = 'rgba(255,255,255,.95)'
          c.fillRect(x * s, y * s, 3, s)
          c.fillRect(x * s + s / 2 - 1, y * s, 2, s - 8)
        }
    })
    const em = mk(512, 512, (c, w, h) => {
      const s = w / 8
      const r = rng(opaque ? 91 : 92)
      c.fillStyle = '#000'
      c.fillRect(0, 0, w, h)
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++)
          for (let k = 0; k < 2; k++) {
            if (r() < 0.5) {
              const col = r() < 0.7 ? '255,226,150' : r() < 0.5 ? '170,235,255' : '255,190,230'
              c.fillStyle = `rgba(${col},${0.55 + r() * 0.45})`
              c.fillRect(x * s + 4 + k * (s / 2 - 1), y * s + 6, s / 2 - 6, s - 18)
            }
          }
    })
    return { map, em }
  }
  const f1 = facade(false)
  const f2 = facade(true)
  T.glass = f1.map
  T.glassEm = f1.em
  T.solid = f2.map
  T.solidEm = f2.em

  const wn = fbmP(256, 5, 123, 4)
  T.waterN = mk(
    256,
    256,
    (c, w, h) => {
      const id = c.createImageData(w, h)
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const g = (xx: number, yy: number) => wn[((yy + h) % h) * w + ((xx + w) % w)]
          const nx = (g(x - 1, y) - g(x + 1, y)) * 14
          const ny = (g(x, y - 1) - g(x, y + 1)) * 14
          const l = Math.hypot(nx, ny, 1)
          const i = (y * w + x) * 4
          id.data[i] = ((nx / l) * 0.5 + 0.5) * 255
          id.data[i + 1] = ((ny / l) * 0.5 + 0.5) * 255
          id.data[i + 2] = ((1 / l) * 0.5 + 0.5) * 255
          id.data[i + 3] = 255
        }
      c.putImageData(id, 0, 0)
    },
    { srgb: false }
  )
  T.waterN.generateMipmaps = true

  const ca1 = fbmP(256, 3, 200, 3)
  const ca2 = fbmP(256, 3, 300, 3)
  T.caustic = mk(256, 256, (c, w, h) => {
    const id = c.createImageData(w, h)
    for (let i = 0; i < w * h; i++) {
      const a = 1 - Math.abs(ca1[i] - 0.5) * 2
      const b = 1 - Math.abs(ca2[i] - 0.5) * 2
      const v = Math.pow(a * b, 6) * 255 * 2.2
      id.data[i * 4] = v
      id.data[i * 4 + 1] = v
      id.data[i * 4 + 2] = v
      id.data[i * 4 + 3] = 255
    }
    c.putImageData(id, 0, 0)
  })

  T.glow = mk(
    128,
    128,
    (c, w, h) => {
      const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
      g.addColorStop(0, 'rgba(255,255,255,1)')
      g.addColorStop(0.25, 'rgba(255,255,255,.5)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      c.fillStyle = g
      c.fillRect(0, 0, w, h)
    },
    { repeat: false }
  )

  T.bubble = mk(
    128,
    128,
    (c, w, h) => {
      const g = c.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, w / 2)
      g.addColorStop(0, 'rgba(180,240,255,0.05)')
      g.addColorStop(0.85, 'rgba(200,245,255,0.35)')
      g.addColorStop(0.95, 'rgba(255,255,255,0.95)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      c.fillStyle = g
      c.fillRect(0, 0, w, h)
      c.fillStyle = 'rgba(255,255,255,.85)'
      c.beginPath()
      c.ellipse(w * 0.35, h * 0.3, w * 0.12, h * 0.07, -0.7, 0, 7)
      c.fill()
    },
    { repeat: false }
  )

  T.ray = mk(
    64,
    256,
    (c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h)
      g.addColorStop(0, 'rgba(255,255,255,.9)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      c.fillStyle = g
      c.fillRect(0, 0, w, h)
      const m = c.createLinearGradient(0, 0, w, 0)
      m.addColorStop(0, 'rgba(0,0,0,1)')
      m.addColorStop(0.5, 'rgba(0,0,0,0)')
      m.addColorStop(1, 'rgba(0,0,0,1)')
      c.globalCompositeOperation = 'destination-out'
      c.fillStyle = m
      c.fillRect(0, 0, w, h)
    },
    { repeat: false }
  )

  const flare = (kind: number) =>
    mk(
      256,
      256,
      (c, w, h) => {
        c.clearRect(0, 0, w, h)
        if (kind === 0) {
          const g = c.createRadialGradient(128, 128, 0, 128, 128, 128)
          g.addColorStop(0, 'rgba(255,255,255,1)')
          g.addColorStop(0.15, 'rgba(255,245,210,.7)')
          g.addColorStop(1, 'rgba(255,200,120,0)')
          c.fillStyle = g
          c.fillRect(0, 0, w, h)
        } else if (kind === 1) {
          c.strokeStyle = 'rgba(120,230,255,.7)'
          c.lineWidth = 6
          c.beginPath()
          c.arc(128, 128, 110, 0, 7)
          c.stroke()
          const g = c.createRadialGradient(128, 128, 90, 128, 128, 128)
          g.addColorStop(0, 'rgba(120,255,200,0)')
          g.addColorStop(1, 'rgba(120,255,200,.25)')
          c.fillStyle = g
          c.fillRect(0, 0, w, h)
        } else {
          c.fillStyle = 'rgba(180,255,170,.45)'
          c.beginPath()
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2
            c.lineTo(128 + Math.cos(a) * 100, 128 + Math.sin(a) * 100)
          }
          c.fill()
        }
      },
      { repeat: false }
    )
  T.flare0 = flare(0)
  T.flare1 = flare(1)
  T.flare2 = flare(2)

  T.bliss = mk(
    256,
    192,
    (c, w, h) => {
      const sky = c.createLinearGradient(0, 0, 0, h * 0.6)
      sky.addColorStop(0, '#2f7fe6')
      sky.addColorStop(1, '#a6dcff')
      c.fillStyle = sky
      c.fillRect(0, 0, w, h)
      c.fillStyle = 'rgba(255,255,255,.85)'
      for (const [x, y, s] of [
        [50, 30, 1],
        [160, 50, 1.4],
        [210, 24, 0.8],
      ])
        for (let i = 0; i < 5; i++) {
          c.beginPath()
          c.ellipse(x + i * 12 * s - 24, y + (i % 2) * 5, 22 * s, 10 * s, 0, 0, 7)
          c.fill()
        }
      const g = c.createLinearGradient(0, h * 0.5, 0, h)
      g.addColorStop(0, '#7ddc3a')
      g.addColorStop(1, '#2c8c18')
      c.fillStyle = g
      c.beginPath()
      c.moveTo(0, h * 0.75)
      c.quadraticCurveTo(w * 0.35, h * 0.38, w * 0.75, h * 0.62)
      c.quadraticCurveTo(w * 0.9, h * 0.7, w, h * 0.58)
      c.lineTo(w, h)
      c.lineTo(0, h)
      c.fill()
      c.fillStyle = 'rgba(255,255,255,.14)'
      c.fillRect(0, 0, w, h * 0.45)
    },
    { repeat: false }
  )

  T.chevron = mk(128, 128, (c, w, h) => {
    c.fillStyle = '#1b5f86'
    c.fillRect(0, 0, w, h)
    c.strokeStyle = '#9beaff'
    c.lineWidth = 9
    c.lineJoin = 'round'
    for (let i = 0; i < 2; i++) {
      c.beginPath()
      c.moveTo(24, i * 64 + 40)
      c.lineTo(64, i * 64 + 14)
      c.lineTo(104, i * 64 + 40)
      c.stroke()
    }
  })

  T.hexglass = mk(256, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h)
    c.fillStyle = 'rgba(205,245,255,0.10)'
    c.fillRect(0, 0, w, h)
    c.strokeStyle = 'rgba(255,255,255,.55)'
    c.lineWidth = 2
    const s = 32,
      hh = s * 0.866
    for (let y = -1; y < 9; y++)
      for (let x = -1; x < 9; x++) {
        const cx = x * s * 1.5,
          cy = y * hh * 2 + (x % 2 ? hh : 0)
        c.beginPath()
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2
          c.lineTo(cx + Math.cos(a) * s * 0.5 * 1.15, cy + Math.sin(a) * s * 0.5 * 1.15)
        }
        c.closePath()
        c.stroke()
      }
  })

  T.fern = mk(
    128,
    256,
    (c, w, h) => {
      c.clearRect(0, 0, w, h)
      c.strokeStyle = '#ffffff'
      c.lineWidth = 3
      c.beginPath()
      c.moveTo(w / 2, h)
      c.quadraticCurveTo(w / 2 - 6, h / 2, w / 2, 8)
      c.stroke()
      for (let i = 0; i < 22; i++) {
        const y = h - 18 - i * 10
        const l = (1 - i / 26) * 52
        c.lineWidth = 3
        c.beginPath()
        c.moveTo(w / 2, y)
        c.quadraticCurveTo(w / 2 - l * 0.6, y - 6, w / 2 - l, y + 6)
        c.moveTo(w / 2, y)
        c.quadraticCurveTo(w / 2 + l * 0.6, y - 6, w / 2 + l, y + 6)
        c.stroke()
      }
    },
    { repeat: false }
  )

  T.fall = mk(64, 256, (c, w, h) => {
    c.fillStyle = 'rgba(190,235,255,.5)'
    c.fillRect(0, 0, w, h)
    const r = rng(8)
    for (let i = 0; i < 40; i++) {
      c.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.6})`
      c.fillRect(r() * w, r() * h, 1 + r() * 3, 20 + r() * 80)
    }
  })

  T.rug = mk(128, 128, (c, w, h) => {
    c.fillStyle = '#ffffff'
    c.fillRect(0, 0, w, h)
    c.strokeStyle = 'rgba(0,0,0,.25)'
    c.lineWidth = 6
    c.strokeRect(8, 8, w - 16, h - 16)
    c.beginPath()
    c.arc(w / 2, h / 2, 30, 0, 7)
    c.stroke()
  })
  T.metal = mk(256, 256, (c, w, h) => {
    c.fillStyle = '#d1dce0'; c.fillRect(0, 0, w, h)
    const r = rng(452)
    for (let i = 0; i < 1800; i++) {
      c.strokeStyle = `rgba(45,70,80,${r() * 0.12})`
      const y = r() * h
      c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke()
    }
    c.strokeStyle = '#85999e'; c.strokeRect(2, 2, w - 4, h - 4)
    for (const x of [8, w - 8]) for (const y of [8, h - 8]) {
      c.fillStyle = '#667c85'; c.beginPath(); c.arc(x, y, 2, 0, Math.PI * 2); c.fill()
    }
  })
  T.fabric = mk(256, 256, (c, w, h) => {
    c.fillStyle = '#eee9df'; c.fillRect(0, 0, w, h)
    for (let i = 0; i < w; i += 3) {
      c.fillStyle = i % 2 ? '#c6c1b6' : '#faf8f0'
      c.fillRect(i, 0, 1, h); c.fillRect(0, i, w, 1)
    }
  })
  T.bark = mk(256, 256, (c, w, h) => {
    c.fillStyle = '#a6977c'; c.fillRect(0, 0, w, h)
    const r = rng(763)
    for (let i = 0; i < 260; i++) {
      const x = r() * w, y = r() * h
      c.strokeStyle = i % 2 ? '#c9b99b' : '#6b6050'
      c.lineWidth = 1 + r() * 3
      c.beginPath(); c.moveTo(x, y); c.bezierCurveTo(x - 6, y + 12, x + 6, y + 24, x, y + 50); c.stroke()
    }
  })
  return T
}

export function signTexture(title: string, sub: string, a = '#27b6f0', b = '#7be04a', w = 512, h = 160) {
  return mk(
    w,
    h,
    (c, W, H) => {
      const g = c.createLinearGradient(0, 0, W, H)
      g.addColorStop(0, a)
      g.addColorStop(1, b)
      c.fillStyle = g
      c.beginPath()
      c.roundRect(4, 4, W - 8, H - 8, 28)
      c.fill()
      const gl = c.createLinearGradient(0, 0, 0, H / 2)
      gl.addColorStop(0, 'rgba(255,255,255,.65)')
      gl.addColorStop(1, 'rgba(255,255,255,.05)')
      c.fillStyle = gl
      c.beginPath()
      c.roundRect(10, 8, W - 20, H / 2 - 4, [22, 22, 6, 6])
      c.fill()
      c.fillStyle = '#ffffff'
      c.shadowColor = 'rgba(0,70,110,.6)'
      c.shadowBlur = 8
      c.textAlign = 'center'
      c.font = `bold ${sub ? H * 0.38 : H * 0.5}px "Trebuchet MS", Verdana, sans-serif`
      c.fillText(title, W / 2, sub ? H * 0.55 : H * 0.66)
      if (sub) {
        c.font = `${H * 0.17}px "Trebuchet MS", Verdana, sans-serif`
        c.fillText(sub, W / 2, H * 0.82)
      }
    },
    { repeat: false }
  )
}
