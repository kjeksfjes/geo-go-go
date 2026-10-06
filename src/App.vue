<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import CountryCard from './components/CountryCard.vue'
import CountryQuizPanel from './components/CountryQuizPanel.vue'
import RegionSelector from './components/RegionSelector.vue'
import WorldMap from './components/WorldMap.vue'
import { useCountryQuiz } from './composables/useCountryQuiz'
import { quizCountryIds } from './data/quizCountries'
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
import { clearStoredValues, readStoredBoolean, readStoredValue, writeStoredValue } from './utils/storage'
import { locale, resetLocale, setLocale, t } from './i18n'
import { isCountryLevelSelection } from './data/mapSelection'
import { supplementalAreaInfoById } from './data/supplementalLand'

const selectedCountryId = ref<string | null>(null)
const selectedGeographicUnitId = ref<string | null>(null)
const selectedLandAreaId = ref<string | null>(null)
const worldMap = shallowRef<InstanceType<typeof WorldMap> | null>(null)
const mapOverlay = ref<HTMLElement | null>(null)
type GameMode = 'explore' | 'find-country' | 'name-country'
const mode = ref<GameMode>('explore')
const quizMode = computed(() => mode.value !== 'explore')
const activeRegionId = ref<MapRegionId>('world')
const showingQuizGuess = ref(false)
watch([mode, activeRegionId], () => { selectedLandAreaId.value = null; showingQuizGuess.value = false })
const selectedLandArea = computed(() => {
  const area = selectedLandAreaId.value ? supplementalAreaInfoById.get(selectedLandAreaId.value) : undefined
  return area ? { name: area.name[locale.value], type: area.type[locale.value] } : null
})
const renderedGeographicUnits = shallowRef(geographicUnits)
const highDetailEnabled = ref(false)
const highDetailPreferenceKey = 'geo-go-go.map.high-detail'
const highDetailPreferred = readStoredBoolean(highDetailPreferenceKey, false)
const detailLoading = ref(false)
const detailBlurred = ref(false)
const settingsOpen = ref(false)
const detailedGeographicUnits = shallowRef<typeof geographicUnits | null>(null)
const wrongAnswerPreferenceKey = 'geo-go-go.quiz.always-show-wrong-answer'
const alwaysShowWrongAnswer = ref(readWrongAnswerPreference())
const allCountryAnswersKey = 'geo-go-go.quiz.suggest-all-countries'
const suggestAllCountries = ref(readStoredBoolean(allCountryAnswersKey, false))
const automaticAnswerRevealKey = 'geo-go-go.quiz.reveal-answers-automatically'
const automaticAnswerReveal = ref(readAutomaticAnswerReveal())
const correctAnswerRevealed = ref(false)

function readAutomaticAnswerReveal() {
  const saved = readStoredValue(automaticAnswerRevealKey)
  if (saved === 'true' || saved === 'false') return saved === 'true'
  // Avoid revealing more answers than either of the old preferences allowed.
  const migrated = readStoredBoolean('geo-go-go.quiz.show-correct-answer', false)
    && readStoredBoolean('geo-go-go.quiz.show-skipped-answer', false)
  writeStoredValue(automaticAnswerRevealKey, migrated)
  return migrated
}

function setAutomaticAnswerReveal(value: boolean) {
  if (['answered', 'skipped'].includes(quizPhase.value) && correctAnswerVisible.value) correctAnswerRevealed.value = true
  automaticAnswerReveal.value = value
  writeStoredValue(automaticAnswerRevealKey, value)
}

function revealCurrentCorrectAnswer() {
  if (mode.value === 'name-country' && ['answered', 'skipped'].includes(quizPhase.value)) correctAnswerRevealed.value = true
}

function setSuggestAllCountries(value: boolean) {
  suggestAllCountries.value = value
  writeStoredValue(allCountryAnswersKey, value)
}

function readWrongAnswerPreference() {
  try { return localStorage.getItem(wrongAnswerPreferenceKey) === 'true' } catch { return false }
}

function setAlwaysShowWrongAnswer(value: boolean) {
  alwaysShowWrongAnswer.value = value
  try { localStorage.setItem(wrongAnswerPreferenceKey, String(value)) } catch { /* The setting still works for this session. */ }
}

function resetSettings() {
  clearStoredValues('geo-go-go.')
  resetLocale()
  setAlwaysShowWrongAnswer(false)
  setSuggestAllCountries(false)
  setAutomaticAnswerReveal(false)
  void setHighDetail(false, false)
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
const quizCountryOptions = computed(() => suggestAllCountries.value
  ? [...quizCountryIds]
  : [...quizRegionEntityIds.value].filter((id) => quizCountryIds.has(id)))
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
  skip: skipQuizQuestion,
  start: startQuiz,
  total: quizTotal,
} = useCountryQuiz()
// A guess can be outside the round's region. Preview it without changing
// the selected region, question pool or score; the next question restores it.
watch(quizQuestionId, () => { showingQuizGuess.value = false; correctAnswerRevealed.value = false }, { flush: 'sync' })
const correctAnswerVisible = computed(() => quizAnswerId.value === quizQuestionId.value
  || correctAnswerRevealed.value
  || automaticAnswerReveal.value)
