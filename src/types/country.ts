import type { Feature, Geometry } from 'geojson'

export interface CountryProperties {
  name: string
  entityId: string
  adminName: string
  sovereignId: string
  sovereignName: string
  featureType: string
  isoA2: string
  regionUn: string
  subregion: string
  continent: string
}

export interface RegionalDisplayGeometry {
  geometry: Geometry
  // The real map-unit edge and the geographic division are separate lines,
  // so a regional cut is not mistaken for an ordinary country border.
  outline: Geometry
  division: Geometry
}

export type MapUnitFeature = Feature<Geometry, CountryProperties> & {
  id: string
  // Quiz identity may differ from Natural Earth's source ADM0_A3 for an
  // unrecognized/breakaway map unit. properties.entityId remains the raw ID.
  quizEntityId: string
  // Optional geometry for a geographic region. The base geometry remains the
  // unmodified Natural Earth map unit; quiz identity is a separate policy.
  regionalDisplayGeometry?: Readonly<Record<string, RegionalDisplayGeometry>>
}

export type MapSubunitFeature = Feature<Geometry, {
  name: string
  mapUnitId: string
  entityId: string
  featureType: string
  sourceKind?: 'admin-1' | 'coastline'
}> & {
  id: string
  regionalDisplayGeometry?: Readonly<Record<string, RegionalDisplayGeometry>>
}

export interface GeographicComponentInfo {
  id: string
  sourceKind: 'map-unit' | 'map-subunit' | 'admin-1' | 'coastline' | 'leased-area'
  sourceId: string
  entityId: string
  name: string
  sourceType: string
  flagCode?: string
  nameOverrides?: Partial<Record<'en' | 'nb', string>>
  typeOverrides?: Partial<Record<'en' | 'nb', string>>
}

export type GeographicUnitFeature = Feature<Geometry, {
  entityId: string
  mapUnitIds: readonly string[]
  componentId?: string
}> & {
  id: string
  regionalDisplayGeometry?: Readonly<Record<string, RegionalDisplayGeometry>>
  // Optional linework separates internal boundaries from country borders.
  // An empty outline intentionally suppresses the ordinary polygon stroke.
  outlineGeometry?: Geometry
  divisionGeometry?: Geometry
  // Explicitly curated quiz-only union, not a source/sovereignty change.
  quizGeometry?: Geometry
}

export interface CountryInfo {
  id: string
  name: string
  flagCode: string
  sovereignId: string
  parentSovereignId?: string
  mapUnitIds: readonly string[]
}

export interface SovereignInfo {
  id: string
  name: string
  entityIds: readonly string[]
  mapUnitIds: readonly string[]
}
