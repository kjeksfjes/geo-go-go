import { geoArea, geoBounds, geoCentroid, type GeoPath } from 'd3-geo'
import type { GeographicUnitFeature } from '../types/country'
import type { MapBounds, MapPoint } from '../composables/useMapZoom'
import { sharedFocusUnitIds } from '../data/mapSelection'

// Keep the geographic default and the optional shared camera footprint in one
// place. Neither rule changes the rendered geometry or quiz identity.
export function projectedUnitFocus(
  generator: GeoPath<any, any>,
  displayUnit: GeographicUnitFeature,
  mapWidth: number,
) {
  const displayBounds = generator.bounds(displayUnit) as MapBounds
  let focusUnit = displayUnit
  let centerOnBounds = false

  // A unit can contain distant islands or cross the antimeridian. Favor its
  // largest landmass only when the full footprint would mislead click-to-zoom.
  if (displayUnit.geometry.type === 'MultiPolygon') {
    const largestLandmass = displayUnit.geometry.coordinates
      .map((coordinates) => ({
        ...displayUnit,
        geometry: { type: 'Polygon' as const, coordinates },
      }))
      .reduce((largest, candidate) =>
        geoArea(candidate) > geoArea(largest) ? candidate : largest,
      )

    const mainBounds = generator.bounds(largestLandmass) as MapBounds
    const fullWidth = Math.max(1, displayBounds[1][0] - displayBounds[0][0])
    const fullHeight = Math.max(1, displayBounds[1][1] - displayBounds[0][1])
    const mainWidth = Math.max(1, mainBounds[1][0] - mainBounds[0][0])
    const mainHeight = Math.max(1, mainBounds[1][1] - mainBounds[0][1])
    const mainlandAreaShare = geoArea(largestLandmass) / geoArea(displayUnit)
    const spansMostOfMap = fullWidth > mapWidth * 0.65
    const hasWideProjectedFootprint = Math.max(fullWidth / mainWidth, fullHeight / mainHeight) > 2
    const mainlandDominates = mainlandAreaShare > 0.75
    if (mainlandDominates && (spansMostOfMap || hasWideProjectedFootprint)) {
      const [[west, south], [east, north]] = geoBounds(displayUnit)
      const longitudeSpan = east >= west ? east - west : east + 360 - west
      // Keep nearby islands together; distant territory can use the mainland.
      const geographicallyBroad = longitudeSpan > 12 || north - south > 12
      if (spansMostOfMap || geographicallyBroad) {
        focusUnit = largestLandmass
      } else {
        centerOnBounds = true
      }
    }
  }

  const projection = generator.projection()
  const focusPoint = !centerOnBounds && typeof projection === 'function'
    ? projection(geoCentroid(focusUnit)) ?? undefined
    : undefined

  return {
    displayBounds,
    bounds: generator.bounds(focusUnit) as MapBounds,
    focusPoint: focusPoint as MapPoint | undefined,
  }
}

export function selectionFocusTarget(
  geographicUnitId: string,
  bounds: MapBounds,
  focusPoint: MapPoint | undefined,
  projectedPaths: readonly { unit: GeographicUnitFeature; displayBounds: MapBounds }[],
  visibleMapUnitIds: ReadonlySet<string>,
  horizontalOffset: number,
): { bounds: MapBounds; focusPoint: MapPoint | undefined } {
  const group = sharedFocusUnitIds(geographicUnitId)
  const sharedPaths = group && projectedPaths.filter(({ unit }) =>
    group.includes(unit.id) && unit.properties.mapUnitIds.some((id) => visibleMapUnitIds.has(id)),
  )
  if (sharedPaths && sharedPaths.length > 1) {
    const x0 = Math.min(...sharedPaths.map(({ displayBounds }) => displayBounds[0][0])) + horizontalOffset
    const y0 = Math.min(...sharedPaths.map(({ displayBounds }) => displayBounds[0][1]))
    const x1 = Math.max(...sharedPaths.map(({ displayBounds }) => displayBounds[1][0])) + horizontalOffset
    const y1 = Math.max(...sharedPaths.map(({ displayBounds }) => displayBounds[1][1]))
    return { bounds: [[x0, y0], [x1, y1]], focusPoint: undefined }
  }

  return {
    bounds: [
      [bounds[0][0] + horizontalOffset, bounds[0][1]],
      [bounds[1][0] + horizontalOffset, bounds[1][1]],
    ],
    focusPoint: focusPoint ? [focusPoint[0] + horizontalOffset, focusPoint[1]] : undefined,
  }
}
