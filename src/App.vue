<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import CountryCard from './components/CountryCard.vue'
import CountryQuizPanel from './components/CountryQuizPanel.vue'
import WorldMap from './components/WorldMap.vue'
import { useCountryQuiz } from './composables/useCountryQuiz'
import { countryInfoById, loadDetailedMapUnits, mapUnits } from './data/countries'
import {
  entityIdsByRegion,
  mapUnitIdsByRegion,
  regionById,
  regions,
  type MapRegionId,
} from './data/regions'
import { afterPaint, wait } from './utils/paint'
import { locale, setLocale, t } from './i18n'

const selectedCountryId = ref<string | null>(null)
const selectedMapUnitId = ref<string | null>(null)
const mode = ref<'explore' | 'find-country'>('explore')
const activeRegionId = ref<MapRegionId>('world')
const renderedMapUnits = shallowRef(mapUnits)
const highDetailEnabled = ref(false)
const detailLoading = ref(false)
const detailBlurred = ref(false)
const detailedMapUnits = shallowRef<typeof mapUnits | null>(null)
const activeRegion = computed(() => regionById.get(activeRegionId.value) ?? regions[0])
const visibleMapUnitIds = computed(() =>
  mapUnitIdsByRegion.get(activeRegionId.value) ?? mapUnitIdsByRegion.get('world')!,
)
const visibleEntityIds = computed(() =>
  entityIdsByRegion.get(activeRegionId.value) ?? entityIdsByRegion.get('world')!,
)
const selectedCountry = computed(() =>
  selectedCountryId.value
    ? countryInfoById.get(selectedCountryId.value) ?? null
    : null,
)
const {
  answeredCountry: quizAnswer,
  answeredCountryId: quizAnswerId,
  answer: answerQuiz,
  currentCountry: quizQuestion,
  currentCountryId: quizQuestionId,
  next: nextQuizQuestion,
  phase: quizPhase,
  questionNumber: quizQuestionNumber,
  score: quizScore,
  start: startQuiz,
  total: quizTotal,
} = useCountryQuiz()

function setMode(nextMode: 'explore' | 'find-country') {
  if (mode.value === nextMode) return
  mode.value = nextMode
  selectedCountryId.value = null
  selectedMapUnitId.value = null
  if (nextMode === 'find-country') startQuiz(visibleEntityIds.value)
}

function handleMapSelection(countryId: string | null, mapUnitId: string | null) {
  selectedMapUnitId.value = mapUnitId
  if (mode.value === 'find-country') {
    if (countryId) answerQuiz(countryId)
  } else {
    selectedCountryId.value = countryId
  }
}

function advanceQuizQuestion() {
  selectedMapUnitId.value = null
  nextQuizQuestion()
}

function restartQuiz() {
  selectedMapUnitId.value = null
  startQuiz(visibleEntityIds.value)
}

function handleQuizShortcut(event: KeyboardEvent) {
  if (
    event.code !== 'Space'
    || event.repeat
    || event.altKey
    || event.ctrlKey
    || event.metaKey
    || mode.value !== 'find-country'
    || quizPhase.value !== 'answered'
  ) return

  // Leave Space to the focused control (including the existing Next button).
  const target = event.target
  if (
    target instanceof Element
    && target.closest('button, input, select, textarea, [contenteditable], [role="combobox"], .vue3-treeselect__menu')
  ) return

  event.preventDefault()
  advanceQuizQuestion()
}

onMounted(() => document.addEventListener('keydown', handleQuizShortcut))
onBeforeUnmount(() => document.removeEventListener('keydown', handleQuizShortcut))

function setActiveRegion(regionId: MapRegionId) {
  activeRegionId.value = regionId

  if (mode.value === 'find-country') {
    selectedMapUnitId.value = null
    startQuiz(visibleEntityIds.value)
    return
  }

  if (
    selectedCountryId.value
    && (!visibleEntityIds.value.has(selectedCountryId.value)
      || !selectedMapUnitId.value
      || !visibleMapUnitIds.value.has(selectedMapUnitId.value))
  ) {
    selectedCountryId.value = null
    selectedMapUnitId.value = null
  }
}

