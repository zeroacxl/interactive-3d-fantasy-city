import * as THREE from 'three'
import { G, TUBE, tubeY, seabed, rng, WATER_Y, lerp } from './consts'
import type { Level } from './physics'
import type { SkySystem } from './sky'
import { glassify, sway, type Mats, type Shared } from './builder'
import { signTexture } from './textures'

export function createWaterMaterial(T: Record<string, THREE.Texture>) {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: true,
    side: THREE.DoubleSide,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        nrm: { value: T.waterN },
        time: { value: 0 },
        sunI: { value: 1 },
        day: { value: 1 },
        sunDir: { value: new THREE.Vector3(0, 1, 0) },
        sunCol: { value: new THREE.Color(1, 1, 1) },
        topCol: { value: new THREE.Color() },
        horCol: { value: new THREE.Color() },
        deepCol: { value: new THREE.Color(0x14b4dc) },
        uwTop: { value: new THREE.Color(0x1aa0d0) },
      },
    ]),
    vertexShader: `varying vec3 vW;
    #include <fog_pars_vertex>
    void main(){ vec4 wp = modelMatrix*vec4(position,1.0); vW = wp.xyz; vec4 mvPosition = viewMatrix*wp; gl_Position = projectionMatrix*mvPosition;
    #include <fog_vertex>
    }`,
    fragmentShader: `uniform sampler2D nrm; uniform float time,sunI,day; uniform vec3 sunDir,sunCol,topCol,horCol,deepCol,uwTop;
    varying vec3 vW;
    #include <fog_pars_fragment>
    void main(){
      vec2 uv = vW.xz*0.045;
      vec3 a = texture2D(nrm, uv + vec2(time*0.010,time*0.006)).xyz*2.-1.;
      vec3 b = texture2D(nrm, uv*2.7 + vec2(-time*0.014,time*0.011)).xyz*2.-1.;
      vec3 c = texture2D(nrm, uv*0.37 + vec2(time*0.004,-time*0.003)).xyz*2.-1.;
      vec2 g = a.xy + b.xy*0.7 + c.xy*1.3;
      vec3 N = normalize(vec3(g.x*0.8, 1.0, g.y*0.8));
      vec3 V = normalize(cameraPosition - vW);
      bool below = cameraPosition.y < vW.y;
      if(below) N = -N;
      float nv = max(dot(N,V),0.0);
      float fres = pow(1.0-nv, 4.0)*0.9 + 0.04;
      vec3 R = reflect(-V,N);
      float ry = clamp(below ? -R.y : R.y, 0.0, 1.0);
      vec3 sky = mix(horCol, topCol, pow(ry,0.5));
      float spec = pow(max(dot(R,sunDir),0.0), 450.0) * sunI * 7.0;
      vec3 col; float alpha;
      if(!below){
        vec3 body = deepCol*(0.25+0.75*day);
        col = mix(body, sky, fres) + sunCol*spec;
        col += vec3(1.0)*pow(max(0.0,length(g)-1.1),2.0)*0.1*day;
        alpha = mix(0.78, 1.0, fres);
      } else {
        float win = smoothstep(0.38,0.72,nv);
        col = mix(uwTop*1.2, sky*0.95+vec3(0.08,0.18,0.22)*day, win);
        col += vec3(0.5,0.9,1.0)*pow(max(0.0,length(g)-0.9),2.0)*0.12*day;
        alpha = 0.9;
      }
      gl_FragColor = vec4(col, alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
    }`,
  })
  return mat
}

const tmpO = new THREE.Object3D()

export class Ocean {
  group = new THREE.Group()
  water: THREE.Mesh
  waterMat: THREE.ShaderMaterial
  beltTex: THREE.Texture
  tubeMat: THREE.MeshStandardMaterial
  rays: THREE.Mesh[] = []
  rayMat: THREE.MeshBasicMaterial
  fishMesh: THREE.InstancedMesh
  fishData: { school: number; off: THREE.Vector3; ph: number; sp: number }[] = []
  schools: { c: THREE.Vector3; R: number; speed: number; ph: number; ring: boolean; dir: number; bob: number }[] = []
  jellies: { g: THREE.Group; base: THREE.Vector3; ph: number }[] = []
  whale: THREE.Group
  whaleTail1: THREE.Group
  whaleTail2: THREE.Group
  bubbles: THREE.Points
  bubbleSpeed: Float32Array
  neonMat: THREE.MeshBasicMaterial
  fishTime = { value: 0 }