const outsideQuizGuess = computed(() => showingQuizGuess.value && !!quizAnswerId.value
  && !visibleEntityIds.value.has(quizAnswerId.value))
const displayedRegion = computed(() => outsideQuizGuess.value ? regionById.get('world')! : activeRegion.value)
const displayedMapUnitIds = computed(() => outsideQuizGuess.value ? mapUnitIdsByRegion.get('world')! : visibleMapUnitIds.value)

const quizAnswerComponent = computed(() => {
  if (quizPhase.value !== 'answered' || isCountryLevelSelection(quizAnswerId.value, selectedGeographicUnitId.value)) return null
  const unit = selectedGeographicUnitId.value
    ? geographicUnitById.get(selectedGeographicUnitId.value)
    : undefined
  if (unit?.properties.entityId !== quizAnswerId.value) return null
  const id = unit.properties.componentId
  return id ? componentInfoById.get(id) ?? null : null
})

function startRegionalQuiz() {
  correctAnswerRevealed.value = false
  showingQuizGuess.value = false
  startQuiz(quizRegionEntityIds.value)
}

function setMode(nextMode: GameMode) {
  if (mode.value === nextMode) return
  mode.value = nextMode
  selectedCountryId.value = null
  selectedGeographicUnitId.value = null
  if (nextMode !== 'explore') startRegionalQuiz()
}

function handleMapSelection(countryId: string | null, geographicUnitId: string | null) {
  if (mode.value === 'name-country') return
  selectedLandAreaId.value = null
  selectedGeographicUnitId.value = geographicUnitId
  if (mode.value === 'find-country') {
    if (countryId) answerQuiz(countryId)
  } else {
    selectedCountryId.value = countryId
  }
}

function handleLandAreaSelection(id: string | null) {
  if (mode.value !== 'explore') return
  const area = id ? supplementalAreaInfoById.get(id) : undefined
  selectedCountryId.value = area?.quizEntityId ?? null
  selectedGeographicUnitId.value = null
  selectedLandAreaId.value = id && supplementalAreaInfoById.has(id) ? id : null
}

function answerNamedCountry(countryId: string) {
  if (mode.value !== 'name-country' || !quizCountryOptions.value.includes(countryId)) return
  answerQuiz(countryId)
}

function advanceQuizQuestion() {
  selectedGeographicUnitId.value = null
  nextQuizQuestion()
}

function skipNamedCountry() {
  if (mode.value !== 'name-country') return
  selectedGeographicUnitId.value = null
  skipQuizQuestion()
}

function showQuizAnswerOnMap() {
  if (
    quizPhase.value !== 'answered'
    || !quizQuestionId.value
    || quizAnswerId.value === quizQuestionId.value
  ) return
  worldMap.value?.focusCountry(quizQuestionId.value)
}

function showQuizGuessOnMap() {
  if (mode.value !== 'name-country' || quizPhase.value !== 'answered'
    || !quizAnswerId.value || quizAnswerId.value === quizQuestionId.value) return
  if (showingQuizGuess.value) worldMap.value?.focusCountry(quizAnswerId.value)
  else showingQuizGuess.value = true
}

function restartQuiz() {
  selectedGeographicUnitId.value = null
  startRegionalQuiz()
}

function handleQuizShortcut(event: KeyboardEvent) {
  if (
    event.code !== 'Space'
    || event.repeat
    || event.altKey
    || event.ctrlKey
    || event.metaKey
    || !quizMode.value
    || !['answered', 'skipped'].includes(quizPhase.value)
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
  if (!event.target.closest(
    '.settings-button, .map-settings-panel, .vue3-treeselect__portal-target[data-instance-id="projection-selector"]',
  )) settingsOpen.value = false
}

function handleEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') settingsOpen.value = false
}

onMounted(() => {
  document.addEventListener('keydown', handleQuizShortcut)
  document.addEventListener('keydown', handleEscape)
  document.addEventListener('pointerdown', handleSettingsPointerDown)
  if (highDetailPreferred) void setHighDetail(true, false)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleQuizShortcut)
  document.removeEventListener('keydown', handleEscape)
  document.removeEventListener('pointerdown', handleSettingsPointerDown)
})

