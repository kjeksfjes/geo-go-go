import {
  geoAzimuthalEqualArea,
  geoMercator,
  geoNaturalEarth1,
  geoPath,
  type GeoProjection,
} from 'd3-geo'
import { geoMiller, geoWinkel3 } from 'd3-geo-projection'
import { computed, onScopeDispose, shallowRef, watch, type Ref } from 'vue'
import type { FeatureCollection, MultiPoint } from 'geojson'
import type { GeographicUnitFeature } from '../types/country'
import type { GeographicFrame, MapRegion } from '../data/regions'
import type { BathymetryBand, BathymetryDepth } from '../data/bathymetry'
import type { ReliefBand, ReliefElevation } from '../data/relief'
import type { MapBounds, MapPoint } from './useMapZoom'
import { projectedUnitFocus } from '../logic/mapFocus'

export type MapProjectionId = 'mercator' | 'miller' | 'winkel-tripel' | 'natural-earth' | 'regional-equal-area'
export interface MapProjectionOption {
  id: MapProjectionId
  label: string
  supportsHorizontalWrap?: boolean
}
export interface HorizontalWrap {
  period: number
  centerX: number
}

export interface ProjectionDebugState {
  key: string
  result: 'cache hit' | 'full projection' | 'regional override'
  durationMs: number
  unitCount: number
}

export const projectionOptions: MapProjectionOption[] = [
  { id: 'mercator', label: 'Mercator', supportsHorizontalWrap: true },
  { id: 'miller', label: 'Miller Cylindrical', supportsHorizontalWrap: true },
  { id: 'winkel-tripel', label: 'Winkel Tripel' },
  { id: 'natural-earth', label: 'Natural Earth' },
  { id: 'regional-equal-area', label: 'Regional Equal Area' },
]

