import { computed, ref, shallowRef } from 'vue'
import { countryInfoById } from '../data/countries'
import { quizCountryIds } from '../data/quizCountries'

export type QuizPhase = 'question' | 'answered' | 'skipped' | 'complete' | 'empty'

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
  const skipped = ref(false)

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
    if (skipped.value) return 'skipped'
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
    skipped.value = false
  }

  function answer(countryId: string) {
    if (phase.value !== 'question') return
    answeredCountryId.value = countryId
    if (countryId === currentCountryId.value) score.value++
  }

  function skip() {
    if (phase.value !== 'question') return
    skipped.value = true
  }

  function next() {
    if (phase.value !== 'answered' && phase.value !== 'skipped') return
    answeredCountryId.value = null
    skipped.value = false
    questionIndex.value++
  }

  function reset() {
    questionIds.value = []
    questionIndex.value = 0
    answeredCountryId.value = null
    score.value = 0
    skipped.value = false
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
    reset,
    skip,
    start,
    total,
  }
}
