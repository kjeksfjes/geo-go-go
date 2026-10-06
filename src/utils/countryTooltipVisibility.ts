export interface CountryTooltipState {
  quizMode: boolean
  quizSkipped?: boolean
  nameCountryQuiz?: boolean
  correctAnswerVisible?: boolean
  quizComplete: boolean
  quizQuestionId: string | null
  quizAnswerId: string | null
  alwaysShowWrongAnswer: boolean
}

// Keep the reveal rule independent of the current SVG <title> presentation.
export function canShowCountryTooltip(countryId: string, state: CountryTooltipState): boolean {
  if (!state.quizMode || state.quizComplete) return true
  if (state.quizAnswerId === null && !state.quizSkipped) return false
  if (state.nameCountryQuiz && state.correctAnswerVisible === false && countryId === state.quizQuestionId) return false
  return countryId === state.quizQuestionId
    || (state.alwaysShowWrongAnswer && countryId === state.quizAnswerId)
}
