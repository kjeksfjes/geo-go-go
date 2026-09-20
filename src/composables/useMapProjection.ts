import {
  geoCentroid,
  geoArea,
  geoAzimuthalEqualArea,
  geoEqualEarth,
  geoMercator,
  geoNaturalEarth1,
  geoPath,
  type GeoProjection,
} from 'd3-geo'
import { geoWinkel3 } from 'd3-geo-projection'
import { computed, type Ref } from 'vue'
import type { FeatureCollection, MultiPoint } from 'geojson'
import type { MapUnitFeature } from '../types/country'
import type { GeographicFrame, MapRegion } from '../data/regions'
import type { MapBounds, MapPoint } from './useMapZoom'

export type MapProjectionId = 'mercator' | 'winkel-tripel' | 'equal-earth' | 'natural-earth' | 'regional-equal-area'

export const projectionOptions: Array<{ id: MapProjectionId; label: string }> = [
  { id: 'mercator', label: 'Mercator' },
  { id: 'winkel-tripel', label: 'Winkel Tripel' },
  { id: 'equal-earth', label: 'Equal Earth' },
  { id: 'natural-earth', label: 'Natural Earth' },
  { id: 'regional-equal-area', label: 'Regional Equal Area' },
]

const projectionFactories: Record<Exclude<MapProjectionId, 'regional-equal-area'>, () => GeoProjection> = {
  mercator: geoMercator,
  'winkel-tripel': geoWinkel3,
  'equal-earth': geoEqualEarth,
  'natural-earth': geoNaturalEarth1,
}

interface ProjectedCountry {
  country: MapUnitFeature
  path: string
  bounds: MapBounds
  focusPoint: MapPoint | undefined
}

interface PathCacheEntry {
  sizeKey: string
  projections: Map<string, ProjectedCountry[]>
}

function frameBoundary({ west, south, east, north }: GeographicFrame): [number, number][] {
  // Sample each edge in geographic coordinates. Its projected outline becomes
  // the display mask as well as the fit geometry, so the two stay aligned.
  const sampleCount = Math.max(12, Math.ceil(Math.max(east - west, north - south)))
  const coordinates: [number, number][] = []
  for (let index = 0; index <= sampleCount; index++) {
    const fraction = index / sampleCount
    coordinates.push([west + (east - west) * fraction, south])
  }
  for (let index = 1; index <= sampleCount; index++) {
    const fraction = index / sampleCount
    coordinates.push([east, south + (north - south) * fraction])
  }
  for (let index = 1; index <= sampleCount; index++) {
    const fraction = index / sampleCount
    coordinates.push([east - (east - west) * fraction, north])
  }
  for (let index = 1; index < sampleCount; index++) {
    const fraction = index / sampleCount
    coordinates.push([west, north - (north - south) * fraction])
  }
  return coordinates
}