  constructor(
    scene: THREE.Scene,
    lv: Level,
    T: Record<string, THREE.Texture>,
    private M: Mats,
    sh: Shared
  ) {
    scene.add(this.group)
    this.waterMat = createWaterMaterial(T)
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(16000, 16000).rotateX(-Math.PI / 2), this.waterMat)
    this.water.position.y = WATER_Y
    this.water.renderOrder = 2
    this.group.add(this.water)

    const R = rng(77)
    const zS = TUBE.zStart,
      zE = TUBE.zEnd

    // ---- tubo de vidro ----
    const pts: THREE.Vector3[] = []
    for (let z = zS + 4; z >= zE; z -= 6) pts.push(new THREE.Vector3(0, tubeY(z) + 2.55, z))
    const curve = new THREE.CatmullRomCurve3(pts)
    this.tubeMat = new THREE.MeshStandardMaterial({
      color: 0xdff8ff,
      transparent: true,
      opacity: 0.1,
      roughness: 0.03,
      metalness: 0,
      envMapIntensity: 2.2,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    glassify(this.tubeMat, 1.8)
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 260, 4.8, 28, false), this.tubeMat)
    tube.renderOrder = 1
    this.group.add(tube)

    // costelas
    const ribGeo = new THREE.TorusGeometry(4.85, 0.17, 8, 30)
    const nRib = Math.floor((zS - zE) / 9)
    const ribs = new THREE.InstancedMesh(ribGeo, new THREE.MeshStandardMaterial({ color: 0xf2fcff, roughness: 0.25, metalness: 0.1, emissive: 0x6fd8ff, emissiveIntensity: 0.35 }), nRib)
    ribs.castShadow = true
    for (let i = 0; i < nRib; i++) {
      const z = zS - i * 9
      tmpO.position.set(0, tubeY(z) + 2.55, z)
      tmpO.rotation.set(Math.atan((tubeY(z - 1) - tubeY(z + 1)) / 2), 0, 0)
      tmpO.scale.set(1, 1, 1)
      tmpO.updateMatrix()
      ribs.setMatrixAt(i, tmpO.matrix)
    }
    this.group.add(ribs)

