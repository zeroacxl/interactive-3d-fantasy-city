import * as THREE from 'three'
import type { Ctx } from './ctx'
import { G } from './consts'
import { signTexture } from './textures'

/** Interações locais, sem serviços ou assets de rede. */
export class Venues {
  group = new THREE.Group()
  lights: THREE.PointLight[] = []
  dancing = true
  onMsg: (s: string) => void = () => {}
  onMusic: () => void = () => {}
  constructor(c: Ctx) {
    const W = c.W
    // Quiosques do bulevar: cada edifício oferece uma função diferente.
    for (const [i, z] of [305, 275, 245, 215, 175, 145, 115, 85].entries()) {
      const x = -19
      W.box('frame', x, G, z, 0.7, 1.5, 0.7, 0xd6ffff)
      W.box('neon', x, G + 1.5, z, 0.8, 0.15, 0.8, 0x65eeff)
      let active = false
      c.lv.interact.push({ x, y: G, z, r: 3.5, label: () => ['Consultar recepção', 'Acender iluminação da fachada', 'Rádio do lounge', 'Ler guia do edifício'][i % 4], run: () => {
        active = !active
        if (i % 4 === 2) this.onMusic()
        else if (i % 4 === 1) {
          beacon.visible = active
          this.onMsg(active ? 'Iluminação da fachada ligada' : 'Iluminação da fachada desligada')
        } else this.onMsg(i % 4 === 0 ? 'Bem-vindo! Entre pela abertura de vidro e explore os ambientes mobiliados.' : 'Guia: torre com elevador, jardim no domo e Aqua Express na orla. Use Esc para viajar.')
      } })
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8), new THREE.MeshBasicMaterial({ color: 0x77ffcf }))
      beacon.position.set(x, G + 2.7, z); beacon.visible = false; c.scene.add(beacon)
    }
    // Clube em terreno livre ao norte, separado das casas e do domo.
    const x = -105, z = -220
    W.box('tile', x, G, z, 32, 0.2, 28, 0x27233d, 3)
    c.lv.surfaces.push({ minX: x - 16, maxX: x + 16, minZ: z - 14, maxZ: z + 14, y: G + 0.2, mat: 'tile' })
    for (const dx of [-16, 16]) {
      W.box('plaster', x + dx, G, z, 0.4, 7, 28, 0x332347)
      c.lv.boxes.push({ minX: x + dx - 0.2, maxX: x + dx + 0.2, minZ: z - 14, maxZ: z + 14, y0: G, y1: G + 7 })
    }
    W.box('plaster', x, G, z - 14, 32, 7, 0.4, 0x332347)
    c.lv.boxes.push({ minX: x - 16, maxX: x + 16, minZ: z - 14.2, maxZ: z - 13.8, y0: G, y1: G + 7 })
    W.box('frame', x, G + 7, z, 33, 0.4, 29, 0x29233b)
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(17, 2), new THREE.MeshBasicMaterial({ map: signTexture('CLUB AURORA', 'NEON · DJ · POLE STAGE', '#b624bb', '#4225ad'), side: THREE.DoubleSide }))
    sign.position.set(x, G + 5.5, z + 14.2); c.scene.add(sign)
    for (let i = 0; i < 6; i++) for (let j = 0; j < 5; j++) W.box('neon', x - 7.5 + i * 3, G + 0.21, z - 3 + j * 3, 2.8, 0.04, 2.8, (i + j) % 2 ? 0x7024a0 : 0x124b77)
    W.box('wood', x, G + 0.2, z - 9, 14, 0.5, 6, 0x422b55)
    for (const dx of [-4, 4]) W.cyl('frame', x + dx, G + 0.7, z - 9, 0.08, 0.08, 5.5, 0xeeeeff, 12)
    W.box('gloss', x + 12, G + 0.2, z, 3, 1.4, 13, 0x2a1938)
    for (let i = 0; i < 5; i++) W.cyl('gloss', x + 9, G + 0.2, z - 5 + i * 2.5, 0.55, 0.3, 0.8, 0xa42b91)
    W.box('frame', x, G + 0.2, z - 12, 6, 1.5, 1.5, 0x131b36)
    for (const dx of [-12, 12]) W.box('frame', x + dx, G + 0.2, z - 11, 2, 3.5, 2, 0x151929)
    const actions = [
      { x, z: z - 10, name: 'DJ · Próxima faixa', run: () => { this.onMusic(); this.onMsg('DJ Aurora · nova faixa selecionada') } },
      { x: x + 8, z, name: 'Bar · Pedir bebida sem álcool', run: () => this.onMsg('Um coquetel Aurora sem álcool para você. Saúde!') },
      { x: x - 8, z, name: 'Alternar luzes da pista', run: () => { this.dancing = !this.dancing; this.onMsg(this.dancing ? 'Luzes da pista ativadas' : 'Iluminação suave ativada') } },
    ]
    for (const a of actions) c.lv.interact.push({ x: a.x, y: G, z: a.z, r: 3, label: () => a.name, run: a.run })
    for (let i = 0; i < 3; i++) {
      const light = new THREE.PointLight([0xff33bb, 0x33bfff, 0xa855ff][i], 65, 25, 2)
      light.position.set(x - 8 + i * 8, G + 5, z); c.scene.add(light); this.lights.push(light)
    }
  }
  update(t: number) {
    this.lights.forEach((l, i) => { l.intensity = this.dancing ? 45 + Math.sin(t * 2 + i * 2) * 25 : 20 })
  }
}
