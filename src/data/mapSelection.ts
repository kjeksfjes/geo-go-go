import selectionBehavior from './selection-behavior.json'
import { geographicUnitById } from './countries'
import type { GeographicUnitFeature } from '../types/country'

// Quiz identity, clicked geographic unit, camera footprint, and quiz highlight
// group are separate. In Explore, a country-click unit selects all parts;
// other units select only the clicked component.
const countryClickUnitIds = new Set<string>(selectionBehavior.countryClickUnitIds)
const sharedFocusByUnitId = new Map<string, readonly string[]>()
const geographicUnitCountByEntityId = new Map<string, number>()
const quizSeparateHighlightUnitIds = new Set<string>()

for (const unit of geographicUnitById.values()) {
  const id = unit.properties.entityId
  geographicUnitCountByEntityId.set(id, (geographicUnitCountByEntityId.get(id) ?? 0) + 1)
}

for (const id of countryClickUnitIds) {
  if (!geographicUnitById.has(id)) throw new Error(`Unknown country-click geographic unit: ${id}`)
}

for (const [entityId, ids] of Object.entries(selectionBehavior.quizSeparateHighlightUnitIdsByEntity)) {
  for (const id of ids) {
    if (geographicUnitById.get(id)?.properties.entityId !== entityId) {
      throw new Error(`Invalid quiz highlight geographic unit for ${entityId}: ${id}`)
    }
    quizSeparateHighlightUnitIds.add(id)
  }
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

// In a country quiz, nearby parts form one visual answer. A listed distant
// component is primary only when clicked; otherwise it stays related. When
// revealing a correct answer after a wrong guess, the main group is primary.
export function isPrimaryQuizHighlightUnit(
  unit: GeographicUnitFeature,
  clickedUnitId: string | null,
) {
  const clickedUnit = clickedUnitId ? geographicUnitById.get(clickedUnitId) : undefined
  if (
    clickedUnitId !== null
    && clickedUnit?.properties.entityId === unit.properties.entityId
    && quizSeparateHighlightUnitIds.has(clickedUnitId)
  ) {
    return unit.id === clickedUnitId
  }
  return !quizSeparateHighlightUnitIds.has(unit.id)
}
