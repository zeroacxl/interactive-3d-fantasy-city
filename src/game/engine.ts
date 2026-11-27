import * as THREE from 'three'
import { makeTextures } from './textures'
import { Batcher, Local, makeMaterials, type Shared } from './builder'
import { Level, Player } from './physics'
import { SkySystem, type Weather } from './sky'
import { Ocean } from './ocean'
import { createTerrain } from './terrain'
import { buildCity } from './city'
import { Tower, ELEV_NAMES } from './tower'
import { Dome } from './dome'
import { Venues } from './venues'
import { Railway } from './railway'
import { Life } from './life'
import { AudioEngine } from './audio'
import type { Ctx } from './ctx'
import { G, DOME, ISLAND_R, TUBE, tubeY, terrainHeight, smooth, clamp } from './consts'

export interface HudState {
  time: string
  hour: number
  weather: Weather
  area: string
  alt: number
  prompt: string | null
  elev: null | { names: string[]; current: number; moving: boolean; target: number }
  msg: string | null
  fps: number
  underwater: boolean
}
export type Place = 'tunel' | 'portal' | 'praca' | 'torre' | 'topo' | 'domo' | 'bairro' | 'praia' | 'estacao' | 'clube'

export class Game {
  renderer: THREE.WebGLRenderer
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(72, 1, 0.15, 5000)
  player = new Player()
  lv = new Level()
  audio = new AudioEngine()
  sky!: SkySystem
  ocean!: Ocean
  tower!: Tower
  dome!: Dome
  venues!: Venues
  railway!: Railway
  life!: Life
  sh: Shared = { time: { value: 0 }, night: { value: 0 }, glow: { value: 0.3 } }
  M!: ReturnType<typeof makeMaterials>
  keys = new Set<string>()
  pressed = new Set<string>()
  raf = 0
  last = 0
  disposed = false
  locked = false
  started = false
  sens = 1
  zoom = false
  zoomToggle = false
  zoomT = 0
  fov = 72
  uw = 0
  shelter = 0
  domeF = 0
  hudT = 0
  fps = 60
  fpsAcc = 0
  fpsN = 0
  msg: string | null = null
  msgT = 0
  lampT = 0
  lightPool: THREE.PointLight[] = []
  lampBuf: { d: number; i: number }[] = []
  hud: (h: HudState) => void = () => {}
  onLock: (l: boolean) => void = () => {}
  bob = 0
  elevName = ELEV_NAMES
  listeners: [EventTarget, string, EventListener][] = []

  constructor(public canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.camera.rotation.order = 'YXZ'
    this.resize()
  }

