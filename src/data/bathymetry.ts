import type { Geometry } from 'geojson'

export type BathymetryDepth = 200 | 2000 | 6000

export interface BathymetryBand {
  depth: BathymetryDepth
  geometry: Geometry
}

let bathymetryPromise: Promise<BathymetryBand[]> | undefined

export function loadBathymetryBands() {
  bathymetryPromise ??= import('./bathymetry.json')
    .then(({ default: source }) => source as BathymetryBand[])
    .catch((error: unknown) => {
      bathymetryPromise = undefined
      throw error
    })
  return bathymetryPromise
}
