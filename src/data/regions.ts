import { mapUnits } from './countries'
import type { MapUnitFeature } from '../types/country'
import type { MapPoint } from '../composables/useMapZoom'

export type MapRegionId =
  | 'world' | 'europe' | 'nordics' | 'baltics' | 'balkans'
  | 'africa' | 'asia' | 'east-asia' | 'southeast-asia' | 'south-asia' | 'central-asia'
  | 'middle-east' | 'north-america' | 'central-america' | 'caribbean'
  | 'south-america' | 'oceania'

export interface GeographicFrame {
  west: number
  south: number
  east: number
  north: number
}

export interface MapRegion {
  id: MapRegionId
  label: string
  view: { center: MapPoint; zoom: number } | null
  regionalProjection?: { center: MapPoint; roll?: number; frame?: GeographicFrame }
  children?: readonly MapRegion[]
}

// The tree is only selector/navigation structure. Membership below is derived
// from each map unit's Natural Earth REGION_UN/SUBREGION classification and
// explicitly named playable overlays; children do not populate parents.
export const regions: readonly MapRegion[] = [
  { id: 'world', label: 'World', view: null },
  {
    id: 'europe', label: 'Europe', view: { center: [15, 52], zoom: 3.1 },
    regionalProjection: {
      center: [10, 52],
      frame: { west: -35, south: 34, east: 60, north: 75 },
    },
    children: [
      {
        id: 'nordics', label: 'Nordics', view: { center: [8, 64], zoom: 4.25 },
        regionalProjection: {
          center: [15, 64],
          frame: { west: -75, south: 53, east: 36, north: 84 },
        },
      },
      { id: 'baltics', label: 'Baltics', view: { center: [25, 57.5], zoom: 7 } },
      { id: 'balkans', label: 'Balkans', view: { center: [22, 43], zoom: 5.7 } },
    ],
  },
  { id: 'africa', label: 'Africa', view: { center: [20, 2], zoom: 2.35 } },
  {
    id: 'asia', label: 'Asia', view: { center: [88, 34], zoom: 1.85 },
    children: [
      { id: 'middle-east', label: 'Middle East', view: { center: [44, 28], zoom: 4.25 } },
      { id: 'central-asia', label: 'Central Asia', view: { center: [69, 42], zoom: 4 } },
      { id: 'south-asia', label: 'South Asia', view: { center: [78, 22], zoom: 3.8 } },
      { id: 'east-asia', label: 'East Asia', view: { center: [115, 37], zoom: 3 } },
      { id: 'southeast-asia', label: 'Southeast Asia', view: { center: [108, 8], zoom: 4 } },
    ],
  },
  {
    id: 'north-america', label: 'North America', view: { center: [-100, 38], zoom: 1.95 },
    children: [
      { id: 'central-america', label: 'Central America', view: { center: [-88, 15], zoom: 5.2 } },
      { id: 'caribbean', label: 'Caribbean', view: { center: [-70, 18], zoom: 5 } },
    ],
  },
  { id: 'south-america', label: 'South America', view: { center: [-61, -18], zoom: 2.45 } },
  { id: 'oceania', label: 'Oceania', view: { center: [150, -19], zoom: 2.15 } },
]

const playableEntityIds: Partial<Record<MapRegionId, ReadonlySet<string>>> = {
  // A playable grouping can cross canonical regions. Greenland belongs to
  // Nordics here, but its canonical North American unit does not enter Europe.
  nordics: new Set(['DNK', 'FRO', 'FIN', 'GRL', 'ISL', 'NOR', 'SWE', 'ALD']),
  baltics: new Set(['EST', 'LVA', 'LTU']),
  balkans: new Set(['ALB', 'BIH', 'BGR', 'HRV', 'GRC', 'KOS', 'MKD', 'MNE', 'ROU', 'SRB', 'SVN', 'TUR']),
}

function belongsToRegion(unit: MapUnitFeature, id: MapRegionId): boolean {
  const { entityId, regionUn, subregion } = unit.properties
  const playableIds = playableEntityIds[id]
  if (playableIds) return playableIds.has(entityId)

  switch (id) {
    case 'world': return true
    case 'europe': return regionUn === 'Europe'
    case 'africa': return regionUn === 'Africa'
    case 'asia': return regionUn === 'Asia'
    case 'north-america': return regionUn === 'Americas'
      && ['Northern America', 'Central America', 'Caribbean'].includes(subregion)
    case 'south-america': return regionUn === 'Americas' && subregion === 'South America'
    case 'oceania': return regionUn === 'Oceania'
    case 'central-america': return subregion === 'Central America'
    case 'caribbean': return subregion === 'Caribbean'
    case 'central-asia': return subregion === 'Central Asia'
    case 'south-asia': return subregion === 'Southern Asia'
    case 'east-asia': return subregion === 'Eastern Asia'
    case 'southeast-asia': return subregion === 'South-Eastern Asia'
    // Middle East is a game grouping based on M49 Western Asia plus Egypt.
    case 'middle-east': return subregion === 'Western Asia' || entityId === 'EGY'
    default: return false
  }
}

export const regionById = new Map<MapRegionId, MapRegion>()
export const mapUnitIdsByRegion = new Map<MapRegionId, ReadonlySet<string>>()
export const entityIdsByRegion = new Map<MapRegionId, ReadonlySet<string>>()

function indexRegion(region: MapRegion) {
  regionById.set(region.id, region)
  const matchingUnits = mapUnits.filter((unit) => belongsToRegion(unit, region.id))
  mapUnitIdsByRegion.set(region.id, new Set(matchingUnits.map((unit) => unit.id)))
  entityIdsByRegion.set(region.id, new Set(matchingUnits.map((unit) => unit.properties.entityId)))
  for (const child of region.children ?? []) indexRegion(child)
}

for (const region of regions) indexRegion(region)
