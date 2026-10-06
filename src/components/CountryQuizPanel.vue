<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, ref, watch } from 'vue'
import type { QuizPhase } from '../composables/useCountryQuiz'
import type { CountryInfo, GeographicComponentInfo } from '../types/country'
import { componentName, countryName, t } from '../i18n'

const CountryAnswerCombobox = defineAsyncComponent(() => import('./CountryAnswerCombobox.vue'))

const props = defineProps<{
  identify?: boolean
  viewingOutsideRegion?: boolean
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
  'update:automaticReveal': [visible: boolean]
  next: []
  restart: []
  'show-answer': []
  'show-guess': []
  'update:alwaysShowWrongAnswer': [value: boolean]
}>()

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
async function revealNamedAnswer() {
  emit('reveal-correct-answer')
  if (document.documentElement.dataset.inputModality !== 'keyboard') return
  await nextTick()
  automaticRevealButton.value?.focus()
}

const nextButton = ref<HTMLButtonElement | null>(null)
const alwaysShowButton = ref<HTMLButtonElement | null>(null)
const questionHeading = ref<HTMLHeadingElement | null>(null)
const isCorrect = computed(() => props.answer?.id === props.question?.id)
const revealedAnswer = ref(false)
const showWrongAnswer = computed(() => props.alwaysShowWrongAnswer || revealedAnswer.value)

async function revealAnswer() {
  revealedAnswer.value = true
  if (document.documentElement.dataset.inputModality !== 'keyboard') return
  await nextTick()
  alwaysShowButton.value?.focus()
}

function toggleAlwaysShow() {
  // Turning the preference off should hide future answers, not this one.
  revealedAnswer.value = true
  emit('update:alwaysShowWrongAnswer', !props.alwaysShowWrongAnswer)
}

watch(() => props.phase, async (phase) => {
  if (phase !== 'answered') revealedAnswer.value = false
  if (!['answered', 'skipped', 'complete'].includes(phase) || document.documentElement.dataset.inputModality !== 'keyboard') return
  await nextTick()
  if (phase === 'complete') restartButton.value?.focus()
  else nextButton.value?.focus()
})

watch(() => props.question?.id, async (countryId) => {
  revealedAnswer.value = false
  if (props.identify || !countryId || document.documentElement.dataset.inputModality !== 'keyboard') return
  await nextTick()
  questionHeading.value?.focus()
})
</script>

<template>
  <section class="quiz-panel map-overlay__content" :class="[`quiz-panel--${phase}`, { 'quiz-panel--identify': identify }]" :aria-label="t(identify ? 'nameCountry' : 'quiz')" @keydown.capture="handleSkipShortcut">
    <template v-if="phase === 'complete'">
      <div class="quiz-panel__message" aria-live="polite">
        <p class="quiz-panel__eyebrow">{{ t('regionComplete') }}</p>
        <h2>{{ t('finalScore', { score, total }) }}</h2>
      </div>
      <button ref="restartButton" class="quiz-panel__button" type="button" @click="emit('restart')">
        {{ t('playAgain') }}
      </button>
    </template>

    <template v-else-if="phase === 'empty'">
      <div class="quiz-panel__message">
        <p class="quiz-panel__eyebrow">{{ t(identify ? 'nameCountry' : 'findCountry') }}</p>
        <h2>{{ t('noCountries') }}</h2>
      </div>
    </template>

    <template v-else-if="question">
      <span
        v-if="!identify"
        class="quiz-panel__flag fi"
        :class="`fi-${question.flagCode}`"
        role="img"
        :aria-label="t('flag', { name: countryName(question.id) })"
      />
      <div class="quiz-panel__message">
        <p class="quiz-panel__eyebrow">
          {{ t('questionStatus', { number: questionNumber, total, score, points: t(score === 1 ? 'point' : 'points') }) }}
        </p>
        <h2 ref="questionHeading" tabindex="-1">{{ identify ? t('identifyQuestion') : t('find', { name: countryName(question.id) }) }}</h2>
      </div>
      <CountryAnswerCombobox
        v-if="identify && phase !== 'skipped'"
        :key="question.id"
        class="quiz-panel__input"
        :country-ids="countryIds ?? []"
        :answer-id="phase === 'answered' ? answer?.id ?? null : null"
        :correct="isCorrect"
        @answer="emit('answer', $event)"
      />
      <div class="quiz-panel__status" aria-live="polite">
        <p v-if="phase === 'question' && !identify" class="quiz-panel__hint">
          {{ t('clickLocation') }}
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
              <span>{{ t('correctAnswer') }} <strong class="quiz-panel__correct-name">{{ countryName(question.id) }}</strong></span>
              <button ref="automaticRevealButton" class="quiz-panel__text-button quiz-panel__text-button--preference" type="button" :aria-pressed="automaticReveal" :aria-label="t('alwaysRevealAnswers')" @click="emit('update:automaticReveal', !automaticReveal)">
                {{ t('showAutomatically') }}<span class="quiz-panel__preference-check" :class="{ 'quiz-panel__preference-check--hidden': !automaticReveal }" aria-hidden="true">✓</span>
              </button>
            </template>
            <button v-else class="quiz-panel__text-button" type="button" @click="revealNamedAnswer">{{ t('showAnswer') }}</button>
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
            <button v-else class="quiz-panel__text-button" type="button" @click="revealAnswer">
              {{ t('whatDidIClick') }}
            </button>
          </div>
        </template>
      </div>
      <p v-if="viewingOutsideRegion" class="quiz-panel__view-hint" aria-live="polite">{{ t('viewingOutsideGuess') }}</p>
      <div class="quiz-panel__actions">
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
  grid-template-columns: 4.5rem minmax(0, 1fr);
  align-items: start;
  gap: 0.45rem 1.1rem;
}

