import type { GeographicUnitFeature } from '../types/country'
import { isCountryLevelSelection, isPrimaryQuizHighlightUnit } from '../data/mapSelection'

export interface MapInteractionState {
  selectedCountryId: string | null
  selectedGeographicUnitId: string | null
  hoveredEntityId: string | null
  quizMode: boolean
  quizSkipped?: boolean
  nameCountryQuiz?: boolean
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
  if (!state.quizMode) {
    const selected = isPrimarySelectedExploreUnit(unit, state)
    return {
      'country--selected': selected,
      'country--related': entityId === state.selectedCountryId && !selected,
      'country--identity-hover': state.hoveredEntityId === entityId
        && entityId !== state.selectedCountryId,
    }
  }

  const answered = state.quizAnswerId !== null || !!state.quizSkipped
  const correct = answered && entityId === state.quizQuestionId
  const wrong = answered && entityId === state.quizAnswerId && !correct
  const primaryAnswer = isPrimaryQuizHighlightUnit(unit, state.selectedGeographicUnitId)

  return {
    'country--quiz-question': !!state.nameCountryQuiz && !answered && !state.quizComplete
      && entityId === state.quizQuestionId && primaryAnswer,
    'country--quiz-question-related': !!state.nameCountryQuiz && !answered && !state.quizComplete
      && entityId === state.quizQuestionId && !primaryAnswer,
    'country--identity-hover': !state.nameCountryQuiz && (state.quizComplete || state.quizQuestionId !== null)
      && state.hoveredEntityId === entityId,
    'country--quiz-correct': correct && primaryAnswer,
    'country--quiz-correct-related': correct && !primaryAnswer,
    'country--quiz-wrong': wrong && primaryAnswer,
    'country--quiz-wrong-related': wrong && !primaryAnswer,
    'country--quiz-inactive': answered && !correct && !wrong,
  }
}

export function hasVisualHighlight(unit: GeographicUnitFeature, state: MapInteractionState) {
  return Object.entries(geographicUnitClasses(unit, state))
    .some(([name, active]) => name !== 'country--quiz-inactive' && active)
}

export function canActivateGeographicUnit(state: MapInteractionState) {
  return !state.quizMode || (!state.nameCountryQuiz && !state.quizSkipped && state.quizQuestionId !== null && state.quizAnswerId === null)
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
  return (state.quizAnswerId !== null || state.quizSkipped) && clickCount <= 1 ? 'next' : 'ignore'
}
