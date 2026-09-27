<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import CountryCard from './components/CountryCard.vue'
import CountryQuizPanel from './components/CountryQuizPanel.vue'
import WorldMap from './components/WorldMap.vue'
import { useCountryQuiz } from './composables/useCountryQuiz'
import {
  countryInfoById,
  componentInfoById,
  geographicUnitById,
  geographicUnits,
  loadDetailedGeographicUnits,
} from './data/countries'
import {
  entityIdsByRegion,
  mapUnitIdsByRegion,
  quizEntityIdsByRegion,
  regionById,
  regions,
  type MapRegionId,
} from './data/regions'
import { afterPaint, wait } from './utils/paint'
import { locale, setLocale, t } from './i18n'
import { isCountryLevelSelection } from './data/mapSelection'

const selectedCountryId = ref<string | null>(null)
const selectedGeographicUnitId = ref<string | null>(null)
const worldMap = shallowRef<InstanceType<typeof WorldMap> | null>(null)
const mode = ref<'explore' | 'find-country'>('explore')
const activeRegionId = ref<MapRegionId>('world')
const renderedGeographicUnits = shallowRef(geographicUnits)
const highDetailEnabled = ref(false)
const detailLoading = ref(false)
const detailBlurred = ref(false)
const settingsOpen = ref(false)
const detailedGeographicUnits = shallowRef<typeof geographicUnits | null>(null)
const wrongAnswerPreferenceKey = 'geo-go-go.quiz.always-show-wrong-answer'
const alwaysShowWrongAnswer = ref(readWrongAnswerPreference())

function readWrongAnswerPreference() {
  try { return localStorage.getItem(wrongAnswerPreferenceKey) === 'true' } catch { return false }
}

function setAlwaysShowWrongAnswer(value: boolean) {
  alwaysShowWrongAnswer.value = value
  try { localStorage.setItem(wrongAnswerPreferenceKey, String(value)) } catch { /* The setting still works for this session. */ }
}

const activeRegion = computed(() => regionById.get(activeRegionId.value) ?? regions[0])
const visibleMapUnitIds = computed(() =>
  mapUnitIdsByRegion.get(activeRegionId.value) ?? mapUnitIdsByRegion.get('world')!,
)
const visibleEntityIds = computed(() =>
  entityIdsByRegion.get(activeRegionId.value) ?? entityIdsByRegion.get('world')!,
)
const quizRegionEntityIds = computed(() =>
  quizEntityIdsByRegion.get(activeRegionId.value) ?? quizEntityIdsByRegion.get('world')!,
)
const selectedCountry = computed(() =>
  selectedCountryId.value
    ? countryInfoById.get(selectedCountryId.value) ?? null
    : null,
)
const selectedComponent = computed(() => {
  if (isCountryLevelSelection(selectedCountryId.value, selectedGeographicUnitId.value)) return null
  const id = selectedGeographicUnitId.value
    ? geographicUnitById.get(selectedGeographicUnitId.value)?.properties.componentId
    : undefined
  return id ? componentInfoById.get(id) ?? null : null
})
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
const quizAnswerComponent = computed(() => {
  if (quizPhase.value !== 'answered' || isCountryLevelSelection(quizAnswerId.value, selectedGeographicUnitId.value)) return null
  const unit = selectedGeographicUnitId.value
    ? geographicUnitById.get(selectedGeographicUnitId.value)
    : undefined
  if (unit?.properties.entityId !== quizAnswerId.value) return null
  const id = unit.properties.componentId
  return id ? componentInfoById.get(id) ?? null : null
})

function setMode(nextMode: 'explore' | 'find-country') {
  if (mode.value === nextMode) return
  mode.value = nextMode
  selectedCountryId.value = null
  selectedGeographicUnitId.value = null
  if (nextMode === 'find-country') startQuiz(quizRegionEntityIds.value)
}

function handleMapSelection(countryId: string | null, geographicUnitId: string | null) {
  selectedGeographicUnitId.value = geographicUnitId
  if (mode.value === 'find-country') {
    if (countryId) answerQuiz(countryId)
  } else {
    selectedCountryId.value = countryId
  }
}

function advanceQuizQuestion() {
  selectedGeographicUnitId.value = null
  nextQuizQuestion()
}

function showQuizAnswerOnMap() {
  if (
    quizPhase.value !== 'answered'
    || !quizQuestionId.value
    || quizAnswerId.value === quizQuestionId.value
  ) return
  worldMap.value?.focusCountry(quizQuestionId.value)
}

function restartQuiz() {
  selectedGeographicUnitId.value = null
  startQuiz(quizRegionEntityIds.value)
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

function handleSettingsPointerDown(event: PointerEvent) {
  if (!(event.target instanceof Element)) return
  if (!event.target.closest('.settings-button, .map-settings-panel')) settingsOpen.value = false
}

function handleEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') settingsOpen.value = false
}

