import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { geoArea, geoContains, geoPath } from 'd3-geo'
import ts from 'typescript'

const root = new URL('../', import.meta.url)
const read = async file => JSON.parse(await readFile(new URL(file, root), 'utf8'))
const catalog = await read('src/data/us-state-catalog.json')
const geometry = await read('src/data/us-states.json')
const { createUsStateProjection, usStateInsets, usStateProjectionParts } = await importTypeScript('src/logic/usStateProjection.ts')
// Explicit state identities prevent DC, territories, or a missing state from
// silently becoming a different quiz pool when source data is regenerated.
const expected = 'AL:01 AK:02 AZ:04 AR:05 CA:06 CO:08 CT:09 DE:10 FL:12 GA:13 HI:15 ID:16 IL:17 IN:18 IA:19 KS:20 KY:21 LA:22 ME:23 MD:24 MA:25 MI:26 MN:27 MS:28 MO:29 MT:30 NE:31 NV:32 NH:33 NJ:34 NM:35 NY:36 NC:37 ND:38 OH:39 OK:40 OR:41 PA:42 RI:44 SC:45 SD:46 TN:47 TX:48 UT:49 VT:50 VA:51 WA:53 WV:54 WI:55 WY:56'.split(' ').sort()
assert.deepEqual(catalog.map(s => `${s.code}:${s.fips}`).sort(), expected)
assert.equal(new Set(catalog.map(s => s.id)).size, 50)
assert.deepEqual(geometry.features.map(f => f.id).sort(), catalog.map(s => s.id).sort())
for (const state of catalog) {
  assert.equal(state.id, `us:state:${state.code}`)
  assert.ok(state.name.en.trim() && state.name.nb.trim())
  const feature = geometry.features.find(f => f.id === state.id)
  assert.equal(feature.properties.fips, state.fips)
  const area = geoArea(feature)
  assert.ok(area > 0 && area < 0.05, `${state.code}: winding/area`)
  const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates
  for (const polygon of polygons) for (const ring of polygon) {
    assert.ok(ring.length >= 4)
    assert.deepEqual(ring[0], ring.at(-1))
    assert.ok(ring.every(point => point.length === 2 && point.every(Number.isFinite)))
  }
}
const fixtures = { AK: [-150, 65], HI: [-155.5, 19.6], TX: [-99, 31], CA: [-119, 36], RI: [-71.5, 41.7], DE: [-75.6, 39.1], MI: [-84.6, 44.5], FL: [-82, 28], NY: [-75, 43], WA: [-120.5, 47.5] }
for (const [code, point] of Object.entries(fixtures)) {
  assert.deepEqual(geometry.features.filter(f => geoContains(f, point)).map(f => f.id), [`us:state:${code}`], `${code}: geographic identity fixture`)
}
for (const point of [[-87, 44], [-88, 47.5], [-123, 52], [-102, 24], [-66.5, 18.2]]) {
  assert.equal(geometry.features.filter(f => geoContains(f, point)).length, 0, 'Lakes, foreign land and territories stay absent')
}
for (const [width, height] of [[390, 650], [1280, 720], [1440, 900]]) {
  const projection = createUsStateProjection().fitExtent([[16, 16], [width - 16, height - 45]], geometry)
  const path = geoPath(projection)
  for (const feature of geometry.features) {
    assert.ok(path(feature), `${feature.id}: empty inset path`)
    const [[x0, y0], [x1, y1]] = path.bounds(feature)
    assert.ok([x0, y0, x1, y1].every(Number.isFinite) && x1 > x0 && y1 > y0)
    assert.ok(x0 >= 15 && x1 <= width - 15 && y0 >= 15 && y1 <= height - 44)
  }
  // Including western Aleutians: dateline coordinates must not disappear.
  for (const point of [...Object.values(fixtures), [173, 52.9]]) {
    const projected = projection(point)
    assert.ok(projected, `Unprojectable fixture ${point}`)
    const inverse = projection.invert(projected)
    assert.ok(Math.abs(inverse[0] - point[0]) < 1e-6 && Math.abs(inverse[1] - point[1]) < 1e-6)
  }
  assert.ok(Math.abs(projection(fixtures.AK)[0] - projection(fixtures.HI)[0]) > width * 0.05)
}

