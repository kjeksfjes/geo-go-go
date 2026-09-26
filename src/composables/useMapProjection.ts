import {
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
import type { GeographicUnitFeature } from '../types/country'
import type { GeographicFrame, MapRegion } from '../data/regions'
import { bathymetryBands, type BathymetryDepth } from '../data/bathymetry'
import { reliefBands, type ReliefElevation } from '../data/relief'
import type { MapBounds, MapPoint } from './useMapZoom'
import { projectedUnitFocus } from '../logic/mapFocus'

export type MapProjectionId = 'mercator' | 'winkel-tripel' | 'equal-earth' | 'natural-earth' | 'regional-equal-area'
export interface HorizontalWrap {
  period: number
  centerX: number
}

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

interface ProjectedGeographicUnit {
  unit: GeographicUnitFeature
  path: string
  outlinePath?: string
  divisionPath?: string
  displayBounds: MapBounds
  bounds: MapBounds
  focusPoint: MapPoint | undefined
}

export interface ProjectedBathymetryBand {
  depth: BathymetryDepth
  path: string
}

export interface ProjectedReliefBand {
  elevation: ReliefElevation
  path: string
}

interface PathCacheEntry {
  sizeKey: string
  projections: Map<string, ProjectedGeographicUnit[]>
}

function frameBoundary({ west, south, east, north }: GeographicFrame): [number, number][] {
  // Sample each edge in geographic coordinates for an explicit fit frame.
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
  geographicUnits: Ref<GeographicUnitFeature[]>,
  width: Ref<number>,
  height: Ref<number>,
  projectionId: Ref<MapProjectionId>,
  activeRegion: Ref<MapRegion>,
  visibleMapUnitIds: Ref<ReadonlySet<string>>,
) {
  // Keep fitting tied to the initial 50m geographic units. A resolution swap may change
  // coastline extents by a fraction, but it must not move the coordinate
  // system underneath an active pan or zoom transform.
  const fittingUnits = geographicUnits.value
  const fittingFeatures: FeatureCollection = {
    type: 'FeatureCollection',
    features: fittingUnits,
  }
  // Retain each projection at the current viewport size. A resize invalidates
  // the old paths, without accumulating maps at every intermediate size.
  const pathCache = new WeakMap<GeographicUnitFeature[], PathCacheEntry>()
  const bathymetryPathCache = new Map<string, { sizeKey: string; paths: ProjectedBathymetryBand[] }>()
  const reliefPathCache = new Map<string, { sizeKey: string; paths: ProjectedReliefBand[] }>()
  const reliefClipPathCache = new Map<string, { sizeKey: string; path: string }>()
  const regionsWithDisplayGeometry = new Set(
    fittingUnits.flatMap((unit) => Object.keys(unit.regionalDisplayGeometry ?? {})),
  )

  function displayFeature(unit: GeographicUnitFeature): GeographicUnitFeature {
    const display = unit.regionalDisplayGeometry?.[activeRegion.value.id]
    return display ? { ...unit, geometry: display.geometry } : unit
  }

  function cacheKey(id: MapProjectionId) {
    return id === 'regional-equal-area' || regionsWithDisplayGeometry.has(activeRegion.value.id)
      ? `${id}:${activeRegion.value.id}`
      : id
  }

  function hasCachedPaths(source: GeographicUnitFeature[], id = projectionId.value): boolean {
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
        const selected = fittingUnits
          .filter((unit) => unit.properties.mapUnitIds.some((id) => visibleMapUnitIds.value.has(id)))
          .map(displayFeature)
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

  function projectedGeographicPaths(source: GeographicUnitFeature[]) {
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
    // A regional view never needs paths for geographic units hidden by its filter.
    const renderUnits = id === 'regional-equal-area'
      ? source.filter((unit) => unit.properties.mapUnitIds.some((mapUnitId) => visibleMapUnitIds.value.has(mapUnitId)))
      : source
    const paths: ProjectedGeographicUnit[] = renderUnits.map((unit) => {
      const regionalDisplay = unit.regionalDisplayGeometry?.[activeRegion.value.id]
      const displayUnit = displayFeature(unit)
      const focus = projectedUnitFocus(generator, displayUnit, width.value)

      return {
        unit,
        path: generator(displayUnit) ?? '',
        outlinePath: regionalDisplay ? generator(regionalDisplay.outline) ?? '' : undefined,
        divisionPath: regionalDisplay ? generator(regionalDisplay.division) ?? '' : undefined,
        ...focus,
      }
    })

    cached.projections.set(key, paths)
    return paths
  }

  const geographicPaths = computed(() => {
    const source = geographicUnits.value
    // Prepare the interaction layer alongside a detailed projection so the
    // first drag does not pay the 50m projection cost at pointer-down time.
    if (source !== fittingUnits) projectedGeographicPaths(fittingUnits)
    return projectedGeographicPaths(source)
  })
  const interactionGeographicPaths = computed(() => projectedGeographicPaths(fittingUnits))

  const spherePath = computed(() => pathGenerator.value({ type: 'Sphere' }) ?? '')

  const bathymetryPaths = computed(() => {
    const key = cacheKey(projectionId.value)
    const sizeKey = `${width.value}:${height.value}`
    const cached = bathymetryPathCache.get(key)
    if (cached?.sizeKey === sizeKey) return cached.paths

    const generator = pathGenerator.value
    const paths = bathymetryBands.map(({ depth, geometry }) => ({
      depth,
      path: generator(geometry) ?? '',
    }))
    bathymetryPathCache.set(key, { sizeKey, paths })
    return paths
  })

  const reliefPaths = computed(() => {
    const key = cacheKey(projectionId.value)
    const sizeKey = `${width.value}:${height.value}`
    const cached = reliefPathCache.get(key)
    if (cached?.sizeKey === sizeKey) return cached.paths

    const generator = pathGenerator.value
    const paths = reliefBands.map(({ elevation, geometry }) => ({
      elevation,
      path: generator(geometry) ?? '',
    }))
    reliefPathCache.set(key, { sizeKey, paths })
    return paths
  })

  const reliefClipPath = computed(() => {
    // Keep clipping independent of the active 10m country layer. Applying a
    // high-detail compound clip to every relief band is expensive during pan;
    // the stable 50m geometry is indistinguishable at these elevation edges.
    const key = `${projectionId.value}:${activeRegion.value.id}`
    const sizeKey = `${width.value}:${height.value}`
    const cached = reliefClipPathCache.get(key)
    if (cached?.sizeKey === sizeKey) return cached.path

    const generator = pathGenerator.value
    const path = fittingUnits
      .filter((unit) => unit.properties.mapUnitIds.some((id) => visibleMapUnitIds.value.has(id)))
      .map((unit) => generator(displayFeature(unit)) ?? '')
      .join(' ')
    reliefClipPathCache.set(key, { sizeKey, path })
    return path
  })

  const horizontalWrap = computed<HorizontalWrap | null>(() => {
    if (projectionId.value !== 'mercator' || activeRegion.value.id !== 'world') return null
    const projection = pathGenerator.value.projection() as GeoProjection
    return {
      period: 2 * Math.PI * projection.scale(),
      centerX: projection.translate()[0],
    }
  })

  // Approximate how large one geographic radian appears relative to a
  // world-fitted map. Regional projections begin at a closer effective zoom.
  const projectionScale = computed(() => {
    const projection = pathGenerator.value.projection() as GeoProjection
    return 2 * Math.PI * projection.scale() / width.value
  })

  function projectPoint(point: MapPoint): MapPoint | undefined {
    const projection = pathGenerator.value.projection()
    if (typeof projection !== 'function') return undefined

    return projection(point) as MapPoint | undefined
  }

  return {
    bathymetryPaths,
    geographicPaths,
    hasCachedPaths,
    horizontalWrap,
    interactionGeographicPaths,
    projectPoint,
    projectionScale,
    reliefClipPath,
    reliefPaths,
    spherePath,
  }
}
