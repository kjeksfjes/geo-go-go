import { readFile } from 'node:fs/promises'

const generated = JSON.parse(
  await readFile(new URL('../src/data/marine-labels.json', import.meta.url), 'utf8'),
)
const reviewFile = JSON.parse(
  await readFile(new URL('./marine-label-names.json', import.meta.url), 'utf8'),
)
const reviewed = reviewFile.labels
const errors = []
const generatedById = new Map()

for (const label of generated) {
  if (generatedById.has(label.id)) {
    errors.push(`Duplicate generated label id: ${label.id}`)
  }
  generatedById.set(label.id, label)
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

if (errors.length > 0) {
  console.error(errors.join('\n'))
  process.exitCode = 1
} else {
  console.log(`Validated ${generated.length} reviewed marine labels`)
}
