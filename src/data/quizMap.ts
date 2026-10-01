import merges from './quiz-map-merges.json'
import type { GeographicUnitFeature } from '../types/country'

// Quiz-only simplification; Explore labels and sovereignty stay unchanged.
export const quizMergedSourceIds = new Set(merges.flatMap((merge) => merge.sourceIds))
const mergedLeaseIds = new Set(merges.flatMap((merge) =>
  merge.leasedAreaIds.map((id) => `leased-area:${id}`),
))
const cache = new WeakMap<GeographicUnitFeature[], GeographicUnitFeature[]>()

export function quizGeographicUnits(source: GeographicUnitFeature[]) {
  const cached = cache.get(source)
  if (cached) return cached
  const units = source.filter((unit) => !mergedLeaseIds.has(unit.id)).map((unit) =>
    unit.quizGeometry ? {
      ...unit,
      geometry: unit.quizGeometry,
      outlineGeometry: undefined,
      divisionGeometry: undefined,
    } : unit,
  )
  cache.set(source, units)
  return units
}
