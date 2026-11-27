import * as THREE from 'three'
import type { Ctx } from './ctx'
import type { Player } from './physics'
import { G } from './consts'
import { signTexture } from './textures'

const R = 325, Y = 19
const STATIONS = ['Praia Cristal', 'Jardim do Domo', 'Mirante Norte', 'Bairro das Cores']

/** Linha panorâmica elevada: embarque no terminal, viagem e desembarque nas paradas. */
export class Railway {
  train = new THREE.Group()
  angle = 0
  wait = 12
  station = 0
  riding = false
  exitRequested = false
  onMsg: (s: string) => void = () => {}
  onBell: () => void = () => {}
  constructor(c: Ctx) {
    const mat = (color: number, map?: THREE.Texture) => new THREE.MeshStandardMaterial({ color, map, roughness: 0.5, metalness: 0.3 })
    const steel = mat(0xc2e6eb, c.T.metal), body = mat(0x4cdbcf, c.T.metal), dark = mat(0x173d52)
    dark.transparent = true; dark.opacity = 0.22; dark.depthWrite = false
    const box = (parent: THREE.Group, w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
      mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh)
    }
    for (const offset of [-1.6, 1.6]) {
      const rail = new THREE.Mesh(new THREE.TorusGeometry(R + offset, 0.16, 6, 320), steel)
      rail.rotation.x = Math.PI / 2; rail.position.y = Y; c.scene.add(rail)
    }
    // Dormentes e pilares espaçados; geometria estática agrupada pelo batcher.
    for (let i = 0; i < 320; i++) {
      const a = i / 320 * Math.PI * 2, x = Math.sin(a) * R, z = Math.cos(a) * R
      c.W.box('wood', x, Y - 0.35, z, 4.8, 0.35, 0.6, 0xc0a889, 2, a)
      if (i % 10 === 0) c.W.cyl('concrete', x, G, z, 0.65, 1, Y - G - 0.5, 0xc9e3e6, 8)
    }
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2, x = Math.sin(a) * 315, z = Math.cos(a) * 315
      c.W.box('plaza', x, G + 0.1, z, 12, 0.2, 12, 0xffffff, 3)
      c.W.box('frame', x, G + 2, z, 0.25, 4, 0.25, 0xe7ffff)
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshBasicMaterial({ map: signTexture('AQUA EXPRESS', STATIONS[i] + ' · E para embarcar', '#007b96', '#40b9a1'), side: THREE.DoubleSide }))
      sign.position.set(x, G + 4, z); sign.rotation.y = a; c.scene.add(sign)
      c.lv.interact.push({ x, y: G, z, r: 8, label: () => this.riding ? null : 'Embarcar no Aqua Express · ' + STATIONS[i], run: () => {
        this.riding = true; this.exitRequested = false
        this.onMsg('Aqua Express: E solicita desembarque na próxima estação. Boa viagem!'); this.onBell()
      } })
      // Bancos, floreiras e cobertura de cada terminal.
      c.W.box('wood', x + 4, G + 0.65, z, 1.2, 0.4, 4, 0xc38a59, 2)
      c.W.box('frame', x, G + 5.5, z, 13, 0.25, 8, 0x89dfdf)
      for (const dx of [-5, 5]) {
        c.W.box('marble', x + dx, G + 0.5, z + 4, 1.5, 1, 1.5, 0xffffff)
        c.W.sph('leaf', x + dx, G + 1.8, z + 4, 1.2, 0x50ad68)
      }
    }
    for (let car = 0; car < 3; car++) {
      const z = car * 8
      box(this.train, 4.4, 0.55, 7.4, 0, 0.5, z, steel)
      box(this.train, 4.2, 1.2, 7.2, 0, 1.3, z, body)
      box(this.train, 4.5, 0.35, 7.5, 0, 4, z, body)
      for (const x of [-2, 2]) {
        for (let j = -1; j <= 1; j++) {
          box(this.train, 0.1, 1.7, 1.7, x, 2.7, z + j * 2.2, dark)
          box(this.train, 0.14, 1.9, 0.12, x, 2.7, z + j * 2.2 + 1, steel)
        }
      }
      box(this.train, 3.6, 1.8, 0.1, 0, 2.7, z - 3.65, dark)
      for (const x of [-1.4, 1.4]) box(this.train, 0.5, 0.3, 0.15, x, 1.3, z - 3.8, new THREE.MeshBasicMaterial({ color: 0xffffb5 }))
    }
    c.scene.add(this.train)
    this.position()
  }
  requestExit() {
    this.exitRequested = true
    this.onMsg('Desembarque solicitado · próxima parada: ' + STATIONS[(this.station + (this.wait > 0 ? 0 : 1)) % 4])
  }
  position() {
    this.train.position.set(Math.sin(this.angle) * R, Y, Math.cos(this.angle) * R)
    this.train.rotation.y = this.angle - Math.PI / 2
  }
  update(dt: number, pl: Player) {
    if (this.wait > 0) this.wait = Math.max(0, this.wait - dt)
    else {
      const target = (this.station + 1) * Math.PI / 2
      this.angle = Math.min(target, this.angle + dt * 0.045)
      if (this.angle >= target) {
        this.station++
        if (this.station === 4) { this.station = 0; this.angle = 0 }
        this.wait = 12
        if (this.riding) { this.onBell(); this.onMsg('Estação ' + STATIONS[this.station] + ' · parada de 12 segundos') }
      }
    }
    this.position()
    if (!this.riding) return
    pl.vel.set(0, 0, 0)
    if (this.exitRequested && this.wait > 0) {
      pl.pos.set(Math.sin(this.angle) * 315, G + 0.3, Math.cos(this.angle) * 315)
      this.riding = false; this.exitRequested = false
      this.onMsg('Você chegou: ' + STATIONS[this.station]); return
    }
    const seat = new THREE.Vector3()
    // matrixWorld é atualizada explicitamente antes da câmera acompanhar o passageiro.
    this.train.updateMatrixWorld(true)
    seat.set(0, 2, -2.5).applyMatrix4(this.train.matrixWorld)
    pl.pos.copy(seat); pl.grounded = false
  }
}
