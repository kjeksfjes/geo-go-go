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

export type MapUnitFeature = Feature<Geometry, CountryProperties> & {
  id: string
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
