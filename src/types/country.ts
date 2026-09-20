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
  // Optional geometry for a geographic region. The base geometry remains the
  // unmodified Natural Earth map unit and continues to define quiz identity.
  regionalDisplayGeometry?: Readonly<Record<string, RegionalDisplayGeometry>>
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
