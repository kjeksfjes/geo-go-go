import { computed, ref, shallowRef } from 'vue'

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

export function useQuizRound<T extends { id: string }>(catalog: ReadonlyMap<string, T>, eligibleIds: ReadonlySet<string>) {
  const questionIds = shallowRef<string[]>([])
  const questionIndex = ref(0)
  const answeredId = ref<string | null>(null)
  const score = ref(0)
  const skipped = ref(false)

  const total = computed(() => questionIds.value.length)
  const currentId = computed(() => questionIds.value[questionIndex.value] ?? null)
  const currentPlace = computed(() => currentId.value
    ? catalog.get(currentId.value) ?? null
    : null)
  const answeredPlace = computed(() => answeredId.value
    ? catalog.get(answeredId.value) ?? null
    : null)
  const phase = computed<QuizPhase>(() => {
    if (total.value === 0) return 'empty'
    if (!currentId.value) return 'complete'
    if (skipped.value) return 'skipped'
    return answeredId.value ? 'answered' : 'question'
  })
  const questionNumber = computed(() => Math.min(questionIndex.value + 1, total.value))

  function start(visibleEntityIds: ReadonlySet<string>) {
    questionIds.value = shuffle(
      [...visibleEntityIds].filter((id) => eligibleIds.has(id) && catalog.has(id)),
    )
    questionIndex.value = 0
    answeredId.value = null
    score.value = 0
    skipped.value = false
  }

  function answer(placeId: string) {
    if (phase.value !== 'question' || !catalog.has(placeId) || !eligibleIds.has(placeId)) return
    answeredId.value = placeId
    if (placeId === currentId.value) score.value++
  }

  function skip() {
    if (phase.value !== 'question') return
    skipped.value = true
  }

  function next() {
    if (phase.value !== 'answered' && phase.value !== 'skipped') return
    answeredId.value = null
    skipped.value = false
    questionIndex.value++
  }

  function reset() {
    questionIds.value = []
    questionIndex.value = 0
    answeredId.value = null
    score.value = 0
    skipped.value = false
  }

  return {
    answeredPlace,
    answeredId,
    answer,
    currentPlace,
    currentId,
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
