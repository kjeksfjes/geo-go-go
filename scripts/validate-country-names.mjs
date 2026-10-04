import { readFile } from 'node:fs/promises'

const [names, atlas, overrides] = await Promise.all(
  ['country-names.json', 'ne-map-units-50m.json', 'ne-quiz-identity-by-map-unit.json']
    .map(async (file) => JSON.parse(await readFile(new URL(`../src/data/${file}`, import.meta.url), 'utf8'))),
)
const countryIds = new Set(atlas.features.map((unit) => overrides[unit.id] ?? unit.properties.entityId))
const errors = []

for (const id of countryIds) {
  for (const locale of ['en', 'nb']) {
    const name = names[id]?.[locale]
    if (typeof name !== 'string' || !name.trim() || name !== name.trim()) {
      errors.push(`${id} lacks a valid explicit ${locale} country name`)
    }
  }
}
for (const id of Object.keys(names)) {
  if (!countryIds.has(id)) errors.push(`Country name has no app identity: ${id}`)
}

if (errors.length) {
  console.error(errors.join('\n'))
  process.exitCode = 1
} else {
  console.log(`Validated English and Norwegian names for ${countryIds.size} country identities`)
}
