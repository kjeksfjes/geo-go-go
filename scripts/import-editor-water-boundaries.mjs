// Usage: node scripts/import-editor-water-boundaries.mjs <marine-polygons.geojson>
// Preserve the pinned Natural Earth source geometry for editor guidance only.
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

if (process.argv.length !== 3) throw new Error('Expected the Natural Earth v5.1.1 marine GeoJSON path')
const bytes = readFileSync(process.argv[2])
const sha256 = createHash('sha256').update(bytes).digest('hex')
if (sha256 !== '53f865e8ffa966cdd402145c82c5cd14ee7ce974cd0eb9a3f59f03a4cfd2d66c') {
  throw new Error('Source differs from the pinned v5.1.1 marine GeoJSON; review upstream changes before importing')
}
const source = JSON.parse(bytes)
const labels = JSON.parse(readFileSync(new URL('../src/data/marine-labels.json', import.meta.url), 'utf8'))
const features = new Map(source.features.map(feature => [String(feature.properties.ne_id), feature]))
// These are source-data pieces, grouped under the app's five existing oceans.
const oceanParts = {
  'ocean:arctic': ['1159115017'],
  'ocean:southern': ['1159115037'],
  'ocean:atlantic': ['1159115057', '1159115149'],
  'ocean:pacific': ['1159115079', '1159115099'],
  'ocean:indian': ['1159115123'],
}

function validGeometry(geometry) {
  const polygons = geometry?.type === 'Polygon' ? [geometry.coordinates]
    : geometry?.type === 'MultiPolygon' ? geometry.coordinates : []
  return polygons.length > 0 && polygons.every(polygon => polygon.length > 0 && polygon.every(ring =>
    ring.length >= 4 && ring.every(point => Array.isArray(point) && point.length === 2
      && point.every(Number.isFinite) && Math.abs(point[0]) <= 180.001 && Math.abs(point[1]) <= 90)
      && ring[0].every((coordinate, axis) => coordinate === ring.at(-1)[axis]),
  ))
}

const boundaries = Object.fromEntries(labels.map(label => {
  const sourceIds = oceanParts[label.id] ?? [label.id.replace(/^ne:/, '')]
  const geometries = sourceIds.map(id => {
    const feature = features.get(id)
    if (!feature || !validGeometry(feature.geometry)) throw new Error(`Missing or invalid water geometry: ${label.id} / ${id}`)
    return feature.geometry
  })
  return [label.id, geometries.length === 1 ? geometries[0] : { type: 'GeometryCollection', geometries }]
}))

const output = {
  source: {
    url: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.1/geojson/ne_10m_geography_marine_polys.geojson',
    sha256,
    oceanParts,
  },
  boundaries,
}
writeFileSync(new URL('../src/dev/water-boundaries.json', import.meta.url), JSON.stringify(output) + '\n')
console.log(`Prepared unchanged source geometry for ${labels.length} editor water highlights.`)
