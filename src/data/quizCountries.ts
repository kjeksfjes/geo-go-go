import { countryInfoById, mapUnits } from './countries'
import type { MapUnitFeature } from '../types/country'

// Natural Earth's ADMIN/SOVEREIGNT relationship supplies the default state
// policy. These are game-policy exceptions, not geographic classifications.
const includeStateIds = new Set(['PSX']) // Palestine (Gaza and West Bank)
const excludeStateIds = new Set(['SOL']) // Somaliland is not a quiz state here.

const unitsByEntityId = new Map<string, MapUnitFeature[]>()
for (const unit of mapUnits) {
  const units = unitsByEntityId.get(unit.properties.entityId) ?? []
  units.push(unit)
  unitsByEntityId.set(unit.properties.entityId, units)
}

export const quizCountryIds = new Set(
  [...countryInfoById.values()]
    .filter(({ id, flagCode }) => {
      if (excludeStateIds.has(id) || flagCode === 'un') return false
      if (includeStateIds.has(id)) return true
      const units = unitsByEntityId.get(id) ?? []
      return units.some(({ properties }) =>
        properties.adminName === properties.sovereignName
        && properties.featureType !== 'Indeterminate',
      )
    })
    .map(({ id }) => id),
)
