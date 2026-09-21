import type { Geometry } from 'geojson'
import source from './relief.json'

export type ReliefElevation = 500 | 1000 | 1500 | 2250 | 3000

export interface ReliefBand {
  elevation: ReliefElevation
  geometry: Geometry
}

export const reliefBands = source as ReliefBand[]
