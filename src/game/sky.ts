import * as THREE from 'three'
import { Lensflare, LensflareElement } from 'three/examples/jsm/objects/Lensflare.js'
import { clamp, lerp, sm01, smooth } from './consts'

export type Weather = 'sunny' | 'cloudy' | 'rain' | 'storm'
const TARGETS: Record<Weather, { cover: number; rain: number; storm: number }> = {
  sunny: { cover: 0.18, rain: 0, storm: 0 },
  cloudy: { cover: 0.62, rain: 0, storm: 0 },
  rain: { cover: 0.88, rain: 0.65, storm: 0 },
  storm: { cover: 1, rain: 1, storm: 1 },
}

const skyVert = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0);
  gl_Position = p.xyww;
}`
const skyFrag = /* glsl */ `
varying vec3 vDir;
uniform vec3 topCol, horCol, botCol, sunDir, sunCol, moonDir, cloudLit, cloudDark, uwCol;
uniform float time, cover, night, sunI, uw, flash;
float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float hash3(vec3 p){ p = fract(p*0.3183099+.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*noise(p); p=p*2.03+vec2(1.7,9.2); a*=.5; } return s; }
void main(){
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(horCol, topCol, pow(clamp(h,0.,1.), 0.42));
  col = mix(col, botCol, smoothstep(0.0,-0.12,h));
  float above = smoothstep(-0.06, 0.03, h);
  float sd = max(dot(d,sunDir),0.);
  col += sunCol * (pow(sd,3000.)*14. + pow(sd,120.)*0.55 + pow(sd,8.)*0.22) * sunI * above;
  float md = dot(d,moonDir);
  col += vec3(.92,.96,1.) * smoothstep(.99935,.99965,md) * night * (1.-cover*.85) * above;
  col += vec3(.5,.62,.9) * pow(max(md,0.),50.) * .16 * night * (1.-cover*.7) * above;
  if(night>0.02 && h>0.0){
    vec3 p = d*190.; vec3 ip = floor(p);
    float r = hash3(ip);
    float tw = .55+.45*sin(time*2.3+r*80.);
    col += vec3(1.,.97,.9) * step(.9955,r) * tw * night * (1.-cover) * smoothstep(0.,.12,h);
  }
  if(h>0.0){
    vec2 uv = d.xz/(h+0.16)*1.25 + vec2(time*0.010, time*0.004);
    float n = fbm(uv);
    float th = mix(0.66, 0.30, cover);
    float c = smoothstep(th, th+0.22, n);
    float n2 = fbm(uv + sunDir.xz*0.10);
    float lit = clamp(0.55 + (n-n2)*3.2, 0., 1.);
    vec3 cc = mix(cloudDark, cloudLit, lit);
    cc += vec3(.9,.95,1.)*flash;
    c *= smoothstep(0.0, 0.10, h);
    col = mix(col, cc, c*mix(0.9,1.0,cover));
  }
  col += vec3(.75,.8,1.)*flash*0.35;
  col = mix(col, uwCol, uw);
  gl_FragColor = vec4(col,1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

const C = (h: number) => new THREE.Color(h)

export class SkySystem {
  hour = 10.5
  speed = 0.045
  auto = true
  weatherAuto = true
  weather: Weather = 'sunny'
  cover = 0.18
  rain = 0
  storm = 0
  flash = 0
  daylight = 1
  night = 0
  sunElev = 1
  sunDir = new THREE.Vector3(0, 1, 0)
  rainTime = 0
  rbTimer = 0
  rbArm = false
  wTimer = 120
  lightningT = 6
  thunderQ: number[] = []
  envT = 0
  fog = new THREE.FogExp2(0xaadfff, 0.0012)
  skyMat: THREE.ShaderMaterial
  sky: THREE.Mesh
  skyScene = new THREE.Scene()
  sun: THREE.DirectionalLight
  hemi: THREE.HemisphereLight
  rainMat: THREE.ShaderMaterial
  rainMesh: THREE.LineSegments
  rainbow: THREE.Mesh
  flare: Lensflare
  flareEls: LensflareElement[] = []
  flareCols = [0xfff2cc, 0x88eeff, 0xaaffaa, 0xffd0ff, 0x88ccff]
  cube: THREE.WebGLCubeRenderTarget
  cubeCam: THREE.CubeCamera
  pmrem: THREE.PMREMGenerator
  envRT: THREE.WebGLRenderTarget | null = null
  topC = new THREE.Color()
  horC = new THREE.Color()
  fogC = new THREE.Color()
  onThunder: (delay: number) => void = () => {}

  constructor(
    public scene: THREE.Scene,
    public renderer: THREE.WebGLRenderer,
    T: Record<string, THREE.Texture>
  ) {
    scene.fog = this.fog
    const u = (v: THREE.Color | THREE.Vector3 | number) => ({ value: v })
    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: skyVert,
      fragmentShader: skyFrag,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
      uniforms: {
        topCol: u(new THREE.Color()),
        horCol: u(new THREE.Color()),
        botCol: u(new THREE.Color()),
        sunDir: u(new THREE.Vector3()),
        moonDir: u(new THREE.Vector3()),
        sunCol: u(new THREE.Color()),
        cloudLit: u(new THREE.Color()),
        cloudDark: u(new THREE.Color()),
        uwCol: u(new THREE.Color()),
        time: u(0),
        cover: u(0),
        night: u(0),
        sunI: u(1),
        uw: u(0),
        flash: u(0),
      },
    })
    const geo = new THREE.SphereGeometry(2800, 32, 20)
    this.sky = new THREE.Mesh(geo, this.skyMat)
    this.sky.renderOrder = -100
    this.sky.frustumCulled = false
    scene.add(this.sky)
    const sky2 = new THREE.Mesh(geo, this.skyMat)
    sky2.frustumCulled = false
    this.skyScene.add(sky2)

    this.cube = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType, generateMipmaps: false })
    this.cubeCam = new THREE.CubeCamera(1, 5000, this.cube)
    this.pmrem = new THREE.PMREMGenerator(renderer)

    this.sun = new THREE.DirectionalLight(0xffffff, 3)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    const sc = this.sun.shadow.camera
    sc.left = -100
    sc.right = 100
    sc.top = 100
    sc.bottom = -100
    sc.near = 10
    sc.far = 600
    this.sun.shadow.bias = -0.0004
    this.sun.shadow.normalBias = 0.06
    scene.add(this.sun, this.sun.target)
    this.hemi = new THREE.HemisphereLight(0xaaddff, 0x6a9a55, 0.8)
    scene.add(this.hemi)

    // chuva
    const N = 7000
    const pos = new Float32Array(N * 2 * 3)
    const endF = new Float32Array(N * 2)
    for (let i = 0; i < N; i++)
      for (let k = 0; k < 2; k++) {
        const j = i * 2 + k
        pos[j * 3] = Math.random() * 60
        pos[j * 3 + 1] = Math.random() * 40
        pos[j * 3 + 2] = Math.random() * 60
        if (k === 1) {
          pos[j * 3] = pos[(j - 1) * 3]
          pos[j * 3 + 1] = pos[(j - 1) * 3 + 1]
          pos[j * 3 + 2] = pos[(j - 1) * 3 + 2]
        }
        endF[j] = k
      }
    const rg = new THREE.BufferGeometry()
    rg.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    rg.setAttribute('endF', new THREE.BufferAttribute(endF, 1))
    this.rainMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: false,
      uniforms: { time: { value: 0 }, cam: { value: new THREE.Vector3() }, op: { value: 0 }, wind: { value: new THREE.Vector2(3, 1) } },
      vertexShader: `attribute float endF; uniform float time; uniform vec3 cam; uniform vec2 wind; varying float vA;
      void main(){ vec3 box=vec3(60.,40.,60.); vec3 p=position; p.y -= time*24.; p.xz += wind*time*0.5;
        p = mod(p - cam + box*.5, box) - box*.5 + cam;
        p.y += endF*0.9; p.xz -= wind*endF*0.03; vA = 1.-endF*.9;
        gl_Position = projectionMatrix*viewMatrix*vec4(p,1.); }`,
      fragmentShader: `uniform float op; varying float vA; void main(){ gl_FragColor = vec4(.78,.88,1.,op*vA*.55); }`,
    })
    this.rainMesh = new THREE.LineSegments(rg, this.rainMat)
    this.rainMesh.frustumCulled = false
    this.rainMesh.visible = false
    scene.add(this.rainMesh)

    // arco-íris
    const rb = new THREE.RingGeometry(1500, 1740, 160, 1)
    const cols = new Float32Array(rb.attributes.position.count * 3)
    const c = new THREE.Color()
    for (let i = 0; i < rb.attributes.position.count; i++) {
      const r = Math.hypot(rb.attributes.position.getX(i), rb.attributes.position.getY(i))
      const t = (r - 1500) / 240
      c.setHSL(0.78 * (1 - t), 1, 0.5)
      cols[i * 3] = c.r
      cols[i * 3 + 1] = c.g
      cols[i * 3 + 2] = c.b
    }
    rb.setAttribute('color', new THREE.BufferAttribute(cols, 3))
    this.rainbow = new THREE.Mesh(
      rb,
      new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false, side: THREE.DoubleSide })
    )
    this.rainbow.visible = false
    this.rainbow.frustumCulled = false
    scene.add(this.rainbow)

    // lens flare
    this.flare = new Lensflare()
    const defs: [THREE.Texture, number, number, number][] = [
      [T.flare0, 380, 0, 0xfff2cc],
      [T.flare1, 110, 0.35, 0x88eeff],
      [T.flare2, 70, 0.55, 0xaaffaa],
      [T.flare1, 160, 0.8, 0xffd0ff],
      [T.flare2, 220, 1.0, 0x88ccff],
    ]
    for (const d of defs) {
      const el = new LensflareElement(d[0], d[1], d[2], C(d[3]))
      this.flareEls.push(el)
      this.flare.addElement(el)
    }
    scene.add(this.flare)
  }

  setWeather(w: Weather) {
    this.weather = w
    this.wTimer = 100 + Math.random() * 80
  }

  hourText() {
    const h = Math.floor(this.hour),
      m = Math.floor((this.hour - h) * 60)
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
  }

  updateEnv() {
    const u = this.skyMat.uniforms
    const keep = u.uw.value
    u.uw.value = 0
    this.sky.visible = false
    this.cubeCam.update(this.renderer, this.skyScene)
    this.sky.visible = true
    u.uw.value = keep
    const old = this.envRT
    this.envRT = this.pmrem.fromCubemap(this.cube.texture)
    this.scene.environment = this.envRT.texture
    old?.dispose()
  }

  update(dt: number, cam: THREE.Camera, st: { underwater: number; shelter: number; dome: number; alt: number }) {
    const t = performance.now() / 1000
    if (this.auto) this.hour = (this.hour + dt * this.speed) % 24
    if (this.weatherAuto) {
      this.wTimer -= dt
      if (this.wTimer <= 0) {
        const r = Math.random()
        const night = this.night > 0.5
        this.setWeather(r < (night ? 0.45 : 0.4) ? 'sunny' : r < 0.65 ? 'cloudy' : r < 0.9 ? 'rain' : 'storm')
      }
    }
    const tg = TARGETS[this.weather]
    const k = 1 - Math.exp(-dt * 0.35)
    this.cover += (tg.cover - this.cover) * k
    this.rain += (tg.rain - this.rain) * k * 1.4
    this.storm += (tg.storm - this.storm) * k

    // sol / lua
    const ang = ((this.hour - 6) / 24) * Math.PI * 2
    this.sunDir.set(Math.cos(ang) * 0.92, Math.sin(ang), 0.32).normalize()
    const e = this.sunDir.y
    this.sunElev = e
    const D = smooth(-0.1, 0.28, e)
    this.daylight = D
    this.night = 1 - smooth(-0.22, 0.04, e)
    const tw = Math.exp(-(((e - 0.0) / 0.17) ** 2))

    const top = C(0x020615).lerp(C(0x1b78ea), D).lerp(C(0x5a4aa8), tw * 0.55)
    const hor = C(0x0a1a40).lerp(C(0xb4e8ff), D).lerp(C(0xff8c55), tw * 0.85)
    const bot = C(0x06122e).lerp(C(0x8fd6f2), D).lerp(C(0xff9a70), tw * 0.5)
    const grey = 0.1 + 0.62 * D
    const gTop = new THREE.Color(grey * 0.78, grey * 0.84, grey * 0.95).multiplyScalar(1 - 0.45 * this.rain - 0.25 * this.storm)
    const gHor = new THREE.Color(grey * 0.95, grey, grey * 1.05).multiplyScalar(1 - 0.35 * this.rain - 0.25 * this.storm)
    const gk = this.cover * 0.8
    top.lerp(gTop, gk)
    hor.lerp(gHor, gk * 0.9)
    bot.lerp(gHor, gk * 0.7)
    this.topC.copy(top)
    this.horC.copy(hor)
    const cl = C(0x0b1226).lerp(C(0xffffff), D).lerp(C(0xff9a68), tw * 0.65)
    const cd = cl.clone().multiplyScalar(0.55).lerp(C(0x5a6a9a), 0.15 * D)
    cd.multiplyScalar(1 - 0.4 * this.storm - 0.15 * this.rain)
    cl.multiplyScalar(1 - 0.3 * this.storm)

    const u = this.skyMat.uniforms
    u.topCol.value.copy(top)
    u.horCol.value.copy(hor)
    u.botCol.value.copy(bot)
    u.sunDir.value.copy(this.sunDir)
    u.moonDir.value.copy(this.sunDir).negate()
    u.sunCol.value.copy(C(0xfff2d8).lerp(C(0xff7a38), tw * 0.9))
    u.cloudLit.value.copy(cl)
    u.cloudDark.value.copy(cd)
    u.time.value = t
    u.cover.value = this.cover
    u.night.value = this.night
    u.sunI.value = D * (1 - this.cover * 0.85)

    // relâmpagos
    if (this.storm > 0.6) {
      this.lightningT -= dt
      if (this.lightningT <= 0) {
        this.lightningT = 3 + Math.random() * 9
        this.flash = 1
        const d = 0.4 + Math.random() * 3.5
        this.onThunder(d)
      }
    }
    this.flash = Math.max(0, this.flash - dt * 2.8)
    const fl = this.flash * (0.6 + 0.4 * Math.sin(t * 60))
    u.flash.value = fl

    // iluminação
    const sunI = 3.4 * D * (1 - this.cover * 0.78) * (1 - st.underwater * 0.65)
    const moonI = 0.55 * (1 - D) * (1 - this.cover * 0.6)
    const useSun = e > -0.02
    const dir = useSun ? this.sunDir : this.sunDir.clone().negate()
    this.sun.color.copy(useSun ? C(0xfff1d6).lerp(C(0xff9a50), tw * 0.9) : C(0x9bb8ff))
    this.sun.intensity = (useSun ? sunI * smooth(-0.02, 0.12, e) : moonI * smooth(0.02, -0.12, e)) + fl * 1.5
    const p = cam.position
    this.sun.position.set(Math.round(p.x) + dir.x * 300, Math.round(p.y) + dir.y * 300, Math.round(p.z) + dir.z * 300)
    this.sun.target.position.set(Math.round(p.x), Math.round(p.y), Math.round(p.z))
    this.sun.target.updateMatrixWorld()
    this.sun.castShadow = this.sun.intensity > 0.05

    this.hemi.color.copy(top).lerp(hor, 0.5).multiplyScalar(1).lerp(C(0x4aa8e0), st.underwater * 0.6)
    this.hemi.groundColor.copy(C(0x5aa64a)).multiplyScalar(0.25 + 0.75 * D).lerp(C(0x1a4a66), st.underwater * 0.5)
    this.hemi.intensity = (0.22 + 0.95 * D) * (1 - this.cover * 0.2) + fl * 1.2
    this.scene.environmentIntensity = (0.12 + 0.88 * D) * (1 - st.underwater * 0.55) * (1 - this.cover * 0.35) + fl * 0.5

    // névoa
    const mist = 0.0011 + this.cover * 0.0012 + this.rain * 0.0022 + tw * 0.0005
    this.fogC.copy(hor).lerp(C(0x9fe8c8), st.dome * 0.22)
    const uwc = C(0x1593c9).multiplyScalar(0.18 + 0.82 * D * (1 - this.cover * 0.35)).add(C(0x03102a).multiplyScalar(this.night))
    u.uwCol.value.copy(uwc)
    u.uw.value = st.underwater
    this.fog.color.copy(this.fogC).lerp(uwc, st.underwater)
    this.fog.density = lerp(mist + st.dome * 0.0026, 0.0125, st.underwater)

    // chuva
    this.rainTime += dt
    const rainVis = this.rain * (1 - st.shelter) * (st.underwater < 0.5 ? 1 : 0)
    this.rainMesh.visible = rainVis > 0.02
    if (this.rainMesh.visible) {
      this.rainMat.uniforms.time.value = this.rainTime
      this.rainMat.uniforms.op.value = clamp(rainVis * 1.2, 0, 1)
      this.rainMat.uniforms.cam.value.copy(cam.position)
      this.rainMat.uniforms.wind.value.set(2 + this.storm * 6, 0.5)
    }

    // arco-íris
    if (this.rain > 0.35) this.rbArm = true
    if (this.rbArm && this.rain < 0.15 && this.cover < 0.7 && e > 0.12) {
      this.rbTimer = 110
      this.rbArm = false
    }
    this.rbTimer = Math.max(0, this.rbTimer - dt)
    const rbo = Math.min(this.rbTimer / 15, 1) * Math.min((110 - this.rbTimer) / 10, 1) * smooth(0.1, 0.3, e) * 0.85 * (1 - st.underwater)
    this.rainbow.visible = rbo > 0.01
    if (this.rainbow.visible) {
      ;(this.rainbow.material as THREE.MeshBasicMaterial).opacity = rbo
      this.rainbow.position.set(p.x - this.sunDir.x * 1800, p.y - this.sunDir.y * 1800, p.z - this.sunDir.z * 1800)
      this.rainbow.lookAt(p)
    }

    // flare / céu segue câmera
    this.sky.position.copy(p)
    this.flare.position.set(p.x + this.sunDir.x * 2500, p.y + this.sunDir.y * 2500, p.z + this.sunDir.z * 2500)
    const fv = sm01((e - 0.02) / 0.15) * (1 - this.cover * 1.1) * (1 - st.underwater)
    this.flare.visible = fv > 0.02
    const base = [1, 0.5, 0.4, 0.4, 0.5]
    for (let i = 0; i < this.flareEls.length; i++) this.flareEls[i].color.set(this.flareCols[i]).multiplyScalar(Math.max(0, fv) * base[i])

    this.envT -= dt
    if (this.envT <= 0) {
      this.envT = 1.6
      this.updateEnv()
    }
  }
}
