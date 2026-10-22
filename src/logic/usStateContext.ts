import { geoAlbers, geoConicEqualArea, geoPath, type GeoProjection } from 'd3-geo'
import type { Feature, Geometry } from 'geojson'
import mapUnits from '../data/ne-map-units-50m.json'
import type { CanvasMapScene } from '../types/mapCanvas'

type ContextFeature = Feature<Geometry, { continent: string }> & { id: string }
const units = mapUnits.features as unknown as ContextFeature[]
const mainland = units.filter(unit => unit.properties.continent === 'North America' && unit.id !== 'USA')
const alaska = units.filter(unit => unit.id === 'CAN' || unit.id === 'RUS')

function rectangle(left: number, top: number, right: number, bottom: number) {
  return `M${left},${top}H${right}V${bottom}H${left}Z`
}

// Match the constituent projections of the installed d3-geo Albers USA layout.
// Fit and navigation still use only the 50 states. Context never enters them.
export function projectUsStateContext(projection: GeoProjection, width: number, height: number): CanvasMapScene['contextCountries'] {
  const k = projection.scale()
  const [x, y] = projection.translate()
  const alaskaBounds: [[number, number], [number, number]] = [[x - 0.425 * k, y + 0.120 * k], [x - 0.214 * k, y + 0.234 * k]]
  const hawaiiBounds: [[number, number], [number, number]] = [[x - 0.214 * k, y + 0.166 * k], [x - 0.115 * k, y + 0.234 * k]]
  // Even-odd holes reserve the inset oceans, rather than letting mainland
  // Mexico/Caribbean land appear behind Alaska or Hawaii at those pixels.
  const mainlandClip = rectangle(-width, -height, width * 2, height * 2)
    + rectangle(...alaskaBounds[0], ...alaskaBounds[1])
    + rectangle(...hawaiiBounds[0], ...hawaiiBounds[1])
  const mainlandProjection = geoAlbers().scale(k).translate([x, y])
    .clipExtent([[-width, -height], [width * 2, height * 2]])
  const alaskaProjection = geoConicEqualArea().rotate([154, 0]).center([-2, 58.5]).parallels([55, 65])
    .scale(k * 0.35).translate([x - 0.307 * k, y + 0.201 * k]).clipExtent(alaskaBounds)
  function project(features: ContextFeature[], projector: GeoProjection, clipPath?: string) {
    const path = geoPath(projector)
    return features.flatMap(feature => {
      const d = path(feature)
      const bounds = path.bounds(feature)
      return d && bounds.flat().every(Number.isFinite) ? [{ path: d, bounds, clipPath }] : []
    })
  }
  return [...project(mainland, mainlandProjection, mainlandClip), ...project(alaska, alaskaProjection)]
}
