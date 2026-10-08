<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, ref, watch } from 'vue'
import type { QuizPhase } from '../composables/useCountryQuiz'
import type { CountryInfo, GeographicComponentInfo } from '../types/country'
import { componentName, countryName, t } from '../i18n'

const CountryAnswerCombobox = defineAsyncComponent(() => import('./CountryAnswerCombobox.vue'))

const props = defineProps<{
  identify?: boolean
  viewingOutsideRegion?: boolean
  wrongAnswerRevealed: boolean
  correctAnswerVisible: boolean
  automaticReveal: boolean
  countryIds?: readonly string[]
  phase: QuizPhase
  question: CountryInfo | null
  answer: CountryInfo | null
  answerComponent: GeographicComponentInfo | null
  alwaysShowWrongAnswer: boolean
  score: number
  questionNumber: number
  total: number
}>()

const emit = defineEmits<{
  answer: [countryId: string]
  skip: []
  'reveal-correct-answer': []
  'reveal-wrong-answer': []
  'update:automaticReveal': [visible: boolean]
  next: []
  restart: []
  'show-answer': []
  'show-guess': []
  'update:alwaysShowWrongAnswer': [value: boolean]
}>()
const answerDraft = defineModel<string>('answerDraft', { required: true })
const answerInput = ref<{ focusInput: () => void } | null>(null)

function focusAnswer() {
  if (props.identify && props.phase === 'question') answerInput.value?.focusInput()
}

defineExpose({ focusAnswer })

const restartButton = ref<HTMLButtonElement | null>(null)
const skipKeyHint = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘↵' : 'Ctrl↵'

