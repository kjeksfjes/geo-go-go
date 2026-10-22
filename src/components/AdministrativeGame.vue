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
import type { AdministrativeMapData, AdministrativeGameProps } from '../types/administrativeMap'
import { placeText } from '../logic/placeText'
import { projectUsStateContext } from '../logic/usStateContext'
import { createUsStateProjection, usStateInsets } from '../logic/usStateProjection'
import { mapPaletteCssVariables } from '../data/mapPalette'
import { useQuizRound } from '../composables/useQuizRound'
import { useElementSize } from '../composables/useElementSize'
import { useMapZoom, type MapBounds } from '../composables/useMapZoom'
import type { CanvasMapScene } from '../types/mapCanvas'
import { locale, setLocale, t } from '../i18n'
import { readStoredBoolean, readStoredValue, writeStoredValue } from '../utils/storage'

const props = defineProps<AdministrativeGameProps & { mapData: AdministrativeMapData }>()
const emit = defineEmits<{
  'automatic-answer-reveal-change': [enabled: boolean]; 'wrong-answer-preference-change': [enabled: boolean]
  'quiz-tips-enabled-change': [enabled: boolean]; 'quiz-tips-reset': []; 'tip-action': [action: QuizTipAction]
  'view-busy-change': [busy: boolean]; 'round-start': []
}>()
// Each lazy map wrapper supplies a fixed dataset for this component instance.
const mapData = props.mapData
const { features, places, ids, badges, aliases } = mapData
const names = computed(() => mapData.names[locale.value])
const fixedLayout = mapData.layout === 'us-insets'
function text(key: import('../i18n').MessageKey, values: Record<string, string | number> = {}) {
  return placeText(mapData.kind, key, values)
}
const markersEnabled = ref(readStoredBoolean(mapSettingKeys.countryMarkers, true))
const limitZoom = ref(readStoredBoolean(mapSettingKeys.limitedCountryZoom, true))
const scaleEnabled = ref(readStoredBoolean(mapSettingKeys.scaleBar, true))
const scaleUnits = ref<ScaleUnitSystem>((['metric', 'imperial', 'nautical'] as const).find(unit => unit === readStoredValue(mapSettingKeys.scaleUnits)) ?? 'metric')
const autoProjection = ref(!fixedLayout && readStoredBoolean(mapSettingKeys.autoRegionalProjection, false))
const projectionId = ref<MapProjectionId>(projectionOptions.find(p => p.id === readStoredValue(mapSettingKeys.projection))?.id ?? 'mercator')
const bathymetryEnabled = ref(!fixedLayout && readStoredBoolean(mapSettingKeys.bathymetry, !window.matchMedia('(pointer: coarse)').matches))
const reliefEnabled = ref(readStoredBoolean(mapSettingKeys.relief, false))
const bathymetry = shallowRef<BathymetryBand[]>([])
const relief = shallowRef<ReliefBand[]>([])
const bathymetryLoading = ref(false)
const reliefLoading = ref(false)
const layerError = ref(false)
const reliefClipId = `administrative-relief-${useId()}`
const contextClipId = `administrative-context-${useId()}`
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
function selectProjection(id: MapProjectionId) { if (!fixedLayout) { autoProjection.value = false; projectionId.value = id } }

