<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { QuizPhase } from '../composables/useCountryQuiz'
import type { CountryInfo } from '../types/country'
import { countryName, t } from '../i18n'

const props = defineProps<{
  phase: QuizPhase
  question: CountryInfo | null
  answer: CountryInfo | null
  score: number
  questionNumber: number
  total: number
}>()

const emit = defineEmits<{
  next: []
  restart: []
}>()

const nextButton = ref<HTMLButtonElement | null>(null)
const questionHeading = ref<HTMLHeadingElement | null>(null)
const isCorrect = computed(() => props.answer?.id === props.question?.id)

watch(() => props.phase, async (phase) => {
  if (phase !== 'answered' || document.documentElement.dataset.inputModality !== 'keyboard') return
  await nextTick()
  nextButton.value?.focus()
})

watch(() => props.question?.id, async (countryId) => {
  if (!countryId || document.documentElement.dataset.inputModality !== 'keyboard') return
  await nextTick()
  questionHeading.value?.focus()
})
</script>

<template>
  <section class="quiz-panel" :aria-label="t('quiz')">
    <template v-if="phase === 'complete'">
      <div class="quiz-panel__message" aria-live="polite">
        <p class="quiz-panel__eyebrow">{{ t('regionComplete') }}</p>
        <h2>{{ t('finalScore', { score, total }) }}</h2>
      </div>
      <button class="quiz-panel__button" type="button" @click="emit('restart')">
        {{ t('playAgain') }}
      </button>
    </template>

    <template v-else-if="phase === 'empty'">
      <div class="quiz-panel__message">
        <p class="quiz-panel__eyebrow">{{ t('findCountry') }}</p>
        <h2>{{ t('noCountries') }}</h2>
      </div>
    </template>

    <template v-else-if="question">
      <span
        class="quiz-panel__flag fi"
        :class="`fi-${question.flagCode}`"
        role="img"
        :aria-label="t('flag', { name: countryName(question.id) })"
      />
      <div class="quiz-panel__message">
        <p class="quiz-panel__eyebrow">
          {{ t('questionStatus', { number: questionNumber, total, score }) }}
        </p>
        <h2 ref="questionHeading" tabindex="-1">{{ t('find', { name: countryName(question.id) }) }}</h2>
        <div class="quiz-panel__status" aria-live="polite">
          <p v-if="phase === 'question'" class="quiz-panel__hint">
            {{ t('clickLocation') }}
          </p>
          <p
            v-else
            class="quiz-panel__feedback"
            :class="isCorrect ? 'quiz-panel__feedback--correct' : 'quiz-panel__feedback--wrong'"
          >
            <template v-if="isCorrect">{{ t('correct') }}</template>
            <template v-else>{{ t('wrong') }}</template>
          </p>
        </div>
      </div>
      <button
        ref="nextButton"
        class="quiz-panel__button"
        :class="{ 'quiz-panel__button--reserved': phase !== 'answered' }"
        type="button"
        :disabled="phase !== 'answered'"
        :aria-hidden="phase !== 'answered'"
        :tabindex="phase === 'answered' ? 0 : -1"
        @click="emit('next')"
      >
        {{ questionNumber === total ? t('seeResults') : t('nextCountry') }}
      </button>
    </template>
  </section>
</template>

<style scoped>
.quiz-panel {
  display: grid;
  grid-template-columns: 4.5rem minmax(0, 1fr);
  align-items: center;
  gap: 0.3rem 1.1rem;
  padding: 1rem 1.2rem;
}

.quiz-panel__flag {
  grid-column: 1;
  grid-row: 1;
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
  display: flex;
  min-height: 2.8rem;
  align-items: center;
}

.quiz-panel__hint,
.quiz-panel__feedback {
  margin: 0;
  color: #687678;
  font-size: 0.85rem;
}

.quiz-panel__feedback--correct { color: #28704a; }
.quiz-panel__feedback--wrong { color: #a13d2c; }

.quiz-panel__button {
  grid-column: 1 / -1;
  justify-self: end;
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

.quiz-panel__button--reserved {
  visibility: hidden;
}

:global(html[data-input-modality='keyboard'] .quiz-panel__button:focus-visible) {
  outline: 2px solid #172d38;
  outline-offset: 3px;
}

@media (max-width: 560px) {
  .quiz-panel {
    grid-template-columns: 3.7rem minmax(0, 1fr);
    gap: 0.3rem 0.85rem;
    padding: 0.85rem;
  }

  .quiz-panel__flag { font-size: 2.8rem; }
}
</style>
