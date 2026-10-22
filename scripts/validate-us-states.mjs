import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { geoAlbersUsa, geoArea, geoContains, geoPath } from 'd3-geo'
import ts from 'typescript'

const root = new URL('../', import.meta.url)
const read = async file => JSON.parse(await readFile(new URL(file, root), 'utf8'))
const catalog = await read('src/data/us-state-catalog.json')
const geometry = await read('src/data/us-states.json')
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
  const projection = geoAlbersUsa().fitExtent([[16, 16], [width - 16, height - 45]], geometry)
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
async function importTypeScript(file) {
  const source = await readFile(new URL(file, root), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
    .replace(/from ['"]vue['"]/g, `from ${JSON.stringify(import.meta.resolve('vue'))}`)
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
}
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
