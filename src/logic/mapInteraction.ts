import type { GeographicUnitFeature } from '../types/country'
import { isCountryLevelSelection } from '../data/mapSelection'

export interface MapInteractionState {
  selectedCountryId: string | null
  selectedGeographicUnitId: string | null
  hoveredEntityId: string | null
  quizMode: boolean
  quizComplete: boolean
  quizQuestionId: string | null
  quizAnswerId: string | null
}

export function isPrimarySelectedExploreUnit(unit: GeographicUnitFeature, state: MapInteractionState) {
  if (unit.properties.entityId !== state.selectedCountryId) return false
  return isCountryLevelSelection(state.selectedCountryId, state.selectedGeographicUnitId)
    || unit.id === state.selectedGeographicUnitId
}

export function geographicUnitClasses(unit: GeographicUnitFeature, state: MapInteractionState) {
  const entityId = unit.properties.entityId
  const clicked = unit.id === state.selectedGeographicUnitId

  if (!state.quizMode) {
    const selected = isPrimarySelectedExploreUnit(unit, state)
    return {
      'country--selected': selected,
      'country--related': entityId === state.selectedCountryId && !selected,
      'country--identity-hover': state.hoveredEntityId === entityId
        && entityId !== state.selectedCountryId,
    }
  }

  const answered = state.quizAnswerId !== null
  const correct = answered && entityId === state.quizQuestionId
  const wrong = answered && entityId === state.quizAnswerId && !correct
  const relatedAnswer = !clicked && state.selectedGeographicUnitId !== null

  return {
    'country--identity-hover': (state.quizComplete || (!answered && state.quizQuestionId !== null))
      && state.hoveredEntityId === entityId,
    'country--quiz-correct': correct && !(relatedAnswer && state.quizAnswerId === state.quizQuestionId),
    'country--quiz-correct-related': correct && relatedAnswer && state.quizAnswerId === state.quizQuestionId,
    'country--quiz-wrong': wrong && !relatedAnswer,
    'country--quiz-wrong-related': wrong && relatedAnswer,
    'country--quiz-inactive': answered && !correct && !wrong,
  }
}

export function hasVisualHighlight(unit: GeographicUnitFeature, state: MapInteractionState) {
  return Object.entries(geographicUnitClasses(unit, state))
    .some(([name, active]) => name !== 'country--quiz-inactive' && active)
}

export function canActivateGeographicUnit(state: MapInteractionState) {
  return !state.quizMode || (state.quizQuestionId !== null && state.quizAnswerId === null)
}

export type CountryClickAction = 'select' | 'clear' | 'ignore' | 'ignore-stop'

export function countryClickAction(
  countryId: string,
  geographicUnitId: string,
  clickCount: number,
  state: MapInteractionState,
): CountryClickAction {
  if (state.quizMode) {
    if (clickCount > 1) return 'ignore-stop'
    return canActivateGeographicUnit(state) ? 'select' : 'ignore'
  }
  return state.selectedCountryId === countryId
    && state.selectedGeographicUnitId === geographicUnitId
    ? 'clear'
    : 'select'
}

export function backgroundClickAction(clickCount: number, state: MapInteractionState) {
  if (!state.quizMode) return state.selectedCountryId === null ? 'ignore' : 'clear'
  return state.quizAnswerId !== null && clickCount <= 1 ? 'next' : 'ignore'
}