function handleSkipShortcut(event: KeyboardEvent) {
  if (!props.identify || props.phase !== 'question' || event.key !== 'Enter'
    || !(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.repeat || event.isComposing) return
  event.preventDefault()
  event.stopPropagation()
  document.documentElement.dataset.inputModality = 'keyboard'
  emit('skip')
}

const automaticRevealButton = ref<HTMLButtonElement | null>(null)
const namedAnswerRevealButton = ref<HTMLButtonElement | null>(null)
async function revealNamedAnswer() {
  emit('reveal-correct-answer')
  if (document.documentElement.dataset.inputModality !== 'keyboard') return
  await nextTick()
  automaticRevealButton.value?.focus()
}

async function toggleAutomaticReveal() {
  const enabled = !props.automaticReveal
  emit('update:automaticReveal', enabled)
  if (enabled || document.documentElement.dataset.inputModality !== 'keyboard') return
  await nextTick()
  namedAnswerRevealButton.value?.focus()
}

const nextButton = ref<HTMLButtonElement | null>(null)
const alwaysShowButton = ref<HTMLButtonElement | null>(null)
const clickedAnswerRevealButton = ref<HTMLButtonElement | null>(null)
const questionHeading = ref<HTMLHeadingElement | null>(null)
const isCorrect = computed(() => props.answer?.id === props.question?.id)
const showQuestionFlag = computed(() => !props.identify || (props.phase === 'answered' && isCorrect.value))
const showWrongAnswer = computed(() => props.alwaysShowWrongAnswer || props.wrongAnswerRevealed)

async function revealAnswer() {
  emit('reveal-wrong-answer')
  if (document.documentElement.dataset.inputModality !== 'keyboard') return
  await nextTick()
  alwaysShowButton.value?.focus()
}

async function toggleAlwaysShow() {
  const enabled = !props.alwaysShowWrongAnswer
  emit('update:alwaysShowWrongAnswer', enabled)
  if (enabled || document.documentElement.dataset.inputModality !== 'keyboard') return
  await nextTick()
  clickedAnswerRevealButton.value?.focus()
}

watch(() => props.phase, async (phase) => {
  if (!['answered', 'skipped', 'complete'].includes(phase) || document.documentElement.dataset.inputModality !== 'keyboard') return
  await nextTick()
  if (phase === 'complete') restartButton.value?.focus()
  else nextButton.value?.focus()
})

watch(() => props.question?.id, async (countryId) => {
  if (props.identify || !countryId || document.documentElement.dataset.inputModality !== 'keyboard') return
  await nextTick()
  questionHeading.value?.focus()
})
</script>

<template>
  <section class="quiz-panel map-overlay__content" :class="[`quiz-panel--${phase}`, { 'quiz-panel--identify': identify, 'quiz-panel--with-flag': showQuestionFlag }]" :aria-label="t(identify ? 'nameCountry' : 'quiz')" @keydown.capture="handleSkipShortcut">
    <template v-if="phase === 'complete'">
      <div class="quiz-panel__message" aria-live="polite">
        <p class="map-overlay__eyebrow">{{ t('regionComplete') }}</p>
        <h2 class="map-overlay__heading">{{ t('finalScore', { score, total }) }}</h2>
      </div>
      <button ref="restartButton" class="quiz-panel__button" type="button" @click="emit('restart')">
        {{ t('playAgain') }}
      </button>
    </template>

    <template v-else-if="phase === 'empty'">
      <div class="quiz-panel__message">
        <p class="map-overlay__eyebrow">{{ t(identify ? 'nameCountry' : 'findCountry') }}</p>
        <h2 class="map-overlay__heading">{{ t('noCountries') }}</h2>
      </div>
    </template>

    <template v-else-if="question">
      <span
        v-if="showQuestionFlag"
        class="quiz-panel__flag map-overlay__flag fi"
        :class="`fi-${question.flagCode}`"
        role="img"
        :aria-label="t('flag', { name: countryName(question.id) })"
      />
      <div class="quiz-panel__message">
        <p class="map-overlay__eyebrow">
          {{ t('questionStatus', { number: questionNumber, total, score, points: t(score === 1 ? 'point' : 'points') }) }}
        </p>
        <h2 class="map-overlay__heading" ref="questionHeading" tabindex="-1">{{ identify ? t('identifyQuestion') : t('find', { name: countryName(question.id) }) }}</h2>
      </div>
      <CountryAnswerCombobox
        ref="answerInput"
        v-if="identify && phase !== 'skipped'"
        :key="question.id"
        v-model:search="answerDraft"
        class="quiz-panel__input"
        :country-ids="countryIds ?? []"
        :answer-id="phase === 'answered' ? answer?.id ?? null : null"
        :correct="isCorrect"
        @answer="emit('answer', $event)"
      />
      <div class="quiz-panel__status" aria-live="polite">
        <p v-if="phase === 'question'" class="quiz-panel__hint">
          {{ t(identify ? 'countryAnswerHint' : 'clickLocation') }}
        </p>
        <p
          v-else-if="isCorrect"
          class="quiz-panel__feedback quiz-panel__feedback--correct"
        >
          {{ t('correct') }}
        </p>
        <template v-else-if="identify && (answer || phase === 'skipped')">
          <p class="quiz-panel__feedback" :class="{ 'quiz-panel__feedback--wrong': phase !== 'skipped' }">{{ t(phase === 'skipped' ? 'skippedQuestion' : 'notQuite') }}</p>
          <div class="quiz-panel__answer">
            <template v-if="correctAnswerVisible">
              <span class="quiz-panel__correct-answer">
                <span>{{ t('correctAnswer') }}</span>
                <span class="quiz-panel__correct-country">
                  <span class="quiz-panel__answer-flag fi" :class="`fi-${question.flagCode}`" aria-hidden="true" />
                  <strong class="quiz-panel__correct-name">{{ countryName(question.id) }}</strong>
                </span>
              </span>
              <button ref="automaticRevealButton" class="quiz-panel__text-button quiz-panel__text-button--preference" type="button" :aria-pressed="automaticReveal" :aria-label="t('alwaysRevealAnswers')" @click="toggleAutomaticReveal">
                {{ t('showAutomatically') }}<span class="quiz-panel__preference-check" :class="{ 'quiz-panel__preference-check--hidden': !automaticReveal }" aria-hidden="true">✓</span>
              </button>
            </template>
            <button v-else ref="namedAnswerRevealButton" class="quiz-panel__text-button" type="button" @click="revealNamedAnswer">{{ t('showAnswer') }}</button>
          </div>
        </template>
        <template v-else-if="answer">
          <p class="quiz-panel__feedback quiz-panel__feedback--wrong">{{ t('wrong') }}</p>
          <div class="quiz-panel__answer">
            <template v-if="showWrongAnswer">
              <span>{{ t('youClickedBefore') }}<strong>{{ countryName(answer.id) }}</strong><span v-if="answerComponent"> · {{ componentName(answerComponent) }}</span>{{ t('youClickedAfter') }}</span>
              <button
                ref="alwaysShowButton"
                class="quiz-panel__text-button quiz-panel__text-button--preference"
                type="button"
                :aria-pressed="alwaysShowWrongAnswer"
                @click="toggleAlwaysShow"
              >
                {{ t('showAutomatically') }}<span class="quiz-panel__preference-check" :class="{ 'quiz-panel__preference-check--hidden': !alwaysShowWrongAnswer }" aria-hidden="true">✓</span>
              </button>
            </template>
            <button v-else ref="clickedAnswerRevealButton" class="quiz-panel__text-button" type="button" @click="revealAnswer">
              {{ t('whatDidIClick') }}
            </button>
          </div>
        </template>
      </div>
      <p v-if="viewingOutsideRegion" class="quiz-panel__view-hint" aria-live="polite">{{ t('viewingOutsideGuess') }}</p>
      <div class="quiz-panel__actions">
        <button class="quiz-panel__text-button quiz-panel__restart" type="button" @click="emit('restart')">{{ t('restartQuiz') }}</button>
        <button v-if="identify && phase === 'question'" class="quiz-panel__button quiz-panel__button--secondary" type="button" aria-keyshortcuts="Control+Enter Meta+Enter" :aria-label="t('skipQuestion')" @click="emit('skip')">
          {{ t('skipQuestion') }} <kbd class="quiz-panel__shortcut" aria-hidden="true">{{ skipKeyHint }}</kbd>
        </button>
        <button
          v-if="identify && phase === 'answered' && !isCorrect && answer"
          class="quiz-panel__button quiz-panel__button--secondary"
          type="button"
          :aria-label="`${t('myGuess')} — ${t('showCountryOnMap', { name: countryName(answer.id) })}`"
          @click="emit('show-guess')"
        >
          {{ t('myGuess') }}
        </button>
        <button
          v-if="!identify && phase === 'answered' && !isCorrect"
          class="quiz-panel__button quiz-panel__button--secondary"
          type="button"
          :aria-label="t('showCountryOnMap', { name: countryName(question.id) })"
          @click="emit('show-answer')"
        >
          {{ t('showOnMap') }}
        </button>
        <button
          v-if="phase === 'answered' || phase === 'skipped' || !identify"
          ref="nextButton"
          class="quiz-panel__button"
          :class="{ 'quiz-panel__button--reserved': phase === 'question' }"
          type="button"
          :disabled="phase === 'question'"
          :aria-hidden="phase === 'question'"
          :tabindex="phase === 'question' ? -1 : 0"
          @click="emit('next')"
        >
          {{ questionNumber === total ? t('seeResults') : t('nextCountry') }}
        </button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.quiz-panel {
  display: grid;
  grid-template-columns: var(--ui-card-flag-width) minmax(0, 1fr);
  align-items: start;
  gap: var(--ui-card-row-gap) var(--ui-card-column-gap);
}

.quiz-panel__flag {
  grid-column: 1;
  grid-row: 1;
  align-self: start;
}

.quiz-panel__message {
  grid-column: 2;
  grid-row: 1;
  min-width: 0;
}

.quiz-panel__message:first-child { grid-column: 1 / -1; }


.quiz-panel__status {
  grid-column: 2;
  grid-row: 2;
  display: flex;
  min-height: 0;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
}

.quiz-panel__hint {
  margin: 0;
  color: var(--ui-muted);
  font-size: var(--ui-text-control);
  font-weight: var(--ui-weight);
  line-height: 1.4;
}

.quiz-panel__feedback {
  margin: 0;
  color: var(--ui-muted);
  font-size: var(--ui-text-body); font-weight: var(--ui-weight-large);
}

.quiz-panel__feedback--correct { color: var(--ui-success); }
.quiz-panel__feedback--wrong { color: var(--ui-error); }

.quiz-panel__answer {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.4em;
  color: var(--ui-text);
  font-size: var(--ui-text-body); font-weight: var(--ui-weight-large);
  line-height: 1.2;
}

.quiz-panel__answer strong { font-weight: var(--ui-weight-emphasis); }
.quiz-panel__correct-name { color: var(--ui-success); }
.quiz-panel__correct-answer { display: inline-flex; flex-wrap: wrap; align-items: baseline; gap: var(--ui-space-2); }
.quiz-panel__correct-country { display: inline-flex; align-items: center; gap: var(--ui-space-2); min-width: 0; }
.quiz-panel__answer-flag { flex: 0 0 auto; width: 1.333333rem; font-size: 1rem; border-radius: var(--ui-radius-flag); }

.quiz-panel__text-button {
  border: 0;
  padding: 0;
  color: var(--ui-ink);
  background: none;
  font: inherit;
  font-weight: var(--ui-weight);
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.quiz-panel__answer .quiz-panel__text-button { margin-left: 0; }
.quiz-panel__text-button:hover { color: var(--ui-ink); }
.quiz-panel__text-button--preference {
  white-space: nowrap;
  color: var(--ui-muted);
  font-weight: var(--ui-weight);
  text-decoration-color: var(--ui-border-strong);
}

.quiz-panel__preference-check {
  display: inline-block;
  width: 1em;
  margin-left: 0.3em;
}

.quiz-panel__preference-check--hidden { visibility: hidden; }

.quiz-panel__actions {
  grid-column: 1 / -1;
  grid-row: 3;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.1rem;
  padding-top: 0.7rem;
  border-top: 1px solid var(--ui-border);
}

.quiz-panel__restart { min-height: var(--ui-control-height); margin-right: auto; color: var(--ui-muted); font-size: var(--ui-text-small); font-weight: var(--ui-weight); }

.quiz-panel__button {
  min-height: var(--ui-control-height);
  padding: 0.55rem 0.85rem;
  border: 0;
  border-radius: var(--ui-radius-control);
  color: #fff;
  background: var(--ui-ink);
  font-size: var(--ui-text-body); font-weight: var(--ui-weight-large);
  cursor: pointer;
}

.quiz-panel__button:hover { background: var(--ui-focus); }

.quiz-panel > .quiz-panel__button {
  grid-column: 1 / -1;
  justify-self: end;
}

.quiz-panel__button--secondary {
  color: var(--ui-text);
  background: transparent;
}

.quiz-panel__button--secondary:hover {
  color: var(--ui-ink);
  background: var(--ui-hover);
}

.quiz-panel__button--reserved {
  visibility: hidden;
}

:global(html[data-input-modality='keyboard'] .quiz-panel__button:focus-visible),
:global(html[data-input-modality='keyboard'] .quiz-panel__text-button:focus-visible) {
  outline: 2px solid var(--ui-focus);
  outline-offset: 3px;
}

.quiz-panel--identify:not(.quiz-panel--with-flag) { grid-template-columns: minmax(0, 1fr); }
.quiz-panel--identify:not(.quiz-panel--with-flag) .quiz-panel__message,
.quiz-panel--identify .quiz-panel__status { grid-column: 1 / -1; }
.quiz-panel__input { grid-column: 1 / -1; grid-row: 2; }
.quiz-panel--identify .quiz-panel__status { grid-row: 3; min-height: 0; }
.quiz-panel__view-hint { grid-row: 4; grid-column: 1 / -1; margin: 0; color: var(--ui-muted); font-size: var(--ui-text-small); }
.quiz-panel--identify .quiz-panel__actions { grid-row: 5; flex-wrap: wrap; }
.quiz-panel__shortcut { margin-left: 0.35rem; font: inherit; font-weight: var(--ui-weight); opacity: 0.75; }

@media (hover: none), (pointer: coarse) {
  .quiz-panel__shortcut,
  .quiz-panel__hint { display: none; }
}

@media (max-width: 680px) {
  .quiz-panel__hint { display: none; }
}

@media (max-width: 560px) {
  .quiz-panel--identify:not(.quiz-panel--with-flag) { grid-template-columns: minmax(0, 1fr); }
  .quiz-panel--identify .quiz-panel__status { grid-row: 3; }
  .quiz-panel--identify .quiz-panel__actions { grid-row: 5; }

  .quiz-panel__status {
    grid-column: 1 / -1;
    grid-row: 2;
    min-height: 0;
    flex-flow: row wrap;
    align-items: baseline;
    gap: 0.15rem 0.45rem;
  }

  .quiz-panel__feedback,
  .quiz-panel__answer {
    font-size: var(--ui-text-control);
    font-weight: var(--ui-weight);
  }

  .quiz-panel__actions {
    grid-row: 3;
    gap: 0.25rem;
    margin-top: 0.2rem;
    padding-top: 0.4rem;
  }

  .quiz-panel--question:not(.quiz-panel--identify) .quiz-panel__button--reserved { display: none; }

  .quiz-panel__button {
    min-height: 2.75rem;
    padding: 0.45rem 0.75rem;
    font-size: var(--ui-text-control);
    font-weight: var(--ui-weight);
  }

}
</style>
