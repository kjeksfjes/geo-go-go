import source from './background-land-50m.json'
import type { Feature, Geometry } from 'geojson'

export type BackgroundLandFeature = Feature<Geometry, {
  sourceName: string
  sourceType: string
}> & { id: string }

export const backgroundLand = source.features as BackgroundLandFeature[]
let detailed: BackgroundLandFeature[] | undefined
let detailedPromise: Promise<BackgroundLandFeature[]> | undefined

export function backgroundLandForDetail(highDetail: boolean) {
  return highDetail && detailed ? detailed : backgroundLand
}

// Awaited by the existing high-detail loader before its geographic units change.
export function loadDetailedBackgroundLand() {
  detailedPromise ??= import('./background-land-10m.json')
    .then(({ default: source }) => {
      detailed = source.features as BackgroundLandFeature[]
      return detailed
    })
    .catch((error: unknown) => { detailedPromise = undefined; throw error })
  return detailedPromise
}
