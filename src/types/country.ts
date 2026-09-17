import type { Feature, Geometry } from 'geojson'

export interface CountryProperties {
  name: string
}

export type CountryFeature = Feature<Geometry, CountryProperties> & {
  id: string
}

export interface CountryInfo {
  id: string
  name: string
  flagCode: string
}
