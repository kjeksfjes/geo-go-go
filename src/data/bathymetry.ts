import type { Geometry } from 'geojson'
import source from './bathymetry.json'

export type BathymetryDepth = 200 | 2000 | 6000

export interface BathymetryBand {
  depth: BathymetryDepth
  geometry: Geometry
}

export const bathymetryBands = source as BathymetryBand[]
