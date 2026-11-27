import * as THREE from 'three'
import type { Batcher, Mats, Shared, Local } from './builder'
import type { Level } from './physics'

export interface TreeSpot {
  x: number
  z: number
  y: number
  s: number
  type: 'round' | 'palm' | 'bush'
}
export interface Tank {
  x0: number
  x1: number
  y0: number
  y1: number
  z0: number
  z1: number
}
export interface Ctx {
  B: Batcher
  lv: Level
  M: Mats
  T: Record<string, THREE.Texture>
  sh: Shared
  scene: THREE.Group
  W: Local // quadro de coordenadas do mundo
  trees: TreeSpot[]
  tanks: Tank[]
  fountains: THREE.Vector3[]
}