const projectionFactories: Record<Exclude<MapProjectionId, 'regional-equal-area'>, () => GeoProjection> = {
  mercator: geoMercator,
  miller: geoMiller,
  'winkel-tripel': geoWinkel3,
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
  bathymetryBands: Ref<readonly BathymetryBand[]>,
  reliefBands: Ref<readonly ReliefBand[]>,
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
  const bathymetryPathCache = new Map<string, {
    sizeKey: string
    source: readonly BathymetryBand[]
    paths: ProjectedBathymetryBand[]
  }>()
  const reliefPathCache = new Map<string, {
    sizeKey: string
    source: readonly ReliefBand[]
    paths: ProjectedReliefBand[]
  }>()
  const reliefClipPathCache = new Map<string, { sizeKey: string; path: string }>()
  const projectionDebug = shallowRef<ProjectionDebugState | null>(null)
  const regionsWithDisplayGeometry = new Set(
    fittingUnits.flatMap((unit) => Object.keys(unit.regionalDisplayGeometry ?? {})),
  )

  function displayFeature(unit: GeographicUnitFeature): GeographicUnitFeature {
    const display = unit.regionalDisplayGeometry?.[activeRegion.value.id]
    return display ? { ...unit, geometry: display.geometry } : unit
  }

  function projectionCacheKey(id: MapProjectionId) {
    return id === 'regional-equal-area' ? `${id}:${activeRegion.value.id}` : id
  }

  function geographicCacheKey(id: MapProjectionId, regionId: string = activeRegion.value.id) {
    const projectionKey = projectionCacheKey(id)
    return id !== 'regional-equal-area' && regionsWithDisplayGeometry.has(regionId)
      ? `${projectionKey}:${regionId}`
      : projectionKey
  }

  function hasCachedPaths(source: GeographicUnitFeature[], id = projectionId.value): boolean {
    const cached = pathCache.get(source)
    return cached?.sizeKey === `${width.value}:${height.value}`
      && cached.projections.has(geographicCacheKey(id))
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

  function projectedGeographicPaths(source: GeographicUnitFeature[], trackDebug = false, regionId: string = activeRegion.value.id) {
    const startedAt = trackDebug ? performance.now() : 0
    const id = projectionId.value
    const key = geographicCacheKey(id, regionId)
    const sizeKey = `${width.value}:${height.value}`
    let cached = pathCache.get(source)
    if (cached?.sizeKey === sizeKey) {
      const paths = cached.projections.get(key)
      if (paths) {
        if (trackDebug) projectionDebug.value = {
          key,
          result: 'cache hit',
          durationMs: performance.now() - startedAt,
          unitCount: paths.length,
        }
        return paths
      }
    } else {
      cached = { sizeKey, projections: new Map() }
      pathCache.set(source, cached)
    }

    const generator = pathGenerator.value
    const baseKey = projectionCacheKey(id)
    let basePaths = cached.projections.get(baseKey)
    const reusedBasePaths = basePaths !== undefined
    if (!basePaths && key !== baseKey) {
      basePaths = source.map((unit) => ({
        unit,
        path: generator(unit) ?? '',
        ...projectedUnitFocus(generator, unit, width.value),
      }))
      cached.projections.set(baseKey, basePaths)
    }

    // Global projections do not change when a region is selected. Reuse all
    // base paths and replace only units with region-specific display geometry
    // instead of reprojecting the complete atlas for Europe's Russia split.
    if (basePaths) {
      const paths = basePaths.map((projected) => {
        const regionalDisplay = projected.unit.regionalDisplayGeometry?.[regionId]
        if (!regionalDisplay) return projected
        const displayUnit = { ...projected.unit, geometry: regionalDisplay.geometry }
        return {
          unit: projected.unit,
          path: generator(displayUnit) ?? '',
          outlinePath: generator(regionalDisplay.outline) ?? '',
          divisionPath: generator(regionalDisplay.division) ?? '',
          ...projectedUnitFocus(generator, displayUnit, width.value),
        }
      })
      cached.projections.set(key, paths)
      if (trackDebug) projectionDebug.value = {
        key,
        result: reusedBasePaths ? 'regional override' : 'full projection',
        durationMs: performance.now() - startedAt,
        unitCount: paths.length,
      }
      return paths
    }

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
    if (trackDebug) projectionDebug.value = {
      key,
      result: 'full projection',
      durationMs: performance.now() - startedAt,
      unitCount: paths.length,
    }
    return paths
  }

  const geographicPaths = computed(() => {
    const source = geographicUnits.value
    // Prepare the interaction layer alongside a detailed projection so the
    // first drag does not pay the 50m projection cost at pointer-down time.
    if (source !== fittingUnits) projectedGeographicPaths(fittingUnits)
    return projectedGeographicPaths(source, true)
  })
  const interactionGeographicPaths = computed(() => projectedGeographicPaths(fittingUnits))

  // Regional display variants share the global coordinate system, but their
  // first projection can be expensive at 10m. Prepare them after the current
  // view is ready, without making a region click pay that cold-cache cost.
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    let idleTask: number | undefined
    const cancelPrewarm = () => {
      if (idleTask !== undefined) window.cancelIdleCallback(idleTask)
      idleTask = undefined
    }
    watch(geographicPaths, () => {
      cancelPrewarm()
      if (projectionId.value === 'regional-equal-area') return
      const sources = geographicUnits.value === fittingUnits
        ? [fittingUnits] : [fittingUnits, geographicUnits.value]
      const pending = sources.flatMap((source) => [...regionsWithDisplayGeometry]
        .map((regionId) => ({ source, regionId })))
      const prepareNext = () => {
        idleTask = window.requestIdleCallback(() => {
          idleTask = undefined
          const next = pending.shift()
          if (next) projectedGeographicPaths(next.source, false, next.regionId)
          if (pending.length) prepareNext()
        })
      }
      prepareNext()
    }, { immediate: true, flush: 'post' })
    onScopeDispose(cancelPrewarm)
  }

  // Context land uses the stable 50m source even when active countries use
  // 10m geometry. Keep only nearby units; they are visual context, not hit
  // targets or quiz members.
  const contextGeographicPaths = computed(() => {
    if (activeRegion.value.id === 'world') return []
    const selected = interactionGeographicPaths.value
      .filter(({ unit }) => unit.properties.mapUnitIds.some((id) => visibleMapUnitIds.value.has(id)))
    if (!selected.length) return []

    const left = Math.min(...selected.map(({ displayBounds }) => displayBounds[0][0]))
    const top = Math.min(...selected.map(({ displayBounds }) => displayBounds[0][1]))
    const right = Math.max(...selected.map(({ displayBounds }) => displayBounds[1][0]))
    const bottom = Math.max(...selected.map(({ displayBounds }) => displayBounds[1][1]))
    const viewScale = projectionId.value === 'regional-equal-area'
      ? 1
      : Math.max(1.15, (activeRegion.value.view?.zoom ?? 1) * 0.8)
    // Cover the whole permitted camera area (a half viewport plus the pan
    // margin beyond the playable land), without painting the rest of Earth.
    const padX = width.value * 0.8 / viewScale
    const padY = height.value * 0.8 / viewScale
    const candidates = projectionId.value === 'regional-equal-area'
      ? fittingUnits.filter((unit) => !unit.properties.mapUnitIds.some((id) => visibleMapUnitIds.value.has(id)))
        .map((unit) => {
          const displayUnit = displayFeature(unit)
          const generator = pathGenerator.value
          return { path: generator(displayUnit) ?? '', bounds: generator.bounds(displayUnit) }
        })
      : interactionGeographicPaths.value
        .filter(({ unit }) => !unit.properties.mapUnitIds.some((id) => visibleMapUnitIds.value.has(id)))
        .map(({ path, displayBounds }) => ({ path, bounds: displayBounds }))

    // A region-specific display geometry can cut a transcontinental map unit.
    // Paint its unmodified source geometry underneath the active regional part:
    // the portion beyond the geographic division then becomes muted context,
    // while hit-testing, quiz identity, fitting, and focus stay regional.
    const generator = pathGenerator.value
    const basePaths = projectionId.value === 'regional-equal-area'
      ? undefined
      : pathCache.get(fittingUnits)?.projections.get(projectionCacheKey(projectionId.value))
    for (const unit of fittingUnits) {
      if (!unit.regionalDisplayGeometry?.[activeRegion.value.id]
        || !unit.properties.mapUnitIds.some((id) => visibleMapUnitIds.value.has(id))) continue
      const base = basePaths?.find((projected) => projected.unit === unit)
      candidates.push(base
        ? { path: base.path, bounds: base.displayBounds }
        : { path: generator(unit) ?? '', bounds: generator.bounds(unit) })
    }

    return candidates.filter(({ path, bounds }) => path
      && Number.isFinite(bounds[0][0]) && Number.isFinite(bounds[0][1])
      && Number.isFinite(bounds[1][0]) && Number.isFinite(bounds[1][1])
      && bounds[0][0] <= right + padX && bounds[1][0] >= left - padX
      && bounds[0][1] <= bottom + padY && bounds[1][1] >= top - padY)
  })

  const spherePath = computed(() => pathGenerator.value({ type: 'Sphere' }) ?? '')

  const bathymetryPaths = computed(() => {
    const key = projectionCacheKey(projectionId.value)
    const sizeKey = `${width.value}:${height.value}`
    const source = bathymetryBands.value
    const cached = bathymetryPathCache.get(key)
    if (cached?.sizeKey === sizeKey && cached.source === source) return cached.paths

    const generator = pathGenerator.value
    const paths = source.map(({ depth, geometry }) => ({
      depth,
      path: generator(geometry) ?? '',
    }))
    bathymetryPathCache.set(key, { sizeKey, source, paths })
    return paths
  })

  const reliefPaths = computed(() => {
    const key = projectionCacheKey(projectionId.value)
    const sizeKey = `${width.value}:${height.value}`
    const source = reliefBands.value
    const cached = reliefPathCache.get(key)
    if (cached?.sizeKey === sizeKey && cached.source === source) return cached.paths

    const generator = pathGenerator.value
    const paths = source.map(({ elevation, geometry }) => ({
      elevation,
      path: generator(geometry) ?? '',
    }))
    reliefPathCache.set(key, { sizeKey, source, paths })
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
    const wrapEnabled = activeRegion.value.id === 'world'
      || activeRegion.value.view?.horizontalWrap === true
    const projectionWraps = projectionOptions.find(({ id }) => id === projectionId.value)
      ?.supportsHorizontalWrap === true
    if (!projectionWraps || !wrapEnabled) return null
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

  function unprojectPoint(point: MapPoint): MapPoint | undefined {
    const projection = pathGenerator.value.projection() as GeoProjection
    return projection.invert?.(point) as MapPoint | undefined
  }

  return {
    bathymetryPaths,
    contextGeographicPaths,
    geographicPaths,
    hasCachedPaths,
    horizontalWrap,
    interactionGeographicPaths,
    projectPoint,
    projectionDebug,
    projectionScale,
    reliefClipPath,
    reliefPaths,
    spherePath,
    unprojectPoint,
  }
}
