import {
  geoCentroid,
  geoArea,
  geoEqualEarth,
  geoMercator,
  geoNaturalEarth1,
  geoPath,
  type GeoProjection,
} from 'd3-geo'
import { geoWinkel3 } from 'd3-geo-projection'
import { computed, type Ref } from 'vue'
import type { FeatureCollection } from 'geojson'
import type { CountryFeature } from '../types/country'
import type { MapBounds, MapPoint } from './useMapZoom'

export type MapProjectionId = 'mercator' | 'winkel-tripel' | 'equal-earth' | 'natural-earth'

export const projectionOptions: Array<{ id: MapProjectionId; label: string }> = [
  { id: 'mercator', label: 'Mercator' },
  { id: 'winkel-tripel', label: 'Winkel Tripel' },
  { id: 'equal-earth', label: 'Equal Earth' },
  { id: 'natural-earth', label: 'Natural Earth' },
]

const projectionFactories: Record<MapProjectionId, () => GeoProjection> = {
  mercator: geoMercator,
  'winkel-tripel': geoWinkel3,
  'equal-earth': geoEqualEarth,
  'natural-earth': geoNaturalEarth1,
}

interface ProjectedCountry {
  country: CountryFeature
  path: string
  bounds: MapBounds
  focusPoint: MapPoint | undefined
}

interface PathCacheEntry {
  key: string
  paths: ProjectedCountry[]
}

export function useMapProjection(
  countries: Ref<CountryFeature[]>,
  width: Ref<number>,
  height: Ref<number>,
  projectionId: Ref<MapProjectionId>,
) {
  // Keep fitting tied to the initial 50m atlas. A resolution swap may change
  // coastline extents by a fraction, but it must not move the coordinate
  // system underneath an active pan or zoom transform.
  const fittingFeatures: FeatureCollection = {
    type: 'FeatureCollection',
    features: countries.value,
  }
  // Cache the last projection of each source array. This keeps both the 50m
  // and 10m path sets ready after their first render, without retaining every
  // intermediate map size after repeated resizes.
  const pathCache = new WeakMap<CountryFeature[], PathCacheEntry>()

  const pathGenerator = computed(() => {
    const padding = Math.max(12, Math.min(width.value, height.value) * 0.035)
    const projection = projectionFactories[projectionId.value]().fitExtent(
      [
        [padding, padding],
        [width.value - padding, height.value - padding],
      ],
      fittingFeatures,
    )

    return geoPath(projection)
  })

  const countryPaths = computed(() => {
    const source = countries.value
    const cacheKey = `${projectionId.value}:${width.value}:${height.value}`
    const cached = pathCache.get(source)
    if (cached?.key === cacheKey) return cached.paths

    const generator = pathGenerator.value
    const paths: ProjectedCountry[] = source.map((country) => {
      const fullBounds = generator.bounds(country) as MapBounds
      let focusCountry = country

      // Countries that cross the antimeridian or include distant territories
      // can have misleading bounds. Frame the largest contiguous landmass when
      // the full geometry is either near-worldwide or far more dispersed than
      // that landmass, while still rendering and highlighting every territory.
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

    pathCache.set(source, { key: cacheKey, paths })
    return paths
  })

  const spherePath = computed(() => pathGenerator.value({ type: 'Sphere' }) ?? '')

  return { countryPaths, spherePath }
}
