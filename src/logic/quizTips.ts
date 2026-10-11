export type QuizTipAction = 'field-touch' | 'map-focus' | 'typed' | 'keyboard-play' | 'answer-pointer' | 'answer-keyboard' | 'answer-touch'
  | 'next-touch' | 'next-pointer' | 'next-keyboard' | 'map-next' | 'space-next' | 'advance'
  | 'skip-button' | 'skip-shortcut' | 'reveal-answer' | 'reveal-clicked'
  | 'automatic-reveal-answer' | 'automatic-reveal-clicked'

// An opportunity is an action in these lists, not every intervening question.
// Mode, input, and visible-control conditions are checked by useQuizTips.
export const quizTipRules = {
  'tap-type': { trigger: ['field-touch'], alternative: ['map-focus'], priority: 4 },
  'answer-keys': { trigger: ['answer-pointer'], alternative: ['answer-keyboard'], priority: 2 },
  'answer-go': { trigger: ['answer-touch'], alternative: ['answer-keyboard'], priority: 2 },
  continue: { trigger: ['next-touch', 'next-pointer'], alternative: ['next-keyboard', 'space-next', 'map-next'], priority: 3 },
  'skip-key': { trigger: ['skip-button'], alternative: ['skip-shortcut'], priority: 1 },
  'auto-reveal-answer': { trigger: ['reveal-answer'], alternative: ['automatic-reveal-answer'], priority: 0 },
  'auto-reveal-clicked': { trigger: ['reveal-clicked'], alternative: ['automatic-reveal-clicked'], priority: 0 },
} satisfies Record<string, { trigger: QuizTipAction[]; alternative: QuizTipAction[]; priority: number }>
export type QuizTipId = keyof typeof quizTipRules
export const quizTipIds = Object.keys(quizTipRules) as QuizTipId[]
export const TIP_TRIGGER_COUNT = 3
export const TIP_QUESTION_GAP = 3
export const TIP_COOLDOWN_MS = 20_000

export function createQuizTipTracker(saved: string | null) {
  const dismissed = new Set<QuizTipId>()
  const runs = new Map<QuizTipId, { count: number; question: string }>()
  const pending = new Map<QuizTipId, { sequence: number; opportunityAt: number }>()
  const shown = new Set<QuizTipId>()
  let disabled = false
  let sequence = 0
  let completedQuestions = 0
  let nextAllowedQuestion = 0
  let nextAllowedAt = 0
  const valid = (id: unknown): id is QuizTipId => quizTipIds.includes(id as QuizTipId)
  try {
    const state = JSON.parse(saved ?? 'null')
    if ([1, 2, 3].includes(state?.version)) {
      if (Array.isArray(state.dismissed)) {
        for (const storedId of state.dismissed) {
          const id = storedId === 'tap-next' || storedId === 'space-next' ? 'continue' : storedId
          if (valid(id)) dismissed.add(id)
        }
      }
      disabled = state.disabled === true
      // Earlier inferred learning is deliberately not permanent under this policy.
    }
  } catch { /* Ignore malformed saved tips; guidance still works in this session. */ }

  return {
    get enabled() { return !disabled },
    observe(id: QuizTipId, question: string, now: number) {
      if (disabled || dismissed.has(id) || shown.has(id)) return
      const run = runs.get(id)
      if (run?.question === question) return
      const count = (run?.count ?? 0) + 1
      runs.set(id, { count, question })
      const actionSequence = ++sequence
      if (count >= TIP_TRIGGER_COUNT) pending.set(id, { sequence: actionSequence, opportunityAt: now })
    },
    resetRun(id: QuizTipId) { runs.delete(id); pending.delete(id) },
    offer(id: QuizTipId, now: number) {
      const candidate = pending.get(id)
      if (candidate) candidate.opportunityAt = now
    },
    candidate(eligible: (id: QuizTipId) => boolean, now: number) {
      if (disabled || completedQuestions < nextAllowedQuestion || now < nextAllowedAt) return undefined
      return [...pending.entries()]
        .filter(([id, candidate]) => !shown.has(id) && !dismissed.has(id)
          && candidate.opportunityAt >= nextAllowedAt && eligible(id))
        .sort(([idA, a], [idB, b]) => b.sequence - a.sequence || quizTipRules[idA].priority - quizTipRules[idB].priority)[0]?.[0]
    },
    completeQuestion() { completedQuestions += 1 },
    dismiss(id: QuizTipId) { dismissed.add(id); runs.delete(id); pending.delete(id) },
    markShown(id: QuizTipId) { shown.add(id); pending.delete(id) },
    closeHint(now: number) {
      nextAllowedQuestion = completedQuestions + TIP_QUESTION_GAP
      nextAllowedAt = now + TIP_COOLDOWN_MS
    },
    startRound() { runs.clear(); pending.clear(); shown.clear() },
    setEnabled(enabled: boolean) { disabled = !enabled; runs.clear(); pending.clear() },
    reset() {
      dismissed.clear(); runs.clear(); pending.clear(); shown.clear(); disabled = false
      completedQuestions = nextAllowedQuestion = nextAllowedAt = 0
    },
    serialize() { return JSON.stringify({ version: 3, dismissed: [...dismissed], disabled }) },
  }
}