    // luzes neon no teto
    this.neonMat = new THREE.MeshBasicMaterial({ color: 0x9ff6ff, toneMapped: false })
    for (const sx of [-1, 1]) {
      const lp = pts.map((p) => new THREE.Vector3(sx * 2.9, p.y + 3.7, p.z))
      const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lp), 200, 0.07, 6, false), this.neonMat)
      this.group.add(m)
      const lp2 = pts.map((p) => new THREE.Vector3(sx * 3.45, p.y - 2.2, p.z))
      const m2 = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lp2), 200, 0.06, 6, false), new THREE.MeshBasicMaterial({ color: 0xb8ff7a, toneMapped: false }))
      this.group.add(m2)
    }

    // piso: lateral + esteira
    const buildStrip = (w: number, lift: number, uvx: number, uvy: number, vFrom: number) => {
      const N = 120
      const pos: number[] = [],
        uv: number[] = [],
        idx: number[] = []
      for (let i = 0; i <= N; i++) {
        const z = lerp(zS + 2, zE, i / N)
        const y = tubeY(z) + lift
        pos.push(-w / 2, y, z, w / 2, y, z)
        const v = ((zS + 2 - z) * uvy) / 1 + vFrom
        uv.push(0, v, uvx, v)
        if (i < N) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2)
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
      g.setIndex(idx)
      g.computeVertexNormals()
      return g
    }
    const sideTex = T.tiles.clone()
    sideTex.needsUpdate = true
    const floor = new THREE.Mesh(buildStrip(6.6, 0.0, 6.6 / 4, 1 / 4, 0), new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.12, metalness: 0.1, envMapIntensity: 1 }))
    floor.receiveShadow = true
    this.group.add(floor)
    this.beltTex = T.chevron.clone()
    this.beltTex.needsUpdate = true
    const belt = new THREE.Mesh(buildStrip(2.4, 0.05, 1, 1 / 2.4, 0), new THREE.MeshStandardMaterial({ map: this.beltTex, roughness: 0.3, emissive: 0x2288aa, emissiveMap: this.beltTex, emissiveIntensity: 0.35 }))
    this.group.add(belt)
    lv.conveyors.push({ minX: -1.2, maxX: 1.2, minZ: zE + 3, maxZ: zS - 3, vx: 0, vz: -2.4 })
    lv.surfaces.push({ minX: -3.3, maxX: 3.3, minZ: zE, maxZ: zS + 2, y: (_x, z) => tubeY(z) + 0.02, mat: 'glass' })
    lv.boxes.push({ minX: -4.4, maxX: -3.3, minZ: zE, maxZ: zS + 3, y0: -60, y1: 40 })
    lv.boxes.push({ minX: 3.3, maxX: 4.4, minZ: zE, maxZ: zS + 3, y0: -60, y1: 40 })
    lv.boxes.push({ minX: -5, maxX: 5, minZ: zS + 3, maxZ: zS + 5, y0: -60, y1: 40 })
    lv.zones.push({ kind: 'tube', test: (x, _y, z) => Math.abs(x) < 4.6 && z > zE && z < zS + 4 })

    // painel de boas vindas + cápsula inicial
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 2.6), new THREE.MeshBasicMaterial({ map: signTexture('AQUA CITY', 'Bem-vindo(a) · Túnel Submarino 2003', '#1fb5f0', '#7ee04d', 768, 240), toneMapped: false, transparent: true }))
    sign.position.set(0, tubeY(zS) + 3.3, zS + 1.9)
    sign.rotation.y = Math.PI
    this.group.add(sign)
    const cap = new THREE.Mesh(new THREE.CircleGeometry(4.95, 32), new THREE.MeshStandardMaterial({ color: 0xcdefff, roughness: 0.2, metalness: 0.4 }))
    cap.position.set(0, tubeY(zS) + 2.55, zS + 3.6)
    cap.rotation.y = Math.PI
    this.group.add(cap)
    for (let z = zS - 12; z > zE + 10; z -= 36) {
      const y = tubeY(z)
      lv.lamps.push({ x: 0, y: y + 4, z, color: 0x7ee8ff, intensity: 14, night: false })
    }
    // banco + texto inicial
    const arrow = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), new THREE.MeshBasicMaterial({ map: signTexture('▲▲▲', '', '#27b6f0', '#7be04a', 256, 256), transparent: true, opacity: 0.9, toneMapped: false }))
    arrow.rotation.x = -Math.PI / 2
    arrow.rotation.z = 0
    arrow.position.set(0, tubeY(zS - 14) + 0.1, zS - 14)
    this.group.add(arrow)

    // pilares
    const pil = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.8, 1.1, 1, 10), M.frameP, 24)
    let pi = 0
    for (let z = zS - 10; z > 405 && pi < 24; z -= 22) {
      const top = tubeY(z) - 0.4,
        bot = seabed(0, z) - 1
      tmpO.position.set(0, (top + bot) / 2, z)
      tmpO.rotation.set(0, 0, 0)
      tmpO.scale.set(1, top - bot, 1)
      tmpO.updateMatrix()
      pil.setMatrixAt(pi++, tmpO.matrix)
    }
    pil.count = pi
    this.group.add(pil)

    // ---- decoração do fundo ----
    const rockG = new THREE.IcosahedronGeometry(1, 1)
    const rp = rockG.attributes.position
    for (let i = 0; i < rp.count; i++) {
      const k = 0.75 + Math.sin(rp.getX(i) * 4.1 + rp.getY(i) * 3.3) * 0.18 + Math.cos(rp.getZ(i) * 5.7) * 0.12
      rp.setXYZ(i, rp.getX(i) * k, rp.getY(i) * k * 0.7, rp.getZ(i) * k)
    }
    rockG.computeVertexNormals()
    const rocks = new THREE.InstancedMesh(rockG, new THREE.MeshStandardMaterial({ roughness: 0.9 }), 260)
    const col = new THREE.Color()
    for (let i = 0; i < 260; i++) {
      const x = (R() < 0.5 ? -1 : 1) * (10 + R() * 150)
      const z = 440 + R() * 300
      const s = 0.8 + R() * R() * 6
      tmpO.position.set(x, seabed(x, z) + s * 0.2, z)
      tmpO.rotation.set(R() * 3, R() * 3, R() * 3)
      tmpO.scale.set(s, s, s)
      tmpO.updateMatrix()
      rocks.setMatrixAt(i, tmpO.matrix)
      rocks.setColorAt(i, col.setHSL(0.1 + R() * 0.08, 0.2, 0.25 + R() * 0.2))
    }
    rocks.castShadow = false
    this.group.add(rocks)

    // corais
    const coralParts: THREE.BufferGeometry[] = []
    for (let i = 0; i < 6; i++) {
      const g = new THREE.ConeGeometry(0.25 - i * 0.015, 1.4 + (i % 3) * 0.5, 6)
      g.translate(0, 0.7 + (i % 3) * 0.25, 0)
      g.rotateZ((i - 2.5) * 0.28)
      g.rotateY(i * 1.1)
      coralParts.push(g)
    }
    const coralG = mergeSimple(coralParts)
    const coral = new THREE.InstancedMesh(coralG, new THREE.MeshStandardMaterial({ roughness: 0.5 }), 420)
    for (let i = 0; i < 420; i++) {
      const x = (R() < 0.5 ? -1 : 1) * (9 + R() * 140)
      const z = 430 + R() * 300
      const s = 0.8 + R() * 2.4
      tmpO.position.set(x, seabed(x, z) - 0.1, z)
      tmpO.rotation.set(0, R() * 6, 0)
      tmpO.scale.set(s, s, s)
      tmpO.updateMatrix()
      coral.setMatrixAt(i, tmpO.matrix)
      coral.setColorAt(i, col.setHSL(R() < 0.5 ? 0.92 + R() * 0.08 : 0.05 + R() * 0.12, 0.8, 0.55))
    }
    this.group.add(coral)

    const kelpG = new THREE.PlaneGeometry(0.9, 10, 1, 8)
    kelpG.translate(0, 5, 0)
    const kelpM = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.6 })
    sway(kelpM, sh.time, 0.06)
    const kelp = new THREE.InstancedMesh(kelpG, kelpM, 380)
    for (let i = 0; i < 380; i++) {
      const x = (R() < 0.5 ? -1 : 1) * (8 + R() * 120)
      const z = 430 + R() * 300
      const s = 0.6 + R() * 1.2
      tmpO.position.set(x, seabed(x, z) - 0.2, z)
      tmpO.rotation.set(0, R() * 6, 0)
      tmpO.scale.set(s, s, s)
      tmpO.updateMatrix()
      kelp.setMatrixAt(i, tmpO.matrix)
      kelp.setColorAt(i, col.setHSL(0.3 + R() * 0.08, 0.7, 0.3 + R() * 0.15))
    }
    this.group.add(kelp)

    // ---- raios de luz ----
    this.rayMat = new THREE.MeshBasicMaterial({ map: T.ray, color: 0x9fe8ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    for (let i = 0; i < 34; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(4 + R() * 7, 46), this.rayMat)
      const side = R() < 0.5 ? -1 : 1
      m.position.set(side * (9 + R() * 55), -20, 440 + R() * 250)
      m.rotation.set(0, R() * 3.14, 0.28)
      this.group.add(m)
      this.rays.push(m)
    }

    // ---- peixes ----
    const fg: THREE.BufferGeometry[] = []
    const body = new THREE.SphereGeometry(0.5, 10, 8)
    body.scale(1, 0.45, 0.26)
    fg.push(body)
    const tail = new THREE.ConeGeometry(0.22, 0.45, 4)
    tail.rotateZ(-Math.PI / 2)
    tail.scale(1, 1, 0.25)
    tail.translate(-0.68, 0, 0)
    fg.push(tail)
    const fin = new THREE.ConeGeometry(0.12, 0.3, 3)
    fin.scale(1, 1, 0.2)
    fin.translate(-0.05, 0.28, 0)
    fg.push(fin)
    const fishG = mergeSimple(fg)
    const fishM = new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.3, envMapIntensity: 1.2 })
    fishM.onBeforeCompile = (s) => {
      s.uniforms.uTime = this.fishTime
      s.vertexShader =
        'uniform float uTime;\n' +
        s.vertexShader.replace(
          '#include <begin_vertex>',
          `vec3 transformed = vec3(position);
          float ph = 0.0;
          #ifdef USE_INSTANCING_COLOR
          ph = instanceColor.r*40.0 + instanceColor.g*13.0;
          #endif
          transformed.z += sin(uTime*9.0 + ph)*smoothstep(0.1,-0.9,position.x)*0.2;`
        )
    }
    const nF = 360
    this.fishMesh = new THREE.InstancedMesh(fishG, fishM, nF)
    this.fishMesh.frustumCulled = false
    const palette = [0xff8a2a, 0xffd23a, 0x35c8ff, 0xf5f9ff, 0xff4f8a, 0x6dff9a, 0x8a6bff]
    let fi = 0
    for (let s = 0; s < 15; s++) {
      const ring = s < 3
      const Rr = ring ? 8.5 + R() * 3 : 6 + R() * 16
      const z = 450 + R() * 230
      const cx = ring ? 0 : (R() < 0.5 ? -1 : 1) * (Rr + 9 + R() * 25)
      const cy = ring ? tubeY(z) + 2.5 : Math.max(-33, Math.min(-4, tubeY(z) + (R() - 0.3) * 14))
      this.schools.push({ c: new THREE.Vector3(cx, cy, z), R: Rr, speed: 0.12 + R() * 0.12, ph: R() * 6, ring, dir: R() < 0.5 ? -1 : 1, bob: 1 + R() * 3 })
      const cnt = s === 14 ? 24 : 24
      const colr = new THREE.Color(palette[s % palette.length])
      for (let k = 0; k < cnt && fi < nF; k++) {
        this.fishData.push({ school: s, off: new THREE.Vector3((R() - 0.5) * 5, (R() - 0.5) * 3, (R() - 0.5) * 5), ph: R() * 6.28, sp: 0.8 + R() * 0.4 })
        this.fishMesh.setColorAt(fi, colr.clone().offsetHSL((R() - 0.5) * 0.04, 0, (R() - 0.5) * 0.15))
        fi++
      }
    }
    this.fishMesh.count = fi
    this.group.add(this.fishMesh)

    // ---- baleia ----
    this.whale = new THREE.Group()
    const wm = new THREE.MeshStandardMaterial({ color: 0x5f86ad, roughness: 0.45, envMapIntensity: 1 })
    const wb = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), wm)
    wb.scale.set(3.4, 3.1, 11.5)
    const belly = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), new THREE.MeshStandardMaterial({ color: 0xdbe9f3, roughness: 0.5 }))
    belly.scale.set(3.0, 2.6, 10.6)
    belly.position.set(0, -0.6, 0.2)
    this.whaleTail1 = new THREE.Group()
    this.whaleTail1.position.set(0, 0, -9)
    const t1 = new THREE.Mesh(new THREE.ConeGeometry(2.4, 8, 14), wm)
    t1.rotation.x = -Math.PI / 2
    t1.position.z = -3.4
    this.whaleTail1.add(t1)
    this.whaleTail2 = new THREE.Group()
    this.whaleTail2.position.set(0, 0, -7)
    const t2 = new THREE.Mesh(new THREE.ConeGeometry(0.9, 5, 12), wm)
    t2.rotation.x = -Math.PI / 2
    t2.position.z = -2.4
    this.whaleTail2.add(t2)
    const fluke = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), wm)
    fluke.scale.set(5.2, 0.22, 1.7)
    fluke.position.z = -5.2
    this.whaleTail2.add(fluke)
    this.whaleTail1.add(this.whaleTail2)
    const fl1 = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), wm)
    fl1.scale.set(3.2, 0.2, 1.1)
    fl1.position.set(3.6, -1.6, 3)
    fl1.rotation.z = -0.5
    const fl2 = fl1.clone()
    fl2.position.x = -3.6
    fl2.rotation.z = 0.5
    this.whale.add(wb, belly, this.whaleTail1, fl1, fl2)
    this.whale.scale.setScalar(1.5)
    this.group.add(this.whale)

    // ---- águas-vivas ----
    const jm = new THREE.MeshStandardMaterial({ color: 0xff9ff0, emissive: 0xff5fd0, emissiveIntensity: 0.9, transparent: true, opacity: 0.6, side: THREE.DoubleSide, roughness: 0.2 })
    const jt = new THREE.MeshBasicMaterial({ color: 0xffb8f4, transparent: true, opacity: 0.55 })
    for (let i = 0; i < 16; i++) {
      const g = new THREE.Group()
      const bell = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), jm)
      bell.scale.set(1.4, 1, 1.4)
      g.add(bell)
      for (let k = 0; k < 7; k++) {
        const t = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.015, 3.5, 4), jt)
        const a = (k / 7) * 6.28
        t.position.set(Math.cos(a) * 0.9, -1.8, Math.sin(a) * 0.9)
        g.add(t)
      }
      const sc = 1.2 + R() * 2.2
      g.scale.setScalar(sc)
      const side = R() < 0.5 ? -1 : 1
      const z = 440 + R() * 240
      const base = new THREE.Vector3(side * (9 + R() * 28), Math.max(-32, tubeY(z) + 2 + R() * 14), z)
      g.position.copy(base)
      this.group.add(g)
      this.jellies.push({ g, base, ph: R() * 6.28 })
    }

    // ---- bolhas ----
    const nb = 600
    const bp = new Float32Array(nb * 3)
    this.bubbleSpeed = new Float32Array(nb)
    for (let i = 0; i < nb; i++) {
      bp[i * 3] = (R() - 0.5) * 120
      bp[i * 3 + 1] = -40 + R() * 40
      bp[i * 3 + 2] = 560 + (R() - 0.5) * 120
      this.bubbleSpeed[i] = 0.6 + R() * 1.4
    }
    const bg = new THREE.BufferGeometry()
    bg.setAttribute('position', new THREE.BufferAttribute(bp, 3))
    this.bubbles = new THREE.Points(bg, new THREE.PointsMaterial({ map: T.bubble, size: 0.7, transparent: true, depthWrite: false, opacity: 0.9, sizeAttenuation: true }))
    this.bubbles.frustumCulled = false
    this.group.add(this.bubbles)
    void G
  }

  updateWaterUniforms(sky: SkySystem, t: number) {
    const u = this.waterMat.uniforms
    u.time.value = t
    u.sunDir.value.copy(sky.sunDir)
    u.sunI.value = sky.daylight * (1 - sky.cover * 0.85)
    u.day.value = sky.daylight * (1 - sky.cover * 0.45)
    u.topCol.value.copy(sky.topC)
    u.horCol.value.copy(sky.horC)
    u.sunCol.value.setRGB(1, 0.92 - 0.3 * (1 - Math.min(1, sky.sunElev * 3)), 0.8 - 0.4 * (1 - Math.min(1, sky.sunElev * 3)))
    u.uwTop.value.setRGB(0.06, 0.55, 0.8).multiplyScalar(0.25 + 0.75 * sky.daylight)
  }

  update(dt: number, t: number, cam: THREE.Camera, sky: SkySystem, st: { underwater: number }) {
    this.updateWaterUniforms(sky, t)
    this.fishTime.value = t
    this.beltTex.offset.y -= (2.4 / 2.4) * dt * 0.5
    const nearSea = cam.position.z > 330 || cam.position.y < 3
    const uw = st.underwater > 0.02
    this.rayMat.opacity = 0.32 * sky.daylight * (1 - sky.cover * 0.5) * (uw ? 1 : 0)
    this.neonMat.color.setRGB(0.6, 0.97, 1).multiplyScalar(0.8 + 0.5 * sky.night)

    if (!nearSea && cam.position.z < 300) {
      this.fishMesh.visible = false
      this.whale.visible = false
      this.bubbles.visible = false
      return
    }
    this.fishMesh.visible = true
    this.whale.visible = true
    this.bubbles.visible = cam.position.y < 2

    // peixes
    const v = new THREE.Vector3()
    const p0 = new THREE.Vector3()
    const p1 = new THREE.Vector3()
    const posOf = (i: number, tt: number, out: THREE.Vector3) => {
      const f = this.fishData[i]
      const s = this.schools[f.school]
      const a = s.ph + tt * s.speed * s.dir * f.sp
      if (s.ring) out.set(Math.cos(a) * s.R, s.c.y + Math.sin(a) * s.R * 0.85, s.c.z + Math.sin(tt * 0.2 + s.ph) * 6)
      else out.set(s.c.x + Math.cos(a) * s.R, s.c.y + Math.sin(a * 2.0 + s.ph) * s.bob, s.c.z + Math.sin(a) * s.R)
      out.x += f.off.x + Math.sin(tt * 0.9 + f.ph) * 0.8
      out.y += f.off.y + Math.sin(tt * 1.3 + f.ph * 2) * 0.5
      out.z += f.off.z + Math.cos(tt * 0.8 + f.ph) * 0.8
    }
    for (let i = 0; i < this.fishData.length; i++) {
      posOf(i, t, p0)
      posOf(i, t + 0.4, p1)
      v.subVectors(p1, p0)
      tmpO.position.copy(p0)
      tmpO.rotation.set(0, 0, 0)
      tmpO.rotation.y = Math.atan2(-v.z, v.x)
      tmpO.rotation.z = Math.atan2(v.y, Math.hypot(v.x, v.z))
      const sc = 0.9 + (i % 5) * 0.12
      tmpO.scale.set(sc, sc, sc)
      tmpO.updateMatrix()
      this.fishMesh.setMatrixAt(i, tmpO.matrix)
    }
    this.fishMesh.instanceMatrix.needsUpdate = true

    // baleia
    const wa = t * 0.035
    const cx = 75,
      cz = 560,
      Rw = 55
    const wx = cx + Math.cos(wa) * Rw,
      wz = cz + Math.sin(wa) * Rw * 1.2
    const nx = cx + Math.cos(wa + 0.02) * Rw,
      nz = cz + Math.sin(wa + 0.02) * Rw * 1.2
    this.whale.position.set(wx, -17 + Math.sin(t * 0.2) * 4, wz)
    this.whale.rotation.y = Math.atan2(nx - wx, nz - wz)
    this.whale.rotation.z = Math.sin(t * 0.3) * 0.06
    this.whaleTail1.rotation.x = Math.sin(t * 1.1) * 0.12
    this.whaleTail2.rotation.x = Math.sin(t * 1.1 - 0.9) * 0.28

    for (const j of this.jellies) {
      const k = 0.5 + 0.5 * Math.sin(t * 1.6 + j.ph)
      j.g.children[0].scale.set(1.4 - k * 0.2, 0.8 + k * 0.35, 1.4 - k * 0.2)
      j.g.position.set(j.base.x + Math.sin(t * 0.2 + j.ph) * 3, j.base.y + Math.sin(t * 0.35 + j.ph) * 4 + k * 0.4, j.base.z + Math.cos(t * 0.17 + j.ph) * 3)
    }

    // bolhas
    if (this.bubbles.visible) {
      const a = this.bubbles.geometry.attributes.position as THREE.BufferAttribute
      const c = cam.position
      for (let i = 0; i < a.count; i++) {
        let y = a.getY(i) + this.bubbleSpeed[i] * dt
        let x = a.getX(i) + Math.sin(t * 2 + i) * dt * 0.3
        let z = a.getZ(i)
        if (y > 0 || Math.abs(x - c.x) > 60 || Math.abs(z - c.z) > 60) {
          x = c.x + (Math.random() - 0.5) * 100
          z = c.z + (Math.random() - 0.5) * 100
          y = Math.max(-38, c.y - 14) + Math.random() * 14 - 7
          y = Math.min(y, -0.5)
        }
        a.setXYZ(i, x, y, z)
      }
      a.needsUpdate = true
    }
    void this.M
  }
}

export function mergeSimple(list: THREE.BufferGeometry[]) {
  // junta geometrias (convertendo para não indexado) mantendo só position/normal
  const pos: number[] = [],
    nor: number[] = []
  for (const g0 of list) {
    const g = g0.index ? g0.toNonIndexed() : g0
    pos.push(...(g.attributes.position.array as ArrayLike<number> as number[]))
    nor.push(...(g.attributes.normal.array as ArrayLike<number> as number[]))
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  return out
}
