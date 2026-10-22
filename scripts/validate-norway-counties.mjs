import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { geoArea, geoBounds, geoContains } from 'd3-geo'

const expected = {
  '03': ['Oslo', [10.75, 59.91]], '11': ['Rogaland', [6.1, 59.0]],
  '15': ['Møre og Romsdal', [8.0, 62.7]], '18': ['Nordland', [15.4, 67.3]],
  '31': ['Østfold', [11.12, 59.30]], '32': ['Akershus', [11.05, 59.96]],
  '33': ['Buskerud', [10.25, 60.17]], '34': ['Innlandet', [11.56, 60.88]],
  '39': ['Vestfold', [10.25, 59.35]], '40': ['Telemark', [9.61, 59.21]],
  '42': ['Agder', [7.8, 58.6]], '46': ['Vestland', [6.42, 60.63]],
  '50': ['Trøndelag', [10.92, 63.46]], '55': ['Troms', [18.5, 69.05]],
  '56': ['Finnmark', [23.05, 69.01]],
}
for (const level of ['overview', 'detail']) {
  const data = JSON.parse(await readFile(new URL(`../src/data/norway-counties-${level}.json`, import.meta.url), 'utf8'))
  assert.equal(data.type, 'FeatureCollection')
  assert.equal(data.features.length, 15)
  assert.deepEqual(data.features.map(f => f.properties.code).sort(), Object.keys(expected).sort())
  for (const feature of data.features) {
    const { code, name } = feature.properties
    assert.equal(feature.id, `no:county:${code}`)
    assert.equal(name, expected[code][0])
    const area = geoArea(feature)
    assert.ok(area > 0 && area < 0.01, `${name}: invalid D3 spherical winding/area`)
    const [[west, south], [east, north]] = geoBounds(feature)
    assert.ok(west > 4 && east < 32 && south > 57 && north < 72, `${name}: unexpected map extent`)
    const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates
    for (const polygon of polygons) for (const ring of polygon) {
      assert.ok(ring.length >= 4)
      assert.deepEqual(ring[0], ring.at(-1))
      assert.ok(new Set(ring.slice(0, -1).map(p => p.join(','))).size >= 3)
      assert.ok(ring.every(p => p.length === 2 && p.every(Number.isFinite)))
    }
  }
  // Geographic fixtures catch swapped county identities and inverted rings,
  // which can render a county as the rest of the globe despite valid GeoJSON.
  for (const [code, [name, point]] of Object.entries(expected)) {
    const containing = data.features.filter(f => geoContains(f, point)).map(f => f.id)
    assert.deepEqual(containing, [`no:county:${code}`], `${level}: ${name} fixture`)
  }
}
console.log('Validated all 15 Norway counties, both detail levels, D3 winding, bounds, rings, and geographic identity fixtures.')