const container = ref<HTMLElement | null>(null)
const svg = ref<SVGSVGElement | null>(null)
const mapContent = ref<SVGGElement | null>(null)
const overlay = ref<HTMLElement | null>(null)
const panel = ref<InstanceType<typeof CountryQuizPanel> | null>(null)
const measured = useElementSize(container)
const width = computed(() => Math.max(320, measured.width.value))
const height = computed(() => Math.max(280, measured.height.value))
const round = useQuizRound(places, ids)
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
  question: `${props.mode}:${mapData.id}:${questionNumber.value}:${currentId.value}`,
  nextCountryVisible: ['answered', 'skipped'].includes(phase.value) && questionNumber.value < total.value,
  revealOpportunity: ['answered', 'skipped'].includes(phase.value) && answeredId.value !== currentId.value,
  answerRevealVisible: identify.value
    ? ['answered', 'skipped'].includes(phase.value) && answeredId.value !== currentId.value && correctVisible.value
    : phase.value === 'answered' && answeredId.value !== currentId.value && wrongRevealed.value,
}))
defineExpose({ confirmLeave, tipContext })
function start() {
  selectedId.value = null; answerDraft.value = ''; wrongRevealed.value = false; correctRevealed.value = false
  if (quiz.value) { round.start(ids); emit('round-start') }
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

// Keep projected coordinates independent of selection and card size. Only the
// camera's destination viewport changes when a card opens or closes.
const overviewViewport = computed<MapBounds>(() => [[16, 16], [width.value - 16, height.value - 45]])
function focusViewport(): MapBounds {
  if (!quiz.value && !selectedId.value) return overviewViewport.value
  if (width.value > 900) return [[460, 16], [width.value - 16, height.value - 45]]
  const cardHeight = overlay.value?.getBoundingClientRect().height ?? 0
  return [[16, Math.min(height.value * 0.55, cardHeight + 32)], [width.value - 16, height.value - 45]]
}

// Fit only this map set. No world context or territory layers enter the scene.
const collection = computed(() => ({ type: 'FeatureCollection' as const, features: features }))
const activeProjectionId = computed(() => fixedLayout || autoProjection.value ? 'regional-equal-area' : projectionId.value)
const projection = computed(() => {
  if (fixedLayout) return createUsStateProjection().fitExtent(overviewViewport.value, collection.value)
  const p = activeProjectionId.value === 'regional-equal-area'
    ? geoAzimuthalEqualArea().rotate([-15, -65]) : projectionFactories[activeProjectionId.value]()
  return p.fitExtent(overviewViewport.value, collection.value).clipExtent([[-width.value, -height.value], [width.value * 2, height.value * 2]])
})
const generator = computed(() => geoPath(projection.value))
const paths = computed(() => features.map(feature => ({
  id: feature.id, path: generator.value(feature) ?? '', bounds: generator.value.bounds(feature) as MapBounds,
})))
const insets = computed(() => fixedLayout ? usStateInsets(projection.value.scale(), projection.value.translate()) : [])
function insetLabel(code: string) {
  return quiz.value ? t('mapInset') : names.value[`us:state:${code}`]
}
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
const contextPaths = computed(() => fixedLayout ? projectUsStateContext(projection.value, width.value, height.value) : [])
const scene = computed<CanvasMapScene>(() => ({
  coordinateKey: `${mapData.id}:${width.value}:${height.value}:high-detail:${fixedLayout ? 'pacific-insets' : activeProjectionId.value}`,
  spherePath: `M${-width.value},${-height.value}h${width.value * 3}v${height.value * 3}h${-width.value * 3}Z`,
  bathymetry: projectedBathymetry.value, relief: projectedRelief.value, reliefClipPath: reliefClipPath.value, contextCountries: contextPaths.value,
  countries: paths.value.map(({ path, bounds }) => ({ path, bounds })),
}))
function insetRegion(point: [number, number]) {
  return point[1] > 50 && (point[0] < -130 || point[0] > 170) ? 'alaska'
    : point[0] < -130 && point[1] < 30 ? 'hawaii' : 'mainland'
}
const scaleSample = computed(() => {
  if (!scaleEnabled.value) return null
  const sample = Math.min(80, width.value * 0.2)
  const viewport = focusViewport()
  const screenX = (viewport[0][0] + viewport[1][0]) / 2
  const screenY = (viewport[0][1] + viewport[1][1]) / 2
  const left: [number, number] = [(screenX - sample / 2 - transform.x) / transform.scale, (screenY - transform.y) / transform.scale]
  const right: [number, number] = [(screenX + sample / 2 - transform.x) / transform.scale, left[1]]
  const a = projection.value.invert?.(left)
  const b = projection.value.invert?.(right)
  if (!a || !b || ![...a, ...b].every(Number.isFinite)) return null
  if (fixedLayout) {
    if (insetRegion(a) !== insetRegion(b)) return null
    for (const [geographic, expected] of [[a, left], [b, right]] as const) {
      const point = projection.value(geographic)
      if (!point || Math.hypot(point[0] - expected[0], point[1] - expected[1]) > 0.01) return null
    }
  }
  return { scale: mapScaleBar(geoDistance(a, b) * 6371.0088 / sample, width.value, scaleUnits.value, locale.value), region: insetRegion(a) }
})
const scaleBar = computed(() => scaleSample.value?.scale)
const scaleCaption = computed(() => {
  const region = scaleSample.value?.region
  return region === 'alaska' ? t(quiz.value ? 'scaleSmallerInset' : 'scaleAlaska')
    : region === 'hawaii' ? t(quiz.value ? 'scaleIslandInset' : 'scaleHawaii') : t('scaleMainland')
})

watch([isInteracting, bathymetryLoading, reliefLoading], () => emit('view-busy-change', isInteracting.value || bathymetryLoading.value || reliefLoading.value))
function focus(id: string) {
  const path = paths.value.find(path => path.id === id)
  if (!path) return
  const viewport = focusViewport()
  // Reference regions give a wider, consistent geographic context for small places.
  const [[left, top], [right, bottom]] = viewport
  const referenceScales = paths.value.filter(p => mapData.zoomReferenceIds.includes(p.id)).map(p => {
    const [[x0, y0], [x1, y1]] = p.bounds
    const widthRatio = Math.max(1, x1 - x0) / Math.max(1, right - left)
    const heightRatio = Math.max(1, y1 - y0) / Math.max(1, bottom - top)
    return Math.max(1.8, 0.68 / Math.max(widthRatio, heightRatio))
  })
  // Alaska is drawn smaller in the composite projection. Adjust the automatic
  // ceiling to represent the same ground scale as the mainland reference states.
  const insetScale = fixedLayout && id === 'us:state:AK' ? 0.35 : 1
  const maxScale = limitZoom.value ? referenceScales.reduce((sum, scale) => sum + scale, 0) / referenceScales.length / insetScale : undefined
  zoomToBounds(path.bounds, undefined, { viewport, maxScale })
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
watch(limitZoom, () => { if (selectedId.value || identify.value) void focusQuestion() })

function select(id: string | null) {
  if (isAnimating.value) return
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
  const target = event.target instanceof Element ? event.target.closest('[data-place]') : null
  select(target?.getAttribute('data-place') ?? null)
}
function touch(event: TouchEvent) {
  if (!svg.value) return
  const tap = updateTouches(event, svg.value)
  if (event.type === 'touchcancel') { consumeDragClick(); return }
  if (event.type !== 'touchend') return
  suppressClickUntil = performance.now() + 700
  if (consumeDragClick() || !tap) return
  const target = tap.target instanceof Element ? tap.target.closest('[data-place]') : null
  select(target?.getAttribute('data-place') ?? null)
}
function keyboard(event: KeyboardEvent) {
  if (event.key !== ' ' || event.repeat || event.altKey || event.ctrlKey || event.metaKey
    || !(event.target instanceof Element) || event.target.closest('button, input, select, textarea, [role="combobox"]')) return
  if (quiz.value && (phase.value === 'answered' || phase.value === 'skipped')) { event.preventDefault(); next() }
}
function classes(id: string) {
  return {
    'administrative--selected': !quiz.value && id === selectedId.value,
    'administrative--question': identify.value && quiz.value && phase.value !== 'complete' && id === currentId.value,
    'administrative--correct': quiz.value && ['answered', 'skipped'].includes(phase.value) && id === currentId.value
      && (!identify.value || correctVisible.value),
    'administrative--wrong': quiz.value && phase.value === 'answered' && id === answeredId.value && answeredId.value !== currentId.value,
  }
}
function label(id: string) { return quiz.value ? text('chooseCountry') : names.value[id] ?? id }
function marker(path: typeof paths.value[number]) {
  const [[x0, y0], [x1, y1]] = path.bounds
  return (x1 - x0) * transform.scale < 22 && (y1 - y0) * transform.scale < 22
}
onMounted(() => {
  document.addEventListener('keydown', keyboard)
  if (bathymetryEnabled.value) void setBathymetry(true)
  if (reliefEnabled.value) void setRelief(true)
})
onBeforeUnmount(() => { document.removeEventListener('keydown', keyboard); emit('view-busy-change', false) })
</script>

<template>
  <div ref="container" class="administrative-game" data-help="map" :style="mapPaletteCssVariables" :class="{ 'administrative-game--canvas': canvasActive, 'administrative-game--dragging': isDragging }">
    <CanvasMap v-if="canvasEnabled" :width="width" :height="height" :scene="scene" :camera="transform"
      :interacting="isInteracting" :panning="isDragging" :wheel-zooming="isWheeling" :animating="isAnimating"
      :firefox-preview="false" :touch-zooming="isPinching" :animated-zooming="isAnimating" :touch-panning="false"
      :diagnostics-active="false" :wrap-offset="null" :wrap-period="null" @ready-change="canvasReady = $event" />
    <svg ref="svg" class="administrative-map" :viewBox="`0 0 ${width} ${height}`" role="group" :aria-label="text('worldMapGame')"
      @contextmenu.prevent @selectstart.prevent
      @pointerdown="svg && startPan($event, svg)" @pointermove="movePan" @pointerup="svg && endPan($event, svg)" @pointercancel="svg && endPan($event, svg)"
      @wheel.prevent="svg && zoomFromWheel($event, svg)"
      @touchstart.prevent="touch" @touchmove.prevent="touch" @touchend="touch" @touchcancel="touch" @click="click">
      <g ref="mapContent">
        <defs>
          <clipPath :id="reliefClipId"><path :d="reliefClipPath" /></clipPath>
          <template v-for="(context, index) in contextPaths" :key="index">
            <clipPath v-if="context.clipPath" :id="`${contextClipId}-${index}`"><path :d="context.clipPath" clip-rule="evenodd" /></clipPath>
          </template>
        </defs>
        <template v-if="!canvasActive">
          <path v-for="band in projectedBathymetry" :key="band.depth" :d="band.path" :fill="`var(--map-bathymetry-${band.depth})`" pointer-events="none" />
          <g class="administrative-context" aria-hidden="true">
            <path v-for="(context, index) in contextPaths" :key="index" :d="context.path" :clip-path="context.clipPath ? `url(#${contextClipId}-${index})` : undefined" />
          </g>
          <path v-for="path in paths" :key="`base:${path.id}`" :d="path.path" :fill="reliefEnabled ? 'var(--map-relief-land)' : 'var(--map-land)'" pointer-events="none" />
          <g :clip-path="`url(#${reliefClipId})`" style="mix-blend-mode: screen" pointer-events="none">
            <path v-for="band in projectedRelief" :key="band.elevation" :d="band.path" :fill="`var(--map-relief-${band.elevation})`" :fill-opacity="`var(--map-relief-${band.elevation}-opacity)`" />
          </g>
        </template>
        <path v-for="path in paths" :key="path.id" :d="path.path" class="administrative" :class="classes(path.id)" :data-place="path.id"
          role="button" tabindex="0" :aria-label="label(path.id)" :aria-pressed="!quiz && selectedId === path.id"
          @keydown.enter.prevent.stop="select(path.id)" @keydown.space.prevent.stop="select(path.id)">
          <title v-if="!quiz">{{ names[path.id] }}</title>
        </path>
        <g v-for="inset in insets" :key="inset.code" class="administrative-inset" aria-hidden="true" pointer-events="none">
          <rect :x="inset.bounds[0][0]" :y="inset.bounds[0][1]" :width="inset.bounds[1][0] - inset.bounds[0][0]" :height="inset.bounds[1][1] - inset.bounds[0][1]" />
          <text :x="inset.bounds[0][0]" :y="inset.bounds[1][1] + 14 / transform.scale" :font-size="11 / transform.scale" :stroke-width="2 / transform.scale">{{ insetLabel(inset.code) }}<tspan v-if="inset.code === 'AK'" :x="inset.bounds[0][0]" :dy="12 / transform.scale">{{ t('insetScaleNote') }}</tspan></text>
        </g>
        <template v-for="path in paths" :key="`marker:${path.id}`">
          <circle v-if="markersEnabled && marker(path)" :cx="(path.bounds[0][0] + path.bounds[1][0]) / 2" :cy="(path.bounds[0][1] + path.bounds[1][1]) / 2"
            :r="11 / transform.scale" class="administrative-marker" :class="classes(path.id)" :data-place="path.id" aria-hidden="true">
            <title v-if="!quiz">{{ names[path.id] }}</title>
          </circle>
        </template>
      </g>
    </svg>
    <div ref="overlay" class="map-overlay">
      <div v-if="quiz" class="map-overlay__card">
        <CountryQuizPanel ref="panel" :key="mode" :place-kind="mapData.kind" :aliases="aliases" :names="names" :badges="badges" :country-ids="[...ids]"
          :identify="identify" v-model:answer-draft="answerDraft" :wrong-answer-revealed="wrongRevealed" :correct-answer-visible="correctVisible"
          :automatic-reveal="automatic" :phase="phase" :question="currentPlace" :answer="answeredPlace" :answer-component="null"
          :always-show-wrong-answer="alwaysShow" :score="score" :question-number="questionNumber" :total="total"
          @tip-action="emit('tip-action', $event)" @answer="round.answer" @skip="round.skip" @next="next" @restart="restart"
          @reveal-correct-answer="correctRevealed = true" @reveal-wrong-answer="wrongRevealed = true"
          @update:automatic-reveal="setAutomatic" @update:always-show-wrong-answer="setAlwaysShow"
          @show-answer="currentId && focus(currentId)" @show-guess="answeredId && focus(answeredId)" />
      </div>
      <aside v-else-if="selectedId" class="map-overlay__card map-overlay__content" aria-live="polite">
        <div class="administrative-card-header">
          <img class="map-overlay__emblem" :src="badges[selectedId]" :alt="text('flag', { name: names[selectedId] })" />
          <div><p class="map-overlay__eyebrow">{{ text('selectedCountry') }}</p>
          <h2 class="map-overlay__heading">{{ names[selectedId] }}</h2></div>
        </div>
      </aside>
    </div>
    <MapSettingsPanel :place-kind="mapData.kind" :fixed-layout="fixedLayout" :open="settingsOpen" :locale="locale" :detail-loading="false" :projection-loading="false"
      :high-detail-enabled="true" :bathymetry-loading="bathymetryLoading" :bathymetry-enabled="bathymetryEnabled"
      :relief-loading="reliefLoading" :relief-enabled="reliefEnabled" :interaction-locked="bathymetryLoading || reliefLoading" :quiz-mode="quiz"
      :projection-id="activeProjectionId" :quiz-tips-enabled="quizTipsEnabled" :suggest-all-countries="false"
      :automatic-answer-reveal="automaticAnswerReveal" :always-show-wrong-answer="alwaysShowWrongAnswer"
      v-model:auto-regional-projection="autoProjection" :marine-labels-enabled="false" v-model:country-markers-enabled="markersEnabled"
      v-model:limited-country-zoom-enabled="limitZoom" v-model:scale-bar-enabled="scaleEnabled" v-model:scale-units="scaleUnits"
      @locale-change="setLocale" @bathymetry-change="setBathymetry" @relief-change="setRelief" @projection-change="selectProjection"
      @quiz-tips-enabled-change="emit('quiz-tips-enabled-change', $event)" @quiz-tips-reset="emit('quiz-tips-reset')"
      @automatic-answer-reveal-change="setAutomatic" @wrong-answer-preference-change="setAlwaysShow" />
    <p v-if="layerError" class="administrative-load-error" role="alert">{{ t('mapLayersLoadError') }} <button @click="setBathymetry(bathymetryEnabled); setRelief(reliefEnabled)">{{ t('retry') }}</button></p>
    <MapScaleBar v-if="scaleBar" :scale="scaleBar" :context="fixedLayout ? scaleCaption : undefined" />
    <div class="administrative-controls"><button type="button" @click="overview">{{ t('resetView') }}</button></div>
    <div class="administrative-attribution">
      <a :href="mapData.attribution.url" target="_blank" rel="noopener noreferrer">{{ t(mapData.attribution.label) }}</a>
      <template v-if="mapData.badgeSourcesUrl"> · <a :href="mapData.badgeSourcesUrl" target="_blank" rel="noopener noreferrer">{{ t('stateFlagSources') }}</a></template>
    </div>
  </div>
</template>

<style scoped>
.administrative-game { position: absolute; inset: 0; overflow: hidden; background: var(--map-ocean); }
.administrative-context { fill: var(--map-context-land); stroke: var(--map-context-border); stroke-width: 0.6; pointer-events: none; }
.administrative-context path { vector-effect: non-scaling-stroke; }
.administrative-map { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
.administrative { fill: transparent; stroke: var(--map-border); stroke-width: 0.8; vector-effect: non-scaling-stroke; cursor: pointer; outline: none; }
.administrative-game--canvas .administrative { fill: transparent; stroke: none; pointer-events: all; }
.administrative-game .administrative--selected { fill: #efe3c9; stroke: var(--map-border); }
.administrative-game .administrative--question { fill: #f5dfa0; stroke: var(--map-border); }
.administrative-game .administrative--correct { fill: #cce5c9; stroke: #287247; }
.administrative-game .administrative--wrong { fill: #f0c8bd; stroke: #b73f2c; }
.administrative-marker { fill: transparent; stroke: var(--map-border); stroke-width: 1.5; vector-effect: non-scaling-stroke; cursor: pointer; outline: none; }
.administrative-game--dragging .administrative-map, .administrative-game--dragging .administrative, .administrative-game--dragging .administrative-marker { cursor: grabbing; }
:global(html[data-input-modality='keyboard']) .administrative:focus-visible { outline: none; stroke: var(--ui-focus); stroke-width: 3; }
@media (hover: hover) { .administrative-game .administrative:not(.administrative--correct):not(.administrative--wrong):hover { fill: #f5edda; stroke: var(--map-border); } }
.administrative-card-header { display: grid; grid-template-columns: var(--ui-card-flag-width) minmax(0, 1fr); gap: var(--ui-card-column-gap); align-items: start; }
.administrative-controls { position: absolute; right: 1rem; bottom: 2.5rem; }
.administrative-controls button, .administrative-load-error button { min-height: var(--ui-control-height); padding: 0.45rem 0.7rem; border: 1px solid var(--ui-border); border-radius: var(--ui-radius-control); color: var(--ui-ink); background: var(--ui-panel); font: inherit; cursor: pointer; }
.administrative-attribution { position: absolute; right: 0.5rem; bottom: 0.3rem; left: 0.5rem; width: fit-content; max-width: calc(100% - 1rem); padding: 0.15rem 0.3rem; border-radius: var(--ui-radius-small); background: var(--ui-panel); color: var(--ui-text); font-size: 0.65rem; }
.administrative-inset rect { fill: none; stroke: var(--map-context-border); stroke-width: 0.7; vector-effect: non-scaling-stroke; }
.administrative-inset text { fill: var(--ui-muted); font-family: var(--ui-font); paint-order: stroke; stroke: var(--map-ocean); }
.administrative-load-error { position: absolute; right: 1rem; top: 1rem; z-index: 5; background: var(--ui-panel); padding: 0.5rem; }
</style>
