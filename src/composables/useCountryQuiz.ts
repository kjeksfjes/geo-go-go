import { countryInfoById } from '../data/countries'
import { quizCountryIds } from '../data/quizCountries'
import { useQuizRound } from './useQuizRound'
export type { QuizPhase } from './useQuizRound'

export function useCountryQuiz() {
  const round = useQuizRound(countryInfoById, quizCountryIds)
  return {
    ...round,
    answeredCountry: round.answeredPlace,
    answeredCountryId: round.answeredId,
    currentCountry: round.currentPlace,
    currentCountryId: round.currentId,
  }
}
