<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, useId, watch } from 'vue'
import { geoAzimuthalEqualArea, geoPath, geoDistance } from 'd3-geo'
import CanvasMap from './CanvasMap.vue'
import MapSettingsPanel from './MapSettingsPanel.vue'
import MapScaleBar from './MapScaleBar.vue'
import { projectionFactories, projectionOptions, type MapProjectionId } from '../composables/useMapProjection'
import { mapSettingKeys } from '../logic/mapSettings'
import { mapScaleBar, type ScaleUnitSystem } from '../logic/mapScale'
import { loadBathymetryBands, type BathymetryBand } from '../data/bathymetry'
import { loadReliefBands, type ReliefBand } from '../data/relief'
import type { QuizTipAction } from '../logic/quizTips'
import CountryQuizPanel from './CountryQuizPanel.vue'
import { countyFeatures, countyEmblems, countyIds, countyInfoById, countyNames, loadCountyDetail, type CountyFeature } from '../data/norwayCounties'
import { mapPaletteCssVariables } from '../data/mapPalette'
import { useQuizRound } from '../composables/useQuizRound'
import { useElementSize } from '../composables/useElementSize'
import { useMapZoom, type MapBounds } from '../composables/useMapZoom'
import type { CanvasMapScene } from '../types/mapCanvas'
import { locale, setLocale, t } from '../i18n'
import { readStoredBoolean, readStoredValue, writeStoredValue } from '../utils/storage'

const props = defineProps<{
  mode: 'explore' | 'find-country' | 'name-country'; settingsOpen: boolean
  automaticAnswerReveal: boolean; alwaysShowWrongAnswer: boolean; quizTipsEnabled: boolean
}>()
const emit = defineEmits<{
  'automatic-answer-reveal-change': [enabled: boolean]; 'wrong-answer-preference-change': [enabled: boolean]
  'quiz-tips-enabled-change': [enabled: boolean]; 'quiz-tips-reset': []; 'tip-action': [action: QuizTipAction]
  'view-busy-change': [busy: boolean]; 'round-start': []
}>()
const markersEnabled = ref(readStoredBoolean(mapSettingKeys.countryMarkers, true))
const limitZoom = ref(readStoredBoolean(mapSettingKeys.limitedCountryZoom, true))
const scaleEnabled = ref(readStoredBoolean(mapSettingKeys.scaleBar, true))
const scaleUnits = ref<ScaleUnitSystem>((['metric', 'imperial', 'nautical'] as const).find(unit => unit === readStoredValue(mapSettingKeys.scaleUnits)) ?? 'metric')
const autoProjection = ref(readStoredBoolean(mapSettingKeys.autoRegionalProjection, false))
const projectionId = ref<MapProjectionId>(projectionOptions.find(p => p.id === readStoredValue(mapSettingKeys.projection))?.id ?? 'mercator')
const bathymetryEnabled = ref(readStoredBoolean(mapSettingKeys.bathymetry, !window.matchMedia('(pointer: coarse)').matches))
const reliefEnabled = ref(readStoredBoolean(mapSettingKeys.relief, false))
const bathymetry = shallowRef<BathymetryBand[]>([])
const relief = shallowRef<ReliefBand[]>([])
const bathymetryLoading = ref(false)
const reliefLoading = ref(false)
const layerError = ref(false)
const reliefClipId = `county-relief-${useId()}`
async function setBathymetry(enabled: boolean) {
  layerError.value = false
  if (enabled && !bathymetry.value.length) {
    bathymetryLoading.value = true
    try { bathymetry.value = await loadBathymetryBands() }
    catch { layerError.value = true; return }
    finally { bathymetryLoading.value = false }
  }
  bathymetryEnabled.value = enabled
}
async function setRelief(enabled: boolean) {
  layerError.value = false
  if (enabled && !relief.value.length) {
    reliefLoading.value = true
    try { relief.value = await loadReliefBands() }
    catch { layerError.value = true; return }
    finally { reliefLoading.value = false }
  }
  reliefEnabled.value = enabled
}
for (const [state, key] of [
  [markersEnabled, mapSettingKeys.countryMarkers], [limitZoom, mapSettingKeys.limitedCountryZoom],
  [scaleEnabled, mapSettingKeys.scaleBar], [autoProjection, mapSettingKeys.autoRegionalProjection],
  [bathymetryEnabled, mapSettingKeys.bathymetry], [reliefEnabled, mapSettingKeys.relief],
] as const) watch(state, value => writeStoredValue(key, value))
watch(scaleUnits, value => writeStoredValue(mapSettingKeys.scaleUnits, value))
watch(projectionId, value => writeStoredValue(mapSettingKeys.projection, value))
function selectProjection(id: MapProjectionId) { autoProjection.value = false; projectionId.value = id }

