import type { Feature, MultiPolygon, Polygon } from 'geojson'
import overview from './norway-counties-overview.json'

export interface CountyInfo { id: string; code: string; name: string }
export type CountyFeature = Feature<Polygon | MultiPolygon, { code: string; name: string }> & { id: string }
export const countyFeatures = overview.features as CountyFeature[]
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
export async function loadCountyDetail(): Promise<CountyFeature[]> {
  return (await import('./norway-counties-detail.json')).default.features as CountyFeature[]
}
