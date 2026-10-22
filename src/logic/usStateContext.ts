import { geoPath, type GeoProjection } from 'd3-geo'
import type { Feature, Geometry } from 'geojson'
import mapUnits from '../data/ne-map-units-50m.json'
import { usStateInsets, usStateProjectionParts } from './usStateProjection'
import type { CanvasMapScene } from '../types/mapCanvas'

type ContextFeature = Feature<Geometry, { continent: string }> & { id: string }
const units = mapUnits.features as unknown as ContextFeature[]
const mainland = units.filter(unit => unit.properties.continent === 'North America' && unit.id !== 'USA')
const alaska = units.filter(unit => unit.id === 'CAN' || unit.id === 'RUS')

function rectangle(left: number, top: number, right: number, bottom: number) {
  return `M${left},${top}H${right}V${bottom}H${left}Z`
}

// Share the constituent projections and inset bounds with the active state map.
// Fit and navigation still use only the 50 states. Context never enters them.
export function projectUsStateContext(projection: GeoProjection, width: number, height: number): CanvasMapScene['contextCountries'] {
  const k = projection.scale()
  const translate = projection.translate()
  const [alaskaInset, hawaiiInset] = usStateInsets(k, translate)
  const parts = usStateProjectionParts(k, translate)
  // Even-odd holes keep the independent Pacific inset panels clear.
  const mainlandClip = rectangle(-width, -height, width * 2, height * 2)
    + rectangle(...alaskaInset!.bounds[0], ...alaskaInset!.bounds[1])
    + rectangle(...hawaiiInset!.bounds[0], ...hawaiiInset!.bounds[1])
  const mainlandProjection = parts.mainland.clipExtent([[-width, -height], [width * 2, height * 2]])
  const alaskaProjection = parts.alaska
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
