// Retain curated leased areas as land, without adding country/quiz identities.
// Natural Earth's 10m country holes supply the exact shared boundary. Use that
// boundary at 50m too, where the source does not distinguish the lease.
import { readFileSync, writeFileSync } from 'node:fs'
import { geoContains } from 'd3-geo'

const data = new URL('../src/data/', import.meta.url)
const read = (name) => JSON.parse(readFileSync(new URL(name, data), 'utf8'))
const config = read('meaningful-map-units.json')
const detailed = read('ne-map-units-10m.json')
const geometries = {}
for (const area of config.leasedAreas) {
  const parent = detailed.features.find(({ id }) => id === area.mapUnitId)
  if (!parent) throw new Error(`Missing lease parent: ${area.mapUnitId}`)
  const polygons = parent.geometry.type === 'Polygon'
    ? [parent.geometry.coordinates] : parent.geometry.coordinates
  const matches = polygons.flatMap((polygon) => polygon.slice(1))
    .map((ring) => ({ type: 'Polygon', coordinates: [[...ring].reverse()] }))
    .filter((geometry) => geoContains(geometry, area.point))
  if (matches.length !== 1) throw new Error(`Expected one source lease boundary for ${area.id}`)
  geometries[area.id] = matches[0]
}
writeFileSync(new URL('leased-area-geometries.json', data), `${JSON.stringify(geometries)}\n`)
