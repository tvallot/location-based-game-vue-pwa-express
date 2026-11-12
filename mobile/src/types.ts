export type LatLon = [number, number]

export type Role = 'explorer' | 'rival' | 'admin'

export interface Player {
  id: string
  role: Role
  position: LatLon
  objectsDone: number
  captures: number
}

export interface Me extends Omit<Player, 'position'> {
  position: LatLon | null
  active: boolean
  eliminatedBy: null | 'creature' | 'capture'
}

export interface GameObject {
  id: string
  role: 'object'
  position: LatLon
  ttlMs: number
  secured: boolean
  /** Explorers only see an area of this radius (meters) around `position`. */
  approxRadius?: number
  /** Explorers only: a rival is close to this object. */
  rivalNearby?: boolean
}

export interface GameArea {
  nw: LatLon
  ne: LatLon
  se: LatLon
  sw: LatLon
}

export interface ResourcesResponse {
  me: Me | null
  resources: Array<Player | GameObject>
}