const container = ref<HTMLElement | null>(null)
const svg = ref<SVGSVGElement | null>(null)
const mapContent = ref<SVGGElement | null>(null)
const overlay = ref<HTMLElement | null>(null)
const panel = ref<InstanceType<typeof CountryQuizPanel> | null>(null)
const measured = useElementSize(container)
const overlaySize = useElementSize(overlay)
const width = computed(() => Math.max(320, measured.width.value))
const height = computed(() => Math.max(280, measured.height.value))
const features = shallowRef<CountyFeature[]>(countyFeatures)
const detailEnabled = ref(false)
const detailLoading = ref(false)
const detailError = ref(false)
const highDetailKey = 'geo-go-go.map.high-detail'
let detailRequest = 0
async function setDetail(enabled: boolean) {
  const request = ++detailRequest
  detailError.value = false
  if (!enabled) {
    features.value = countyFeatures; detailEnabled.value = false; detailLoading.value = false
    writeStoredValue(highDetailKey, false); return
  }
  detailLoading.value = true
  try {
    const detailed = await loadCountyDetail()
    if (request !== detailRequest) return
    features.value = detailed; detailEnabled.value = true
    writeStoredValue(highDetailKey, true)
  } catch {
    if (request === detailRequest) detailError.value = true
  } finally {
    if (request === detailRequest) detailLoading.value = false
  }
}
const round = useQuizRound(countyInfoById, countyIds)
const { currentId, currentPlace, answeredId, answeredPlace, phase, score, questionNumber, total } = round
const selectedId = ref<string | null>(null)
const answerDraft = ref('')
const wrongRevealed = ref(false)
const correctRevealed = ref(false)
const alwaysShow = computed(() => props.alwaysShowWrongAnswer)
const automatic = computed(() => props.automaticAnswerReveal)
const identify = computed(() => props.mode === 'name-country')
const quiz = computed(() => props.mode !== 'explore')
const correctVisible = computed(() => answeredId.value === currentId.value || automatic.value || correctRevealed.value)
const unfinished = computed(() => quiz.value && (phase.value === 'answered' || phase.value === 'skipped'
  || (phase.value === 'question' && questionNumber.value > 1)))
function confirmLeave() { return !unfinished.value || window.confirm(t('leaveQuizConfirmation')) }
const tipContext = computed(() => ({
  phase: phase.value,
  question: `${props.mode}:norway-counties:${questionNumber.value}:${currentId.value}`,
  nextCountryVisible: ['answered', 'skipped'].includes(phase.value) && questionNumber.value < total.value,
  revealOpportunity: ['answered', 'skipped'].includes(phase.value) && answeredId.value !== currentId.value,
  answerRevealVisible: identify.value
    ? ['answered', 'skipped'].includes(phase.value) && answeredId.value !== currentId.value && correctVisible.value
    : phase.value === 'answered' && answeredId.value !== currentId.value && wrongRevealed.value,
}))
defineExpose({ confirmLeave, tipContext })
function start() {
  selectedId.value = null; answerDraft.value = ''; wrongRevealed.value = false; correctRevealed.value = false
  if (quiz.value) { round.start(countyIds); emit('round-start') }
  else round.reset()
}
function restart() {
  if (unfinished.value && !window.confirm(t('restartQuizConfirmation'))) return
  start()
}
function next() {
  emit('tip-action', 'advance')
  round.next(); answerDraft.value = ''; wrongRevealed.value = false; correctRevealed.value = false
}
function setAutomatic(value: boolean) { emit('automatic-answer-reveal-change', value); correctRevealed.value = value }
function setAlwaysShow(value: boolean) { emit('wrong-answer-preference-change', value); wrongRevealed.value = value }