  build() {
    const T = makeTextures()
    this.M = makeMaterials(T, this.sh)
    const B = new Batcher()
    const world = new THREE.Group()
    this.scene.add(world)
    const ctx: Ctx = { B, lv: this.lv, M: this.M, T, sh: this.sh, scene: world, W: new Local(B, this.lv, 0, 0, 0, 0), trees: [], tanks: [], fountains: [] }

    const terrain = createTerrain(T)
    world.add(terrain.mesh, terrain.far)
    this.ocean = new Ocean(this.scene, this.lv, T, this.M, this.sh)
    this.sky = new SkySystem(this.scene, this.renderer, T)
    this.sky.onThunder = (d) => this.audio.thunder(d)
    buildCity(ctx)
    this.tower = new Tower(ctx)
    this.tower.onDing = (up) => this.audio.ding(up)
    this.tower.onZoom = () => {
      this.zoomToggle = !this.zoomToggle
      this.zoomT = 14
    }
    this.tower.onMsg = (s) => this.say(s)
    this.dome = new Dome(ctx, this.ocean.waterMat, this.sh)
    this.dome.onChime = (i) => this.audio.chime(i)
    this.dome.onSplash = () => this.audio.splash()
    this.dome.onMsg = (s) => this.say(s)
    this.life = new Life(ctx, this.scene, T, this.M)
    this.venues = new Venues(ctx)
    this.venues.onMsg = (s) => this.say(s)
    this.venues.onMusic = () => this.audio.setTrack((this.audio.track + 1) % 4)
    this.railway = new Railway(ctx)
    this.railway.onMsg = (s) => this.say(s)
    this.railway.onBell = () => this.audio.ding(true)
    B.finish(world, this.M)

    for (let i = 0; i < 8; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 34, 2)
      this.scene.add(l)
      this.lightPool.push(l)
    }
    this.sky.updateEnv()
    this.teleport('tunel')
    this.bindEvents()
  }

  say(s: string) {
    this.msg = s
    this.msgT = 4
  }

  resize = () => {
    const w = this.canvas.clientWidth || window.innerWidth,
      h = this.canvas.clientHeight || window.innerHeight
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  private on(t: EventTarget, ev: string, fn: EventListener) {
    t.addEventListener(ev, fn)
    this.listeners.push([t, ev, fn])
  }

  bindEvents() {
    this.on(window, 'resize', this.resize)
    this.on(window, 'keydown', ((e: KeyboardEvent) => {
      if (!this.locked) return
      if (!e.repeat) this.pressed.add(e.code)
      this.keys.add(e.code)
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault()
    }) as EventListener)
    this.on(window, 'keyup', ((e: KeyboardEvent) => {
      this.keys.delete(e.code)
    }) as EventListener)
    this.on(window, 'blur', (() => this.keys.clear()) as EventListener)
    this.on(document, 'mousemove', ((e: MouseEvent) => {
      if (!this.locked) return
      this.player.yaw -= e.movementX * 0.0022 * this.sens * (this.zoom ? 0.3 : 1)
      this.player.pitch = clamp(this.player.pitch - e.movementY * 0.0022 * this.sens * (this.zoom ? 0.3 : 1), -1.5, 1.5)
    }) as EventListener)
    this.on(document, 'pointerlockchange', (() => {
      this.locked = document.pointerLockElement === this.canvas
      if (!this.locked) {
        this.keys.clear()
        this.zoom = false
      }
      this.onLock(this.locked)
    }) as EventListener)
    this.on(this.canvas, 'mousedown', ((e: MouseEvent) => {
      if (this.locked && e.button === 2) this.zoom = true
    }) as EventListener)
    this.on(window, 'mouseup', ((e: MouseEvent) => {
      if (e.button === 2) this.zoom = false
    }) as EventListener)
    this.on(this.canvas, 'contextmenu', ((e: Event) => e.preventDefault()) as EventListener)
  }

  lock() {
    this.audio.start()
    this.started = true
    void this.canvas.requestPointerLock()
  }

  teleport(p: Place) {
    const pl = this.player
    this.railway.riding = false
    this.railway.exitRequested = false
    pl.vel.set(0, 0, 0)
    const set = (x: number, y: number, z: number, yaw: number) => {
      pl.pos.set(x, y, z)
      pl.yaw = yaw
      pl.pitch = 0
    }
    switch (p) {
      case 'tunel':
        set(0, tubeY(TUBE.zStart - 8) + 0.05, TUBE.zStart - 8, 0)
        break
      case 'portal':
        set(0, G + 0.2, TUBE.zEnd - 6, 0)
        break
      case 'praca':
        set(0, G + 0.2, 110, 0)
        break
      case 'torre':
        set(0, G + 0.2, 17, 0)
        break
      case 'topo':
        set(0, this.tower.floors[4] + 0.1, 6, Math.PI)
        break
      case 'domo':
        set(DOME.x - DOME.r + 14, terrainHeight(DOME.x - DOME.r + 14, DOME.z) + 0.1, DOME.z, -Math.PI / 2)
        break
      case 'bairro':
        set(-186, G + 0.2, 20, Math.PI / 2)
        break
      case 'clube':
        set(-105, G + 0.3, -201, 0)
        break
      case 'estacao':
        set(0, G + 0.3, 310, Math.PI)
        break
      case 'praia':
        set(0, G + 0.2, 366, Math.PI)
        break
    }
  }

  setQuality(high: boolean) {
    this.renderer.setPixelRatio(high ? Math.min(window.devicePixelRatio, 1.75) : 1)
    this.sky.sun.shadow.mapSize.set(high ? 2048 : 1024, high ? 2048 : 1024)
    this.sky.sun.shadow.map?.dispose()
    ;(this.sky.sun.shadow as THREE.LightShadow).map = null
    this.resize()
  }

  start() {
    this.last = performance.now()
    const loop = () => {
      if (this.disposed) return
      this.raf = requestAnimationFrame(loop)
      const now = performance.now()
      const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000))
      this.last = now
      this.frame(dt, now / 1000)
    }
    this.raf = requestAnimationFrame(loop)
  }

  key(c: string) {
    return this.keys.has(c)
  }

  frame(dt: number, t: number) {
    dt = Math.max(0, Math.min(0.05, dt))
    const pl = this.player
    const cam = this.camera
    this.sh.time.value = t
    this.fpsAcc += dt
    this.fpsN++
    if (this.fpsAcc > 0.5) {
      this.fps = Math.round(this.fpsN / this.fpsAcc)
      this.fpsAcc = 0
      this.fpsN = 0
    }

    // ---------- entrada ----------
    if (this.locked) {
      const fz = (this.key('KeyW') || this.key('ArrowUp') ? 1 : 0) - (this.key('KeyS') || this.key('ArrowDown') ? 1 : 0)
      const fx = (this.key('KeyD') || this.key('ArrowRight') ? 1 : 0) - (this.key('KeyA') || this.key('ArrowLeft') ? 1 : 0)
      const inp = { fx, fz, sprint: this.key('ShiftLeft') || this.key('ShiftRight'), jump: this.key('Space') }
      this.tower.update(dt, pl, this.sky.night, t)
      pl.update(dt, inp, this.lv)
      if (this.pressed.has('KeyH') && this.railway.riding) { this.audio.ding(false); this.say('Aqua Express · passagem livre!') }
      if (this.pressed.has('KeyE')) this.interactNow()
      for (let i = 1; i <= 5; i++) if (this.pressed.has('Digit' + i)) this.tower.select(i - 1)
    } else {
      this.tower.update(dt, pl, this.sky.night, t)
      pl.update(dt, { fx: 0, fz: 0, sprint: false, jump: false }, this.lv)
    }
    this.pressed.clear()

    this.railway.update(dt, pl)
    this.venues.update(t)

    // passos
    const sprint = this.key('ShiftLeft')
    if (pl.grounded && pl.stepAcc > (sprint ? 3.0 : 2.1)) {
      pl.stepAcc = 0
      this.audio.step(pl.mat, sprint)
    }
    if (pl.landed) this.audio.thump()

    // ---------- câmera ----------
    const moving = pl.grounded ? Math.min(1, pl.speedNow / 5) : 0
    this.bob += pl.speedNow * dt * (sprint ? 1.4 : 1.7)
    const bobY = Math.sin(this.bob * 1.6) * 0.045 * moving
    cam.position.set(pl.pos.x, pl.pos.y + pl.eye + bobY, pl.pos.z)
    cam.rotation.set(pl.pitch, pl.yaw, Math.sin(this.bob * 0.8) * 0.004 * moving)
    if (this.zoomToggle) {
      this.zoomT -= dt
      if (this.zoomT <= 0) this.zoomToggle = false
    }
    const zoomOn = this.zoom || this.zoomToggle || this.key('KeyC')
    const tf = zoomOn ? 16 : sprint && moving > 0.5 ? 78 : 72
    this.fov += (tf - this.fov) * (1 - Math.exp(-dt * 8))
    if (Math.abs(cam.fov - this.fov) > 0.01) {
      cam.fov = this.fov
      cam.updateProjectionMatrix()
    }

    // ---------- ambiente ----------
    const r = Math.hypot(cam.position.x, cam.position.z)
    const uwT = r > 385 ? smooth(0.3, -1.0, cam.position.y) : 0
    const k = 1 - Math.exp(-dt * 3)
    this.uw += (uwT - this.uw) * k
    const zone = this.lv.zoneAt(cam.position.x, cam.position.y, cam.position.z)
    const shT = zone === 'indoor' ? 1 : zone === 'dome' ? 0.95 : zone === 'tube' ? 0.9 : 0
    this.shelter += (shT - this.shelter) * k
    this.domeF += ((zone === 'dome' ? 1 : 0) - this.domeF) * k
    const alt = Math.max(0, cam.position.y - G)

    this.sky.update(dt, cam, { underwater: this.uw, shelter: this.shelter, dome: this.domeF, alt })
    const sky = this.sky
    this.sh.night.value = sky.night
    this.sh.glow.value = 0.12 + 1.5 * sky.night + 0.15 * sky.cover * (1 - sky.night)
    ;(this.M.solid as THREE.MeshStandardMaterial).emissiveIntensity = sky.night * 1.7
    ;(this.M.glass as THREE.MeshStandardMaterial).emissiveIntensity = sky.night * 2.4
    this.ocean.update(dt, t, cam, sky, { underwater: this.uw })
    this.dome.update(dt, t, pl, sky.night)
    this.life.update(dt, t, cam.position, { day: sky.daylight, night: sky.night, storm: sky.storm, underwater: this.uw, outdoors: 1 - this.shelter })
    this.updateLamps(dt, cam.position, sky.night)

    // ---------- áudio ----------
    const dfall = Math.hypot(pl.pos.x - this.dome.fallPos.x, pl.pos.z - this.dome.fallPos.z)
    const dfount = Math.min(Math.hypot(pl.pos.x + 18, pl.pos.z - 300), Math.hypot(pl.pos.x - 18, pl.pos.z - 300))
    this.audio.update(dt, {
      underwater: this.uw,
      shelter: this.shelter,
      dome: this.domeF,
      rain: sky.rain,
      storm: sky.storm,
      alt,
      night: sky.night,
      day: sky.daylight,
      shore: smooth(ISLAND_R - 130, ISLAND_R - 10, r) * (r < 460 ? 1 : 0.3),
      fall: this.domeF > 0.5 ? smooth(60, 8, dfall) : 0,
      fountain: smooth(45, 6, dfount),
      tube: zone === 'tube' ? 1 : 0,
      elev: this.tower.car.playerOn ? Math.min(1, this.tower.car.vel / 40) : 0,
    })

    // ---------- HUD ----------
    this.msgT -= dt
    if (this.msgT <= 0) this.msg = null
    this.hudT -= dt
    if (this.hudT <= 0) {
      this.hudT = 0.12
      const car = this.tower.car
      this.hud({
        time: sky.hourText(),
        hour: sky.hour,
        weather: sky.weather,
        area: this.areaName(zone),
        alt: Math.round(alt),
        prompt: this.locked ? this.currentPrompt() : null,
        elev: car.playerOn ? { names: ELEV_NAMES, current: car.at, moving: car.moving, target: car.target } : null,
        msg: this.msg,
        fps: this.fps,
        underwater: this.uw > 0.5,
      })
    }

    this.renderer.render(this.scene, cam)
  }

  nearest() {
    const pl = this.player
    let best: (typeof this.lv.interact)[number] | null = null
    let bd = 1e9
    for (const it of this.lv.interact) {
      const dx = it.x - pl.pos.x,
        dz = it.z - pl.pos.z
      if (Math.abs(it.y - pl.pos.y) > 3.2) continue
      const d = Math.hypot(dx, dz)
      if (d > it.r || d >= bd) continue
      if (it.label() === null) continue
      bd = d
      best = it
    }
    return best
  }
  currentPrompt() {
    if (this.railway.riding) return this.railway.exitRequested ? 'Desembarque solicitado · aguardando estação' : 'E · Solicitar desembarque do trem'
    const n = this.nearest()
    return n ? n.label() : null
  }
  interactNow() {
    if (this.railway.riding) { this.railway.requestExit(); return }
    const n = this.nearest()
    if (n) n.run()
  }

  areaName(zone: string | null) {
    const p = this.player.pos
    const r = Math.hypot(p.x, p.z)
    if (zone === 'tube') return p.y < -2 ? 'Túnel Submarino · Entrada' : 'Túnel de Cristal'
    if (r < 60 && p.y > G + 20 && zone !== 'dome') {
      let best = 0,
        bd = 1e9
      this.tower.floors.forEach((f, i) => {
        const d = Math.abs(f - p.y)
        if (d < bd) {
          bd = d
          best = i
        }
      })
      if (bd < 8) return 'Torre Cristal · ' + ELEV_NAMES[best]
      return 'Torre Cristal · no ar'
    }
    if (zone === 'dome') return 'Jardim Exótico · Domo de Cristal'
    if (r < 26) return 'Torre Cristal · Saguão'
    if (Math.hypot(p.x - DOME.x, p.z - DOME.z) < DOME.r + 6) return 'Domo de Cristal · Entrada'
    if (r > ISLAND_R - 12) return p.y < 0 ? 'Mar Aberto' : 'Praia de Aqua City'
    if (p.x < -100) return 'Bairro das Casas'
    if (Math.abs(p.x) < 65 && p.z > 70) return p.z > 262 ? 'Portal de Entrada' : 'Bulevar Aqua'
    if (Math.abs(p.x) < 82 && Math.abs(p.z) < 82) return 'Praça da Torre'
    if (p.z < -108) return 'Distrito Cristal'
    return 'Parque Aqua'
  }

  updateLamps(dt: number, cp: THREE.Vector3, night: number) {
    this.lampT -= dt
    if (this.lampT > 0) return
    this.lampT = 0.15
    const nf = smooth(0.08, 0.55, night)
    const best: { i: number; d: number }[] = []
    const L = this.lv.lamps
    for (let i = 0; i < L.length; i++) {
      const l = L[i]
      if (l.night && nf < 0.02) continue
      const dx = l.x - cp.x,
        dy = l.y - cp.y,
        dz = l.z - cp.z
      const d = dx * dx + dy * dy + dz * dz
      if (d > 3600) continue
      if (best.length < 8) {
        best.push({ i, d })
        best.sort((a, b) => a.d - b.d)
      } else if (d < best[7].d) {
        best[7] = { i, d }
        best.sort((a, b) => a.d - b.d)
      }
    }
    for (let k = 0; k < 8; k++) {
      const pl = this.lightPool[k]
      if (k < best.length) {
        const l = L[best[k].i]
        pl.position.set(l.x, l.y, l.z)
        pl.color.setHex(l.color)
        pl.intensity = l.intensity * (l.night ? nf : 1) * 1.4
      } else pl.intensity = 0
    }
  }

  // API da UI
  setHour(h: number) {
    this.sky.hour = h
  }
  setWeather(w: Weather) {
    this.sky.weatherAuto = false
    this.sky.setWeather(w)
  }
  setWeatherAuto(a: boolean) {
    this.sky.weatherAuto = a
  }
  setTimeFlow(a: boolean, minutesPerDay: number) {
    this.sky.auto = a
    this.sky.speed = 24 / (minutesPerDay * 60)
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    for (const [t, e, f] of this.listeners) t.removeEventListener(e, f)
    this.listeners = []
    if (document.pointerLockElement === this.canvas) document.exitPointerLock()
    this.audio.dispose()
    this.renderer.dispose()
  }
}
