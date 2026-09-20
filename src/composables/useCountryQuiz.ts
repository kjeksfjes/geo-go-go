import { computed, ref, shallowRef } from 'vue'
import { countryInfoById } from '../data/countries'
import { quizCountryIds } from '../data/quizCountries'

export type QuizPhase = 'question' | 'answered' | 'complete' | 'empty'

function shuffle(ids: string[]): string[] {
  for (let index = ids.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const current = ids[index]
    ids[index] = ids[swapIndex]
    ids[swapIndex] = current
  }
  return ids
}

export function useCountryQuiz() {
  const questionIds = shallowRef<string[]>([])
  const questionIndex = ref(0)
  const answeredCountryId = ref<string | null>(null)
  const score = ref(0)

  const total = computed(() => questionIds.value.length)
  const currentCountryId = computed(() => questionIds.value[questionIndex.value] ?? null)
  const currentCountry = computed(() => currentCountryId.value
    ? countryInfoById.get(currentCountryId.value) ?? null
    : null)
  const answeredCountry = computed(() => answeredCountryId.value
    ? countryInfoById.get(answeredCountryId.value) ?? null
    : null)
  const phase = computed<QuizPhase>(() => {
    if (total.value === 0) return 'empty'
    if (!currentCountryId.value) return 'complete'
    return answeredCountryId.value ? 'answered' : 'question'
  })
  const questionNumber = computed(() => Math.min(questionIndex.value + 1, total.value))

  function start(visibleEntityIds: ReadonlySet<string>) {
    questionIds.value = shuffle(
      [...visibleEntityIds].filter((id) => quizCountryIds.has(id)),
    )
    questionIndex.value = 0
    answeredCountryId.value = null
    score.value = 0
  }

  function answer(countryId: string) {
    if (phase.value !== 'question') return
    answeredCountryId.value = countryId
    if (countryId === currentCountryId.value) score.value++
  }

  function next() {
    if (phase.value !== 'answered') return
    answeredCountryId.value = null
    questionIndex.value++
  }

  return {
    answeredCountry,
    answeredCountryId,
    answer,
    currentCountry,
    currentCountryId,
    next,
    phase,
    questionNumber,
    score,
    start,
    total,
  }
}