const focusViewport = computed<MapBounds>(() => {
  if (!quiz.value && !selectedId.value) return [[16, 16], [width.value - 16, height.value - 45]]
  if (width.value > 900) return [[460, 16], [width.value - 16, height.value - 45]]
  return [[16, Math.min(height.value * 0.55, overlaySize.height.value + 32)], [width.value - 16, height.value - 45]]
})

// Fit only county land. No world/context/territory layers are part of this scene.
const collection = computed(() => ({ type: 'FeatureCollection' as const, features: features.value }))
const activeProjectionId = computed(() => autoProjection.value ? 'regional-equal-area' : projectionId.value)
const projection = computed(() => {
  const p = activeProjectionId.value === 'regional-equal-area'
    ? geoAzimuthalEqualArea().rotate([-15, -65]) : projectionFactories[activeProjectionId.value]()
  return p.fitExtent(focusViewport.value, collection.value).clipExtent([[-width.value, -height.value], [width.value * 2, height.value * 2]])
})
const generator = computed(() => geoPath(projection.value))
const paths = computed(() => features.value.map(feature => ({
  id: feature.id, path: generator.value(feature) ?? '', bounds: generator.value.bounds(feature) as MapBounds,
})))
const wholeBounds = computed(() => generator.value.bounds(collection.value) as MapBounds)
const noWrap = ref(null)
const constraint = computed(() => ({ minScale: 1, bounds: [
  [Math.min(0, wholeBounds.value[0][0]), Math.min(0, wholeBounds.value[0][1])],
  [Math.max(width.value, wholeBounds.value[1][0]), Math.max(height.value, wholeBounds.value[1][1])],
] as MapBounds }))
const home = ref(null)
const verticalBounds = computed<[number, number]>(() => [wholeBounds.value[0][1], wholeBounds.value[1][1]])
const { transform, isDragging, isPinching, isWheeling, isAnimating, isInteracting,
  consumeDragClick, startPan, movePan, endPan, updateTouches, zoomFromWheel, zoomToBounds, resetZoom } =
  useMapZoom(width, height, mapContent, noWrap, constraint, home, verticalBounds)
const canvasReady = ref(false)
const canvasEnabled = new URLSearchParams(window.location.search).get('renderer') !== 'svg'
const canvasActive = computed(() => canvasEnabled && canvasReady.value)
const projectedBathymetry = computed(() => bathymetryEnabled.value ? bathymetry.value.map(band => ({ depth: band.depth, path: generator.value(band.geometry) ?? '' })) : [])
const projectedRelief = computed(() => reliefEnabled.value ? relief.value.map(band => ({ elevation: band.elevation, path: generator.value(band.geometry) ?? '' })) : [])
const reliefClipPath = computed(() => paths.value.map(p => p.path).join(''))
const scene = computed<CanvasMapScene>(() => ({
  coordinateKey: `norway-counties:${width.value}:${height.value}:${detailEnabled.value}:${activeProjectionId.value}:${focusViewport.value.flat().join(',')}`,
  spherePath: `M${-width.value},${-height.value}h${width.value * 3}v${height.value * 3}h${-width.value * 3}Z`,
  bathymetry: projectedBathymetry.value, relief: projectedRelief.value, reliefClipPath: reliefClipPath.value, contextCountries: [],
  countries: paths.value.map(({ path, bounds }) => ({ path, bounds })),
}))
const scaleBar = computed(() => {
  if (!scaleEnabled.value) return null
  const sample = Math.min(80, width.value * 0.2)
  const a = projection.value.invert?.([(width.value / 2 - sample / 2 - transform.x) / transform.scale, (height.value / 2 - transform.y) / transform.scale])
  const b = projection.value.invert?.([(width.value / 2 + sample / 2 - transform.x) / transform.scale, (height.value / 2 - transform.y) / transform.scale])
  if (!a || !b) return null
  return mapScaleBar(geoDistance(a, b) * 6371.0088 / sample, width.value, scaleUnits.value, locale.value)
})
watch([isInteracting, detailLoading, bathymetryLoading, reliefLoading], () => emit('view-busy-change', isInteracting.value || detailLoading.value || bathymetryLoading.value || reliefLoading.value))
function focus(id: string) {
  const path = paths.value.find(path => path.id === id)
  if (path) zoomToBounds(path.bounds, undefined, { viewport: focusViewport.value, preferredScale: limitZoom.value ? 8 : undefined })
}
function overview() { resetZoom() }
async function focusQuestion() {
  await nextTick()
  if (!quiz.value && selectedId.value) focus(selectedId.value)
  else if (identify.value && currentId.value && phase.value !== 'complete') focus(currentId.value)
  else resetZoom(false)
}
watch(() => props.mode, () => { start(); void focusQuestion() }, { immediate: true })
watch(currentId, () => { void focusQuestion() })
watch([projection], () => { void focusQuestion() }, { flush: 'post' })