async function setHighDetail(enabled: boolean, pathsCached: boolean) {
  if (detailLoading.value) return

  if (!enabled) {
    renderedMapUnits.value = mapUnits
    highDetailEnabled.value = false
    return
  }

  if (detailedMapUnits.value && pathsCached) {
    renderedMapUnits.value = detailedMapUnits.value
    highDetailEnabled.value = true
    return
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  highDetailEnabled.value = true
  detailLoading.value = true
  detailBlurred.value = true
  try {
    // Paint the blurred current map before loading or projecting detailed paths.
    await nextTick()
    await afterPaint()
    const minimumBlur = reducedMotion ? Promise.resolve() : wait(300)
    const [detailed] = await Promise.all([
      detailedMapUnits.value ?? loadDetailedMapUnits(),
      minimumBlur,
    ])
    detailedMapUnits.value = detailed
    renderedMapUnits.value = detailed
    // Let the detailed paths render while they are still blurred.
    await nextTick()
    await afterPaint()
  } catch (error) {
    renderedMapUnits.value = mapUnits
    highDetailEnabled.value = false
    console.error('Could not load the high-detail map.', error)
  } finally {
    detailBlurred.value = false
    if (!reducedMotion) {
      await nextTick()
      await afterPaint()
      await wait(280)
    }
    detailLoading.value = false
  }
}
</script>

<template>
  <main class="app-shell">
    <header class="app-header">
      <div class="language-selector" role="group" :aria-label="t('language')">
        <button type="button" :aria-pressed="locale === 'en'" lang="en" @click="setLocale('en')">EN</button>
        <button type="button" :aria-pressed="locale === 'nb'" lang="nb" @click="setLocale('nb')">NO</button>
      </div>
      <p class="eyebrow">{{ t('eyebrow') }}</p>
      <h1>{{ t('title') }}</h1>
      <p>{{ t('subtitle') }}</p>
    </header>

    <div class="mode-selector" role="group" :aria-label="t('gameMode')">
      <button
        type="button"
        :aria-pressed="mode === 'explore'"
        @click="setMode('explore')"
      >
        {{ t('explore') }}
      </button>
      <button
        type="button"
        :aria-pressed="mode === 'find-country'"
        @click="setMode('find-country')"
      >
        {{ t('findCountry') }}
      </button>
    </div>

    <CountryQuizPanel
      v-if="mode === 'find-country'"
      :phase="quizPhase"
      :question="quizQuestion"
      :answer="quizAnswer"
      :score="quizScore"
      :question-number="quizQuestionNumber"
      :total="quizTotal"
      @next="advanceQuizQuestion"
      @restart="restartQuiz"
    />

    <section class="map-card" :aria-label="t('worldMapGame')">
      <WorldMap
        :map-units="renderedMapUnits"
        :detailed-map-units="detailedMapUnits"
        :detail-loading="detailLoading"
        :detail-blurred="detailBlurred"
        :high-detail-enabled="highDetailEnabled"
        :active-region="activeRegion"
        :region-options="regions"
        :selected-country-id="selectedCountryId"
        :selected-map-unit-id="selectedMapUnitId"
        :quiz-mode="mode === 'find-country'"
        :quiz-complete="mode === 'find-country' && quizPhase === 'complete'"
        :quiz-question-id="quizQuestionId"
        :quiz-answer-id="quizAnswerId"
        :visible-map-unit-ids="visibleMapUnitIds"
        @detail-change="setHighDetail"
        @region-change="setActiveRegion"
        @select="handleMapSelection"
        @quiz-next="advanceQuizQuestion"
      />
    </section>

    <CountryCard v-if="mode === 'explore'" :country="selectedCountry" />
  </main>
</template>