.quiz-panel__flag {
  grid-column: 1;
  grid-row: 1;
  align-self: center;
  width: 1.333333em;
  border-radius: 4px;
  box-shadow: 0 8px 20px rgba(23, 45, 56, 0.25);
  font-size: 3.4rem;
}

.quiz-panel__message {
  grid-column: 2;
  grid-row: 1;
  min-width: 0;
}

.quiz-panel__message:first-child { grid-column: 1 / -1; }

.quiz-panel__eyebrow {
  margin: 0 0 0.3rem;
  color: #687678;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.quiz-panel h2 {
  margin: 0;
  color: #172d38;
  font-size: clamp(1.15rem, 2.5vw, 1.65rem);
  line-height: 1.15;
}

.quiz-panel__status {
  grid-column: 2;
  grid-row: 2;
  display: flex;
  min-height: 3rem;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
}

.quiz-panel__hint,
.quiz-panel__feedback {
  margin: 0;
  color: #687678;
  font-size: 0.85rem;
}

.quiz-panel__feedback--correct { color: #28704a; }
.quiz-panel__feedback--wrong { color: #a13d2c; }

.quiz-panel__answer {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.4em;
  color: #52676e;
  font-size: 0.82rem;
  line-height: 1.2;
}

.quiz-panel__answer strong { font-weight: 800; }
.quiz-panel__correct-name { color: #28704a; }

.quiz-panel__text-button {
  border: 0;
  padding: 0;
  color: #172d38;
  background: none;
  font: inherit;
  font-weight: 750;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.quiz-panel__answer .quiz-panel__text-button { margin-left: 0; }
.quiz-panel__text-button:hover { color: #a13d2c; }
.quiz-panel__text-button--preference {
  white-space: nowrap;
  color: #687a80;
  font-size: 0.76rem;
  font-weight: 400;
  text-decoration-color: #a7b3b6;
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
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.1rem;
  padding-top: 0.7rem;
  border-top: 1px solid #d9e3e6;
}

.quiz-panel__button {
  padding: 0.65rem 0.95rem;
  border: 0;
  border-radius: 999px;
  color: #fff;
  background: #172d38;
  font-size: 0.82rem;
  font-weight: 750;
  cursor: pointer;
}

.quiz-panel__button:hover { background: #315060; }

.quiz-panel > .quiz-panel__button {
  grid-column: 1 / -1;
  justify-self: end;
}

.quiz-panel__button--secondary {
  color: #52676e;
  background: transparent;
}

.quiz-panel__button--secondary:hover {
  color: #172d38;
  background: #e6eef1;
}

.quiz-panel__button--reserved {
  visibility: hidden;
}

:global(html[data-input-modality='keyboard'] .quiz-panel__button:focus-visible),
:global(html[data-input-modality='keyboard'] .quiz-panel__text-button:focus-visible) {
  outline: 2px solid #172d38;
  outline-offset: 3px;
}

.quiz-panel--identify { grid-template-columns: minmax(0, 1fr); }
.quiz-panel--identify .quiz-panel__message,
.quiz-panel--identify .quiz-panel__status { grid-column: 1 / -1; }
.quiz-panel__input { grid-column: 1 / -1; grid-row: 2; }
.quiz-panel--identify .quiz-panel__status { grid-row: 3; min-height: 0; }
.quiz-panel__view-hint { grid-row: 4; grid-column: 1 / -1; margin: 0; color: #687678; font-size: 0.75rem; }
.quiz-panel--identify .quiz-panel__actions { grid-row: 5; flex-wrap: wrap; }
.quiz-panel__shortcut { margin-left: 0.35rem; font: inherit; font-weight: 400; opacity: 0.75; }

@media (hover: none), (pointer: coarse) {
  .quiz-panel__shortcut { display: none; }
}

@media (max-width: 560px) {
  .quiz-panel {
    grid-template-columns: 2.75rem minmax(0, 1fr);
    gap: 0.25rem 0.65rem;
  }

  .quiz-panel--identify { grid-template-columns: minmax(0, 1fr); }
  .quiz-panel--identify .quiz-panel__status { grid-row: 3; }
  .quiz-panel--identify .quiz-panel__actions { grid-row: 5; }

  .quiz-panel__flag {
    align-self: start;
    margin-top: 0.1rem;
    box-shadow: 0 2px 6px rgba(23, 45, 56, 0.16);
    font-size: 2rem;
  }

  .quiz-panel__eyebrow {
    margin-bottom: 0.1rem;
    font-size: 0.62rem;
    letter-spacing: 0.045em;
  }

  .quiz-panel h2 {
    font-size: 1.05rem;
  }

  .quiz-panel__status {
    grid-column: 1 / -1;
    grid-row: 2;
    min-height: 0;
    flex-flow: row wrap;
    align-items: baseline;
    gap: 0.15rem 0.45rem;
  }

  .quiz-panel__hint { display: none; }

  .quiz-panel__feedback,
  .quiz-panel__answer {
    font-size: 0.76rem;
  }

  .quiz-panel__actions {
    grid-row: 3;
    gap: 0.25rem;
    margin-top: 0.2rem;
    padding-top: 0.4rem;
  }

  .quiz-panel--question:not(.quiz-panel--identify) .quiz-panel__actions { display: none; }

  .quiz-panel__button {
    min-height: 2.75rem;
    padding: 0.45rem 0.75rem;
    font-size: 0.76rem;
  }

}
</style>