function select(id: string | null) {
  if (isAnimating.value || detailLoading.value) return
  if (!quiz.value) {
    selectedId.value = id
    if (id) { void nextTick(() => focus(id)) }
    return
  }
  if (phase.value === 'answered' || phase.value === 'skipped') { next(); return }
  if (phase.value !== 'question') return
  if (identify.value) { panel.value?.focusAnswer(); emit('tip-action', 'map-focus') }
  else if (id) round.answer(id)
}
let suppressClickUntil = 0
function click(event: MouseEvent) {
  if (event.detail !== 0 && performance.now() < suppressClickUntil) return
  if (consumeDragClick()) return
  const target = event.target instanceof Element ? event.target.closest('[data-county]') : null
  select(target?.getAttribute('data-county') ?? null)
}
function touch(event: TouchEvent) {
  if (!svg.value) return
  const tap = updateTouches(event, svg.value)
  if (event.type === 'touchcancel') { consumeDragClick(); return }
  if (event.type !== 'touchend') return
  suppressClickUntil = performance.now() + 700
  if (consumeDragClick() || !tap) return
  const target = tap.target instanceof Element ? tap.target.closest('[data-county]') : null
  select(target?.getAttribute('data-county') ?? null)
}
function keyboard(event: KeyboardEvent) {
  if (event.key !== ' ' || event.repeat || event.altKey || event.ctrlKey || event.metaKey
    || !(event.target instanceof Element) || event.target.closest('button, input, select, textarea, [role="combobox"]')) return
  if (quiz.value && (phase.value === 'answered' || phase.value === 'skipped')) { event.preventDefault(); next() }
}
function classes(id: string) {
  return {
    'county--selected': !quiz.value && id === selectedId.value,
    'county--question': identify.value && quiz.value && phase.value !== 'complete' && id === currentId.value,
    'county--correct': quiz.value && ['answered', 'skipped'].includes(phase.value) && id === currentId.value
      && (!identify.value || correctVisible.value),
    'county--wrong': quiz.value && phase.value === 'answered' && id === answeredId.value && answeredId.value !== currentId.value,
  }
}
function label(id: string) { return quiz.value ? t('chooseCounty') : countyNames[id] ?? id }
function marker(path: typeof paths.value[number]) {
  const [[x0, y0], [x1, y1]] = path.bounds
  return (x1 - x0) * transform.scale < 22 && (y1 - y0) * transform.scale < 22
}
onMounted(() => {
  document.addEventListener('keydown', keyboard)
  if (readStoredBoolean(highDetailKey, false)) void setDetail(true)
  if (bathymetryEnabled.value) void setBathymetry(true)
  if (reliefEnabled.value) void setRelief(true)
})
onBeforeUnmount(() => { detailRequest++; document.removeEventListener('keydown', keyboard) })
</script>

