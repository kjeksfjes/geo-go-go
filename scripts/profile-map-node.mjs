// Diagnostic only: no DOM, browser painting, worker scheduling or device emulation.
// Run: node scripts/profile-map-node.mjs > /tmp/map-node-profile.json
import { createRequire } from 'node:module'
import { readFileSync, readdirSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { performance } from 'node:perf_hooks'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const require = createRequire(new URL('../package.json', import.meta.url))
const ts = require('typescript')
// Transpile the actual application modules in memory, keeping the source untouched.
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
}).outputText, filename)
// Optionally replay only the focus algorithm from a committed revision while
// keeping the same current datasets and harness, without changing the worktree.
const focusReference = process.env.PROFILE_FOCUS_REF
const focusSource = focusReference
  ? execFileSync('git', ['show', `${focusReference}:src/logic/mapFocus.ts`], { encoding: 'utf8' })
  : readFileSync(new URL('../src/logic/mapFocus.ts', import.meta.url), 'utf8')
if (focusReference) {
  const compile = require.extensions['.ts']
  require.extensions['.ts'] = (module, filename) => {
    if (!filename.endsWith('/logic/mapFocus.ts')) return compile(module, filename)
    module._compile(ts.transpileModule(focusSource, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
    }).outputText, filename)
  }
}
const started = performance.now()
const countries = require('./src/data/countries.ts')
const moduleInitializationMs = performance.now() - started
const { effectScope, shallowRef } = require('vue')
const { regionById, mapUnitIdsByRegion } = require('./src/data/regions.ts')
const focus = require('./src/logic/mapFocus.ts')
const originalFocus = focus.projectedUnitFocus
let focusCalls = []
focus.projectedUnitFocus = (...args) => {
  const start = performance.now()
  const result = originalFocus(...args)
  focusCalls.push({ id: args[1].id, ms: performance.now() - start })
  return result
}
const { useMapProjection } = require('./src/composables/useMapProjection.ts')
const detailStart = performance.now()
const detailed = await countries.loadDetailedGeographicUnits()
const detailedLoadMs = performance.now() - detailStart
function measure(action) {
  focusCalls = []
  const start = performance.now()
  const paths = action()
  const durationMs = performance.now() - start
  return { durationMs, focusMs: focusCalls.reduce((sum, item) => sum + item.ms, 0),
    focusTop: [...focusCalls].sort((a, b) => b.ms - a.ms).slice(0, 5),
    ...(Array.isArray(paths) ? { pathsChecksum: createHash('sha256').update(JSON.stringify(paths.map(({ unit, path, outlinePath, divisionPath, displayBounds, bounds, focusPoint }) => ({ id: unit.id, path, outlinePath, divisionPath, displayBounds, bounds, focusPoint })))).digest('hex'), units: paths.length, pathCharacters: paths.reduce((sum, item) => sum + (item.path?.length ?? 0), 0) } : {}) }
}
const runs = []
for (let repeat = 0; repeat < 3; repeat++) {
  const scope = effectScope()
  const source = shallowRef(countries.geographicUnits)
  const region = shallowRef(regionById.get('world'))
  const visible = shallowRef(mapUnitIdsByRegion.get(region.value.id))
  const quiz = shallowRef(false)
  const projection = shallowRef('mercator')
  const map = scope.run(() => useMapProjection(source, shallowRef(1200), shallowRef(650), projection, region, visible, shallowRef([]), shallowRef([]), quiz))
  const low = measure(() => map.geographicPaths.value)
  source.value = detailed
  const high = measure(() => map.geographicPaths.value)
  quiz.value = true
  const quizCold = measure(() => map.geographicPaths.value)
  quiz.value = false
  const exploreCached = measure(() => map.geographicPaths.value)
  region.value = regionById.get('europe')
  visible.value = mapUnitIdsByRegion.get(region.value.id)
  const europe = measure(() => map.geographicPaths.value)
  region.value = regionById.get('world')
  visible.value = mapUnitIdsByRegion.get(region.value.id)
  projection.value = 'natural-earth'
  const naturalEarth = measure(() => map.geographicPaths.value)
  projection.value = 'miller'
  const miller = measure(() => map.geographicPaths.value)
  projection.value = 'winkel-tripel'
  const winkel = measure(() => map.geographicPaths.value)
  region.value = regionById.get('europe')
  visible.value = mapUnitIdsByRegion.get('europe')
  projection.value = 'regional-equal-area'
  const regional = measure(() => map.geographicPaths.value)
  runs.push({ repeat, low, high, quizCold, exploreCached, europe, naturalEarth, miller, winkel, regional })
  scope.stop()
}
// Isolate the suspected repeated-area work. Compare identical largest polygons;
// this prototype is diagnostic only and does not change application behavior.
const { geoArea } = require('d3-geo')
const largestChecks = []
for (const id of ['entity:CAN', 'remainder:RUS', 'entity:IDN']) {
  const unit = detailed.find(unit => unit.id === id)
  if (!unit || unit.geometry.type !== 'MultiPolygon') continue
  const polygons = unit.geometry.coordinates.map(coordinates => ({ ...unit, geometry: { type: 'Polygon', coordinates } }))
  const start = performance.now()
  const baseline = polygons.reduce((largest, candidate) => geoArea(candidate) > geoArea(largest) ? candidate : largest)
  const baselineMs = performance.now() - start
  const next = performance.now()
  let largest = polygons[0], largestArea = geoArea(largest)
  for (const candidate of polygons.slice(1)) {
    const area = geoArea(candidate)
    if (area > largestArea) { largest = candidate; largestArea = area }
  }
  largestChecks.push({ id, polygons: polygons.length, baselineMs, singlePassMs: performance.now() - next, identicalPolygon: baseline === largest })
}
const assets = readdirSync(new URL('../dist/assets/', import.meta.url)).filter(file => /\.js$|\.css$/.test(file)).map(file => {
  const bytes = readFileSync(new URL(`../dist/assets/${file}`, import.meta.url))
  return { file, bytes: bytes.length, gzipBytes: gzipSync(bytes).length }
}).sort((a, b) => b.bytes - a.bytes)
console.log(JSON.stringify({ commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), focusSourceSha256: createHash('sha256').update(focusSource).digest('hex'), focusReference: focusReference ?? 'working tree', node: process.version, viewport: [1200, 650], moduleInitializationMs, detailedLoadMs, runs, largestChecks, assets }, null, 2))
