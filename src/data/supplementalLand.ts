import source from './supplemental-land.json'
import labels from './supplemental-area-labels.json'
import groupedGeometries from './supplemental-area-geometries.json'
import quizIdentities from './ne-quiz-identity-by-map-unit.json'
import baseMapUnits from './ne-map-units-50m.json'
import type { Feature, Geometry } from 'geojson'

// Source geometry and debug names do not imply public labels, quiz identity,
// or regional membership. Curated presentation and associations live below.
export type SupplementalLandFeature = Feature<Geometry, {
  sourceName: string
  sourceType: string
}> & { id: string }

export const supplementalLand = source.features as SupplementalLandFeature[]
export type SupplementalExploreFeature = SupplementalLandFeature & { divisionGeometry?: Geometry }

// Public presentation is explicitly opted in, independently of source geometry.
// A country/quiz association must be explicitly curated, never inferred from
// the source type, operator, or location. It does not assert sovereignty.
interface SupplementalAreaInfo {
  id: string
  sourceIds: string[]
  name: Record<'en' | 'nb', string>
  type: Record<'en' | 'nb', string>
  quizEntityId?: string
}
const areas: SupplementalAreaInfo[] = labels
// The identity file contains overrides only, not the complete country list.
const identityOverrides = quizIdentities as Record<string, string>
const knownQuizIdentities = new Set(baseMapUnits.features.map((unit) =>
  identityOverrides[unit.id] ?? unit.properties.entityId,
))
export const supplementalAreaInfoById = new Map(areas.map((area) => [area.id, area]))
export const supplementalAreaInfoBySourceId = new Map<string, SupplementalAreaInfo>()
for (const area of areas) {
  if (area.quizEntityId && !knownQuizIdentities.has(area.quizEntityId)) {
    throw new Error(`Invalid supplemental area quiz identity: ${area.quizEntityId}`)
  }
  for (const id of area.sourceIds) {
    if (!supplementalLand.some((land) => land.id === id) || supplementalAreaInfoBySourceId.has(id)) {
      throw new Error(`Invalid supplemental area label: ${id}`)
    }
    supplementalAreaInfoBySourceId.set(id, area)
  }
}

// Preserve source pieces for quiz policy and debug review. Explore alone
// dissolves grouped public areas into one hit/focus target with separate lines.
const grouped = groupedGeometries as Record<string, { geometry: Geometry; divisionGeometry?: Geometry }>
const groupedSourceIds = new Set(areas.filter((area) => area.sourceIds.length > 1).flatMap((area) => area.sourceIds))
export const supplementalAreaInfoByDisplayId = new Map(supplementalAreaInfoBySourceId)
export const supplementalExploreLand: SupplementalExploreFeature[] = supplementalLand.filter((land) => !groupedSourceIds.has(land.id))
for (const area of areas.filter((area) => area.sourceIds.length > 1)) {
  const geometry = grouped[area.id]
  if (!geometry || supplementalAreaInfoByDisplayId.has(area.id)) {
    throw new Error(`Invalid grouped supplemental area: ${area.id}`)
  }
  supplementalAreaInfoByDisplayId.set(area.id, area)
  supplementalExploreLand.push({
    type: 'Feature',
    id: area.id,
    properties: { sourceName: area.name.en, sourceType: area.type.en },
    ...geometry,
  })
}