<template>
  <div ref="container" class="county-game" data-help="map" :style="mapPaletteCssVariables" :class="{ 'county-game--canvas': canvasActive, 'county-game--dragging': isDragging }">
    <CanvasMap v-if="canvasEnabled" :width="width" :height="height" :scene="scene" :camera="transform"
      :interacting="isInteracting" :panning="isDragging" :wheel-zooming="isWheeling" :animating="isAnimating"
      :firefox-preview="false" :touch-zooming="isPinching" :animated-zooming="isAnimating" :touch-panning="false"
      :diagnostics-active="false" :wrap-offset="null" :wrap-period="null" @ready-change="canvasReady = $event" />
    <svg ref="svg" class="county-map" :viewBox="`0 0 ${width} ${height}`" role="group" :aria-label="t('countyMap')"
      @contextmenu.prevent @selectstart.prevent
      @pointerdown="svg && startPan($event, svg)" @pointermove="movePan" @pointerup="svg && endPan($event, svg)" @pointercancel="svg && endPan($event, svg)"
      @wheel.prevent="svg && zoomFromWheel($event, svg)"
      @touchstart.prevent="touch" @touchmove.prevent="touch" @touchend="touch" @touchcancel="touch" @click="click">
      <g ref="mapContent">
        <defs><clipPath :id="reliefClipId"><path :d="reliefClipPath" /></clipPath></defs>
        <template v-if="!canvasActive">
          <path v-for="band in projectedBathymetry" :key="band.depth" :d="band.path" :fill="`var(--map-bathymetry-${band.depth})`" pointer-events="none" />
          <path v-for="path in paths" :key="`base:${path.id}`" :d="path.path" :fill="reliefEnabled ? 'var(--map-relief-land)' : 'var(--map-land)'" pointer-events="none" />
          <g :clip-path="`url(#${reliefClipId})`" style="mix-blend-mode: screen" pointer-events="none">
            <path v-for="band in projectedRelief" :key="band.elevation" :d="band.path" :fill="`var(--map-relief-${band.elevation})`" :fill-opacity="`var(--map-relief-${band.elevation}-opacity)`" />
          </g>
        </template>
        <path v-for="path in paths" :key="path.id" :d="path.path" class="county" :class="classes(path.id)" :data-county="path.id"
          role="button" tabindex="0" :aria-label="label(path.id)" :aria-pressed="!quiz && selectedId === path.id"
          @keydown.enter.prevent.stop="select(path.id)" @keydown.space.prevent.stop="select(path.id)">
          <title v-if="!quiz">{{ countyNames[path.id] }}</title>
        </path>
        <template v-for="path in paths" :key="`marker:${path.id}`">
          <circle v-if="markersEnabled && marker(path)" :cx="(path.bounds[0][0] + path.bounds[1][0]) / 2" :cy="(path.bounds[0][1] + path.bounds[1][1]) / 2"
            :r="11 / transform.scale" class="county-marker" :class="classes(path.id)" :data-county="path.id" aria-hidden="true">
            <title v-if="!quiz">{{ countyNames[path.id] }}</title>
          </circle>
        </template>
      </g>
    </svg>
    <div ref="overlay" class="map-overlay">
      <div v-if="quiz" class="map-overlay__card">
        <CountryQuizPanel ref="panel" :key="mode" county :names="countyNames" :badges="countyEmblems" :country-ids="[...countyIds]"
          :identify="identify" v-model:answer-draft="answerDraft" :wrong-answer-revealed="wrongRevealed" :correct-answer-visible="correctVisible"
          :automatic-reveal="automatic" :phase="phase" :question="currentPlace" :answer="answeredPlace" :answer-component="null"
          :always-show-wrong-answer="alwaysShow" :score="score" :question-number="questionNumber" :total="total"
          @tip-action="emit('tip-action', $event)" @answer="round.answer" @skip="round.skip" @next="next" @restart="restart"
          @reveal-correct-answer="correctRevealed = true" @reveal-wrong-answer="wrongRevealed = true"
          @update:automatic-reveal="setAutomatic" @update:always-show-wrong-answer="setAlwaysShow"
          @show-answer="currentId && focus(currentId)" @show-guess="answeredId && focus(answeredId)" />
      </div>
      <aside v-else-if="selectedId" class="map-overlay__card map-overlay__content" aria-live="polite">
        <div class="county-card-header">
          <img class="map-overlay__emblem" :src="countyEmblems[selectedId]" :alt="t('coatOfArms', { name: countyNames[selectedId] })" />
          <div><p class="map-overlay__eyebrow">{{ t('selectedCounty') }}</p>
          <h2 class="map-overlay__heading">{{ countyNames[selectedId] }}</h2></div>
        </div>
      </aside>
    </div>
    <MapSettingsPanel county :open="settingsOpen" :locale="locale" :detail-loading="detailLoading" :projection-loading="false"
      :high-detail-enabled="detailEnabled" :bathymetry-loading="bathymetryLoading" :bathymetry-enabled="bathymetryEnabled"
      :relief-loading="reliefLoading" :relief-enabled="reliefEnabled" :interaction-locked="detailLoading || bathymetryLoading || reliefLoading" :quiz-mode="quiz"
      :projection-id="activeProjectionId" :quiz-tips-enabled="quizTipsEnabled" :suggest-all-countries="false"
      :automatic-answer-reveal="automaticAnswerReveal" :always-show-wrong-answer="alwaysShowWrongAnswer"
      v-model:auto-regional-projection="autoProjection" :marine-labels-enabled="false" v-model:country-markers-enabled="markersEnabled"
      v-model:limited-country-zoom-enabled="limitZoom" v-model:scale-bar-enabled="scaleEnabled" v-model:scale-units="scaleUnits"
      @locale-change="setLocale" @detail-change="setDetail" @bathymetry-change="setBathymetry" @relief-change="setRelief" @projection-change="selectProjection"
      @quiz-tips-enabled-change="emit('quiz-tips-enabled-change', $event)" @quiz-tips-reset="emit('quiz-tips-reset')"
      @automatic-answer-reveal-change="setAutomatic" @wrong-answer-preference-change="setAlwaysShow" />
    <p v-if="detailError || layerError" class="county-load-error" role="alert">{{ t('countyLoadError') }} <button @click="setDetail(true); setBathymetry(bathymetryEnabled); setRelief(reliefEnabled)">{{ t('retry') }}</button></p>
    <MapScaleBar v-if="scaleBar" :scale="scaleBar" />
    <div class="county-controls"><button type="button" @click="overview">{{ t('resetView') }}</button></div>
    <a class="county-attribution" href="https://data.norge.no/nb/datasets/8aa07439-e295-3e11-8ee5-141cf03d7bd5/administrative-enheter-fylker" target="_blank" rel="noopener noreferrer">{{ t('countyAttribution') }}</a>
  </div>