const sources = await read('src/assets/state-flags/sources.json')
assert.deepEqual(sources.files.map(s => s.code).sort(), catalog.map(s => s.code).sort())
for (const source of sources.files) {
  assert.equal(source.file, `${source.code}.svg`)
  const svg = await readFile(new URL(`src/assets/state-flags/${source.file}`, root))
  assert.equal(createHash('sha256').update(svg).digest('hex'), source.sha256)
  assert.ok(['Public domain', 'Copyrighted free use'].includes(source.license))
  assert.ok(source.page.startsWith('https://commons.wikimedia.org/wiki/File:'))
  assert.ok(!/<(?:script|foreignObject|image)\b|\son\w+\s*=/i.test(svg.toString()))
  assert.ok(!/(?:href|url)\s*(?:=|\()\s*["']?https?:/i.test(svg.toString()))
}

// Exercise the actual shared round and suggestion logic with the new catalog.
async function typeScriptUrl(file) {
  let source = await readFile(new URL(file, root), 'utf8')
  if (file === 'src/logic/usStateContext.ts') {
    const units = await readFile(new URL('src/data/ne-map-units-50m.json', root), 'utf8')
    source = source.replace("import mapUnits from '../data/ne-map-units-50m.json'", `const mapUnits = ${units}`)
    source = source.replace("from './usStateProjection'", `from ${JSON.stringify(await typeScriptUrl('src/logic/usStateProjection.ts'))}`)
  }
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
    .replace(/from ['"]vue['"]/g, `from ${JSON.stringify(import.meta.resolve('vue'))}`)
    .replace(/from ['"]d3-geo['"]/g, `from ${JSON.stringify(import.meta.resolve('d3-geo'))}`)
  return `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
}
async function importTypeScript(file) { return import(await typeScriptUrl(file)) }
const { useQuizRound } = await importTypeScript('src/composables/useQuizRound.ts')
const ids = new Set(catalog.map(s => s.id))
const round = useQuizRound(new Map(catalog.map(s => [s.id, s])), ids)
round.start(ids)
const seen = new Set()
while (round.phase.value === 'question') {
  const id = round.currentId.value
  assert.ok(ids.has(id) && !seen.has(id))
  seen.add(id)
  round.answer('USA')
  assert.equal(round.phase.value, 'question', 'Country identities cannot answer state questions')
  round.answer(id)
  assert.equal(round.phase.value, 'answered')
  round.next()
}
assert.equal(seen.size, 50)
assert.equal(round.score.value, 50)
assert.equal(round.phase.value, 'complete')
round.start(ids)
round.skip()
assert.equal(round.phase.value, 'skipped')
assert.equal(round.score.value, 0)
const { filterCountrySuggestions } = await importTypeScript('src/logic/countrySuggestions.ts')
const suggestions = catalog.map(s => ({ id: s.id, name: s.name.nb, aliases: [s.name.en, s.code] }))
assert.equal(filterCountrySuggestions(suggestions, 'North Carolina', 'nb')[0].id, 'us:state:NC')
assert.equal(filterCountrySuggestions(suggestions, 'sor-dakota', 'nb')[0].id, 'us:state:SD')
assert.equal(filterCountrySuggestions(suggestions, 'CA', 'en')[0].id, 'us:state:CA')
console.log('Validated 50 state identities and names, geography/lake fixtures, three inset viewport sizes, projection inversion, 50 local flags, shared quiz progression, and bilingual answer aliases.')

// Context uses the same projection scale/translation but must leave the two
// synthetic inset oceans clear of mainland Mexico/Caribbean geography.
const { projectUsStateContext } = await importTypeScript('src/logic/usStateContext.ts')
for (const [width, height] of [[390, 650], [1280, 720]]) {
  const projection = createUsStateProjection().fitExtent([[16, 16], [width - 16, height - 45]], geometry)
  const before = projection(fixtures.CA)
  const context = projectUsStateContext(projection, width, height)
  assert.ok(context.some(layer => layer.clipPath) && context.some(layer => !layer.clipPath))
  assert.ok(context.every(layer => layer.path && layer.bounds.flat().every(Number.isFinite)))
  assert.deepEqual(projection(fixtures.CA), before, 'Context must not move or refit the state map')
  const mask = context.find(layer => layer.clipPath).clipPath
  const rectangles = [...mask.matchAll(/M([^,]+),([^H]+)H([^V]+)V([^H]+)H([^Z]+)Z/g)]
    .map(match => [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4])])
  assert.equal(rectangles.length, 3, 'Outer clip with Alaska/Hawaii holes')
  const inside = point => rectangles.filter(([left, top, right, bottom]) => point[0] > left && point[0] < right && point[1] > top && point[1] < bottom).length % 2 === 1
  assert.equal(inside(projection(fixtures.CA)), true, 'Mainland backdrop remains visible')
  assert.equal(inside(projection(fixtures.AK)), false, 'Mainland backdrop stays out of Alaska')
  assert.equal(inside(projection(fixtures.HI)), false, 'Mainland backdrop stays out of Hawaii')
}
console.log('Validated faded context bounds, unchanged state framing, and mainland exclusion from both inset oceans.')

// Detached Pacific panels must not cover mainland state land or Mexico, and
// their surrounding-land projectors must agree with the active state map.
const mapUnits = await read('src/data/ne-map-units-50m.json')
for (const [width, height] of [[390, 650], [1280, 720]]) {
  const projection = createUsStateProjection().fitExtent([[16, 16], [width - 16, height - 45]], geometry)
  const panels = usStateInsets(projection.scale(), projection.translate())
  assert.ok(panels[0].bounds[1][1] < panels[1].bounds[0][1], 'Pacific panels remain vertically separated')
  const parts = usStateProjectionParts(projection.scale(), projection.translate())
  for (const [code, part] of [['AK', parts.alaska], ['HI', parts.hawaii]]) {
    const point = fixtures[code]
    const expected = part(point)
    assert.deepEqual(projection(point), expected)
  }
  const mainlandGeometry = { ...geometry, features: geometry.features.filter(f => !['us:state:AK', 'us:state:HI'].includes(f.id)) }
  const mainlandBounds = geoPath(projection).bounds(mainlandGeometry)
  const mexicoBounds = geoPath(parts.mainland).bounds(mapUnits.features.find(f => f.id === 'MEX'))
  const overlap = (a, b) => a[0][0] < b[1][0] && a[1][0] > b[0][0] && a[0][1] < b[1][1] && a[1][1] > b[0][1]
  for (const panel of panels) {
    assert.equal(overlap(panel.bounds, mainlandBounds), false, 'Inset does not overlap mainland state bounds')
    assert.equal(overlap(panel.bounds, mexicoBounds), false, 'Inset does not overlap Mexico')
  }
}
console.log('Validated detached Pacific panels, context/state projection agreement, and mainland/Mexico separation.')
