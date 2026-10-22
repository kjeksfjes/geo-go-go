import type { Feature, MultiPolygon, Polygon } from 'geojson'
import detail from './norway-counties-detail.json'

export interface CountyInfo { id: string; code: string; name: string }
export type CountyFeature = Feature<Polygon | MultiPolygon, { code: string; name: string }> & { id: string }
export const countyFeatures = detail.features as CountyFeature[]
export const countyInfoById: ReadonlyMap<string, CountyInfo> = new Map(countyFeatures.map(f =>
  [f.id, { id: f.id, ...f.properties }]))
export const countyIds: ReadonlySet<string> = new Set(countyInfoById.keys())
export const countyNames: Readonly<Record<string, string>> = Object.fromEntries(
  [...countyInfoById.values()].map(county => [county.id, county.name]),
)
const emblems = import.meta.glob('../assets/county-arms/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
export const countyEmblems: Readonly<Record<string, string>> = Object.fromEntries(
  [...countyInfoById.values()].map(county => [county.id, emblems[`../assets/county-arms/${county.code}.svg`]!]),
)

export const countyMap: import('../types/administrativeMap').AdministrativeMapData = {
  id: 'norway-counties', kind: 'county', layout: 'geographic', features: countyFeatures,
  places: countyInfoById, ids: countyIds, names: { en: countyNames, nb: countyNames }, badges: countyEmblems,
  zoomReferenceIds: ['no:county:50', 'no:county:18'],
  attribution: { label: 'countyAttribution', url: 'https://data.norge.no/nb/datasets/8aa07439-e295-3e11-8ee5-141cf03d7bd5/administrative-enheter-fylker' },
}