export function useMapProjection(
  mapUnits: Ref<MapUnitFeature[]>,
  width: Ref<number>,
  height: Ref<number>,
  projectionId: Ref<MapProjectionId>,
  activeRegion: Ref<MapRegion>,
  visibleMapUnitIds: Ref<ReadonlySet<string>>,
) {
  // Keep fitting tied to the initial 50m map units. A resolution swap may change
  // coastline extents by a fraction, but it must not move the coordinate
  // system underneath an active pan or zoom transform.
  const fittingUnits = mapUnits.value
  const fittingFeatures: FeatureCollection = {
    type: 'FeatureCollection',
    features: fittingUnits,
  }
  // Retain each projection at the current viewport size. A resize invalidates
  // the old paths, without accumulating maps at every intermediate size.
  const pathCache = new WeakMap<MapUnitFeature[], PathCacheEntry>()

  function cacheKey(id: MapProjectionId) {
    return id === 'regional-equal-area' ? `${id}:${activeRegion.value.id}` : id
  }

  function hasCachedPaths(source: MapUnitFeature[], id = projectionId.value): boolean {
    const cached = pathCache.get(source)
    return cached?.sizeKey === `${width.value}:${height.value}`
      && cached.projections.has(cacheKey(id))
  }

  const pathGenerator = computed(() => {
    const padding = Math.max(12, Math.min(width.value, height.value) * 0.035)
    const id = projectionId.value
    let projection: GeoProjection
    let fitGeometry: FeatureCollection | MultiPoint = fittingFeatures

    if (id === 'regional-equal-area') {
      const region = activeRegion.value
      const { center, roll = 0, frame } = region.regionalProjection
        ?? { center: region.view?.center ?? [0, 0] as MapPoint }
      projection = geoAzimuthalEqualArea().rotate([-center[0], -center[1], roll])
      if (frame) {
        fitGeometry = { type: 'MultiPoint', coordinates: frameBoundary(frame) }
      } else {
        const selected = fittingUnits.filter((unit) => visibleMapUnitIds.value.has(unit.id))
        if (selected.length) fitGeometry = { type: 'FeatureCollection', features: selected }
      }
    } else {
      projection = projectionFactories[id]()
    }

    projection.fitExtent(
      [
        [padding, padding],
        [width.value - padding, height.value - padding],
      ],
      fitGeometry,
    )

    return geoPath(projection)
  })

  const countryPaths = computed(() => {
    const source = mapUnits.value
    const id = projectionId.value
    const key = cacheKey(id)
    const sizeKey = `${width.value}:${height.value}`
    let cached = pathCache.get(source)
    if (cached?.sizeKey === sizeKey) {
      const paths = cached.projections.get(key)
      if (paths) return paths
    } else {
      cached = { sizeKey, projections: new Map() }
      pathCache.set(source, cached)
    }

    const generator = pathGenerator.value
    // A regional view never needs paths for map units hidden by its filter.
    const renderCountries = id === 'regional-equal-area'
      ? source.filter((country) => visibleMapUnitIds.value.has(country.id))
      : source
    const paths: ProjectedCountry[] = renderCountries.map((country) => {
      const fullBounds = generator.bounds(country) as MapBounds
      let focusCountry = country

      // A map unit can still contain distant islands or cross the antimeridian.
      // Use its largest landmass for click-to-zoom when the full unit bounds
      // would be misleading, while retaining all of its rendered polygons.
      if (country.geometry.type === 'MultiPolygon') {
        const largestLandmass = country.geometry.coordinates
          .map((coordinates) => ({
            ...country,
            geometry: { type: 'Polygon' as const, coordinates },
          }))
          .reduce((largest, candidate) =>
            geoArea(candidate) > geoArea(largest) ? candidate : largest,
          )

        const mainBounds = generator.bounds(largestLandmass) as MapBounds
        const fullWidth = Math.max(1, fullBounds[1][0] - fullBounds[0][0])
        const fullHeight = Math.max(1, fullBounds[1][1] - fullBounds[0][1])
        const mainWidth = Math.max(1, mainBounds[1][0] - mainBounds[0][0])
        const mainHeight = Math.max(1, mainBounds[1][1] - mainBounds[0][1])
        const mainlandAreaShare = geoArea(largestLandmass) / geoArea(country)
        const spansMostOfMap = fullWidth > width.value * 0.65
        const hasDistantTerritories = Math.max(
          fullWidth / mainWidth,
          fullHeight / mainHeight,
        ) > 2
        const mainlandDominates = mainlandAreaShare > 0.75

        if (mainlandDominates && (spansMostOfMap || hasDistantTerritories)) {
          focusCountry = largestLandmass
        }
      }

      const projection = generator.projection()
      const focusPoint = typeof projection === 'function'
        ? projection(geoCentroid(focusCountry)) ?? undefined
        : undefined

      return {
        country,
        path: generator(country) ?? '',
        bounds: generator.bounds(focusCountry) as MapBounds,
        focusPoint: focusPoint as MapPoint | undefined,
      }
    })

    cached.projections.set(key, paths)
    return paths
  })

  const spherePath = computed(() => pathGenerator.value({ type: 'Sphere' }) ?? '')

  function projectPoint(point: MapPoint): MapPoint | undefined {
    const projection = pathGenerator.value.projection()
    if (typeof projection !== 'function') return undefined

    return projection(point) as MapPoint | undefined
  }

  return { countryPaths, hasCachedPaths, projectPoint, spherePath }
}
