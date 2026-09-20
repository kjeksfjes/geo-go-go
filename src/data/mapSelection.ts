import selectionBehavior from './selection-behavior.json'
import { geographicUnitById } from './countries'

// Quiz identity, clicked geographic unit, and camera footprint are separate.
// A country-click unit selects all of its quiz identity's parts. Other units
// select only the clicked component, while siblings retain a related style.
const countryClickUnitIds = new Set<string>(selectionBehavior.countryClickUnitIds)
const sharedFocusByUnitId = new Map<string, readonly string[]>()
const geographicUnitCountByEntityId = new Map<string, number>()

for (const unit of geographicUnitById.values()) {
  const id = unit.properties.entityId
  geographicUnitCountByEntityId.set(id, (geographicUnitCountByEntityId.get(id) ?? 0) + 1)
}

for (const id of countryClickUnitIds) {
  if (!geographicUnitById.has(id)) throw new Error(`Unknown country-click geographic unit: ${id}`)
}

for (const group of selectionBehavior.sharedFocusGroups) {
  const entityIds = new Set(group.map((id) => geographicUnitById.get(id)?.properties.entityId))
  if (group.length < 2 || entityIds.size !== 1 || entityIds.has(undefined)) {
    throw new Error(`Invalid shared focus group: ${group.join(', ')}`)
  }
  for (const id of group) {
    if (sharedFocusByUnitId.has(id)) throw new Error(`Overlapping shared focus group: ${id}`)
    sharedFocusByUnitId.set(id, group)
  }
}

export function isCountryLevelSelection(countryId: string | null, geographicUnitId: string | null) {
  if (!countryId || !geographicUnitId) return false
  const unit = geographicUnitById.get(geographicUnitId)
  if (unit?.properties.entityId !== countryId) return false
  return countryClickUnitIds.has(geographicUnitId)
    || geographicUnitCountByEntityId.get(countryId) === 1
}

export function sharedFocusUnitIds(geographicUnitId: string): readonly string[] | undefined {
  return sharedFocusByUnitId.get(geographicUnitId)
}