onMounted(() => {
  document.addEventListener('keydown', handleQuizShortcut)
  document.addEventListener('keydown', handleEscape)
  document.addEventListener('pointerdown', handleSettingsPointerDown)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleQuizShortcut)
  document.removeEventListener('keydown', handleEscape)
  document.removeEventListener('pointerdown', handleSettingsPointerDown)
})

function setActiveRegion(regionId: MapRegionId) {
  activeRegionId.value = regionId

  if (mode.value === 'find-country') {
    selectedGeographicUnitId.value = null
    startQuiz(quizRegionEntityIds.value)
    return
  }

  if (
    selectedCountryId.value
    && (!visibleEntityIds.value.has(selectedCountryId.value)
      || !selectedGeographicUnitId.value
      || !geographicUnitById.get(selectedGeographicUnitId.value)?.properties.mapUnitIds
        .some((id) => visibleMapUnitIds.value.has(id)))
  ) {
    selectedCountryId.value = null
    selectedGeographicUnitId.value = null
  }
}

async function setHighDetail(enabled: boolean, pathsCached: boolean) {
  if (detailLoading.value) return

  if (!enabled) {
    renderedGeographicUnits.value = geographicUnits
    highDetailEnabled.value = false
    return
  }

  if (detailedGeographicUnits.value && pathsCached) {
    renderedGeographicUnits.value = detailedGeographicUnits.value
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
      detailedGeographicUnits.value ?? loadDetailedGeographicUnits(),
      minimumBlur,
    ])
    detailedGeographicUnits.value = detailed
    renderedGeographicUnits.value = detailed
    // Let the detailed paths render while they are still blurred.
    await nextTick()
    await afterPaint()
  } catch (error) {
    renderedGeographicUnits.value = geographicUnits
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
      <div class="app-brand">
        <h1>{{ t('title') }}</h1>
        <p class="eyebrow">{{ t('eyebrow') }}</p>
        <p class="visually-hidden">{{ t('subtitle') }}</p>
      </div>
      <div class="mode-selector" role="group" :aria-label="t('gameMode')">
        <button type="button" :aria-pressed="mode === 'explore'" @click="setMode('explore')">
          {{ t('explore') }}
        </button>
        <button type="button" :aria-pressed="mode === 'find-country'" @click="setMode('find-country')">
          {{ t('findCountry') }}
        </button>
      </div>
      <div class="header-actions">
        <div class="language-selector" role="group" :aria-label="t('language')">
          <button type="button" :aria-pressed="locale === 'en'" lang="en" @click="setLocale('en')">EN</button>
          <button type="button" :aria-pressed="locale === 'nb'" lang="nb" @click="setLocale('nb')">NO</button>
        </div>
        <button
          class="settings-button"
          type="button"
          :aria-label="t('mapSettings')"
          :aria-expanded="settingsOpen"
          aria-controls="map-settings-panel"
          @click="settingsOpen = !settingsOpen"
        ><span aria-hidden="true">⚙</span></button>
      </div>
    </header>

    <section class="map-card" :aria-label="t('worldMapGame')">
      <WorldMap
        ref="worldMap"
        :geographic-units="renderedGeographicUnits"
        :detailed-geographic-units="detailedGeographicUnits"
        :detail-loading="detailLoading"
        :detail-blurred="detailBlurred"
        :high-detail-enabled="highDetailEnabled"
        :settings-open="settingsOpen"
        :active-region="activeRegion"
        :region-options="regions"
        :selected-country-id="selectedCountryId"
        :selected-geographic-unit-id="selectedGeographicUnitId"
        :quiz-mode="mode === 'find-country'"
        :quiz-complete="mode === 'find-country' && quizPhase === 'complete'"
        :quiz-question-id="quizQuestionId"
        :quiz-answer-id="quizAnswerId"
        :always-show-wrong-answer="alwaysShowWrongAnswer"
        :visible-map-unit-ids="visibleMapUnitIds"
        @detail-change="setHighDetail"
        @region-change="setActiveRegion"
        @select="handleMapSelection"
        @quiz-next="advanceQuizQuestion"
      />
      <div v-if="mode === 'find-country'" class="map-overlay" :inert="detailLoading">
        <div class="map-overlay__card">
          <CountryQuizPanel
            :phase="quizPhase"
            :question="quizQuestion"
            :answer="quizAnswer"
            :answer-component="quizAnswerComponent"
            :always-show-wrong-answer="alwaysShowWrongAnswer"
            :score="quizScore"
            :question-number="quizQuestionNumber"
            :total="quizTotal"
            @next="advanceQuizQuestion"
            @restart="restartQuiz"
            @show-answer="showQuizAnswerOnMap"
            @update:always-show-wrong-answer="setAlwaysShowWrongAnswer"
          />
        </div>
      </div>
      <div v-else-if="selectedCountry" class="map-overlay" :inert="detailLoading">
        <div class="map-overlay__card">
          <CountryCard :country="selectedCountry" :component="selectedComponent" />
        </div>
      </div>
    </section>
  </main>
</template>
