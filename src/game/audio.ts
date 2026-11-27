import type { Mat } from './physics'

export interface AudioEnv {
  underwater: number
  shelter: number
  dome: number
  rain: number
  storm: number
  alt: number
  night: number
  day: number
  shore: number
  fall: number
  fountain: number
  tube: number
  elev: number
}

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

const CHORDS = [
  { r: 41, n: [57, 60, 64, 67] }, // Fmaj9
  { r: 40, n: [55, 59, 62, 66] }, // Em9
  { r: 38, n: [57, 60, 64, 65] }, // Dm9
  { r: 36, n: [55, 59, 62, 64] }, // Cmaj9
  { r: 33, n: [55, 60, 64, 67] }, // Am9
  { r: 38, n: [57, 60, 64, 65] }, // Dm9
  { r: 34, n: [57, 62, 65, 69] }, // Bbmaj7
  { r: 43, n: [59, 62, 65, 69] }, // G9sus
]
const ARP = [0, 2, 1, 3, 2, 1, 3, 2, 0, 3, 2, 1, 2, 3, 1, 0]

export const MUSIC_TRACKS = [
  { name: 'Cristal · downtempo', bpm: 88, shift: 0, density: 0.82, wave: 'sawtooth', order: [0,1,2,3,4,5,6,7], arp: ARP, drums: 1 },
  { name: 'Maré Serena · ambient', bpm: 62, shift: 5, density: 0.42, wave: 'sine', order: [0,3,4,2,0,6,3,7], arp: [0,0,2,1,3,2,1,0,2,3,1,2,0,1,3,2], drums: 0 },
  { name: 'Expresso Neon · synthwave', bpm: 112, shift: -2, density: 0.96, wave: 'triangle', order: [4,2,0,7,4,6,2,7], arp: [0,1,2,3,0,1,2,3,3,2,1,0,3,2,1,0], drums: 1.2 },
  { name: 'Jardim Lunar · caixinha musical', bpm: 74, shift: 7, density: 0.65, wave: 'triangle', order: [2,4,1,0,6,3,2,7], arp: [3,1,2,0,2,1,0,2,3,2,0,1,2,0,1,3], drums: 0.25 },
] as const

export class AudioEngine {
  ctx: AudioContext | null = null
  master!: GainNode
  musicBus!: GainNode
  sfxBus!: GainNode
  ambBus!: GainNode
  musicFilter!: BiquadFilterNode
  reverb!: ConvolverNode
  revSend!: GainNode
  delay!: DelayNode
  delSend!: GainNode
  noise!: AudioBuffer
  volume = 0.7
  musicOn = true
  nextTime = 0
  stepN = 0
  bpm: number = 88
  track = 0
  shuffle = true

  setTrack(index: number) {
    this.track = Math.max(0, Math.min(MUSIC_TRACKS.length - 1, index))
    this.bpm = MUSIC_TRACKS[this.track].bpm
    this.stepN = 0
  }
  timer = 0
  energy = 1
  wantEnergy = 1
  env: AudioEnv = { underwater: 0, shelter: 0, dome: 0, rain: 0, storm: 0, alt: 0, night: 0, day: 1, shore: 0, fall: 0, fountain: 0, tube: 0, elev: 0 }
  g: Record<string, GainNode> = {}
  f: Record<string, BiquadFilterNode> = {}
  elevOsc!: OscillatorNode
  birdT = 2
  dingQ = 0

