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
  display: flex;
  min-height: 112px;
  align-items: center;
  gap: 1.25rem;
  margin-bottom: 1rem;
  padding: 1rem 1.25rem;
  border: 1px solid rgba(82, 103, 110, 0.16);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.8);
  box-shadow: 0 8px 28px rgba(23, 45, 56, 0.06);
}

.quiz-panel__flag {
  flex: 0 0 auto;
  width: 1.333333em;
  border-radius: 4px;
  box-shadow: 0 8px 20px rgba(23, 45, 56, 0.25);
  font-size: clamp(3.2rem, 6vw, 4.5rem);
}

.quiz-panel__message {
  min-width: 0;
  flex: 1;
}

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
  min-height: 3.4rem;
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
  flex: 0 0 auto;
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
    flex-wrap: wrap;
    gap: 0.8rem;
    padding: 0.85rem;
  }

  .quiz-panel__button { margin-left: auto; }
}
</style>
