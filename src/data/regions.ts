import { mapUnits, primaryMapUnitByEntityId } from './countries'
import type { MapUnitFeature } from '../types/country'
import type { MapPoint } from '../composables/useMapZoom'

export type MapRegionId =
  | 'world' | 'europe' | 'western-europe' | 'eastern-europe' | 'balkans'
  | 'africa' | 'asia' | 'east-asia' | 'southeast-asia' | 'south-asia' | 'central-asia'
  | 'middle-east' | 'north-america' | 'central-america-caribbean'
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
  view: { center: MapPoint; zoom: number; panReach?: number; horizontalWrap?: boolean } | null
  regionalProjection?: { center: MapPoint; roll?: number; frame?: GeographicFrame }
  children?: readonly MapRegion[]
}

// The tree is only selector/navigation structure. Membership below is derived
// from each map unit's Natural Earth REGION_UN/SUBREGION classification and
// explicitly named playable overlays; children do not populate parents.
export const regions: readonly MapRegion[] = [
  { id: 'world', label: 'World', view: null },
  {
    id: 'europe', label: 'Europe', view: { center: [24.77, 58.02], zoom: 3.1 },
    regionalProjection: { center: [10, 52] },
    children: [
      {
        id: 'western-europe', label: 'Western Europe', view: { center: [2, 50], zoom: 3.25, panReach: 0.75 },
        regionalProjection: {
          center: [2, 50],
          frame: { west: -75, south: 34, east: 34, north: 84 },
        },
      },
      {
        id: 'eastern-europe', label: 'Eastern Europe', view: { center: [35, 55], zoom: 4.25, panReach: 0.75 },
        // Frame the European practice area without splitting Russia's country identity.
        regionalProjection: {
          center: [35, 55],
          frame: { west: 12, south: 34, east: 65, north: 72 },
        },
      },
      { id: 'balkans', label: 'Balkans', view: { center: [29.72, 41.73], zoom: 11.56 } },
    ],
  },
  { id: 'africa', label: 'Africa', view: { center: [20.13, 2.17], zoom: 2.84 } },
  {
    id: 'asia', label: 'Asia', view: { center: [87, 26.2], zoom: 2.69 },
    children: [
      { id: 'middle-east', label: 'Middle East', view: { center: [43.51, 28.76], zoom: 5.76 } },
      { id: 'central-asia', label: 'Central Asia', view: { center: [67.47, 46.21], zoom: 7.24 } },
      { id: 'south-asia', label: 'South Asia', view: { center: [72.08, 24.09], zoom: 5.93 } },
      { id: 'east-asia', label: 'East Asia', view: { center: [111.99, 37.53], zoom: 4.85 } },
      { id: 'southeast-asia', label: 'Southeast Asia', view: { center: [114.44, 7.9], zoom: 5.49 } },
    ],
  },
  {
    id: 'north-america', label: 'North America', view: { center: [-102.74, 52.73], zoom: 2.11, horizontalWrap: true },
    children: [
      {
        id: 'central-america-caribbean',
        label: 'Central America & Caribbean',
        view: { center: [-89.44, 20.1], zoom: 7.31 },
      },
    ],
  },
  { id: 'south-america', label: 'South America', view: { center: [-61.68, -26.07], zoom: 2.92 } },
  { id: 'oceania', label: 'Oceania', view: { center: [145.05, -26.9], zoom: 4.25, horizontalWrap: true } },
]

// Game policy adapted from the Norwegian Wikipedia Land table, with Greece
// assigned to the western/Mediterranean group and Turkey retained in the east.
// https://no.wikipedia.org/w/index.php?title=Øst-Europa&oldid=25912362#Land
const easternEuropeEntityIds = new Set([
  'EST', 'LVA', 'LTU', 'POL', 'CZE', 'SVK', 'HUN', 'BLR', 'UKR', 'MDA', 'ROU', 'BGR', 'RUS',
  'ALB', 'BIH', 'HRV', 'KOS', 'MKD', 'MNE', 'SRB', 'SVN', 'TUR',
])

// Western Europe is the remaining canonical European country identities,
// including Nordic and Mediterranean countries. Preserve Greenland/Faroes in
// Explore. Using quiz identities keeps source-data splits out of this policy.
const westernEuropeEntityIds = new Set([
  ...mapUnits
    .filter((unit) => unit.properties.regionUn === 'Europe'
      && !easternEuropeEntityIds.has(unit.quizEntityId))
    .map((unit) => unit.quizEntityId),
  'GRL', 'FRO',
])

const playableEntityIds: Partial<Record<MapRegionId, ReadonlySet<string>>> = {
  'western-europe': westernEuropeEntityIds,
  'eastern-europe': easternEuropeEntityIds,
  balkans: new Set(['ALB', 'BIH', 'BGR', 'HRV', 'GRC', 'KOS', 'MKD', 'MNE', 'ROU', 'SRB', 'SVN', 'TUR']),
}

function belongsToRegion(unit: MapUnitFeature, id: MapRegionId): boolean {
  const { regionUn, subregion } = unit.properties
  const entityId = unit.quizEntityId
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
    case 'central-america-caribbean': return ['Central America', 'Caribbean'].includes(subregion)
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
export const quizEntityIdsByRegion = new Map<MapRegionId, ReadonlySet<string>>()

function indexRegion(region: MapRegion) {
  regionById.set(region.id, region)
  const matchingUnits = mapUnits.filter((unit) => belongsToRegion(unit, region.id))
  mapUnitIdsByRegion.set(region.id, new Set(matchingUnits.map((unit) => unit.id)))
  entityIdsByRegion.set(region.id, new Set(matchingUnits.map((unit) => unit.quizEntityId)))
  // Overseas parts stay visible and interactive without making their parent
  // country a regional quiz question. Playable overlays still match the
  // principal unit through their explicit entity lists above.
  quizEntityIdsByRegion.set(region.id, new Set(
    matchingUnits
      .filter((unit) => primaryMapUnitByEntityId.get(unit.quizEntityId) === unit)
      .map((unit) => unit.quizEntityId),
  ))
  for (const child of region.children ?? []) indexRegion(child)
}

for (const region of regions) indexRegion(region)