  start() {
    if (this.ctx) {
      void this.ctx.resume()
      return
    }
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctor()
    this.ctx = ctx
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -14
    comp.ratio.value = 3
    this.master = ctx.createGain()
    this.master.gain.value = this.volume
    this.master.connect(comp)
    comp.connect(ctx.destination)
    this.musicBus = ctx.createGain()
    this.musicBus.gain.value = 0.9
    this.sfxBus = ctx.createGain()
    this.sfxBus.gain.value = 0.8
    this.ambBus = ctx.createGain()
    this.ambBus.gain.value = 1
    this.sfxBus.connect(this.master)
    this.ambBus.connect(this.master)

    // reverb
    const len = ctx.sampleRate * 3
    const ir = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6)
    }
    this.reverb = ctx.createConvolver()
    this.reverb.buffer = ir
    const revOut = ctx.createGain()
    revOut.gain.value = 0.55
    this.reverb.connect(revOut)
    revOut.connect(this.master)
    this.revSend = ctx.createGain()
    this.revSend.gain.value = 1
    this.revSend.connect(this.reverb)

    this.musicFilter = ctx.createBiquadFilter()
    this.musicFilter.type = 'lowpass'
    this.musicFilter.frequency.value = 9000
    this.musicBus.connect(this.musicFilter)
    this.musicFilter.connect(this.master)
    this.musicFilter.connect(this.revSend)

    this.delay = ctx.createDelay(2)
    this.delay.delayTime.value = (60 / this.bpm) * 0.75
    const fb = ctx.createGain()
    fb.gain.value = 0.38
    const dl = ctx.createBiquadFilter()
    dl.type = 'lowpass'
    dl.frequency.value = 2800
    this.delay.connect(dl)
    dl.connect(fb)
    fb.connect(this.delay)
    this.delSend = ctx.createGain()
    this.delSend.gain.value = 1
    this.delSend.connect(this.delay)
    dl.connect(this.musicFilter)

    // ruído
    const nl = ctx.sampleRate * 2
    this.noise = ctx.createBuffer(1, nl, ctx.sampleRate)
    const nd = this.noise.getChannelData(0)
    for (let i = 0; i < nl; i++) nd[i] = Math.random() * 2 - 1

    this.buildAmbience()
    this.nextTime = ctx.currentTime + 0.2
    this.timer = window.setInterval(() => this.schedule(), 40)
  }

  private noiseSrc(name: string, type: BiquadFilterType, freq: number, q = 0.7, extra?: BiquadFilterNode) {
    const ctx = this.ctx!
    const s = ctx.createBufferSource()
    s.buffer = this.noise
    s.loop = true
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    const g = ctx.createGain()
    g.gain.value = 0
    s.connect(f)
    let last: AudioNode = f
    if (extra) {
      f.connect(extra)
      last = extra
    }
    last.connect(g)
    g.connect(this.ambBus)
    s.start(0, Math.random())
    this.g[name] = g
    this.f[name] = f
    return g
  }

  private buildAmbience() {
    const ctx = this.ctx!
    this.noiseSrc('wind', 'bandpass', 500, 0.5)
    // ondas com LFO
    const wave = this.noiseSrc('wave', 'lowpass', 600, 0.4)
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.09
    const lg = ctx.createGain()
    lg.gain.value = 0.5
    lfo.connect(lg)
    lg.connect(wave.gain)
    lfo.start()
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 9000
    this.noiseSrc('rain', 'highpass', 1200, 0.5, lp)
    this.f.rainLp = lp
    this.noiseSrc('uw', 'lowpass', 260, 0.7)
    this.noiseSrc('water', 'bandpass', 1900, 0.6)
    this.noiseSrc('fall', 'bandpass', 900, 0.4)
    // grilos
    const cg = ctx.createGain()
    cg.gain.value = 0
    const lfo2 = ctx.createOscillator()
    lfo2.frequency.value = 9
    lfo2.type = 'square'
    const l2g = ctx.createGain()
    l2g.gain.value = 0.5
    const am = ctx.createGain()
    am.gain.value = 0.5
    lfo2.connect(l2g)
    l2g.connect(am.gain)
    for (const fr of [4350, 4720]) {
      const o = ctx.createOscillator()
      o.frequency.value = fr
      o.connect(am)
      o.start()
    }
    lfo2.start()
    am.connect(cg)
    cg.connect(this.ambBus)
    this.g.crick = cg
    // zumbido do túnel
    const th = ctx.createGain()
    th.gain.value = 0
    for (const fr of [55, 82.5, 110.4]) {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = fr
      o.connect(th)
      o.start()
    }
    th.connect(this.ambBus)
    this.g.tube = th
    // elevador
    const eg = ctx.createGain()
    eg.gain.value = 0
    this.elevOsc = ctx.createOscillator()
    this.elevOsc.type = 'sawtooth'
    this.elevOsc.frequency.value = 60
    const ef = ctx.createBiquadFilter()
    ef.type = 'lowpass'
    ef.frequency.value = 260
    this.elevOsc.connect(ef)
    ef.connect(eg)
    eg.connect(this.ambBus)
    this.elevOsc.start()
    this.g.elev = eg
  }

  setVolume(v: number) {
    this.volume = v
    if (this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05)
  }
  setMusic(on: boolean) {
    this.musicOn = on
    if (this.ctx) this.musicBus.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.2)
  }

  update(dt: number, e: AudioEnv) {
    const ctx = this.ctx
    if (!ctx) return
    this.env = e
    const now = ctx.currentTime
    const T = 0.35
    const out = (1 - e.shelter) * (1 - e.underwater)
    const set = (n: string, v: number) => this.g[n].gain.setTargetAtTime(v, now, T)
    set('wind', (0.03 + 0.07 * e.storm + 0.28 * Math.min(1, e.alt / 500) + 0.04 * e.rain) * (1 - e.underwater) * (1 - 0.7 * e.shelter))
    this.f.wind.frequency.setTargetAtTime(350 + e.alt * 1.2 + e.storm * 300, now, T)
    set('wave', 0.09 * e.shore * (1 - e.underwater) * (1 - 0.6 * e.shelter))
    set('rain', e.rain * (e.underwater > 0.5 ? 0 : 0.22) * (1 - 0.15 * e.shelter))
    this.f.rainLp.frequency.setTargetAtTime(9000 - e.shelter * 7500 - e.dome * 1500, now, T)
    set('uw', 0.2 * e.underwater)
    set('water', 0.07 * e.fountain * (1 - e.underwater))
    set('fall', 0.11 * e.fall * (1 - e.underwater))
    set('crick', 0.018 * e.night * out * (1 - e.rain) * (1 - e.storm))
    set('tube', 0.05 * e.tube + 0.03 * e.underwater)
    set('elev', 0.09 * e.elev)
    this.elevOsc.frequency.setTargetAtTime(52 + e.elev * 70, now, 0.2)

    // música
    let en = 1
    en *= 1 - 0.55 * e.underwater
    en *= 1 - 0.3 * e.storm
    en *= 1 - 0.25 * e.night
    this.wantEnergy = en
    this.energy += (en - this.energy) * Math.min(1, dt * 0.8)
    const cut = 9000 - e.underwater * 8300 - e.shelter * 3500 - e.storm * 3000 - e.elev * 2500
    this.musicFilter.frequency.setTargetAtTime(Math.max(500, cut), now, 0.5)

    // pássaros
    this.birdT -= dt
    if (this.birdT <= 0) {
      this.birdT = 1.5 + Math.random() * 4
      if (e.dome > 0.5 && e.underwater < 0.3) this.exoticCall()
      else if (out > 0.5 && e.day > 0.4 && e.rain < 0.3 && e.alt < 80) this.chirp()
    }
  }

  private env2(g: GainNode, t: number, a: number, peak: number, dec: number) {
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + a)
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec)
  }

  private chirp() {
    const ctx = this.ctx!
    const t0 = ctx.currentTime
    const n = 2 + Math.floor(Math.random() * 4)
    const base = 2400 + Math.random() * 1800
    const pan = ctx.createStereoPanner()
    pan.pan.value = Math.random() * 2 - 1
    pan.connect(this.sfxBus)
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      const t = t0 + i * 0.13
      o.frequency.setValueAtTime(base, t)
      o.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.5), t + 0.07)
      this.env2(g, t, 0.01, 0.025 * (1 - this.env.shelter * 0.7), 0.08)
      o.connect(g)
      g.connect(pan)
      o.start(t)
      o.stop(t + 0.15)
    }
  }
  private exoticCall() {
    const ctx = this.ctx!
    const t = ctx.currentTime
    const pan = ctx.createStereoPanner()
    pan.pan.value = Math.random() * 2 - 1
    pan.connect(this.sfxBus)
    pan.connect(this.revSend)
    if (Math.random() < 0.5) {
      // pássaro tropical (glissando)
      const o = ctx.createOscillator()
      o.type = 'triangle'
      const g = ctx.createGain()
      const f = 900 + Math.random() * 900
      o.frequency.setValueAtTime(f, t)
      o.frequency.exponentialRampToValueAtTime(f * 2.2, t + 0.18)
      o.frequency.exponentialRampToValueAtTime(f * 0.8, t + 0.4)
      this.env2(g, t, 0.02, 0.05, 0.4)
      o.connect(g)
      g.connect(pan)
      o.start(t)
      o.stop(t + 0.6)
    } else {
      // sapo
      for (let i = 0; i < 3; i++) {
        const o = ctx.createOscillator()
        o.type = 'square'
        const g = ctx.createGain()
        const f = ctx.createBiquadFilter()
        f.type = 'lowpass'
        f.frequency.value = 600
        o.frequency.value = 130 + Math.random() * 40
        const tt = t + i * 0.16
        this.env2(g, tt, 0.01, 0.03, 0.1)
        o.connect(f)
        f.connect(g)
        g.connect(pan)
        o.start(tt)
        o.stop(tt + 0.2)
      }
    }
  }

  // ---------- música ----------
  private schedule() {
    const ctx = this.ctx
    if (!ctx || !this.musicOn) {
      if (ctx) this.nextTime = Math.max(this.nextTime, ctx.currentTime)
      return
    }
    const dur = 60 / this.bpm / 2
    while (this.nextTime < ctx.currentTime + 0.25) {
      this.playStep(this.stepN, this.nextTime)
      this.nextTime += dur
      this.stepN++
      if (this.shuffle && this.stepN >= 128) this.setTrack((this.track + 1) % MUSIC_TRACKS.length)
    }
  }

  private pluck(freq: number, t: number, vel: number, pan: number, long = 1) {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.value = freq
    const o2 = ctx.createOscillator()
    o2.type = 'triangle'
    o2.frequency.value = freq * 2.003
    const g = ctx.createGain()
    this.env2(g, t, 0.004, vel, 0.9 * long)
    const g2 = ctx.createGain()
    g2.gain.value = 0.35
    const p = ctx.createStereoPanner()
    p.pan.value = pan
    o.connect(g)
    o2.connect(g2)
    g2.connect(g)
    g.connect(p)
    p.connect(this.musicBus)
    p.connect(this.delSend)
    o.start(t)
    o2.start(t)
    o.stop(t + 1.2 * long + 0.2)
    o2.stop(t + 1.2 * long + 0.2)
  }

  private playStep(n: number, t: number) {
    const ctx = this.ctx!
    const bar = Math.floor(n / 16) % CHORDS.length
    const s = n % 16
    const track = MUSIC_TRACKS[this.track]
    const base = CHORDS[track.order[bar]]
    const ch = { r: base.r + track.shift, n: base.n.map((m) => m + track.shift) }
    const en = this.energy
    if (s === 0) {
      // pad
      for (const m of ch.n) {
        for (const det of [-6, 6]) {
          const o = ctx.createOscillator()
          o.type = track.wave
          o.frequency.value = mtof(m) * Math.pow(2, det / 1200)
          const f = ctx.createBiquadFilter()
          f.type = 'lowpass'
          f.frequency.value = 900
          const g = ctx.createGain()
          const d = (60 / this.bpm / 2) * 16
          g.gain.setValueAtTime(0.0001, t)
          g.gain.linearRampToValueAtTime(0.022, t + d * 0.35)
          g.gain.linearRampToValueAtTime(0.0001, t + d * 1.05)
          o.connect(f)
          f.connect(g)
          g.connect(this.musicBus)
          o.start(t)
          o.stop(t + d * 1.1)
        }
      }
    }
    // baixo
    if (s === 0 || s === 6 || s === 8 || s === 14) {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = mtof(ch.r + (s === 14 ? 12 : 0))
      const g = ctx.createGain()
      this.env2(g, t, 0.01, 0.2, 0.5)
      o.connect(g)
      g.connect(this.musicBus)
      o.start(t)
      o.stop(t + 0.7)
    }
    // arpejo
    if (Math.random() < track.density - 0.2 * (1 - en)) {
      const idx = track.arp[s]
      const m = ch.n[idx % 4] + (s % 8 > 3 ? 12 : 0) + (Math.random() < 0.15 ? 12 : 0)
      this.pluck(mtof(m), t, 0.07 + Math.random() * 0.04, Math.sin(n * 0.7) * 0.6)
    }
    // sino alto ocasional
    if (s === 0 && Math.random() < 0.6) this.pluck(mtof(ch.n[3] + 24), t + 0.02, 0.05, 0.4, 2)
    // percussão leve
    if (en * track.drums > 0.4) {
      if (s % 2 === 1) {
        const src = ctx.createBufferSource()
        src.buffer = this.noise
        const f = ctx.createBiquadFilter()
        f.type = 'highpass'
        f.frequency.value = 7000
        const g = ctx.createGain()
        this.env2(g, t, 0.002, 0.03 * en, 0.04)
        src.connect(f)
        f.connect(g)
        g.connect(this.musicBus)
        src.start(t, Math.random())
        src.stop(t + 0.08)
      }
      if (s === 0 || s === 8 || s === 11) {
        const o = ctx.createOscillator()
        o.frequency.setValueAtTime(130, t)
        o.frequency.exponentialRampToValueAtTime(42, t + 0.15)
        const g = ctx.createGain()
        this.env2(g, t, 0.002, 0.28 * en, 0.22)
        o.connect(g)
        g.connect(this.musicBus)
        o.start(t)
        o.stop(t + 0.3)
      }
      if (s === 4 || s === 12) {
        const src = ctx.createBufferSource()
        src.buffer = this.noise
        const f = ctx.createBiquadFilter()
        f.type = 'bandpass'
        f.frequency.value = 1900
        f.Q.value = 1.2
        const g = ctx.createGain()
        this.env2(g, t, 0.002, 0.07 * en, 0.1)
        src.connect(f)
        f.connect(g)
        g.connect(this.musicBus)
        src.start(t, Math.random())
        src.stop(t + 0.15)
      }
    }
    // blip de bolha
    if (Math.random() < 0.05) {
      const o = ctx.createOscillator()
      const f0 = 500 + Math.random() * 600
      o.frequency.setValueAtTime(f0, t)
      o.frequency.exponentialRampToValueAtTime(f0 * 2.4, t + 0.08)
      const g = ctx.createGain()
      this.env2(g, t, 0.005, 0.05, 0.1)
      o.connect(g)
      g.connect(this.musicBus)
      o.start(t)
      o.stop(t + 0.2)
    }
  }

  // ---------- efeitos ----------
  step(mat: Mat, sprint: boolean) {
    const ctx = this.ctx
    if (!ctx) return
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const f = ctx.createBiquadFilter()
    const g = ctx.createGain()
    let dur = 0.07,
      vol = 0.16
    switch (mat) {
      case 'grass':
        f.type = 'lowpass'
        f.frequency.value = 700
        vol = 0.12
        dur = 0.1
        break
      case 'sand':
        f.type = 'bandpass'
        f.frequency.value = 1100
        f.Q.value = 0.5
        vol = 0.1
        dur = 0.13
        break
      case 'water':
        f.type = 'bandpass'
        f.frequency.value = 1000
        f.Q.value = 0.8
        vol = 0.2
        dur = 0.2
        break
      case 'wood':
        f.type = 'bandpass'
        f.frequency.value = 420
        f.Q.value = 1.4
        vol = 0.28
        break
      default:
        f.type = 'highpass'
        f.frequency.value = 1500
        vol = 0.14
    }
    if (sprint) vol *= 1.35
    this.env2(g, t, 0.003, vol, dur)
    src.connect(f)
    f.connect(g)
    g.connect(this.sfxBus)
    if (mat === 'tile' || mat === 'glass' || mat === 'metal') g.connect(this.revSend)
    src.start(t, Math.random())
    src.stop(t + dur + 0.05)
    if (mat === 'tile' || mat === 'glass' || mat === 'metal') {
      const o = ctx.createOscillator()
      o.frequency.value = 1700 + Math.random() * 300
      const og = ctx.createGain()
      this.env2(og, t, 0.001, 0.015, 0.03)
      o.connect(og)
      og.connect(this.sfxBus)
      o.start(t)
      o.stop(t + 0.06)
    }
  }
  thump() {
    const ctx = this.ctx
    if (!ctx) return
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.frequency.setValueAtTime(110, t)
    o.frequency.exponentialRampToValueAtTime(40, t + 0.15)
    const g = ctx.createGain()
    this.env2(g, t, 0.003, 0.3, 0.2)
    o.connect(g)
    g.connect(this.sfxBus)
    o.start(t)
    o.stop(t + 0.3)
  }
  chime(i: number) {
    const ctx = this.ctx
    if (!ctx) return
    const sc = [0, 2, 4, 7, 9, 12, 14, 16, 19]
    const m = 72 + sc[((i % sc.length) + sc.length) % sc.length]
    const t = ctx.currentTime
    for (const [mul, v] of [
      [1, 0.14],
      [2.76, 0.05],
      [5.4, 0.02],
    ]) {
      const o = ctx.createOscillator()
      o.frequency.value = mtof(m) * mul
      const g = ctx.createGain()
      this.env2(g, t, 0.003, v, 1.8 / mul + 0.3)
      o.connect(g)
      g.connect(this.sfxBus)
      g.connect(this.revSend)
      o.start(t)
      o.stop(t + 2.2)
    }
  }
  ding(up = true) {
    this.chime(up ? 5 : 3)
    setTimeout(() => this.chime(up ? 8 : 1), 160)
  }
  click() {
    this.chime(3)
  }
  splash() {
    const ctx = this.ctx
    if (!ctx) return
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.setValueAtTime(600, t)
    f.frequency.exponentialRampToValueAtTime(2400, t + 0.3)
    const g = ctx.createGain()
    this.env2(g, t, 0.01, 0.3, 0.5)
    src.connect(f)
    f.connect(g)
    g.connect(this.sfxBus)
    g.connect(this.revSend)
    src.start(t, Math.random())
    src.stop(t + 0.7)
  }
  thunder(delay: number) {
    const ctx = this.ctx
    if (!ctx) return
    const t = ctx.currentTime + delay
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.setValueAtTime(380, t)
    f.frequency.exponentialRampToValueAtTime(70, t + 3)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(0.7 * (1 - this.env.shelter * 0.5), t + 0.15)
    g.gain.linearRampToValueAtTime(0.3, t + 0.9)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.6)
    src.connect(f)
    f.connect(g)
    g.connect(this.sfxBus)
    g.connect(this.revSend)
    src.start(t)
    src.stop(t + 3.8)
  }
  dispose() {
    clearInterval(this.timer)
    void this.ctx?.close()
    this.ctx = null
  }
}