function setActiveRegion(regionId: MapRegionId) {
  activeRegionId.value = regionId

  if (quizMode.value) {
    selectedGeographicUnitId.value = null
    startRegionalQuiz()
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
    writeStoredValue(highDetailPreferenceKey, false)
    return
  }

  if (detailedGeographicUnits.value && pathsCached) {
    renderedGeographicUnits.value = detailedGeographicUnits.value
    highDetailEnabled.value = true
    writeStoredValue(highDetailPreferenceKey, true)
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
    writeStoredValue(highDetailPreferenceKey, true)
  } catch (error) {
    renderedGeographicUnits.value = geographicUnits
    highDetailEnabled.value = false
    writeStoredValue(highDetailPreferenceKey, false)
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
      <div class="header-navigation">
        <div class="header-region-control">
          <svg class="header-region-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3Z" />
          </svg>
          <RegionSelector
            :model-value="activeRegionId"
            :options="regions"
            @update:model-value="setActiveRegion"
          />
        </div>
        <div class="mode-selector" role="group" :aria-label="t('gameMode')">
          <button type="button" :aria-pressed="mode === 'explore'" @click="setMode('explore')">
            {{ t('explore') }}
          </button>
          <button type="button" :aria-pressed="mode === 'find-country'" @click="setMode('find-country')">
            {{ t('findCountry') }}
          </button>
          <button type="button" :aria-pressed="mode === 'name-country'" @click="setMode('name-country')">
            {{ t('nameCountry') }}
          </button>
        </div>
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
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>
    </header>

    <section class="map-card" :aria-label="t('worldMapGame')">
      <WorldMap
        ref="worldMap"
        :focus-overlay="mapOverlay"
        :geographic-units="renderedGeographicUnits"
        :detailed-geographic-units="detailedGeographicUnits"
        :detail-loading="detailLoading"
        :detail-blurred="detailBlurred"
        :high-detail-enabled="highDetailEnabled"
        :settings-open="settingsOpen"
        :locale="locale"
        :active-region="displayedRegion"
        :selected-country-id="selectedCountryId"
        :selected-geographic-unit-id="selectedGeographicUnitId"
        :selected-land-area-id="selectedLandAreaId"
        :quiz-mode="quizMode"
        :name-country-quiz="mode === 'name-country'"
        :quiz-viewing-guess="showingQuizGuess"
        :suggest-all-countries="suggestAllCountries"
        :automatic-answer-reveal="automaticAnswerReveal"
        :quiz-skipped="quizPhase === 'skipped'"
        :correct-answer-visible="correctAnswerVisible"
        :quiz-complete="quizMode && quizPhase === 'complete'"
        :quiz-question-id="quizQuestionId"
        :quiz-answer-id="quizAnswerId"
        :always-show-wrong-answer="alwaysShowWrongAnswer"
        :visible-map-unit-ids="displayedMapUnitIds"
        @detail-change="setHighDetail"
        @locale-change="setLocale"
        @reset-settings="resetSettings"
        @suggest-all-countries-change="setSuggestAllCountries"
        @wrong-answer-preference-change="setAlwaysShowWrongAnswer"
        @automatic-answer-reveal-change="setAutomaticAnswerReveal"
        @select="handleMapSelection"
        @land-select="handleLandAreaSelection"
        @quiz-next="advanceQuizQuestion"
      />
      <div v-if="quizMode" ref="mapOverlay" class="map-overlay" :inert="detailLoading">
        <div class="map-overlay__card">
          <CountryQuizPanel
            :key="`${mode}:${activeRegionId}`"
            :identify="mode === 'name-country'"
            :country-ids="quizCountryOptions"
            :viewing-outside-region="outsideQuizGuess"
            :correct-answer-visible="correctAnswerVisible"
            :automatic-reveal="automaticAnswerReveal"
            :phase="quizPhase"
            :question="quizQuestion"
            :answer="quizAnswer"
            :answer-component="quizAnswerComponent"
            :always-show-wrong-answer="alwaysShowWrongAnswer"
            :score="quizScore"
            :question-number="quizQuestionNumber"
            :total="quizTotal"
            @answer="answerNamedCountry"
            @skip="skipNamedCountry"
            @reveal-correct-answer="revealCurrentCorrectAnswer"
            @update:automatic-reveal="setAutomaticAnswerReveal"
            @next="advanceQuizQuestion"
            @restart="restartQuiz"
            @show-answer="showQuizAnswerOnMap"
            @show-guess="showQuizGuessOnMap"
            @update:always-show-wrong-answer="setAlwaysShowWrongAnswer"
          />
        </div>
      </div>
      <div v-else-if="selectedCountry || selectedLandArea" ref="mapOverlay" class="map-overlay" :inert="detailLoading">
        <div class="map-overlay__card">
          <CountryCard :country="selectedCountry" :component="selectedComponent" :area="selectedLandArea" />
        </div>
      </div>
    </section>
  </main>
</template>
