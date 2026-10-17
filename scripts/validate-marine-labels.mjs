import { readFile } from 'node:fs/promises'
import ts from 'typescript'

// Share the editor's placement/text validation without importing browser code.
const validationSource = await readFile(new URL('../src/dev/waterLabelDraft.ts', import.meta.url), 'utf8')
const validationModule = ts.transpileModule(validationSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { validPlacement, validLabelText } = await import(`data:text/javascript;base64,${Buffer.from(validationModule).toString('base64')}`)
const overrides = JSON.parse(await readFile(new URL('../src/data/marine-label-overrides.json', import.meta.url), 'utf8'))

const generated = JSON.parse(
  await readFile(new URL('../src/data/marine-labels.json', import.meta.url), 'utf8'),
)
const reviewFile = JSON.parse(
  await readFile(new URL('./marine-label-names.json', import.meta.url), 'utf8'),
)
const reviewed = reviewFile.labels
const guides = JSON.parse(
  await readFile(new URL('../src/data/marine-label-paths.json', import.meta.url), 'utf8'),
)
const errors = []
const generatedById = new Map()

for (const label of generated) {
  if (generatedById.has(label.id)) {
    errors.push(`Duplicate generated label id: ${label.id}`)
  }
  generatedById.set(label.id, label)
  if (label.kind !== 'ocean' && !guides[label.id]) {
    errors.push(`${label.id} (${label.name}) has no prepared water-label placement`)
  }
  if (typeof label.nameNb !== 'string' || label.nameNb.trim() === '') {
    errors.push(`${label.id} lacks an explicit Norwegian Bokmål display name`)
  }
}

for (const [id, review] of Object.entries(reviewed)) {
  const label = generatedById.get(id)
  if (!label) {
    errors.push(`Reviewed label is missing from generated data: ${id}`)
    continue
  }
  if (review.name !== label.name) {
    errors.push(`${id} English name differs from its review`)
  }
  if (review.nameNb !== label.nameNb) {
    errors.push(`${id} Norwegian name differs from its review`)
  }
  if (review.kind && review.kind !== label.kind) {
    errors.push(`${id} water-body kind differs from its review`)
  }
}

for (const id of generatedById.keys()) {
  if (!reviewed[id]) {
    errors.push(`Generated label has no review: ${id}`)
  }
}

for (const [id, guide] of Object.entries(guides)) {
  if (!generatedById.has(id)) errors.push(`Guide has no marine label: ${id}`)
  if (!Number.isFinite(guide.sizeScale) || guide.sizeScale <= 0) errors.push(`Invalid geographic size tier: ${id}`)
  for (const points of [guide.points, ...(guide.readablePoints ? [guide.readablePoints] : [])]) {
    if (!Array.isArray(points) || points.length < 3 || !points.every((point) =>
      Array.isArray(point) && point.length === 2 && point.every(Number.isFinite)
      && Math.abs(point[1]) <= 90,
    )) errors.push(`Invalid geographic guide: ${id}`)
  }
  if (guide.layout === 'horizontal') {
    const validPoint = (point) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite)
    if (!validPoint(guide.anchor) || !Array.isArray(guide.bounds) || guide.bounds.length !== 2
      || !guide.bounds.every(validPoint)
      || ![0, 1].every((axis) => guide.bounds[0][axis] < guide.anchor[axis]
        && guide.anchor[axis] < guide.bounds[1][axis])) errors.push(`Invalid horizontal water placement: ${id}`)
  }
}

const effectiveById = new Map(generatedById)
for (const label of overrides.addedLabels) {
  if (effectiveById.has(label.id)) errors.push(`Added label already exists: ${label.id}`)
  if (!validLabelText({ name: label.name, nameNb: label.nameNb })
    || !['ocean', 'sea', 'gulf', 'bay', 'strait', 'sound', 'channel', 'fjord', 'inlet'].includes(label.kind)
    || !Array.isArray(label.point) || label.point.length !== 2 || !label.point.every(Number.isFinite)
    || Math.abs(label.point[0]) > 180 || Math.abs(label.point[1]) > 90
    || !Number.isInteger(label.rank) || label.rank < 0 || label.rank > 9
    || !Number.isFinite(label.minLabel) || !Number.isFinite(label.maxLabel)
    || label.minLabel < 0 || label.maxLabel > 10 || label.minLabel > label.maxLabel) {
    errors.push(`Invalid added label: ${label.id}`)
  }
  if (!overrides.placements[label.id]) errors.push(`Added label lacks a placement: ${label.id}`)
  effectiveById.set(label.id, label)
}
for (const id of overrides.removedIds) {
  if (!generatedById.has(id)) errors.push(`Removed label does not exist in source data: ${id}`)
  effectiveById.delete(id)
}
for (const [id, placement] of Object.entries(overrides.placements)) {
  if (!effectiveById.has(id) || !validPlacement(placement)) errors.push(`Invalid maintained placement: ${id}`)
}
for (const [id, text] of Object.entries(overrides.labelText)) {
  if (!effectiveById.has(id) || !validLabelText(text)) errors.push(`Invalid maintained name text: ${id}`)
}

if (errors.length > 0) {
  console.error(errors.join('\n'))
  process.exitCode = 1
} else {
  console.log(`Validated ${generated.length} reviewed source marine labels, ${Object.keys(guides).length} prepared guides, and ${effectiveById.size} shipped labels with maintained overrides`)
}
