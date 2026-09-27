import type { Geometry } from 'geojson'

export type ReliefElevation = 500 | 1000 | 1500 | 2250 | 3000 | 4000

export interface ReliefBand {
  elevation: ReliefElevation
  geometry: Geometry
}

let reliefPromise: Promise<ReliefBand[]> | undefined

export function loadReliefBands() {
  reliefPromise ??= import('./relief.json')
    .then(({ default: source }) => source as ReliefBand[])
    .catch((error: unknown) => {
      reliefPromise = undefined
      throw error
    })
  return reliefPromise
}
