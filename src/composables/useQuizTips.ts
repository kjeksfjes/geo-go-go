import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch, type Ref } from 'vue'
import { placeText } from '../logic/placeText'
import type { PlaceKind } from '../types/administrativeMap'
import { createQuizTipTracker, quizTipIds, quizTipRules, type QuizTipAction, type QuizTipId } from '../logic/quizTips'
import { locale, t } from '../i18n'
import { readStoredValue, writeStoredValue } from '../utils/storage'

interface TipContext {
  placeKind?: PlaceKind
  mode: string
  phase: string
  question: string
  busy: boolean
  input: 'touch' | 'mouse' | 'keyboard'
  automaticReveal: boolean
  answerRevealVisible: boolean
  revealOpportunity: boolean
  nextCountryVisible: boolean
}

const storageKey = 'geo-go-go.quiz.tips.v3'
const tipText = {
  'tap-type': 'tipTapType', 'answer-keys': 'tipAnswerKeys', 'answer-go': 'tipAnswerGo', 'skip-key': 'tipSkipKey',
  'auto-reveal-answer': 'tipAutoReveal', 'auto-reveal-clicked': 'tipAutoRevealClicked',
} as const

export function useQuizTips(context: Ref<TipContext>) {
  const tracker = createQuizTipTracker(readStoredValue(storageKey)
    ?? readStoredValue('geo-go-go.quiz.tips.v2') ?? readStoredValue('geo-go-go.quiz.tips.v1'))
  const enabled = ref(tracker.enabled)
  const editing = ref(false)
  const tip = shallowRef<{ id: QuizTipId; anchor: HTMLElement; input: TipContext['input'] } | null>(null)
  let timer: number | undefined
  let keyboardTyped = false
  let keyboardPlayed = false
  let pointerAnswer = false
  let touchAnswer = false
  let buttonSkip = false
  let manuallyRevealed = false
  let disposed = false

  const revealTip = (): QuizTipId => context.value.mode === 'name-country' ? 'auto-reveal-answer' : 'auto-reveal-clicked'
  function persist() { writeStoredValue(storageKey, tracker.serialize()) }
  function close() {
    if (tip.value) tracker.closeHint(performance.now())
    if (timer !== undefined) window.clearTimeout(timer)
    timer = undefined
    const popover = document.querySelector('.geo-quiz-tip')
    const restore = popover?.contains(document.activeElement)
    const anchor = document.querySelector<HTMLElement>('[data-quiz-tip="panel"]')
    tip.value = null
    if (restore && anchor?.isConnected) anchor.focus({ preventScroll: true })
  }

  function displayMatches(id: QuizTipId) {
    const state = context.value
    const feedback = ['answered', 'skipped'].includes(state.phase)
    switch (id) {
      case 'tap-type': return state.mode === 'name-country' && state.input === 'touch' && state.phase === 'question'
      case 'answer-keys': return state.mode === 'name-country' && state.input !== 'touch' && feedback && pointerAnswer && keyboardTyped
      case 'answer-go': return state.mode === 'name-country' && state.input === 'touch' && feedback && touchAnswer
      case 'continue': return feedback && state.nextCountryVisible
      case 'skip-key': return state.mode === 'name-country' && state.input !== 'touch' && state.phase === 'skipped' && buttonSkip
      case 'auto-reveal-answer': return state.mode === 'name-country' && !state.automaticReveal && state.answerRevealVisible && manuallyRevealed
      case 'auto-reveal-clicked': return state.mode === 'find-country' && !state.automaticReveal && state.answerRevealVisible && manuallyRevealed
    }
  }
  function eligible(id: QuizTipId) {
    return enabled.value && !context.value.busy && !editing.value && displayMatches(id)
  }
  const description = computed(() => {
    const current = tip.value
    if (!current) return ''
    const key = current.id === 'continue'
      ? current.input === 'keyboard' ? 'tipSpaceNext' : current.input === 'mouse' ? 'tipClickNext' : 'tipTapNext'
      : tipText[current.id]
    return placeText(context.value.placeKind ?? 'country', key, {
      shortcut: /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘Enter' : 'Ctrl+Enter',
      after: t(context.value.mode === 'find-country' ? 'tipAfterAnswer' : 'tipAfterAnswerOrSkip'),
    })
  })
  function show(id: QuizTipId) {
    if (disposed || !eligible(id)) return
    const anchor = document.querySelector<HTMLElement>('[data-quiz-tip="panel"] .map-overlay__heading')
    if (!anchor || !anchor.getClientRects().length) return
    tip.value = { id, anchor, input: id === 'continue' && keyboardPlayed ? 'keyboard' : context.value.input }
    tracker.markShown(id)
  }
  function dismiss() {
    if (tip.value) { tracker.dismiss(tip.value.id); persist() }
    close()
  }
  function schedule() {
    if (timer !== undefined) window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      timer = undefined
      if (tip.value) return
      updateEditing()
      const id = tracker.candidate(eligible, performance.now())
      if (id) show(id)
    }, 0) // Evaluate after Vue patches the controls, without requiring a pause.
  }

  function record(action: QuizTipAction) {
    const state = context.value
    if (action === 'typed' && state.input !== 'touch') keyboardTyped = keyboardPlayed = true
    if (action === 'keyboard-play' && state.input !== 'touch') keyboardPlayed = true
    if (action === 'answer-pointer') pointerAnswer = true
    if (action === 'answer-touch') touchAnswer = true
    if ((action === 'answer-keyboard' && state.input !== 'touch') || action === 'skip-shortcut') keyboardPlayed = true
    if (action === 'skip-button') buttonSkip = true
    if (action === 'reveal-answer' || action === 'reveal-clicked') manuallyRevealed = true
    if (action === 'advance' && state.revealOpportunity && !manuallyRevealed) tracker.resetRun(revealTip())

    for (const id of quizTipIds) {
      const rule = quizTipRules[id]
      // Desktop arrows and the software keyboard's Go key are independent
      // variants: using one must not reset the other variant's sequence.
      if (id === 'answer-keys' && state.input === 'touch') continue
      if (id === 'answer-go' && state.input !== 'touch') continue
      if ((rule.alternative as readonly QuizTipAction[]).includes(action)) tracker.resetRun(id)
      if (!(rule.trigger as readonly QuizTipAction[]).includes(action)) continue
      if (id === 'answer-keys' && !keyboardTyped) { tracker.resetRun(id); continue }
      if (id === 'skip-key' && state.input === 'touch') continue
      if ((id === 'auto-reveal-answer' || id === 'auto-reveal-clicked') && state.automaticReveal) continue
      tracker.observe(id, state.question, performance.now())
    }
    schedule()
  }
  function clearQuestionActions() {
    keyboardTyped = keyboardPlayed = pointerAnswer = touchAnswer = buttonSkip = manuallyRevealed = false
  }
  function startRound() { close(); tracker.startRound(); clearQuestionActions() }
  function setEnabled(value: boolean) {
    enabled.value = value
    tracker.setEnabled(value)
    persist()
    close()
  }
  function reset() { close(); tracker.reset(); clearQuestionActions(); enabled.value = true; persist() }
  function updateEditing() {
    editing.value = document.activeElement instanceof Element
      && !!document.activeElement.closest('input:not([readonly]), textarea, [contenteditable="true"], .country-suggestions, .vue3-treeselect__menu')
  }
  watch([context, editing, locale, enabled], () => {
    if (tip.value && (context.value.mode === 'explore' || ['complete', 'empty'].includes(context.value.phase))) close()
    schedule()
  })
  watch(() => context.value.question, () => { clearQuestionActions() }, { flush: 'sync' })
  // Only new quiz opportunities refresh pending tips. A timer expiring, focus
  // changing, or a menu closing never makes a stale candidate fresh again.
  watch([() => context.value.question, () => context.value.phase, () => context.value.answerRevealVisible] as const, ([, phase], previous) => {
    if (['answered', 'skipped'].includes(phase) && previous?.[1] === 'question') tracker.completeQuestion()
    for (const id of quizTipIds) if (displayMatches(id)) tracker.offer(id, performance.now())
  }, { flush: 'post' })
  watch([() => context.value.mode, () => context.value.automaticReveal] as const, ([mode]) => {
    if (mode === 'name-country' || mode === 'find-country') tracker.resetRun(revealTip())
  })
  onMounted(() => {
    document.addEventListener('focusin', updateEditing)
    document.addEventListener('focusout', updateEditing)
    updateEditing()
  })
  onBeforeUnmount(() => {
    disposed = true
    close()
    document.removeEventListener('focusin', updateEditing)
    document.removeEventListener('focusout', updateEditing)
  })
  return { enabled, tip, description, record, startRound, setEnabled, reset, close, dismiss }
}