</template>

<style scoped>
.county-game { position: absolute; inset: 0; overflow: hidden; background: var(--map-ocean); }
.county-map { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
.county { fill: transparent; stroke: var(--map-border); stroke-width: 0.8; vector-effect: non-scaling-stroke; cursor: pointer; outline: none; }
.county-game--canvas .county { fill: transparent; stroke: none; pointer-events: all; }
.county-game .county--selected { fill: #efe3c9; stroke: var(--map-border); }
.county-game .county--question { fill: #f5dfa0; stroke: var(--map-border); }
.county-game .county--correct { fill: #cce5c9; stroke: #287247; }
.county-game .county--wrong { fill: #f0c8bd; stroke: #b73f2c; }
.county-marker { fill: transparent; stroke: var(--map-border); stroke-width: 1.5; vector-effect: non-scaling-stroke; cursor: pointer; outline: none; }
.county-game--dragging .county-map, .county-game--dragging .county, .county-game--dragging .county-marker { cursor: grabbing; }
:global(html[data-input-modality='keyboard']) .county:focus-visible { outline: none; stroke: var(--ui-focus); stroke-width: 3; }
@media (hover: hover) { .county-game .county:not(.county--correct):not(.county--wrong):hover { fill: #f5edda; stroke: var(--map-border); } }
.county-card-header { display: grid; grid-template-columns: var(--ui-card-flag-width) minmax(0, 1fr); gap: var(--ui-card-column-gap); align-items: start; }
.county-controls { position: absolute; right: 1rem; bottom: 2.5rem; }
.county-controls button, .county-load-error button { min-height: var(--ui-control-height); padding: 0.45rem 0.7rem; border: 1px solid var(--ui-border); border-radius: var(--ui-radius-control); color: var(--ui-ink); background: var(--ui-panel); font: inherit; cursor: pointer; }
.county-attribution { position: absolute; right: 0.5rem; bottom: 0.3rem; left: 0.5rem; width: fit-content; max-width: calc(100% - 1rem); padding: 0.15rem 0.3rem; border-radius: var(--ui-radius-small); background: var(--ui-panel); color: var(--ui-text); font-size: 0.65rem; }
.county-load-error { position: absolute; right: 1rem; top: 1rem; z-index: 5; background: var(--ui-panel); padding: 0.5rem; }
</style>
