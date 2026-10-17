// Usage: node scripts/import-marine-label-paths.mjs <marine-polygons.geojson>
// Source: Natural Earth v5.1.1 ne_10m_geography_marine_polys.geojson.
// Prepare small geographic guides offline; no polygons or coastline searches
// are added to the live label layout. Requires existing dev dependencies only.
import { readFileSync, writeFileSync } from 'node:fs'
import ts from 'typescript'
import { geoArea } from 'd3-geo'

if (process.argv.length !== 3) throw new Error('Expected the marine GeoJSON source path')
const source = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const labels = JSON.parse(readFileSync(new URL('../src/data/marine-labels.json', import.meta.url), 'utf8'))
const helper = ts.transpileModule(readFileSync(new URL('../src/logic/marineLabelLayout.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { sampleLabelGuide } = await import(`data:text/javascript;base64,${Buffer.from(helper).toString('base64')}`)
const authoredModule = ts.transpileModule(readFileSync(new URL('../src/data/marineLabelPaths.ts', import.meta.url), 'utf8')
  .replace("import generated from './marine-label-paths.json'", 'const generated = {}')
  .replace("import overrides from './marine-label-overrides.json'", 'const overrides = { placements: {}, removedIds: [] }'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { marineLabelPaths: authored } = await import(`data:text/javascript;base64,${Buffer.from(authoredModule).toString('base64')}`)

function polygons(geometry) {
  return geometry.type === 'Polygon' ? [geometry.coordinates]
    : geometry.type === 'MultiPolygon' ? geometry.coordinates : []
}

function containsRing(ring, x, y) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j]
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside
  }
  return inside
}

function preparePolygon(rings) {
  const xs = rings[0].map(([x]) => x), ys = rings[0].map(([, y]) => y)
  return { rings, bounds: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] }
}

function contains({ rings, bounds }, x, y) {
  return x >= bounds[0] && x <= bounds[2] && y >= bounds[1] && y <= bounds[3]
    && containsRing(rings[0], x, y) && !rings.slice(1).some((ring) => containsRing(ring, x, y))
}

// A small spatial index keeps the offline water checks bounded, including
// islands within marine polygons. Validate against both shipped detail levels.
const landCells = new Map()
for (const detail of ['50m', '10m']) {
  const land = JSON.parse(readFileSync(new URL(`../src/data/ne-map-units-${detail}.json`, import.meta.url), 'utf8'))
  for (const feature of land.features) for (const rings of polygons(feature.geometry)) {
    const polygon = preparePolygon(rings)
    const [left, top, right, bottom] = polygon.bounds
    for (let x = Math.floor(left / 5); x <= Math.floor(right / 5); x++) {
      for (let y = Math.floor(top / 5); y <= Math.floor(bottom / 5); y++) {
        const key = `${x}:${y}`
        const cell = landCells.get(key) ?? []
        cell.push(polygon)
        landCells.set(key, cell)
      }
    }
  }
}

function onLand(x, y) {
  x = ((x + 180) % 360 + 360) % 360 - 180
  return (landCells.get(`${Math.floor(x / 5)}:${Math.floor(y / 5)}`) ?? [])
    .some((polygon) => contains(polygon, x, y))
}

function marinePolygons(geometry, anchor) {
  // Unwrap marine coordinates around their existing anchor before finding
  // their axis, so a date-line sea does not appear almost a world wide.
  return polygons(geometry).map((rings) => preparePolygon(rings.map((ring) => ring.map(([x, y]) => {
    while (x - anchor[0] > 180) x -= 360
    while (x - anchor[0] < -180) x += 360
    return [x, y]
  }))))
}

function guideFor(geometry, anchor, resolution = 28) {
  const marine = marinePolygons(geometry, anchor)
  const water = (x, y) => marine.some((polygon) => contains(polygon, x, y)) && !onLand(x, y)
  const left = Math.min(...marine.map(({ bounds }) => bounds[0]))
  const top = Math.min(...marine.map(({ bounds }) => bounds[1]))
  const right = Math.max(...marine.map(({ bounds }) => bounds[2]))
  const bottom = Math.max(...marine.map(({ bounds }) => bounds[3]))
  const samples = []
  for (let x = 0; x < resolution; x++) for (let y = 0; y < resolution; y++) {
    const point = [left + (right - left) * (x + 0.5) / resolution, top + (bottom - top) * (y + 0.5) / resolution]
    if (water(...point)) samples.push(point)
  }
  if (samples.length < 8) return undefined
  const latitude = samples.reduce((sum, point) => sum + point[1], 0) / samples.length
  const longitude = samples.reduce((sum, point) => sum + point[0], 0) / samples.length
  const longitudeScale = Math.max(0.15, Math.cos(latitude * Math.PI / 180))
  const local = samples.map(([x, y]) => [(x - longitude) * longitudeScale, y - latitude])
  const xx = local.reduce((sum, [x]) => sum + x * x, 0)
  const yy = local.reduce((sum, [, y]) => sum + y * y, 0)
  const xy = local.reduce((sum, [x, y]) => sum + x * y, 0)
  const angle = 0.5 * Math.atan2(2 * xy, xx - yy)
  const cosine = Math.cos(angle), sine = Math.sin(angle)
  const axisPoints = local.map(([x, y]) => [x * cosine + y * sine, -x * sine + y * cosine])
  const us = axisPoints.map(([u]) => u).sort((a, b) => a - b)
  const vs = axisPoints.map(([, v]) => v)
  const vMin = Math.min(...vs), vMax = Math.max(...vs)
  const toGeo = (u, v) => [longitude + (u * cosine - v * sine) / longitudeScale, latitude + u * sine + v * cosine]
  function centerAt(u) {
    let best = [], run = []
    for (let step = 0; step <= 64; step++) {
      const v = vMin + (vMax - vMin) * step / 64
      if (water(...toGeo(u, v))) run.push(v)
      else {
        if (run.length > best.length) best = run
        run = []
      }
    }
    if (run.length > best.length) best = run
    return best.length > 2 ? (best[0] + best.at(-1)) / 2 : undefined
  }
  // Prefer the broad interior. For awkward shapes, shorten the guide until
  // its sampled curve is entirely water; the original anchor is the fallback.
  for (const inset of [0.15, 0.25, 0.35]) {
    const positions = [us[Math.floor(us.length * inset)], us[Math.floor(us.length / 2)], us[Math.floor(us.length * (1 - inset))]]
    const centers = positions.map(centerAt)
    if (centers.some((v) => v === undefined)) continue
    const mean = centers.reduce((sum, v) => sum + v, 0) / centers.length
    for (const bend of [1, 0.5, 0]) {
      const points = positions.map((u, i) => toGeo(u, mean + (centers[i] - mean) * bend))
      if (!sampleLabelGuide(points).every((point) => water(...point))) continue
      // Suppress insignificant bends rather than curving every name equally.
      const deviation = Math.abs(centers[1] - (centers[0] + centers[2]) / 2) * bend
      if (deviation < (positions[2] - positions[0]) * 0.025) {
        const straight = positions.map((u) => toGeo(u, mean))
        if (sampleLabelGuide(straight).every((point) => water(...point))) return straight
      }
      return points
    }
  }
  return undefined
}

function readableGuide(points, geometry, anchor) {
  const cosine = Math.max(0.15, Math.cos(anchor[1] * Math.PI / 180))
  const start = points[0], end = points.at(-1)
  const angle = Math.atan2(end[1] - start[1], (end[0] - start[0]) * cosine)
  if (Math.abs(angle) <= Math.PI / 3) return undefined
  const target = Math.sign(angle) * Math.PI * 0.29 // About 52°, where water allows.
  const rotation = target - angle
  const pivot = points[Math.floor(points.length / 2)]
  const marine = marinePolygons(geometry, anchor)
  for (const length of [1, 0.85, 0.7, 0.55, 0.4]) {
    const rotated = points.map(([x, y]) => {
      x = (x - pivot[0]) * cosine * length
      y = (y - pivot[1]) * length
      return [pivot[0] + (x * Math.cos(rotation) - y * Math.sin(rotation)) / cosine,
        pivot[1] + x * Math.sin(rotation) + y * Math.cos(rotation)]
    })
    if (sampleLabelGuide(rotated).every(([x, y]) => marine.some((polygon) => contains(polygon, x, y)) && !onLand(x, y))) return rotated
  }
  return undefined
}

function horizontalPlacement(geometry, anchor, points) {
  const marine = marinePolygons(geometry, anchor)
  const water = (x, y) => marine.some((polygon) => contains(polygon, x, y)) && !onLand(x, y)
  const left = Math.min(...marine.map(({ bounds }) => bounds[0]))
  const bottom = Math.min(...marine.map(({ bounds }) => bounds[1]))
  const right = Math.max(...marine.map(({ bounds }) => bounds[2]))
  const top = Math.max(...marine.map(({ bounds }) => bounds[3]))
  const count = 24
  const dx = (right - left) / count, dy = (top - bottom) / count
  // Find an interior rectangle, including islands and coastline margins.
  // This work happens once during data preparation, never while panning.
  const cells = Array.from({ length: count }, (_, row) => Array.from({ length: count }, (_, column) =>
    [0, 0.5, 1].every((u) => [0, 0.5, 1].every((v) => water(left + (column + u) * dx, bottom + (row + v) * dy))),
  ))
  const cosine = Math.max(0.15, Math.cos(anchor[1] * Math.PI / 180))
  const centers = cells.flatMap((row, y) => row.flatMap((inside, x) => inside
    ? [[(x + 0.5) * dx * cosine, (y + 0.5) * dy]] : []))
  if (centers.length < 4) return undefined
  const mean = [0, 1].map((axis) => centers.reduce((sum, point) => sum + point[axis], 0) / centers.length)
  let xx = 0, yy = 0, xy = 0
  for (const point of centers) {
    const x = point[0] - mean[0], y = point[1] - mean[1]
    xx += x * x; yy += y * y; xy += x * y
  }
  const spread = Math.hypot(xx - yy, 2 * xy)
  // An elongated water body has a meaningful direction even if a small
  // horizontal rectangle happens to fit inside its wider end.
  if (Math.sqrt((xx + yy + spread) / Math.max(1e-9, xx + yy - spread)) > 1.55) return undefined
  const guideLength = points ? sampleLabelGuide(points).reduce((sum, point, index, guide) => index
    ? sum + Math.hypot((point[0] - guide[index - 1][0]) * cosine, point[1] - guide[index - 1][1]) : sum, 0) : 0
  let best
  for (let first = 0; first < count; first++) {
    const columns = Array(count).fill(true)
    for (let last = first; last < count; last++) {
      for (let column = 0; column < count; column++) columns[column] &&= cells[last][column]
      let start = 0
      for (let end = 0; end <= count; end++) {
        if (end < count && columns[end]) continue
        const width = (end - start) * dx * cosine, height = (last - first + 1) * dy
        const ratio = width / height
        if (ratio >= 0.8 && ratio <= 4 && width >= guideLength * 0.45 && height >= guideLength * 0.22) {
          const score = width * height
          if (!best || score > best.score) best = { start, end, first, last, score }
        }
        start = end + 1
      }
    }
  }
  if (!best) return undefined
  const bounds = [[left + best.start * dx, bottom + best.first * dy],
    [left + best.end * dx, bottom + (best.last + 1) * dy]]
  const center = [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2]
  return { layout: 'horizontal', anchor: center, bounds }
}

const byId = new Map(source.features.map((feature) => [`ne:${feature.properties.ne_id}`, feature]))
const guides = {}
for (const label of labels) {
  const feature = byId.get(label.id)
  if (!feature) continue // Oceans keep their explicit cartographic placements.
  const points = authored[label.id]?.points ?? guideFor(feature.geometry, label.point)
    ?? guideFor(feature.geometry, label.point, 80)
  const horizontal = !authored[label.id] ? horizontalPlacement(feature.geometry, label.point, points) : undefined
  if (points || horizontal) {
    const round = (points) => points.map((point) => point.map((coordinate) => Number(coordinate.toFixed(6))))
    const guide = points ?? [horizontal.bounds[0], horizontal.anchor, horizontal.bounds[1]]
    const readable = !horizontal ? readableGuide(guide, feature.geometry, label.point) : undefined
    // Use geographic area, not Mercator's exaggerated polar footprint or
    // label length. Nearby waters of comparable size share a typography tier.
    const area = geoArea(feature) * 6371 ** 2
    const sizeScale = area < 100000 ? 0.4 : area < 300000 ? 0.55 : area < 500000 ? 0.65
      : area < 1000000 ? 0.8 : area < 2000000 ? 1 : area < 5000000 ? 1.2 : 1.4
    guides[label.id] = { points: round(guide), ...(readable ? { readablePoints: round(readable) } : {}),
      sizeScale,
      ...(horizontal ? { ...horizontal, anchor: round([horizontal.anchor])[0], bounds: round(horizontal.bounds) } : {}) }
  }
}
const output = new URL('../src/data/marine-label-paths.json', import.meta.url)
writeFileSync(output, JSON.stringify(guides) + '\n')
console.log(`Prepared ${Object.keys(guides).length} water-only guides; ${labels.filter((label) => byId.has(label.id) && !guides[label.id]).length} waters have no prepared placement and remain hidden.`)
console.log(`${Object.values(guides).filter((guide) => guide.layout === 'horizontal').length} broad waters use horizontal interior placements.`)
