import type { Geometry, MultiLineString, Position } from 'geojson'

const outlineCache = new WeakMap<Geometry, MultiLineString | null>()
// The 50m source places some cut vertices at 179.99995 rather than 180.
// Allow its coordinate rounding without treating ordinary coastlines as cuts.
const onDateLine = (point: Position) => Math.abs(Math.abs(point[0]!) - 180) < 1e-4

// Polygon fills must stay closed, but their artificial date-line closures
// must not become borders when neighboring world copies meet. Project open
// linework instead: d3 clips crossing lines without adding polygon closures.
export function dateLineOutline(geometry: Geometry): MultiLineString | undefined {
  if (outlineCache.has(geometry)) return outlineCache.get(geometry) ?? undefined
  const rings = geometry.type === 'Polygon' ? geometry.coordinates
    : geometry.type === 'MultiPolygon' ? geometry.coordinates.flat() : []
  const crossesDateLine = rings.some((ring) => ring.some((point, index) =>
    onDateLine(point) || (index > 0 && Math.abs(point[0]! - ring[index - 1]![0]!) > 180),
  ))
  if (!crossesDateLine) {
    outlineCache.set(geometry, null)
    return undefined
  }

  const coordinates: Position[][] = []
  for (const ring of rings) {
    let line: Position[] = []
    for (let index = 1; index < ring.length; index++) {
      const from = ring[index - 1]!
      const to = ring[index]!
      if (onDateLine(from) && onDateLine(to)) {
        if (line.length > 1) coordinates.push(line)
        line = []
      } else {
        if (!line.length) line.push(from)
        line.push(to)
      }
    }
    if (line.length > 1) coordinates.push(line)
  }
  const outline: MultiLineString = { type: 'MultiLineString', coordinates }
  outlineCache.set(geometry, outline)
  return outline
}
