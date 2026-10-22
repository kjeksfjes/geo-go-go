<script setup lang="ts">
import { geoArea, geoDistance } from 'd3-geo'
import packageInfo from '../../package.json'
import { createGestureDiagnostics, type GestureWorkerEvent, type GestureWheelInput } from '../logic/gestureDiagnostics'
import { copyText } from '../utils/copyText'
import { sharedMapViewHash, type SharedMapView } from '../logic/sharedMapView'
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, toRef, useId, watch } from 'vue'
import type { MarineLabelPath } from '../data/marineLabelPaths'
import type { MarineLabel } from '../data/marineLabels'
import MapSettingsPanel from './MapSettingsPanel.vue'
import CanvasMap from './CanvasMap.vue'
import LoadingIndicator from './LoadingIndicator.vue'
import MapDebugPanel from './MapDebugPanel.vue'
import MarineLabels from './MarineLabels.vue'
import MapScaleBar from './MapScaleBar.vue'
import SmallCountryMarkers from './SmallCountryMarkers.vue'
import { useElementSize } from '../composables/useElementSize'
import {
  projectionOptions,
  useMapProjection,
  type MapProjectionId,
  type ProjectionDebugState,
} from '../composables/useMapProjection'
import {
  useMapZoom,
  PREFERRED_COUNTRY_FOCUS_SCALE,
  type MapBounds,
  type MapHomeView,
  type MapPoint,
  type MapViewConstraint,
  type ZoomToBoundsOptions,
} from '../composables/useMapZoom'
import type { GeographicUnitFeature } from '../types/country'
import type { CanvasMapScene } from '../types/mapCanvas'
import { quizEntityIdsByRegion, type MapRegion, type MapRegionId } from '../data/regions'
import { loadBathymetryBands, type BathymetryBand } from '../data/bathymetry'
import { loadReliefBands, type ReliefBand } from '../data/relief'
import { afterPaint, wait } from '../utils/paint'
import { canShowCountryTooltip } from '../utils/countryTooltipVisibility'
import { readStoredBoolean, readStoredValue, writeStoredValue } from '../utils/storage'
import { componentName, countryName, regionName, t, type Locale } from '../i18n'
import { componentInfoById } from '../data/countries'
import { supplementalAreaInfoByDisplayId } from '../data/supplementalLand'
import { quizMergedSourceIds } from '../data/quizMap'
import { mapPaletteCssVariables } from '../data/mapPalette'
import { mapSettingKeys } from '../logic/mapSettings'
import { mapScaleBar, scaleUnitSystems, type ScaleUnitSystem } from '../logic/mapScale'
import type { QuizTipAction } from '../logic/quizTips'
import { quizCountryIds } from '../data/quizCountries'
import {
  backgroundClickAction,
  canActivateGeographicUnit,
  countryClickAction,
  geographicUnitClasses as classesForUnit,
  hasVisualHighlight,
  isPrimarySelectedExploreUnit as isPrimaryExploreUnit,
  type MapInteractionState,
} from '../logic/mapInteraction'
import { selectionFocusTarget } from '../logic/mapFocus'
import { wrappedMapPath } from '../logic/wrappedMapPath'
import { mergeQuestionMarkerRings } from '../logic/questionMarkerRings'
import {
  smallCountryMarkers as groupSmallCountryMarkers,
  type SmallCountryAnchor,
  type SmallCountryFeedbackMarker,
  type SmallCountryMarker,
} from '../logic/smallCountryMarkers'

const COUNTRY_MARKER_MIN_ZOOM = 2
const MARKER_DISTRIBUTION_MS = 200
const MARKER_STAGGER_MS = 120

function initialProjection(): MapProjectionId {
  const saved = readStoredValue(mapSettingKeys.projection)
  return projectionOptions.some(({ id }) => id === saved) ? saved as MapProjectionId : 'mercator'
}

function initialScaleUnits(): ScaleUnitSystem {
  const saved = readStoredValue(mapSettingKeys.scaleUnits)
  return scaleUnitSystems.find((units) => units === saved) ?? 'metric'
}

const props = defineProps<{
  sharedView: SharedMapView | null
  focusOverlay: HTMLElement | null
  geographicUnits: GeographicUnitFeature[]
  detailedGeographicUnits: GeographicUnitFeature[] | null
  detailLoading: boolean
  detailBlurred: boolean
  highDetailEnabled: boolean
  settingsOpen: boolean
  quizTipsEnabled: boolean
  locale: Locale
  activeRegion: MapRegion
  selectedRegionId: MapRegionId
  selectedCountryId: string | null
  selectedGeographicUnitId: string | null
  selectedLandAreaId: string | null
  quizMode: boolean
  nameCountryQuiz: boolean
  quizViewingGuess: boolean
  suggestAllCountries: boolean
  automaticAnswerReveal: boolean
  quizSkipped: boolean
  correctAnswerVisible: boolean
  quizComplete: boolean
  quizQuestionId: string | null
  quizAnswerId: string | null
  alwaysShowWrongAnswer: boolean
  visibleMapUnitIds: ReadonlySet<string>
}>()

const emit = defineEmits<{
  'shared-view-applied': []
  select: [countryId: string | null, geographicUnitId: string | null]
  'land-select': [id: string | null]
  'quiz-next': []
  'tip-action': [action: QuizTipAction]
  'quiz-tips-enabled-change': [enabled: boolean]
  'quiz-tips-reset': []
  'view-busy-change': [busy: boolean]
  'focus-answer': []
  'detail-change': [enabled: boolean, pathsCached: boolean]
  'locale-change': [locale: Locale]
  'reset-settings': []
  'suggest-all-countries-change': [value: boolean]
  'wrong-answer-preference-change': [value: boolean]
  'automatic-answer-reveal-change': [value: boolean]
}>()

const container = ref<HTMLElement | null>(null)
const svg = ref<SVGSVGElement | null>(null)
const mapContent = ref<SVGGElement | null>(null)
const projectionId = ref<MapProjectionId>(initialProjection())
const autoRegionalProjection = ref(readStoredBoolean(mapSettingKeys.autoRegionalProjection, false))
const savedGlobalProjection = readStoredValue(mapSettingKeys.globalProjection)
const globalProjectionId = ref<MapProjectionId>(
  projectionOptions.some(({ id }) => id !== 'regional-equal-area' && id === savedGlobalProjection)
    ? savedGlobalProjection as MapProjectionId
    : projectionId.value !== 'regional-equal-area' ? projectionId.value : 'mercator',
)
const pendingAutoProjection = ref<MapProjectionId | null>(null)
let pendingProportionalTransition = false
// Hold the displayed geography until the proportional-region switch is blurred.
const renderedRegion = shallowRef(props.activeRegion)
const renderedMapUnitIds = shallowRef(props.visibleMapUnitIds)
const usesMobileMapDefaults = window.matchMedia('(hover: none) and (pointer: coarse)').matches
const bathymetryEnabled = ref(readStoredBoolean(mapSettingKeys.bathymetry, !usesMobileMapDefaults))
const reliefEnabled = ref(readStoredBoolean(mapSettingKeys.relief, false))
const bathymetryLoading = ref(false)
const reliefLoading = ref(false)
const bathymetryBands = shallowRef<readonly BathymetryBand[]>([])
const reliefBands = shallowRef<readonly ReliefBand[]>([])
const marineLabelsEnabled = ref(readStoredBoolean(mapSettingKeys.marineLabels, true))
const scaleBarEnabled = ref(readStoredBoolean(mapSettingKeys.scaleBar, true))
const scaleUnits = ref<ScaleUnitSystem>(initialScaleUnits())
const countryMarkersEnabled = ref(readStoredBoolean(mapSettingKeys.countryMarkers, true))
const limitedCountryZoomEnabled = ref(readStoredBoolean(mapSettingKeys.limitedCountryZoom, true))
// Keep the SVG renderer available for a direct performance comparison.
const canvasRendererEnabled = new URLSearchParams(window.location.search).get('renderer') !== 'svg'
const WaterLabelEditor = import.meta.env.DEV
  ? defineAsyncComponent(() => import('../dev/WaterLabelEditor.vue')) : undefined
const waterEditorEnabled = import.meta.env.DEV && new URLSearchParams(window.location.search).has('water-editor')
const waterEditorPlacements = shallowRef<Record<string, MarineLabelPath> | undefined>()
const waterEditorLabels = shallowRef<MarineLabel[] | undefined>()
const waterEditorSelectedId = ref('')
const waterEditorPlacementIndex = ref(0)
const waterEditorEditing = ref(false)
const waterEditorWarning = ref('')
const waterEditorFontSize = shallowRef<{ id: string; size: number; pixels: number; placementIndex: number } | null>(null)
const canvasReady = ref(false)
const canvasContextKind = ref('unavailable')
const fastTouchZoomPreview = ref(false)
const restoringTouchDetail = ref(false)
const canvasRendererActive = computed(() => canvasRendererEnabled && canvasReady.value)
watch(countryMarkersEnabled, (value) => writeStoredValue(mapSettingKeys.countryMarkers, value))
watch(autoRegionalProjection, (value) => writeStoredValue(mapSettingKeys.autoRegionalProjection, value))
watch(globalProjectionId, (value) => writeStoredValue(mapSettingKeys.globalProjection, value))
watch(projectionId, (value) => writeStoredValue(mapSettingKeys.projection, value))
watch(limitedCountryZoomEnabled, (value) => writeStoredValue(mapSettingKeys.limitedCountryZoom, value))
watch(bathymetryEnabled, (value) => writeStoredValue(mapSettingKeys.bathymetry, value))
watch(reliefEnabled, (value) => writeStoredValue(mapSettingKeys.relief, value))
watch(marineLabelsEnabled, (value) => writeStoredValue(mapSettingKeys.marineLabels, value))
watch(scaleBarEnabled, (value) => writeStoredValue(mapSettingKeys.scaleBar, value))
watch(scaleUnits, (value) => writeStoredValue(mapSettingKeys.scaleUnits, value))
const reliefClipId = `relief-land-${useId()}`
const waterNamePointerPressed = ref(false)
let waterNamePointerId: number | null = null
const hoveredUnit = ref<{ id: string; entityId: string } | null>(null)
const interactionState = computed<MapInteractionState>(() => ({
  selectedCountryId: props.selectedCountryId,
  selectedGeographicUnitId: props.selectedGeographicUnitId,
  hoveredEntityId: hoveredUnit.value?.entityId ?? null,
  quizMode: props.quizMode,
  quizSkipped: props.quizSkipped,
  nameCountryQuiz: props.nameCountryQuiz,
  quizComplete: props.quizComplete,
  quizQuestionId: props.quizQuestionId,
  quizAnswerId: props.quizAnswerId,
}))
const highlightRevision = ref(0)
const projectionLoading = ref(false)
const projectionBlurred = ref(false)
const projectionBlurDuration = ref(280)
const projectionSnapshot = ref<HTMLElement | null>(null)
const projectionSnapshotFading = ref(false)
const debugEnabled = new URLSearchParams(window.location.search).has('debug')
const gestureDebugEnabled = new URLSearchParams(window.location.search).has('gesture-debug')
// The user accepted this preview policy on desktop Firefox. Keep it independent
// of diagnostics and preserve the existing policies on other browsers/devices.
const firefoxPreviewEnabled = window.matchMedia('(hover: hover) and (pointer: fine)').matches
  && /Firefox\/\d/.test(navigator.userAgent)
interface MapDebugVerticalFit {
  span: number
  topGap: number
  bottomGap: number
}
interface MapDebugMetrics {
  zoom: number
  countryFocus: string
  center: MapPoint | null
  regionVerticalFit: MapDebugVerticalFit | null
  selectionVerticalFit: MapDebugVerticalFit | null
  region: string
  projection: string
  detail: string
  renderer: string
  width: number
  height: number
  pixelRatio: number
  bathymetry: boolean
  relief: boolean
  waterNames: boolean
  gesture: string
  paths: ProjectionDebugState | null
}
const debugMetrics = shallowRef<MapDebugMetrics | null>(null)
let debugTimer: number | undefined
let compatibilityClickTimer: number | undefined
let hoverRestoreFrame: number | undefined
let lastHoverPointer: { clientX: number; clientY: number } | null = null
let suppressCompatibilityClick = false
const interactionLocked = computed(() => props.detailLoading || projectionLoading.value)
const mapBlurred = computed(() => props.detailBlurred || projectionBlurred.value)
watch(
  () => [props.activeRegion, props.visibleMapUnitIds, props.selectedRegionId] as const,
  ([region, mapUnitIds, selectedId], previous) => {
    if (autoRegionalProjection.value && (projectionLoading.value || selectedId !== previous?.[2])) return
    renderedRegion.value = region
    renderedMapUnitIds.value = mapUnitIds
  },
)
const { width: measuredWidth, height: measuredHeight } = useElementSize(container)
const mapWidth = computed(() => Math.max(measuredWidth.value, 320))
const mapHeight = computed(() => Math.max(measuredHeight.value, 280))
const {
  backgroundLandPaths,
  bathymetryPaths,
  contextGeographicPaths,
  disputedBoundaryPaths,
  geographicPaths,
  hasCachedPaths,
  horizontalWrap,
  interactionGeographicPaths,
  projectPoint,
  projectGeometry,
  questionLandmassAnchors,
  projectionDebug,
  projectionScale,
  reliefClipPath,
  reliefPaths,
  spherePath,
  supplementalLandPaths,
  supplementalExploreLandPaths,
  unprojectPoint,
  worldVerticalBounds,
} = useMapProjection(
  toRef(props, 'geographicUnits'),
  mapWidth,
  mapHeight,
  projectionId,
  renderedRegion,
  renderedMapUnitIds,
  bathymetryBands,
  reliefBands,
  toRef(props, 'quizMode'),
)
const visibleSupplementalLandPaths = computed(() => props.quizMode
  ? supplementalLandPaths.value.filter((area) => !quizMergedSourceIds.has(area.id))
  : supplementalExploreLandPaths.value,
)
const regionViewConstraint = computed<MapViewConstraint | null>(() => {
  if (renderedRegion.value.id === 'world') return null
  if (projectionId.value !== 'regional-equal-area') {
    const view = renderedRegion.value.view
    const center = view && projectPoint(view.center)
    if (!view || !center) return null
    // Start with the existing regional envelope. Expand it only to the
    // region's quiz-country focus points, so distant source pieces cannot
    // open the whole world while legitimate questions remain reachable.
    const reach = view.panReach ?? 0.45
    const radiusX = mapWidth.value * reach / view.zoom
    const radiusY = mapHeight.value * reach / view.zoom
    let left = center[0] - radiusX, right = center[0] + radiusX
    let top = center[1] - radiusY, bottom = center[1] + radiusY
    const paddingX = mapWidth.value * 0.25 / view.zoom
    const paddingY = mapHeight.value * 0.25 / view.zoom
    const regionCountries = quizEntityIdsByRegion.get(renderedRegion.value.id)
    const candidatesByCountry = new Map<string, typeof interactionGeographicPaths.value>()
    for (const candidate of interactionGeographicPaths.value) {
      const id = candidate.unit.properties.entityId
      if (!candidate.path || !quizCountryIds.has(id) || !regionCountries?.has(id) || !isGeographicUnitVisible(candidate.unit)) continue
      const candidates = candidatesByCountry.get(id) ?? []
      candidates.push(candidate)
      candidatesByCountry.set(id, candidates)
    }
    for (const [id, candidates] of candidatesByCountry) {
      const main = candidates.find(({ unit }) => unit.id === `entity:${id}`)
        ?? candidates.reduce((largest, candidate) => geoArea(candidate.unit) > geoArea(largest.unit) ? candidate : largest)
      const target = selectionFocusTarget(main.unit.id, main.bounds, main.focusPoint,
        interactionGeographicPaths.value, renderedMapUnitIds.value, 0)
      let x = target.focusPoint?.[0] ?? (target.bounds[0][0] + target.bounds[1][0]) / 2
      const y = target.focusPoint?.[1] ?? (target.bounds[0][1] + target.bounds[1][1]) / 2
      if (![x, y].every(Number.isFinite)) continue
      const wrap = horizontalWrap.value
      if (wrap) x += Math.round((center[0] - x) / wrap.period) * wrap.period
      left = Math.min(left, x - paddingX)
      right = Math.max(right, x + paddingX)
      top = Math.min(top, y - paddingY)
      bottom = Math.max(bottom, y + paddingY)
    }
    return {
      minScale: Math.max(1.15, view.zoom * 0.8),
      bounds: [[left, top], [right, bottom]],
    }
  }

  // A regional projection is already fitted to the region at scale one. Its
  // displayed (not global source) geometry defines where its camera may pan.
  const visiblePaths = interactionGeographicPaths.value.filter(({ unit }) => isGeographicUnitVisible(unit))
  if (!visiblePaths.length) return null
  const left = Math.min(...visiblePaths.map(({ displayBounds }) => displayBounds[0][0]))
  const top = Math.min(...visiblePaths.map(({ displayBounds }) => displayBounds[0][1]))
  const right = Math.max(...visiblePaths.map(({ displayBounds }) => displayBounds[1][0]))
  const bottom = Math.max(...visiblePaths.map(({ displayBounds }) => displayBounds[1][1]))
  if (![left, top, right, bottom].every(Number.isFinite)) return null
  return {
    minScale: 1,
    bounds: [
      [left - mapWidth.value * 0.2, top - mapHeight.value * 0.2],
      [right + mapWidth.value * 0.2, bottom + mapHeight.value * 0.2],
    ],
  }
})
const homeView = computed<MapHomeView | null>(() => {
  if (projectionId.value === 'regional-equal-area') {
    const view = !usesMobileMapDefaults ? renderedRegion.value.regionalDesktopView : undefined
    const point = view && projectPoint(view.center)
    return view && point ? { point, scale: view.zoom } : null
  }

  const regionalView = renderedRegion.value.view
  const center = regionalView?.center
    ?? (usesMobileMapDefaults && renderedRegion.value.id === 'world' ? [24, 31] as const : null)
  const point = center && projectPoint(center)
  if (!point) return null
  return {
    point,
    scale: regionalView?.zoom ?? 3,
  }
})
function geographicUnitClasses(unit: GeographicUnitFeature) {
  return classesForUnit(unit, interactionState.value)
}

function isPrimarySelectedExploreUnit(unit: GeographicUnitFeature) {
  return isPrimaryExploreUnit(unit, interactionState.value)
}

function isGeographicUnitVisible(unit: GeographicUnitFeature) {
  const regional = unit.regionalDisplayGeometry?.[renderedRegion.value.id]?.geometry
  if (regional?.type === 'GeometryCollection' && regional.geometries.length === 0) return false
  return unit.properties.mapUnitIds.some((id) => renderedMapUnitIds.value.has(id))
}
const {
  transform,
  consumeDragClick,
  endPan,
  isDragging,
  isPinching,
  isWheeling,
  isAnimating,
  isInteracting,
  isZoomed,
  movePan,
  resetZoom,
  startPan,
  updateTouches,
  wrapActive,
  wrapNeighborDirection,
  zoomFromWheel,
  zoomToBounds,
  zoomToPoint,
} = useMapZoom(
  mapWidth,
  mapHeight,
  mapContent,
  horizontalWrap,
  regionViewConstraint,
  homeView,
  worldVerticalBounds,
  firefoxPreviewEnabled,
)

watch([interactionLocked, isInteracting], ([locked, moving]) => emit('view-busy-change', locked || moving), { immediate: true })

function focusWaterEditor(points: MapPoint[]) {
  const projected = points.map(projectPoint).filter((p): p is MapPoint => !!p && p.every(Number.isFinite))
  if (projected.length < 2 || interactionLocked.value) return
  const period = horizontalWrap.value?.period
  if (period) for (const point of projected) point[0] += Math.round((projected[0]![0] - point[0]) / period) * period
  const xs = projected.map(p => p[0]), ys = projected.map(p => p[1])
  const width = mapWidth.value > 700 ? mapWidth.value - 340 : mapWidth.value
  zoomToBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], undefined,
    { viewport: [[0, 0], [Math.max(200, width), mapHeight.value]] })
}

const gestureDiagnosticsActive = ref(false)
const lastGestureReport = shallowRef<Record<string, unknown> | null>(null)
const gestureCopyState = ref<'idle' | 'copied' | 'failed'>('idle')
let gestureRecorder: ReturnType<typeof createGestureDiagnostics> | null = null
let gestureFrame: number | undefined
let gestureSettleTimer: number | undefined
let gestureCopyTimer: number | undefined
let gestureLongTaskObserver: PerformanceObserver | null = null
let gestureLongTasksAvailable = false
const gestureLongTasksSupported = typeof PerformanceObserver !== 'undefined'
  && PerformanceObserver.supportedEntryTypes?.includes('longtask') === true

type DiagnosticMovement = 'pinch' | 'pan' | 'wheel' | 'animation'
let diagnosticInput: { startedAt: number; initial: ReturnType<typeof gestureSample>; source: 'touch' | 'pointer' | 'wheel'; cancelled: boolean } | null = null
let pendingPanStartup: {
  downAt: number
  timings: {
    pointerDownEventAgeMs: number | null
    pointerDownHandlerMs: number | null
    pointerDownToFirstMoveMs: number | null
    firstMoveEventAgeMs: number | null
    pointerDownToDragStartMs: number | null
    dragStartHandlerMs: number | null
    pointerDownToFirstTransformMs: number | null
    pointerDownToFirstRafMs: number | null
  }
} | null = null

function inputEventAge(event: PointerEvent, now: number) {
  const age = now - event.timeStamp
  // Accept only a compatible monotonic event timestamp, not an epoch clock.
  return age >= 0 && age < 60_000 ? Math.round(age * 100) / 100 : null
}

function withGestureInput<T>(source: 'touch' | 'pointer' | 'wheel', action: () => T, cancelled = false, wheel?: GestureWheelInput): T {
  if (!gestureDebugEnabled) return action()
  const startedAt = performance.now()
  diagnosticInput = { startedAt, initial: gestureSample(), source, cancelled }
  try { return action() } finally {
    gestureRecorder?.input(performance.now() - startedAt, wheel)
    diagnosticInput = null
  }
}

function gestureSample() {
  return { scale: transform.scale, x: transform.x, y: transform.y, canvas: canvasRendererActive.value, preview: fastTouchZoomPreview.value }
}

function captureGestureReport() {
  if (gestureFrame !== undefined) cancelAnimationFrame(gestureFrame)
  gestureFrame = undefined
  if (gestureSettleTimer !== undefined) window.clearTimeout(gestureSettleTimer)
  gestureSettleTimer = undefined
  for (const entry of gestureLongTaskObserver?.takeRecords() ?? []) gestureRecorder?.longTask(entry.startTime, entry.duration)
  gestureLongTaskObserver?.disconnect()
  gestureLongTaskObserver = null
  if (gestureRecorder) lastGestureReport.value = {
    ...gestureRecorder.report(performance.now(), gestureLongTasksAvailable),
    finalRendering: { renderer: canvasRendererActive.value ? 'Canvas worker' : 'SVG', canvasContext: canvasContextKind.value, viewportWidth: mapWidth.value, viewportHeight: mapHeight.value },
  }
  gestureRecorder = null
  gestureDiagnosticsActive.value = false
}

function beginGestureReport(now: number, gesture: DiagnosticMovement, initial = gestureSample()) {
  captureGestureReport()
  gestureCopyState.value = 'idle'
  const startup = gesture === 'pan' && diagnosticInput?.source === 'pointer' ? pendingPanStartup : null
  if (startup) startup.timings.pointerDownToDragStartMs = Math.round((now - startup.downAt) * 100) / 100
  gestureRecorder = createGestureDiagnostics({
    appVersion: packageInfo.version,
    gesture,
    panStartup: startup?.timings,
    inputSource: gesture === 'animation' ? 'automatic' : diagnosticInput?.source ?? (gesture === 'wheel' ? 'wheel' : 'touch'),
    recordedAt: new Date().toISOString(),
    browser: navigator.userAgent,
    viewport: { width: mapWidth.value, height: mapHeight.value, devicePixelRatio: window.devicePixelRatio },
    map: { renderer: canvasRendererActive.value ? 'Canvas worker' : 'SVG', canvasContext: canvasContextKind.value, detail: props.highDetailEnabled ? '10m' : '50m', projection: projectionId.value, region: renderedRegion.value.id, mode: props.nameCountryQuiz ? 'name-country' : props.quizMode ? 'find-country' : 'explore', bathymetry: bathymetryEnabled.value, relief: reliefEnabled.value, countryPaths: geographicPaths.value.length, highlightPaths: highlightedGeographicPaths.value.length },
    renderingPolicy: {
      firefoxPreview: firefoxPreviewEnabled,
      previewPixelRatio: firefoxPreviewEnabled ? 0.75 : null,
      previewOverscan: firefoxPreviewEnabled ? 3 : null,
      panRefreshMargin: firefoxPreviewEnabled ? 0.3 : 0.08,
      zoomPreviewMaxMagnification: firefoxPreviewEnabled ? 3.5 : 2,
      zoomPreviewReuseWindowMs: firefoxPreviewEnabled ? 1000 : null,
      omitMovingBorders: false,
      omitMovingHighlightStrokes: false,
      retainedWrappedHitCopies: firefoxPreviewEnabled,
    },
  }, now, initial)
  gestureDiagnosticsActive.value = true
  gestureLongTasksAvailable = false
  if (gestureLongTasksSupported) {
    try {
      gestureLongTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) gestureRecorder?.longTask(entry.startTime, entry.duration)
      })
      gestureLongTaskObserver.observe({ type: 'longtask' })
      gestureLongTasksAvailable = true
    } catch {
      gestureLongTaskObserver?.disconnect()
      gestureLongTaskObserver = null
    }
  }
  const sample = (time: number) => {
    if (startup && startup.timings.pointerDownToFirstRafMs === null) {
      startup.timings.pointerDownToFirstRafMs = Math.round((performance.now() - startup.downAt) * 100) / 100
    }
    gestureRecorder?.frame(time, gestureSample())
    gestureFrame = requestAnimationFrame(sample)
  }
  gestureFrame = requestAnimationFrame(sample)
}

function endGestureReport(now: number, cancelled = false) {
  if (!gestureRecorder) return
  if (gestureFrame !== undefined) cancelAnimationFrame(gestureFrame)
  gestureFrame = undefined
  gestureRecorder?.finish(now, gestureSample(), cancelled)
  // Include the final worker replies without recording an unrelated later gesture.
  gestureSettleTimer = window.setTimeout(captureGestureReport, 300)
}

const diagnosticMovement = computed<DiagnosticMovement | null>(() =>
  isPinching.value ? 'pinch' : isDragging.value ? 'pan' : isWheeling.value ? 'wheel' : isAnimating.value ? 'animation' : null,
)
watch(diagnosticMovement, (movement, previous) => {
  if (!gestureDebugEnabled || movement === previous) return
  const now = performance.now()
  if (previous) {
    if (diagnosticInput) gestureRecorder?.input(now - diagnosticInput.startedAt)
    endGestureReport(now, diagnosticInput?.cancelled ?? movement !== null)
  }
  if (movement) beginGestureReport(diagnosticInput?.startedAt ?? now, movement, diagnosticInput?.initial ?? gestureSample())
}, { flush: 'sync' })

function recordGestureRender(event: GestureWorkerEvent) { gestureRecorder?.worker(event) }

// Record every edge, including changes that occur between sampled RAF callbacks.
watch(fastTouchZoomPreview, (active) => gestureRecorder?.transition('preview', active, performance.now()), { flush: 'sync' })
watch(canvasRendererActive, (active) => gestureRecorder?.transition('renderer', active, performance.now()), { flush: 'sync' })

async function copyLastGesture() {
  if (!lastGestureReport.value || gestureDiagnosticsActive.value) return
  const text = `Geo Go Go — last ${String(lastGestureReport.value.gesture)}\n${JSON.stringify(lastGestureReport.value, null, 2)}`
  gestureCopyState.value = await copyText(text) ? 'copied' : 'failed'
  if (gestureCopyTimer !== undefined) window.clearTimeout(gestureCopyTimer)
  gestureCopyTimer = window.setTimeout(() => { gestureCopyState.value = 'idle'; gestureCopyTimer = undefined }, 1600)
}

const scaleBar = computed(() => {
  if (!scaleBarEnabled.value) return null
  // A map projection has a local scale, not one fixed scale across the world.
  // Sample a short horizontal span around the screen centre for a stable
  // reference through pan, zoom, projection, and viewport changes.
  const sampleWidth = Math.min(80, mapWidth.value * 0.2)
  const y = mapHeight.value / 2
  const geographicPoints = [-sampleWidth / 2, sampleWidth / 2].map((offset) =>
    unprojectPoint([
      (mapWidth.value / 2 + offset - transform.x) / transform.scale,
      (y - transform.y) / transform.scale,
    ]),
  )
  const [left, right] = geographicPoints
  if (!left || !right || !left.every(Number.isFinite) || !right.every(Number.isFinite)) return null
  const kilometresPerPixel = geoDistance(left, right) * 6371.0088 / sampleWidth
  return mapScaleBar(kilometresPerPixel, mapWidth.value, scaleUnits.value, props.locale)
})

function updateDebugMetrics() {
  const projectedCenter: MapPoint = [
    (mapWidth.value / 2 - transform.x) / transform.scale,
    (mapHeight.value / 2 - transform.y) / transform.scale,
  ]
  const unprojected = unprojectPoint(projectedCenter)
  const center = unprojected?.every(Number.isFinite)
    ? [((unprojected[0] + 180) % 360 + 360) % 360 - 180, unprojected[1]] as MapPoint
    : null
  const projection = projectionId.value === 'regional-equal-area'
    ? t('regionalEqualArea')
    : projectionOptions.find(({ id }) => id === projectionId.value)?.label ?? projectionId.value
  const gesture = isPinching.value
    ? 'Pinching'
    : isDragging.value
      ? 'Dragging'
      : isWheeling.value
        ? 'Wheel zoom'
        : isAnimating.value
          ? 'Animating'
          : 'Idle'
  const visibleRegionPaths = geographicPaths.value.filter(({ unit }) => isGeographicUnitVisible(unit))
  const regionBounds: MapBounds | null = visibleRegionPaths.length
    ? [
        [
          Math.min(...visibleRegionPaths.map(({ displayBounds }) => displayBounds[0][0])),
          Math.min(...visibleRegionPaths.map(({ displayBounds }) => displayBounds[0][1])),
        ],
        [
          Math.max(...visibleRegionPaths.map(({ displayBounds }) => displayBounds[1][0])),
          Math.max(...visibleRegionPaths.map(({ displayBounds }) => displayBounds[1][1])),
        ],
      ]
    : null
  const selectedPath = props.selectedGeographicUnitId
    ? geographicPaths.value.find(({ unit }) =>
        unit.id === props.selectedGeographicUnitId && isGeographicUnitVisible(unit),
      )
    : undefined
  const selectionBounds = selectedPath
    ? selectionFocusTarget(
        selectedPath.unit.id,
        selectedPath.bounds,
        selectedPath.focusPoint,
        geographicPaths.value,
        renderedMapUnitIds.value,
        0,
      ).bounds
    : null

  function verticalFit(bounds: MapBounds | null): MapDebugVerticalFit | null {
    if (!bounds) return null
    const top = bounds[0][1] * transform.scale + transform.y
    const bottom = bounds[1][1] * transform.scale + transform.y
    return {
      span: (bottom - top) / mapHeight.value,
      topGap: top / mapHeight.value,
      bottomGap: (mapHeight.value - bottom) / mapHeight.value,
    }
  }

  debugMetrics.value = {
    zoom: transform.scale,
    countryFocus: limitedCountryZoomEnabled.value
      ? `Limited · ${PREFERRED_COUNTRY_FOCUS_SCALE.toFixed(2)}× preferred`
      : 'Fit to country',
    center,
    regionVerticalFit: verticalFit(regionBounds),
    selectionVerticalFit: verticalFit(selectionBounds),
    region: regionName(renderedRegion.value),
    projection,
    detail: `${props.highDetailEnabled ? '10m' : '50m'}${props.detailLoading ? ' · loading' : ''}`,
    renderer: canvasRendererActive.value ? 'Canvas worker' : 'SVG',
    width: mapWidth.value,
    height: mapHeight.value,
    pixelRatio: window.devicePixelRatio || 1,
    bathymetry: bathymetryEnabled.value,
    relief: reliefEnabled.value,
    waterNames: marineLabelsEnabled.value,
    gesture,
    paths: projectionDebug.value,
  }
}

// Reuse the active drawing paths for SVG hit targets in both renderers.
// Coarser hit geometry omits visible islands and disagrees with coastlines.
function geographicUnitLabel(unit: GeographicUnitFeature) {
  if (props.nameCountryQuiz && !props.quizComplete
    && ((props.quizAnswerId === null && !props.quizSkipped) || (!props.correctAnswerVisible && unit.properties.entityId === props.quizQuestionId))) return t('highlightedCountry')
  const component = unit.properties.componentId
    ? componentInfoById.get(unit.properties.componentId) : undefined
  const country = countryName(unit.properties.entityId)
  if (!component || props.quizMode) return country
  return component.sourceKind === 'leased-area'
    ? componentName(component) : `${componentName(component)} — ${country}`
}
const detailedGeographicPathById = computed(() => new Map(
  geographicPaths.value.map((projected) => [projected.unit.id, projected]),
))

// SVG paths paint in DOM order. Put related geographic units above ordinary
// countries, the clicked unit above its siblings, and correct above wrong.
const paintedGeographicPaths = computed(() => {
  const paths = geographicPaths.value
  const foregroundIds = props.quizMode
    ? (props.quizAnswerId === null ? (props.nameCountryQuiz ? [props.quizQuestionId] : []) : [props.quizAnswerId, props.quizQuestionId])
    : [props.selectedCountryId]
  if (!foregroundIds.some(Boolean)) return paths

  let ordered = [...paths]
  for (const id of foregroundIds) {
    if (!id) continue
    const foreground = ordered.filter(({ unit }) => unit.properties.entityId === id)
    ordered = ordered.filter(({ unit }) => unit.properties.entityId !== id)
    const selectedIndex = foreground.findIndex(({ unit }) => unit.id === props.selectedGeographicUnitId)
    if (selectedIndex >= 0 && selectedIndex < foreground.length - 1) {
      foreground.push(...foreground.splice(selectedIndex, 1))
    }
    ordered.push(...foreground)
  }
  return ordered
})
const highlightedGeographicPaths = computed(() => paintedGeographicPaths.value
  .filter(({ unit }) => isGeographicUnitVisible(unit) && hasVisualHighlight(unit, interactionState.value)))

const visibleLandPath = computed(() => geographicPaths.value
  .filter(({ unit }) => isGeographicUnitVisible(unit))
  .map(({ path }) => path)
  .concat(backgroundLandPaths.value.map(({ path }) => path))
  .join(' '))
const canvasScene = computed<CanvasMapScene>(() => ({
  coordinateKey: projectionId.value === 'regional-equal-area'
    ? `${projectionId.value}:${renderedRegion.value.id}` : projectionId.value,
  spherePath: spherePath.value,
  bathymetry: bathymetryEnabled.value ? bathymetryPaths.value : [],
  contextCountries: contextGeographicPaths.value,
  relief: reliefEnabled.value ? reliefPaths.value : [],
  reliefClipPath: reliefEnabled.value ? reliefClipPath.value : '',
  countries: [
    ...geographicPaths.value
      .filter(({ unit }) => isGeographicUnitVisible(unit))
      .map(({ unit, path, outlinePath, divisionPath, displayBounds }) => ({
        path, outlinePath, divisionPath, bounds: displayBounds,
        internalBoundary: !!unit.divisionGeometry,
      })),
    ...backgroundLandPaths.value.map(({ path, outlinePath, bounds }) => ({ path, outlinePath, bounds })),
  ],
}))
const canvasWrapOffset = computed(() => horizontalWrap.value?.period ?? null)

const visibleCopyCount = computed(() => {
  const period = horizontalWrap.value?.period
  return period ? Math.max(1, Math.ceil(mapWidth.value / (2 * transform.scale * period))) : 0
})
const needsBothNeighbors = computed(() => {
  const period = horizontalWrap.value?.period
  return period !== undefined && transform.scale * period < mapWidth.value
})

const copyOffsets = computed<number[]>((previous) => {
  const wrap = horizontalWrap.value
  let offsets: number[]
  if (!wrap) offsets = [0]
  // A narrow projected world can expose more than one repeat on very wide
  // screens. At closer zoom, only the neighbor toward the seam is needed.
  else if (!needsBothNeighbors.value) offsets = [0, wrapNeighborDirection.value * wrap.period]
  else {
    const count = visibleCopyCount.value
    offsets = [
      0,
      ...Array.from({ length: count }, (_, index) => -(index + 1) * wrap.period),
      ...Array.from({ length: count }, (_, index) => (index + 1) * wrap.period),
    ]
  }
  // Camera movement usually leaves the displayed copies unchanged. Reuse
  // their identity so child layers do not update just for a fresh array.
  return previous?.length === offsets.length && offsets.every((offset, index) => offset === previous[index])
    ? previous : offsets
})

const wrappedSpherePath = computed(() => wrappedMapPath(spherePath.value, copyOffsets.value))
const wrappedBathymetryPaths = computed(() => bathymetryPaths.value.map((band) => ({
  depth: band.depth,
  path: wrappedMapPath(band.path, copyOffsets.value),
})))

// Keep wrapped hit geometry mounted in desktop Firefox. Revealing
// a cached copy avoids parsing a new set of 10m paths mid-zoom or at a seam.
const hitCopyOffsets = computed<number[]>((previous) => {
  const wrap = horizontalWrap.value
  if (!firefoxPreviewEnabled || !wrap) return copyOffsets.value
  const count = Math.max(1, Math.ceil(mapWidth.value / (2 * wrap.period)))
  const offsets = [0,
    ...Array.from({ length: count }, (_, index) => -(index + 1) * wrap.period),
    ...Array.from({ length: count }, (_, index) => (index + 1) * wrap.period),
  ]
  return previous?.length === offsets.length && offsets.every((offset, index) => offset === previous[index])
    ? previous : offsets
})

const smallCountryAnchors = computed<SmallCountryAnchor[]>(() => {
  const byCountry = new Map<string, {
    unitId: string; x0: number; y0: number; x1: number; y1: number
  }>()
  for (const { unit, path, displayBounds } of geographicPaths.value) {
    const countryId = unit.properties.entityId
    if (!path || !quizCountryIds.has(countryId) || !isGeographicUnitVisible(unit)) continue
    const [[x0, y0], [x1, y1]] = displayBounds
    if (![x0, y0, x1, y1].every(Number.isFinite)) continue
    const previous = byCountry.get(countryId)
    byCountry.set(countryId, previous ? {
      unitId: previous.unitId,
      x0: Math.min(previous.x0, x0), y0: Math.min(previous.y0, y0),
      x1: Math.max(previous.x1, x1), y1: Math.max(previous.y1, y1),
    } : { unitId: unit.id, x0, y0, x1, y1 })
  }
  return [...byCountry].map(([countryId, bounds]) => ({
    countryId,
    unitId: bounds.unitId,
    x: (bounds.x0 + bounds.x1) / 2,
    y: (bounds.y0 + bounds.y1) / 2,
    width: bounds.x1 - bounds.x0,
    height: bounds.y1 - bounds.y0,
  }))
})

// Regional Equal Area is already fitted to a selected region at scale one.
// Global views need a closer camera before tiny-country helpers become useful.
const countryMarkersVisible = computed(() => countryMarkersEnabled.value && (
  transform.scale >= COUNTRY_MARKER_MIN_ZOOM
  || (projectionId.value === 'regional-equal-area' && renderedRegion.value.id !== 'world')
))
const quizSmallCountryMarkers = computed(() =>
  countryMarkersVisible.value && props.quizMode && !props.nameCountryQuiz && props.quizAnswerId === null && !props.quizSkipped && !props.quizComplete && !isInteracting.value
    ? groupSmallCountryMarkers(
        smallCountryAnchors.value, transform, copyOffsets.value, mapWidth.value, mapHeight.value,
      )
    : [],
)

const zoomTargetHighlights = shallowRef<SmallCountryMarker['targets']>([])
let pendingZoomTargets: SmallCountryMarker['targets'] = []
let zoomedMarkerQuestionId: string | null = null
let zoomHighlightTimer: number | undefined
const markerDistribution = shallowRef<{ marker: SmallCountryMarker; origin: MapPoint; progress: number; delays: number[] } | null>(null)
let markerDistributionFrame: number | undefined
let suppressMarkerTransitionTouch = false
function cancelMarkerDistribution() {
  if (markerDistributionFrame !== undefined) cancelAnimationFrame(markerDistributionFrame)
  markerDistributionFrame = undefined
  markerDistribution.value = null
  pendingZoomTargets = []
  zoomedMarkerQuestionId = null
}
const displayedQuizSmallCountryMarkers = computed(() => markerDistribution.value
  ? quizSmallCountryMarkers.value.filter((marker) => marker.key !== markerDistribution.value?.marker.key)
  : quizSmallCountryMarkers.value)
const distributingCountryDots = computed(() => {
  const distribution = markerDistribution.value
  if (!distribution) return []
  const elapsed = distribution.progress * (MARKER_DISTRIBUTION_MS + MARKER_STAGGER_MS)
  return distribution.marker.targets.map((target, index) => {
    const localProgress = Math.max(0, Math.min(1, (elapsed - distribution.delays[index]!) / MARKER_DISTRIBUTION_MS))
    const progress = 1 - (1 - localProgress) ** 3
    return {
      key: `${target.countryId}:${target.offset}`,
      x: transform.x + transform.scale * (distribution.origin[0] + progress * (target.x + target.offset - distribution.origin[0])),
      y: transform.y + transform.scale * (distribution.origin[1] + progress * (target.y - distribution.origin[1])),
    }
  })
})
function clearZoomTargetHighlights() {
  if (zoomHighlightTimer !== undefined) window.clearTimeout(zoomHighlightTimer)
  zoomHighlightTimer = undefined
  zoomTargetHighlights.value = []
}
function showZoomTargetHighlights() {
  if (props.quizMode && !props.nameCountryQuiz && !props.quizComplete && !props.quizSkipped
    && zoomedMarkerQuestionId === props.quizQuestionId && props.quizAnswerId === null) {
    clearZoomTargetHighlights()
    zoomTargetHighlights.value = pendingZoomTargets
    zoomHighlightTimer = window.setTimeout(clearZoomTargetHighlights, 3000)
  }
  pendingZoomTargets = []
  zoomedMarkerQuestionId = null
}
watch([() => props.quizQuestionId, () => props.quizAnswerId, () => renderedRegion.value.id, () => props.quizMode, () => props.nameCountryQuiz, () => props.quizSkipped, () => props.quizComplete, countryMarkersVisible, projectionId, mapWidth, mapHeight], () => {
  cancelMarkerDistribution()
  clearZoomTargetHighlights()
})
watch(isAnimating, (animating) => {
  if (!animating && zoomedMarkerQuestionId !== null) {
    markerDistribution.value = null
    showZoomTargetHighlights()
  }
})
watch(isInteracting, (active) => {
  if (active) clearZoomTargetHighlights()
})
const revealedCountryMarkers = computed<SmallCountryMarker[]>(() => {
  if (!countryMarkersVisible.value || isInteracting.value || !props.quizMode || props.nameCountryQuiz || props.quizSkipped || props.quizComplete || props.quizAnswerId !== null) return []
  // Only countries that no longer need a small-country target get a temporary selection dot.
  // Still-small countries retain their persistent selection/zoom controls.
  const stillSmall = new Set(quizSmallCountryMarkers.value.flatMap((marker) => marker.targets
    .map((target) => `${target.countryId}:${target.offset}`)))
  return zoomTargetHighlights.value.filter((target) => !stillSmall.has(`${target.countryId}:${target.offset}`))
    .map((target) => ({
      key: `revealed:${target.countryId}:${target.offset}`,
      x: transform.x + transform.scale * (target.x + target.offset),
      y: transform.y + transform.scale * target.y,
      targets: [target],
    })).filter(({ x, y }) => x >= 0 && x <= mapWidth.value && y >= 0 && y <= mapHeight.value)
})

const questionRingGroupingGap = ref(0)
const questionLocationRings = computed(() => {
  // These communicate the question itself, so keep them available at its
  // fitted zoom even when the general Find-the-country helpers are hidden.
  if (!countryMarkersEnabled.value || !props.nameCountryQuiz || props.quizAnswerId !== null
    || props.quizSkipped || props.quizComplete || isInteracting.value) return []
  const questionUnits = geographicPaths.value.filter(({ unit, path }) => path
    && unit.properties.entityId === props.quizQuestionId && isGeographicUnitVisible(unit))
  const anchors: SmallCountryAnchor[] = []
  const landmassRadii = new Map<string, number>()
  for (const { unit } of questionUnits) {
    const landmasses = questionLandmassAnchors(unit, transform.scale)
    if (landmasses === null) return []
    landmasses.forEach((point, index) => {
      const anchorId = `${unit.id}:landmass:${index}`
      landmassRadii.set(anchorId, point.radius * transform.scale)
      anchors.push({
        ...point,
        anchorId,
        countryId: props.quizQuestionId!,
        unitId: unit.id,
        // Eligibility was checked by land area, not the wide island-group bounds.
        width: 0,
        height: 0,
      })
    })
  }
  return groupSmallCountryMarkers(anchors, transform, copyOffsets.value, mapWidth.value, mapHeight.value, 0)
    .map((marker) => ({
      ...marker,
      // Enclose the actual landmass bounds, with ten pixels of clear space.
      radius: Math.max(14, ...marker.targets.map((target) => Math.hypot(target.screenX - marker.x, target.screenY - marker.y)
        + (landmassRadii.get(target.anchorId!) ?? 0) + 10)),
    }))
})

// Include the white outline in the overlap baseline; the slider adds extra room.
const namedQuestionMarkers = computed(() => mergeQuestionMarkerRings(questionLocationRings.value, 5 + questionRingGroupingGap.value))
function setQuestionRingGroupingGap(value: number) {
  if (Number.isFinite(value)) questionRingGroupingGap.value = Math.max(0, Math.min(80, value))
}

const quizFeedbackMarkers = computed<SmallCountryFeedbackMarker[]>(() => {
  if (!countryMarkersVisible.value || !props.quizMode || (props.quizAnswerId === null && !props.quizSkipped) || props.quizComplete || isInteracting.value) return []
  const answerIds = new Set([props.quizQuestionId, props.quizAnswerId])
  return groupSmallCountryMarkers(
    smallCountryAnchors.value.filter((anchor) => answerIds.has(anchor.countryId)),
    transform, copyOffsets.value, mapWidth.value, mapHeight.value,
  )
    .flatMap((marker) => marker.targets.map((target) => ({
      ...target,
      status: target.countryId === props.quizQuestionId ? 'correct' as const : 'wrong' as const,
    })))
    .sort((a, b) => Number(a.status === 'correct') - Number(b.status === 'correct'))
})

const wrappedGeographicPaths = computed(() => {
  const wrap = horizontalWrap.value
  const paths = new Map<number, typeof paintedGeographicPaths.value>()
  if (!wrap) return paths
  // Filter against every position the viewport can occupy at minimum zoom.
  // This stays cached while panning, rather than re-filtering on every frame.
  const halfReach = (wrap.period + mapWidth.value) / 2
  const left = wrap.centerX - halfReach
  const right = wrap.centerX + halfReach
  const count = Math.max(1, Math.ceil(mapWidth.value / (2 * wrap.period)))
  for (let index = -count; index <= count; index += 1) {
    if (index === 0) continue
    const offset = index * wrap.period
    paths.set(offset, paintedGeographicPaths.value.filter(({ displayBounds }) =>
      displayBounds[0][0] + offset <= right && displayBounds[1][0] + offset >= left,
    ))
  }
  return paths
})

function geographicPathsAt(offset: number) {
  if (offset === 0) return paintedGeographicPaths.value
  return wrappedGeographicPaths.value.get(offset) ?? []
}

function focusActiveRegion(animated: boolean, zoomOutFirst = false) {
  // Use the regional home view, including any configured desktop camera framing.
  if (projectionId.value === 'regional-equal-area') {
    resetZoom(animated)
    restoreHoverUnderPointer()
    return
  }
  const view = renderedRegion.value.view
  if (!view) {
    resetZoom(animated)
    restoreHoverUnderPointer()
    return
  }

  const point = projectPoint(view.center)
  if (point) zoomToPoint(point, view.zoom, animated, zoomOutFirst)
  restoreHoverUnderPointer()
}

function resetView() {
  cancelMarkerDistribution()
  emit('select', null, null)
  focusActiveRegion(true, true)
}

const viewCopyStatus = ref<'idle' | 'copied' | 'failed'>('idle')
let viewCopyTimer: number | undefined
function sharedViewSnapshot(): SharedMapView | null {
  const center = unprojectPoint([
    (mapWidth.value / 2 - transform.x) / transform.scale,
    (mapHeight.value / 2 - transform.y) / transform.scale,
  ])
  if (!center?.every(Number.isFinite)) return null
  return {
    lat: center[1], lon: ((center[0] + 180) % 360 + 360) % 360 - 180,
    zoom: transform.scale, region: renderedRegion.value.id, projection: projectionId.value,
  }
}
async function copyViewLink() {
  const view = sharedViewSnapshot()
  if (!view) return
  const url = new URL(window.location.href)
  url.hash = sharedMapViewHash(view)
  viewCopyStatus.value = await copyText(url.href) ? 'copied' : 'failed'
  if (viewCopyTimer !== undefined) window.clearTimeout(viewCopyTimer)
  viewCopyTimer = window.setTimeout(() => { viewCopyStatus.value = 'idle' }, 2500)
}

watch(
  () => renderedRegion.value.id,
  () => focusActiveRegion(!autoRegionalProjection.value && projectionId.value !== 'regional-equal-area'),
  { flush: 'post' },
)
watch(() => [props.quizMode, props.nameCountryQuiz], ([active]) => {
  hoveredUnit.value = null
  if (active) focusActiveRegion(!autoRegionalProjection.value, true)
}, { flush: 'post' })
watch([() => renderedRegion.value.id, () => props.geographicUnits], () => {
  hoveredUnit.value = null
})
watch([() => props.quizQuestionId, () => props.quizAnswerId], () => {
  hoveredUnit.value = null
})
watch(
  () => [props.nameCountryQuiz, props.quizViewingGuess, props.quizQuestionId, props.quizComplete, renderedRegion.value.id, props.geographicUnits, props.detailLoading, projectionId.value, mapWidth.value, mapHeight.value],
  async () => {
    if ((autoRegionalProjection.value && projectionLoading.value) || !props.nameCountryQuiz || props.quizComplete || !props.quizQuestionId || props.detailLoading) return
    await nextTick()
    const targetId = props.quizViewingGuess ? props.quizAnswerId : props.quizQuestionId
    if (!(autoRegionalProjection.value && projectionLoading.value) && props.nameCountryQuiz && !props.quizComplete && targetId && !props.detailLoading) focusCountry(targetId)
  },
  { flush: 'post' },
)

watch(isInteracting, (active) => {
  if (hoverRestoreFrame !== undefined) {
    cancelAnimationFrame(hoverRestoreFrame)
    hoverRestoreFrame = undefined
  }
  if (active) {
    hoveredUnit.value = null
  } else {
    // Firefox can retain a highlight rasterized at the start of a zoom and
    // keep scaling that texture after motion stops. Recreate only the painted
    // highlight paths at the final camera scale; hit paths and map stay put.
    highlightRevision.value += 1
    restoreHoverUnderPointer()
  }
})
watch(projectionId, () => focusActiveRegion(false), { flush: 'post' })
watch([mapWidth, mapHeight], () => focusActiveRegion(false), { flush: 'post' })

function countryFocusOptions(): ZoomToBoundsOptions {
  const options: ZoomToBoundsOptions = limitedCountryZoomEnabled.value
    ? { preferredScale: PREFERRED_COUNTRY_FOCUS_SCALE }
    : {}
  // On narrow screens the card spans the map. Measure its actual bottom,
  // including its top offset, rather than assuming a fixed card height.
  const mapRect = container.value?.getBoundingClientRect()
  const overlayRect = props.focusOverlay?.getBoundingClientRect()
  if (window.matchMedia('(max-width: 680px)').matches && mapRect && overlayRect && mapRect.height > 0) {
    const top = Math.max(0, Math.min(mapHeight.value - 1,
      (overlayRect.bottom - mapRect.top + 12) * mapHeight.value / mapRect.height))
    options.viewport = [[0, top], [mapWidth.value, mapHeight.value]]
  }
  return options
}

async function selectCountry(
  countryId: string,
  geographicUnitId: string,
  bounds: MapBounds,
  focusPoint: MapPoint | undefined,
  event?: MouseEvent | KeyboardEvent,
  horizontalOffset = 0,
) {
  if (markerDistribution.value) { event?.stopPropagation(); return }
  if (event instanceof MouseEvent && consumeDragClick()) {
    event.stopPropagation()
    return
  }
  const action = countryClickAction(
    countryId,
    geographicUnitId,
    event instanceof MouseEvent ? event.detail : 0,
    interactionState.value,
  )
  if (action === 'ignore-stop') {
    event?.stopPropagation()
    return
  }
  if (action === 'ignore') return
  event?.stopPropagation()
  if (action === 'clear') {
    emit('select', null, null)
    return
  }
  emit('select', countryId, geographicUnitId)
  if (props.quizMode) return
  // The first selection creates the card; wait for it before measuring.
  await nextTick()
  if (props.quizMode || props.selectedCountryId !== countryId || props.selectedGeographicUnitId !== geographicUnitId) return
  const detailed = canvasRendererActive.value
    ? detailedGeographicPathById.value.get(geographicUnitId)
    : undefined
  const target = selectionFocusTarget(
    geographicUnitId,
    detailed?.bounds ?? bounds,
    detailed?.focusPoint ?? focusPoint,
    geographicPaths.value,
    renderedMapUnitIds.value,
    horizontalOffset,
  )
  zoomToBounds(
    target.bounds,
    target.focusPoint,
    countryFocusOptions(),
  )
  restoreHoverUnderPointer()
}

async function focusCountry(countryId: string) {
  await nextTick()
  const candidates = geographicPaths.value.filter(({ unit, path }) =>
    path && unit.properties.entityId === countryId && isGeographicUnitVisible(unit),
  )
  if (!candidates.length) return

  // The country-level unit is the usual camera target. Some identities only
  // have component units; then prefer their largest visible land area.
  const main = candidates.find(({ unit }) => unit.id === `entity:${countryId}`)
    ?? candidates.reduce((largest, candidate) =>
      geoArea(candidate.unit) > geoArea(largest.unit) ? candidate : largest,
    )
  const target = selectionFocusTarget(
    main.unit.id,
    main.bounds,
    main.focusPoint,
    geographicPaths.value,
    renderedMapUnitIds.value,
    0,
  )
  zoomToBounds(
    target.bounds,
    target.focusPoint,
    countryFocusOptions(),
  )
  restoreHoverUnderPointer()
}

defineExpose({ focusCountry, reportDevelopmentView })

let focusOverlayObserver: ResizeObserver | undefined
watch(() => props.focusOverlay, (overlay) => {
  focusOverlayObserver?.disconnect()
  if (!overlay) return
  let previousTop: number | undefined
  focusOverlayObserver = new ResizeObserver(() => {
    const top = countryFocusOptions().viewport?.[0][1]
    if (top === previousTop) return
    previousTop = top
    // The asynchronously loaded answer field can change the question card's
    // height. Refit unanswered questions, without moving answered feedback.
    if (top !== undefined && props.nameCountryQuiz && !props.quizComplete
      && props.quizAnswerId === null && !props.quizSkipped && props.quizQuestionId
      && !interactionLocked.value && !isDragging.value && !isPinching.value && !isWheeling.value) {
      void focusCountry(props.quizQuestionId)
    }
  })
  focusOverlayObserver.observe(overlay)
}, { flush: 'post' })

function handleMapClick(event: MouseEvent) {
  if (!props.quizMode) {
    if (!consumeDragClick() && (props.selectedLandAreaId !== null
      || backgroundClickAction(event.detail, interactionState.value) === 'clear')) {
      emit('select', null, null)
    }
    return
  }
  if (props.quizAnswerId === null && !props.quizSkipped) return
  if (consumeDragClick()) return
  if (backgroundClickAction(event.detail, interactionState.value) === 'next') {
    emit('tip-action', 'map-next')
    emit('quiz-next')
  }
}

function supplementalAreaName(sourceId: string) {
  return supplementalAreaInfoByDisplayId.get(sourceId)?.name[props.locale]
}

function canSelectSupplementalArea(sourceId: string) {
  return !props.quizMode && supplementalAreaInfoByDisplayId.has(sourceId)
}

function supplementalCountryClasses(sourceId: string) {
  const entityId = supplementalAreaInfoByDisplayId.get(sourceId)?.quizEntityId
  return {
    'country--selected': !!entityId && !props.quizMode && entityId === props.selectedCountryId,
  }
}

function selectSupplementalArea(sourceId: string, event: MouseEvent | KeyboardEvent) {
  if (interactionLocked.value || !canSelectSupplementalArea(sourceId)) return
  if (event instanceof MouseEvent && (consumeDragClick() || event.detail > 1)) return
  const area = supplementalAreaInfoByDisplayId.get(sourceId)
  if (area) emit('land-select', props.selectedLandAreaId === area.id ? null : area.id)
}

function handleWheel(event: WheelEvent) {
  withGestureInput('wheel', () => {
    cancelMarkerDistribution()
    rememberHoverPointer(event)
    if (svg.value) zoomFromWheel(event, svg.value)
  }, false, { deltaY: event.deltaY, deltaMode: event.deltaMode })
}

function clearWaterNamePress() {
  waterNamePointerId = null
  waterNamePointerPressed.value = false
}

function releaseWaterNamePress(event: PointerEvent) {
  if (event.pointerId === waterNamePointerId) clearWaterNamePress()
}

function handlePointerDown(event: PointerEvent) {
  if (event.pointerType === 'touch' || markerDistribution.value) return
  if (event.button === 0) {
    waterNamePointerId = event.pointerId
    waterNamePointerPressed.value = true
  }
  const startedAt = gestureDebugEnabled ? performance.now() : 0
  if (gestureDebugEnabled) pendingPanStartup = event.button === 0 ? {
    downAt: startedAt,
    timings: {
      pointerDownEventAgeMs: inputEventAge(event, startedAt),
      pointerDownHandlerMs: null,
      pointerDownToFirstMoveMs: null,
      firstMoveEventAgeMs: null,
      pointerDownToDragStartMs: null,
      dragStartHandlerMs: null,
      pointerDownToFirstTransformMs: null,
      pointerDownToFirstRafMs: null,
    },
  } : null
  withGestureInput('pointer', () => {
    rememberHoverPointer(event)
    if (svg.value) startPan(event, svg.value)
  })
  if (pendingPanStartup) pendingPanStartup.timings.pointerDownHandlerMs = Math.round((performance.now() - startedAt) * 100) / 100
}

function handlePointerMove(event: PointerEvent) {
  if (event.pointerType === 'touch') return
  const startup = gestureDebugEnabled ? pendingPanStartup : null
  const startedAt = startup ? performance.now() : 0
  const before = startup && startup.timings.pointerDownToFirstTransformMs === null ? gestureSample() : null
  if (startup && startup.timings.pointerDownToFirstMoveMs === null) {
    startup.timings.pointerDownToFirstMoveMs = Math.round((startedAt - startup.downAt) * 100) / 100
    startup.timings.firstMoveEventAgeMs = inputEventAge(event, startedAt)
  }
  withGestureInput('pointer', () => {
    rememberHoverPointer(event)
    movePan(event)
  })
  if (startup && isDragging.value) {
    const now = performance.now()
    if (startup.timings.dragStartHandlerMs === null) startup.timings.dragStartHandlerMs = Math.round((now - startedAt) * 100) / 100
    if (before && (transform.x !== before.x || transform.y !== before.y)) {
      startup.timings.pointerDownToFirstTransformMs = Math.round((now - startup.downAt) * 100) / 100
    }
  }
}

function handlePointerLeave(event: PointerEvent) {
  if (event.pointerType === 'touch') return
  lastHoverPointer = null
  hoveredUnit.value = null
}

function handlePointerEnd(event: PointerEvent) {
  if (event.pointerType === 'touch') return
  if (!svg.value) return
  withGestureInput('pointer', () => endPan(event, svg.value!), event.type === 'pointercancel')
  pendingPanStartup = null
}

function handleTouch(event: TouchEvent) {
  if (!svg.value) return
  if (event.type === 'touchstart' && markerDistribution.value) {
    // A new gesture can interrupt the transition without turning a repeat tap
    // into an answer on the country that happened to move beneath the finger.
    suppressMarkerTransitionTouch = true
    cancelMarkerDistribution()
  }
  const tap = withGestureInput('touch', () => updateTouches(event, svg.value!), event.type === 'touchcancel')
  if (event.type === 'touchcancel') {
    if (event.touches.length === 0) suppressMarkerTransitionTouch = false
    consumeDragClick()
    return
  }
  if (event.type !== 'touchend') return

  // Preventing touchstart is the only reliable way to suppress Safari's
  // tap-then-hold loupe. Recreate a normal tap after our pan detector has had
  // the chance to reject drags and pinches.
  suppressCompatibilityClick = true
  if (compatibilityClickTimer !== undefined) window.clearTimeout(compatibilityClickTimer)
  compatibilityClickTimer = window.setTimeout(() => {
    suppressCompatibilityClick = false
    compatibilityClickTimer = undefined
  }, 700)
  const suppressTransitionTap = suppressMarkerTransitionTouch
  if (event.touches.length === 0) suppressMarkerTransitionTouch = false
  if (suppressTransitionTap) { consumeDragClick(); return }
  const tapTarget = tap?.target
  if (consumeDragClick() || !tap || !(tapTarget instanceof Element) || !tapTarget.isConnected) return

  if (props.nameCountryQuiz && props.quizQuestionId && props.quizAnswerId === null
    && !props.quizSkipped && !props.quizComplete && !interactionLocked.value) {
    // Keep focus synchronous with the real touchend so iOS can open its
    // keyboard. Tap detection above has already rejected pans and pinches.
    emit('focus-answer')
    return
  }

  tapTarget.dispatchEvent(new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    clientX: tap.clientX,
    clientY: tap.clientY,
    detail: 1,
    view: window,
  }))
}

function handleMapCaptureClick(event: MouseEvent) {
  if (markerDistribution.value) {
    event.preventDefault()
    event.stopPropagation()
    return
  }
  if (event.isTrusted && suppressCompatibilityClick) {
    suppressCompatibilityClick = false
    event.preventDefault()
    event.stopPropagation()
    return
  }
  // Water names, editor handles, and panel controls live in separate overlays.
  // A real click on the map itself therefore deselects the edited water name.
  if (waterEditorEnabled && !props.quizMode) {
    if (consumeDragClick()) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
    waterEditorSelectedId.value = ''
    waterEditorWarning.value = ''
  }
}

function clearHoveredUnit(id: string) {
  if (hoveredUnit.value?.id === id) hoveredUnit.value = null
}

function rememberHoverPointer(event: MouseEvent) {
  lastHoverPointer = { clientX: event.clientX, clientY: event.clientY }
}

function restoreHoverUnderPointer() {
  const pointer = lastHoverPointer
  if (!pointer) return
  if (hoverRestoreFrame !== undefined) cancelAnimationFrame(hoverRestoreFrame)
  hoverRestoreFrame = requestAnimationFrame(() => {
    hoverRestoreFrame = undefined
    if (props.nameCountryQuiz || isInteracting.value) return
    const target = document.elementFromPoint(pointer.clientX, pointer.clientY)
    const hit = target instanceof Element
      ? target.closest<SVGElement>('[data-country-id][data-geographic-unit-id]')
      : null
    if (!hit || !svg.value?.contains(hit)) {
      hoveredUnit.value = null
      return
    }
    const id = hit.dataset.geographicUnitId
    const entityId = hit.dataset.countryId
    hoveredUnit.value = id && entityId ? { id, entityId } : null
  })
}

function hoverGeographicUnit(unit: GeographicUnitFeature, event: PointerEvent) {
  // A touch contact emits pointerenter before we can know whether it will be
  // a tap or a pan. Only hover-capable pointers should preview a country.
  if (event.pointerType === 'touch') return
  rememberHoverPointer(event)
  if (!props.nameCountryQuiz && !isInteracting.value) hoveredUnit.value = { id: unit.id, entityId: unit.properties.entityId }
}

function hoverSmallCountryMarker(marker: SmallCountryMarker | null) {
  const target = marker?.targets.length === 1 ? marker.targets[0] : null
  hoveredUnit.value = target && !isInteracting.value
    ? { id: target.unitId, entityId: target.countryId }
    : null
}

function activateSmallCountryMarker(marker: SmallCountryMarker, event: MouseEvent | KeyboardEvent) {
  if (event instanceof MouseEvent && (consumeDragClick() || event.detail > 1)) return
  if (!countryMarkersVisible.value || markerDistribution.value || !canActivateGeographicUnit(interactionState.value)) return

  if (marker.targets.length === 1) {
    const target = marker.targets[0]
    emit('select', target.countryId, target.unitId)
    return
  }

  clearZoomTargetHighlights()
  hoveredUnit.value = null
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    zoomSmallCountryGroup(marker)
    return
  }
  const origin: MapPoint = [(marker.x - transform.x) / transform.scale, (marker.y - transform.y) / transform.scale]
  // Start at twelve o'clock and stagger clockwise. Collinear dots start
  // nearest-first, keeping the sequence deterministic without changing targets.
  const order = marker.targets.map((target, index) => {
    const dx = target.x + target.offset - origin[0]
    const dy = target.y - origin[1]
    return { index, angle: (Math.atan2(dy, dx) + Math.PI * 2.5) % (Math.PI * 2), distance: Math.hypot(dx, dy) }
  }).sort((a, b) => a.angle - b.angle || a.distance - b.distance)
  const delays = new Array<number>(marker.targets.length)
  order.forEach(({ index }, rank) => { delays[index] = MARKER_STAGGER_MS * rank / (order.length - 1) })
  markerDistribution.value = { marker, origin, progress: 0, delays }
  const startedAt = performance.now()
  const distribute = (now: number) => {
    const distribution = markerDistribution.value
    if (!distribution) return
    const progress = Math.min(1, (now - startedAt) / (MARKER_DISTRIBUTION_MS + MARKER_STAGGER_MS))
    markerDistribution.value = { ...distribution, progress }
    if (progress < 1) markerDistributionFrame = requestAnimationFrame(distribute)
    else {
      markerDistributionFrame = undefined
      zoomSmallCountryGroup(marker)
    }
  }
  markerDistributionFrame = requestAnimationFrame(distribute)
}

function zoomSmallCountryGroup(marker: SmallCountryMarker) {
  zoomedMarkerQuestionId = props.quizQuestionId
  pendingZoomTargets = marker.targets
  const xs = marker.targets.map((target) => target.screenX)
  const ys = marker.targets.map((target) => target.screenY)
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1)
  const factor = Math.min(24, Math.max(6, Math.min(mapWidth.value, mapHeight.value) * 0.3 / span))
  zoomToPoint(
    [(marker.x - transform.x) / transform.scale, (marker.y - transform.y) / transform.scale],
    transform.scale * factor,
  )
  if (!isAnimating.value) {
    markerDistribution.value = null
    showZoomTargetHighlights()
  }
  restoreHoverUnderPointer()
}

async function ensureBathymetryLoaded() {
  if (bathymetryBands.value.length || bathymetryLoading.value) return
  bathymetryLoading.value = true
  try {
    bathymetryBands.value = await loadBathymetryBands()
  } catch (error) {
    bathymetryEnabled.value = false
    console.error('Could not load bathymetry.', error)
  } finally {
    bathymetryLoading.value = false
  }
}

async function ensureReliefLoaded() {
  if (reliefBands.value.length || reliefLoading.value) return
  reliefLoading.value = true
  try {
    reliefBands.value = await loadReliefBands()
  } catch (error) {
    reliefEnabled.value = false
    console.error('Could not load relief.', error)
  } finally {
    reliefLoading.value = false
  }
}

function setBathymetryEnabled(enabled: boolean) {
  bathymetryEnabled.value = enabled
  if (enabled) void ensureBathymetryLoaded()
}

function setReliefEnabled(enabled: boolean) {
  reliefEnabled.value = enabled
  if (enabled) void ensureReliefLoaded()
}

function resetMapSettings() {
  questionRingGroupingGap.value = 0
  countryMarkersEnabled.value = true
  autoRegionalProjection.value = false
  pendingAutoProjection.value = null
  globalProjectionId.value = 'mercator'
  limitedCountryZoomEnabled.value = true
  setBathymetryEnabled(!usesMobileMapDefaults)
  setReliefEnabled(false)
  marineLabelsEnabled.value = true
  scaleBarEnabled.value = true
  scaleUnits.value = 'metric'
  void setProjection('mercator')
  emit('reset-settings')
}

function requestDetailChange(enabled: boolean) {
  emit(
    'detail-change',
    enabled,
    enabled && props.detailedGeographicUnits !== null && hasCachedPaths(props.detailedGeographicUnits),
  )
}

onMounted(async () => {
  // A press can end outside the map before pointer capture begins.
  window.addEventListener('pointerup', releaseWaterNamePress, true)
  window.addEventListener('pointercancel', releaseWaterNamePress, true)
  window.addEventListener('blur', clearWaterNamePress)
  if (debugEnabled) {
    updateDebugMetrics()
    debugTimer = window.setInterval(updateDebugMetrics, 125)
  }

  // Let the playable base map paint before optional visual layers compete for
  // bandwidth and main-thread projection work on desktop.
  await afterPaint()
  if (bathymetryEnabled.value) void ensureBathymetryLoaded()
  if (reliefEnabled.value) void ensureReliefLoaded()
})

onBeforeUnmount(() => {
  if (viewCopyTimer !== undefined) window.clearTimeout(viewCopyTimer)
  window.removeEventListener('pointerup', releaseWaterNamePress, true)
  window.removeEventListener('pointercancel', releaseWaterNamePress, true)
  window.removeEventListener('blur', clearWaterNamePress)
  projectionSnapshot.value?.replaceChildren()
  cancelMarkerDistribution()
  clearZoomTargetHighlights()
  if (gestureFrame !== undefined) cancelAnimationFrame(gestureFrame)
  if (gestureSettleTimer !== undefined) window.clearTimeout(gestureSettleTimer)
  if (gestureCopyTimer !== undefined) window.clearTimeout(gestureCopyTimer)
  gestureLongTaskObserver?.disconnect()
  focusOverlayObserver?.disconnect()
  if (debugTimer !== undefined) window.clearInterval(debugTimer)
  if (compatibilityClickTimer !== undefined) window.clearTimeout(compatibilityClickTimer)
  if (hoverRestoreFrame !== undefined) cancelAnimationFrame(hoverRestoreFrame)
})

// Automatic changes follow the selected region, not temporary quiz-guess framing.
// Queue the latest request while detail/projection work is busy.
watch([() => props.selectedRegionId, autoRegionalProjection], ([regionId, enabled], previous) => {
  if (props.sharedView) { pendingAutoProjection.value = null; return }
  pendingProportionalTransition = previous !== undefined && (enabled || previous[1] === true)
  if (enabled) {
    writeStoredValue(mapSettingKeys.globalProjection, globalProjectionId.value)
    pendingAutoProjection.value = regionId === 'world' ? globalProjectionId.value : 'regional-equal-area'
  } else {
    // Turning automation off also undoes its projection. Initial/manual choices
    // remain untouched while the preference was already off.
    pendingAutoProjection.value = previous?.[1] ? globalProjectionId.value : null
  }
}, { immediate: true })
watch([pendingAutoProjection, interactionLocked], ([nextId, locked]) => {
  if (nextId === null || locked) return
  pendingAutoProjection.value = null
  void setProjection(nextId, pendingProportionalTransition)
}, { immediate: true, flush: 'post' })

function selectProjection(nextId: MapProjectionId) {
  if (interactionLocked.value) return
  pendingAutoProjection.value = null
  if (nextId !== 'regional-equal-area') {
    globalProjectionId.value = nextId
    // Also remember an unchanged global choice before the first automatic switch.
    writeStoredValue(mapSettingKeys.globalProjection, nextId)
  }
  void setProjection(nextId)
}

function retainProjectionSnapshot() {
  const source = container.value
  const target = projectionSnapshot.value
  if (!source || !target) return
  const viewport = source.getBoundingClientRect()
  const snapshot = document.createElement('canvas')
  // The snapshot is only shown under blur: viewport-sized pixels are sufficient,
  // without retaining the renderer's much larger overscanned backing buffers.
  snapshot.width = Math.ceil(viewport.width)
  snapshot.height = Math.ceil(viewport.height)
  snapshot.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'
  const context = snapshot.getContext('2d')
  if (!context) return
  for (const canvas of source.querySelectorAll<HTMLCanvasElement>('.canvas-map-layer canvas')) {
    if (canvas.style.opacity !== '1') continue
    const bounds = canvas.getBoundingClientRect()
    context.drawImage(canvas, bounds.left - viewport.left, bounds.top - viewport.top, bounds.width, bounds.height)
  }
  const layers: Element[] = [snapshot]
  for (const svg of source.querySelectorAll<SVGSVGElement>(':scope > .world-map, :scope > .map-highlights')) {
    const copy = svg.cloneNode(true) as SVGSVGElement
    // Canvas supplies the land; its invisible hit paths need not be retained.
    copy.querySelectorAll('.country--hit-only').forEach((path) => path.remove())
    // Keep the old relief clip independent from the replacement projection.
    for (const clip of copy.querySelectorAll('clipPath[id]')) {
      const id = clip.id
      clip.id = `${id}-snapshot`
      copy.querySelectorAll('[clip-path]').forEach((element) => {
        if (element.getAttribute('clip-path') === `url(#${id})`) {
          element.setAttribute('clip-path', `url(#${clip.id})`)
        }
      })
    }
    layers.push(copy)
  }
  target.replaceChildren(...layers)
}

async function setProjection(nextId: MapProjectionId, proportionalTransition = false) {
  if (interactionLocked.value || (nextId === projectionId.value && !proportionalTransition)) return

  if (!proportionalTransition && (!props.highDetailEnabled || hasCachedPaths(props.geographicUnits, nextId))) {
    projectionId.value = nextId
    return
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const blurDuration = proportionalTransition ? 120 : 280
  projectionBlurDuration.value = blurDuration
  projectionLoading.value = true
  projectionBlurred.value = true
  try {
    // Give the selector time to close and paint the blurred current projection
    // before projecting the detailed atlas on the main thread.
    await nextTick()
    await afterPaint()
    const loaderShownAt = performance.now()
    // The filter needs time to become visibly blurred before synchronous work
    // blocks the main thread.
    if (!reducedMotion) await wait(blurDuration)
    if (proportionalTransition && !reducedMotion) {
      retainProjectionSnapshot()
    }
    renderedRegion.value = props.activeRegion
    renderedMapUnitIds.value = props.visibleMapUnitIds
    projectionId.value = nextId
    await nextTick()
    if (proportionalTransition) focusActiveRegion(false)
    await nextTick()
    await afterPaint()
    if (projectionSnapshot.value?.hasChildNodes()) {
      projectionSnapshotFading.value = true
      await nextTick()
      await afterPaint()
      await wait(1900)
      projectionSnapshot.value.replaceChildren()
      projectionSnapshotFading.value = false
    }
    // Updating an existing SVG can take another frame to rasterize. Keep the
    // newly projected paths blurred long enough to appear before deblurring.
    if (proportionalTransition) {
      const remaining = 2000 - (performance.now() - loaderShownAt)
      if (remaining > 0) await wait(remaining)
    } else if (!reducedMotion) {
      await wait(160)
    }
  } finally {
    projectionSnapshot.value?.replaceChildren()
    projectionSnapshotFading.value = false
    projectionBlurred.value = false
    if (!reducedMotion) {
      await nextTick()
      await afterPaint()
      await wait(blurDuration)
    }
    projectionLoading.value = false
    projectionBlurDuration.value = 280
  }
}

// Apply explicit views after region, detail, projection and element sizing settle.
// A newer request replaces a queued one; normal navigation keeps its existing rules.
const applyingSharedView = ref(false)
watch([() => props.sharedView, interactionLocked, measuredWidth, measuredHeight, applyingSharedView], async () => {
  const view = props.sharedView
  if (!view || interactionLocked.value || applyingSharedView.value || measuredWidth.value <= 0 || measuredHeight.value <= 0) return
  applyingSharedView.value = true
  try {
    pendingAutoProjection.value = null
    renderedRegion.value = props.activeRegion
    renderedMapUnitIds.value = props.visibleMapUnitIds
    await setProjection(view.projection)
    await nextTick()
    await afterPaint()
    if (props.sharedView !== view) return
    const point = projectPoint([view.lon, view.lat])
    if (point?.every(Number.isFinite)) zoomToPoint(point, view.zoom, view.animate ?? false)
    emit('shared-view-applied')
  } finally {
    applyingSharedView.value = false
  }
}, { flush: 'post' })

// Development snapshots run on interaction boundaries, never on camera frames.
let developmentViewTimer: number | undefined
function reportDevelopmentView() {
  if (!import.meta.hot) return
  const busy = isInteracting.value || interactionLocked.value || applyingSharedView.value || props.sharedView !== null
  import.meta.hot.send('geo-go-go:state', { busy, view: busy ? null : sharedViewSnapshot() })
}
if (import.meta.hot) {
  watch([isInteracting, interactionLocked, applyingSharedView, () => props.sharedView,
    measuredWidth, measuredHeight, projectionId, () => renderedRegion.value.id], () => {
    if (developmentViewTimer !== undefined) window.clearTimeout(developmentViewTimer)
    if (isInteracting.value || interactionLocked.value || applyingSharedView.value || props.sharedView) {
      reportDevelopmentView()
    } else {
      developmentViewTimer = window.setTimeout(reportDevelopmentView, 100)
    }
  }, { flush: 'post' })
  onBeforeUnmount(() => {
    if (developmentViewTimer !== undefined) window.clearTimeout(developmentViewTimer)
  })
}
</script>

<template>
  <div
    class="map-stage"
    :class="{ 'map-stage--busy': interactionLocked }"
    @contextmenu.prevent
    @selectstart.prevent
  >
    <div
      ref="container"
      class="map-container"
      data-help="map"
      :style="mapPaletteCssVariables"
      :class="{
        'map-container--dragging': isDragging,
        'map-container--interacting': isInteracting,
        'map-container--fast-touch-zoom': fastTouchZoomPreview,
        'map-container--water-editor': waterEditorEnabled,
      }"
      :aria-busy="interactionLocked"
      :inert="interactionLocked"
    >
      <CanvasMap
        v-if="canvasRendererEnabled"
        :width="mapWidth"
        :height="mapHeight"
        :scene="canvasScene"
        :camera="transform"
        :interacting="isInteracting"
        :panning="isDragging"
        :wheel-zooming="isWheeling"
        :animating="isAnimating"
        :firefox-preview="firefoxPreviewEnabled"
        :touch-zooming="usesMobileMapDefaults && isPinching"
        :animated-zooming="usesMobileMapDefaults && isAnimating"
        :touch-panning="usesMobileMapDefaults && isDragging"
        :diagnostics-active="gestureDiagnosticsActive"
        :wrap-offset="canvasWrapOffset"
        :wrap-period="horizontalWrap?.period ?? null"
        @ready-change="canvasReady = $event"
        @preview-change="fastTouchZoomPreview = $event"
        @restoring-change="restoringTouchDetail = $event"
        @render-diagnostic="recordGestureRender"
        @context-ready="canvasContextKind = $event"
      />
      <svg
        ref="svg"
        class="world-map"
        :class="{
          'world-map--wrapped': wrapActive,
          'world-map--canvas': canvasRendererActive,
          'world-map--naming': nameCountryQuiz,
          'world-map--quiz': quizMode,
          'world-map--bathymetry': bathymetryEnabled && bathymetryPaths.length > 0,
        }"
        :viewBox="`0 0 ${mapWidth} ${mapHeight}`"
        role="group"
        :aria-label="t('interactiveMap')"
        @touchstart.prevent="handleTouch"
        @touchmove.prevent="handleTouch"
        @touchend="handleTouch"
        @touchcancel="handleTouch"
        @wheel.prevent="handleWheel"
        @pointerdown="handlePointerDown"
        @pointermove="handlePointerMove"
        @pointerleave="handlePointerLeave"
        @pointerup="handlePointerEnd"
        @pointercancel="handlePointerEnd"
        @click.capture="handleMapCaptureClick"
        @click="handleMapClick"
      >
        <g ref="mapContent" class="map-content">
          <defs v-if="!canvasRendererActive">
            <clipPath :id="reliefClipId" clipPathUnits="userSpaceOnUse">
              <path :d="reliefClipPath" />
            </clipPath>
          </defs>
          <path
            v-if="!canvasRendererActive"
            class="map-sphere"
            :d="wrappedSpherePath"
          />
          <g v-if="bathymetryEnabled && !canvasRendererActive" class="bathymetry" aria-hidden="true">
            <path
              v-for="band in wrappedBathymetryPaths"
              :key="band.depth"
              class="bathymetry__band"
              :class="`bathymetry__band--${band.depth}`"
              :d="band.path"
            />
          </g>
          <g v-if="!canvasRendererActive && contextGeographicPaths.length" class="context-land" aria-hidden="true">
            <g
              v-for="offset in copyOffsets"
              :key="offset"
              :transform="offset === 0 ? undefined : `translate(${offset} 0)`"
            >
              <path v-for="(country, index) in contextGeographicPaths" :key="index" :d="country.path" />
            </g>
          </g>
          <g
            v-for="offset in canvasRendererActive ? [] : copyOffsets"
            :key="`terrain-${offset}`"
            class="terrain"
            :class="{ 'terrain--relief': reliefEnabled && reliefPaths.length > 0 }"
            :transform="offset === 0 ? undefined : `translate(${offset} 0)`"
            aria-hidden="true"
          >
            <path class="terrain__land" :d="visibleLandPath" />
            <g v-if="reliefEnabled" class="relief" :clip-path="`url(#${reliefClipId})`">
              <path
                v-for="band in reliefPaths"
                :key="band.elevation"
                class="relief__band"
                :class="`relief__band--${band.elevation}`"
                :d="band.path"
              />
            </g>
            <path v-for="area in backgroundLandPaths" :key="area.id" :d="area.outlinePath ?? area.path" class="background-land-outline" />
          </g>
          <!-- Geometry and answer state change independently of the camera.
               Keep this expensive path loop cached during ordinary movement. -->
          <g
            v-for="offset in hitCopyOffsets"
            :key="offset"
            v-show="copyOffsets.includes(offset)"
            class="countries"
            v-memo="[firefoxPreviewEnabled ? copyOffsets : null, paintedGeographicPaths, wrappedGeographicPaths, interactionState, renderedMapUnitIds, renderedRegion, locale, canvasRendererActive, correctAnswerVisible, alwaysShowWrongAnswer, quizViewingGuess]"
            :transform="offset === 0 ? undefined : `translate(${offset} 0)`"
            :aria-hidden="offset !== 0"
          >
            <g
              v-for="{ unit, path, outlinePath, divisionPath, bounds, focusPoint } in geographicPathsAt(offset)"
              :key="unit.id"
              v-show="isGeographicUnitVisible(unit)"
            >
              <path
                :d="path"
                class="country"
                :class="[geographicUnitClasses(unit), { 'country--split-fill': outlinePath !== undefined, 'country--hit-only': canvasRendererActive }]"
                :style="outlinePath !== undefined ? { stroke: 'none' } : undefined"
                :data-country-id="unit.properties.entityId"
                :data-geographic-unit-id="unit.id"
                :role="nameCountryQuiz ? 'img' : 'button'"
                :tabindex="offset === 0 && isGeographicUnitVisible(unit) && canActivateGeographicUnit(interactionState) ? 0 : -1"
                :aria-label="geographicUnitLabel(unit)"
                :aria-hidden="!isGeographicUnitVisible(unit) || (nameCountryQuiz && unit.properties.entityId !== (quizViewingGuess ? quizAnswerId : quizQuestionId))"
                :aria-disabled="nameCountryQuiz ? undefined : !canActivateGeographicUnit(interactionState)"
                :aria-pressed="nameCountryQuiz ? undefined : (quizMode ? unit.id === selectedGeographicUnitId : isPrimarySelectedExploreUnit(unit))"
                @click="selectCountry(unit.properties.entityId, unit.id, bounds, focusPoint, $event, offset)"
                @pointerenter="hoverGeographicUnit(unit, $event)"
                @pointerleave="clearHoveredUnit(unit.id)"
                @keydown.enter.prevent="selectCountry(unit.properties.entityId, unit.id, bounds, focusPoint, $event, offset)"
                @keydown.space.prevent="selectCountry(unit.properties.entityId, unit.id, bounds, focusPoint, $event, offset)"
              >
                <title v-if="canShowCountryTooltip(unit.properties.entityId, props)">{{ geographicUnitLabel(unit) }}</title>
              </path>
              <!-- Open border linework must not inherit the country's hover fill. -->
              <path
                v-if="outlinePath && !canvasRendererActive"
                class="country-outline"
                :class="geographicUnitClasses(unit)"
                :d="outlinePath"
                style="fill: none"
                aria-hidden="true"
              />
              <path
                v-if="divisionPath && !canvasRendererActive"
                class="regional-division"
                :class="{ 'internal-boundary': !!unit.divisionGeometry }"
                :d="divisionPath"
                aria-hidden="true"
              />
            </g>
          </g>
        </g>
        <!-- Shared neutral-land pass stays above country fills in both renderers.
             It blocks country clicks underneath until affiliations are curated. -->
        <g :transform="`translate(${transform.x} ${transform.y}) scale(${transform.scale})`">
          <g v-for="offset in copyOffsets" :key="`restored-${offset}`" :transform="`translate(${offset} 0)`" :aria-hidden="offset !== 0">
            <g v-for="area in visibleSupplementalLandPaths" :key="area.id">
              <path
                :d="area.path"
                class="supplemental-land"
                :class="[supplementalCountryClasses(area.id), {
                  'supplemental-land--named': canSelectSupplementalArea(area.id),
                  'supplemental-land--selected': supplementalAreaInfoByDisplayId.get(area.id)?.id === selectedLandAreaId,
                }]"
                :role="supplementalAreaInfoByDisplayId.has(area.id) ? 'button' : undefined"
                :tabindex="offset === 0 && canSelectSupplementalArea(area.id) ? 0 : -1"
                :aria-label="quizMode ? t('chooseCountry') : supplementalAreaName(area.id)"
                :aria-hidden="!supplementalAreaInfoByDisplayId.has(area.id)"
                :aria-disabled="!canSelectSupplementalArea(area.id)"
                :aria-pressed="supplementalAreaInfoByDisplayId.get(area.id)?.id === selectedLandAreaId"
                @click.stop="selectSupplementalArea(area.id, $event)"
                @keydown.enter.stop.prevent="selectSupplementalArea(area.id, $event)"
                @keydown.space.stop.prevent="selectSupplementalArea(area.id, $event)"
                @pointerenter="hoveredUnit = null"
              >
                <title v-if="!quizMode && supplementalAreaName(area.id)">{{ supplementalAreaName(area.id) }}</title>
              </path>
              <path
                v-if="supplementalAreaInfoByDisplayId.has(area.id)"
                :d="area.path"
                class="regional-division internal-boundary"
                aria-hidden="true"
              />
              <path
                v-if="area.divisionPath"
                :d="area.divisionPath"
                class="regional-division internal-boundary"
                aria-hidden="true"
              />
            </g>
          </g>
        </g>
        <g v-if="namedQuestionMarkers.length" class="named-question-markers" role="img" :aria-label="t('highlightedCountry')">
          <g v-for="marker in namedQuestionMarkers" :key="marker.key">
            <circle class="named-question-markers__back" :cx="marker.x" :cy="marker.y" :r="marker.radius" />
            <circle :cx="marker.x" :cy="marker.y" :r="marker.radius" />
          </g>
        </g>
        <SmallCountryMarkers
          v-if="quizSmallCountryMarkers.length || quizFeedbackMarkers.length || revealedCountryMarkers.length"
          :width="mapWidth"
          :height="mapHeight"
          :markers="displayedQuizSmallCountryMarkers"
          :feedback-markers="quizFeedbackMarkers"
          :temporary-markers="revealedCountryMarkers"
          :always-show-wrong-answer="alwaysShowWrongAnswer"
          :hide-correct-name="nameCountryQuiz && !correctAnswerVisible"
          @activate="activateSmallCountryMarker"
          @hover="hoverSmallCountryMarker"
        />
        <g v-if="distributingCountryDots.length" class="small-country-distribution" aria-hidden="true">
          <circle v-for="dot in distributingCountryDots" :key="dot.key" :cx="dot.x" :cy="dot.y" r="5" />
        </g>
      </svg>

      <!-- Labels have independent SVG layout; hiding text for movement must
           not alter the interactive map's descendant geometry. Reuse the
           overlay class so projection snapshots retain the label layer. -->
      <svg
        v-if="(marineLabelsEnabled || waterEditorEnabled) && !quizMode"
        class="map-highlights map-water-labels"
        :viewBox="`0 0 ${mapWidth} ${mapHeight}`"
        aria-hidden="true"
      >
        <MarineLabels
          :visible="(marineLabelsEnabled || waterEditorEnabled) && !quizMode && !waterNamePointerPressed && !isInteracting"
          :width="mapWidth"
          :height="mapHeight"
          :transform="transform"
          :projection-scale="projectionScale"
          :project-point="projectPoint"
          :copy-offsets="copyOffsets"
          :wrap-period="horizontalWrap?.period ?? null"
          :placements="waterEditorEnabled ? waterEditorPlacements : undefined"
          :labels="waterEditorEnabled ? waterEditorLabels : undefined"
          :editing="waterEditorEnabled && waterEditorEditing && !waterNamePointerPressed && !isInteracting && !interactionLocked"
          :editing-label-id="waterEditorEnabled && waterEditorPlacements ? waterEditorSelectedId : undefined"
          :editing-placement-index="waterEditorPlacementIndex"
          @select="(id, index) => { waterEditorSelectedId = id; waterEditorPlacementIndex = index }"
          @editing-warning="waterEditorWarning = $event"
          @editing-size="waterEditorFontSize = $event"
        />
      </svg>

      <!-- Keep painted highlights in their own SVG. Firefox otherwise keeps a
           low-resolution raster of the much larger interaction group after a
           close zoom, especially when a component also highlights its parent. -->
      <svg
        v-if="canvasRendererActive"
        :key="highlightRevision"
        class="map-highlights"
        :viewBox="`0 0 ${mapWidth} ${mapHeight}`"
        aria-hidden="true"
      >
        <g :transform="`translate(${transform.x} ${transform.y}) scale(${transform.scale})`">
          <g
            v-for="offset in copyOffsets"
            :key="offset"
            :transform="offset === 0 ? undefined : `translate(${offset} 0)`"
          >
            <path
              v-for="{ unit, path, outlinePath } in highlightedGeographicPaths"
              :key="unit.id"
              :d="detailedGeographicPathById.get(unit.id)?.path ?? path"
              class="country country--visual"
              :class="geographicUnitClasses(unit)"
              :style="(detailedGeographicPathById.get(unit.id)?.outlinePath ?? outlinePath) !== undefined ? { stroke: 'none' } : undefined"
            />
            <path
              v-for="{ unit, outlinePath } in highlightedGeographicPaths"
              :key="`outline-${unit.id}`"
              :d="detailedGeographicPathById.get(unit.id)?.outlinePath ?? outlinePath"
              class="country-outline"
              :class="geographicUnitClasses(unit)"
              style="fill: none"
            />
            <path
              v-for="{ unit, divisionPath } in highlightedGeographicPaths.filter(({ unit }) => !!unit.divisionGeometry)"
              :key="`internal-${unit.id}`"
              :d="detailedGeographicPathById.get(unit.id)?.divisionPath ?? divisionPath"
              class="regional-division internal-boundary"
            />
          </g>
        </g>
      </svg>

      <!-- Shared overlay keeps claim lines visible above canvas/SVG fills and
           highlights without changing country hit targets or quiz answers. -->
      <svg
        v-if="disputedBoundaryPaths.length"
        class="map-highlights"
        :viewBox="`0 0 ${mapWidth} ${mapHeight}`"
        aria-hidden="true"
      >
        <g :transform="`translate(${transform.x} ${transform.y}) scale(${transform.scale})`">
          <g v-for="offset in copyOffsets" :key="offset" :transform="`translate(${offset} 0)`">
            <path
              v-for="boundary in disputedBoundaryPaths"
              :key="boundary.id"
              :d="boundary.path"
              class="disputed-boundary"
            />
          </g>
        </g>
      </svg>

      <div ref="projectionSnapshot" class="map-projection-snapshot" :class="{ 'map-projection-snapshot--fading': projectionSnapshotFading }" aria-hidden="true" inert />

      <MapSettingsPanel :open="settingsOpen" :locale="locale" :detail-loading="detailLoading" :projection-loading="projectionLoading"
        :high-detail-enabled="highDetailEnabled" :bathymetry-loading="bathymetryLoading" :bathymetry-enabled="bathymetryEnabled"
        :relief-loading="reliefLoading" :relief-enabled="reliefEnabled" :interaction-locked="interactionLocked" :quiz-mode="quizMode"
        :projection-id="projectionId" :quiz-tips-enabled="quizTipsEnabled" :suggest-all-countries="suggestAllCountries"
        :automatic-answer-reveal="automaticAnswerReveal" :always-show-wrong-answer="alwaysShowWrongAnswer"
        v-model:auto-regional-projection="autoRegionalProjection" v-model:marine-labels-enabled="marineLabelsEnabled"
        v-model:country-markers-enabled="countryMarkersEnabled" v-model:limited-country-zoom-enabled="limitedCountryZoomEnabled"
        v-model:scale-bar-enabled="scaleBarEnabled" v-model:scale-units="scaleUnits"
        @locale-change="emit('locale-change', $event)" @detail-change="requestDetailChange" @bathymetry-change="setBathymetryEnabled"
        @relief-change="setReliefEnabled" @projection-change="selectProjection" @quiz-tips-enabled-change="emit('quiz-tips-enabled-change', $event)"
        @quiz-tips-reset="emit('quiz-tips-reset')" @suggest-all-countries-change="emit('suggest-all-countries-change', $event)"
        @automatic-answer-reveal-change="emit('automatic-answer-reveal-change', $event)" @wrong-answer-preference-change="emit('wrong-answer-preference-change', $event)" />

      <div class="map-tools" :class="{ 'map-tools--with-scale': scaleBar }">
        <span>
          {{ quizMode && (quizAnswerId !== null || quizSkipped) ? t('continueHint') : t('mapHint') }}
        </span>
        <button v-if="isZoomed" type="button" @click="resetView">
          {{ t('resetView') }}
        </button>
        <button v-if="!quizMode" type="button" :disabled="interactionLocked || isInteracting" @click="copyViewLink" aria-live="polite">
          {{ t(viewCopyStatus === 'copied' ? 'viewLinkCopied' : viewCopyStatus === 'failed' ? 'viewLinkCopyFailed' : 'copyViewLink') }}
        </button>
      </div>
      <button
        v-if="gestureDebugEnabled"
        type="button"
        class="touch-zoom-preview-status"
        :disabled="!lastGestureReport || gestureDiagnosticsActive"
        :aria-label="t(lastGestureReport ? 'copyLastGesture' : 'noGestureReport')"
        :title="t(lastGestureReport ? 'copyLastGesture' : 'noGestureReport')"
        @click="copyLastGesture"
        :class="{ 'touch-zoom-preview-status--active': fastTouchZoomPreview && canvasRendererActive }"
      >
        <span class="touch-zoom-preview-status__dot" aria-hidden="true" />
        {{ t(gestureCopyState === 'copied' ? 'gestureCopied' : gestureCopyState === 'failed' ? 'gestureCopyFailed' : !canvasRendererActive ? 'svgZoom' : fastTouchZoomPreview ? (isDragging ? 'touchPanPreview' : 'fastZoomPreview') : restoringTouchDetail ? 'restoringZoomDetail' : 'normalZoom') }}
      </button>
      <WaterLabelEditor
        v-if="waterEditorEnabled && !quizMode && WaterLabelEditor"
        v-model:selected-id="waterEditorSelectedId"
        v-model:placement-index="waterEditorPlacementIndex"
        :width="mapWidth" :height="mapHeight" :transform="transform"
        :project-point="projectPoint" :unproject-point="unprojectPoint"
        :project-geometry="projectGeometry"
        :wrap-period="horizontalWrap?.period ?? null" :copy-offsets="copyOffsets"
        :disabled="interactionLocked || isInteracting"
        :warning="waterEditorWarning"
        :font-size="waterEditorFontSize"
        @preview="waterEditorPlacements = $event" @editing="waterEditorEditing = $event"
        @labels="waterEditorLabels = $event"
        @focus="focusWaterEditor"
      />
      <MapScaleBar v-if="scaleBar" :scale="scaleBar" />
      <MapDebugPanel
        v-if="debugEnabled && debugMetrics"
        v-bind="debugMetrics"
        :question-ring-grouping-gap="nameCountryQuiz ? questionRingGroupingGap : undefined"
        :question-ring-count="nameCountryQuiz ? namedQuestionMarkers.length : undefined"
        @update:question-ring-grouping-gap="setQuestionRingGroupingGap"
        :disabled="interactionLocked"
        @reset-settings="resetMapSettings"
      />
    </div>
    <div
      v-if="interactionLocked"
      class="map-loading-overlay"
      :style="{ '--map-blur-duration': `${projectionBlurDuration}ms` }"
      :class="{ 'map-loading-overlay--blurred': mapBlurred }"
    >
      <LoadingIndicator v-if="mapBlurred" :label="t(projectionLoading ? 'loadingProjection' : 'loadingMap')" />
    </div>
  </div>
</template>

<style scoped>
.map-stage {
  position: relative;
  width: 100%;
  height: 100%;
}

.map-stage,
.map-stage * {
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
}

.map-container {
  position: relative;
  width: 100%;
  height: 100%;
  /* Unlike hidden, clip cannot be scrolled by focus/scrollIntoView. */
  overflow: clip;
}

.world-map {
  position: relative;
  /* Keep screen-space quiz markers and labels above painted country highlights. */
  z-index: 2;
  display: block;
  width: 100%;
  height: 100%;
  cursor: grab;
  -webkit-tap-highlight-color: transparent;
  -webkit-user-select: none;
  user-select: none;
  touch-action: none;
}

.map-highlights {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.map-water-labels {
  z-index: 2;
}

.map-loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: grid;
  place-items: center;
  cursor: default;
  backdrop-filter: blur(0);
  transition: backdrop-filter var(--map-blur-duration, 280ms) ease;
}

.map-loading-overlay--blurred {
  backdrop-filter: blur(5px);
}

.map-projection-snapshot {
  position: absolute;
  inset: 0;
  z-index: 2;
  overflow: clip;
  background: var(--map-ocean);
  opacity: 1;
  pointer-events: none;
  transition: opacity 1900ms ease;
}

.map-projection-snapshot:empty { display: none; }
.map-projection-snapshot--fading { opacity: 0; }

.map-loading-overlay :deep(.loading-indicator) {
  position: relative;
}

.map-sphere {
  fill: var(--map-ocean);
  /* Ocean gestures target the persistent SVG, not this fallback-only path. */
  pointer-events: none;
}

.world-map--bathymetry .map-sphere {
  fill: var(--map-bathymetry-surface);
}

/* Match the repeated sphere where two cylindrical copies meet at a pixel edge. */
.world-map--wrapped {
  background-color: var(--map-ocean);
}

.world-map--wrapped.world-map--bathymetry {
  background-color: var(--map-bathymetry-surface);
}

.world-map--canvas.world-map--wrapped {
  background-color: transparent;
}

.bathymetry {
  pointer-events: none;
}

.bathymetry__band {
  stroke: none;
}

.bathymetry__band--200 {
  fill: var(--map-bathymetry-200);
}

.bathymetry__band--2000 {
  fill: var(--map-bathymetry-2000);
}

.bathymetry__band--3000 {
  fill: var(--map-bathymetry-3000);
}

.bathymetry__band--4000 {
  fill: var(--map-bathymetry-4000);
}

.bathymetry__band--5000 {
  fill: var(--map-bathymetry-5000);
}

.bathymetry__band--6000 {
  fill: var(--map-bathymetry-6000);
}

.bathymetry__band--7000 {
  fill: var(--map-bathymetry-7000);
}

.terrain,
.relief {
  pointer-events: none;
}

.context-land {
  fill: var(--map-context-land);
  stroke: var(--map-context-border);
  stroke-width: 0.6;
  vector-effect: non-scaling-stroke;
  pointer-events: none;
}

.terrain__land {
  fill: var(--map-land);
}

.background-land-outline {
  fill: none;
  stroke: var(--map-border);
  stroke-width: 0.85;
  vector-effect: non-scaling-stroke;
  pointer-events: none;
}

.terrain--relief .terrain__land {
  fill: var(--map-relief-land);
}

.relief__band {
  mix-blend-mode: screen;
  stroke: none;
}

.relief__band--500 {
  fill: var(--map-relief-500);
  fill-opacity: var(--map-relief-500-opacity);
}

.relief__band--1000 {
  fill: var(--map-relief-1000);
  fill-opacity: var(--map-relief-1000-opacity);
}

.relief__band--1500 {
  fill: var(--map-relief-1500);
  fill-opacity: var(--map-relief-1500-opacity);
}

.relief__band--2250 {
  fill: var(--map-relief-2250);
  fill-opacity: var(--map-relief-2250-opacity);
}

.relief__band--3000 {
  fill: var(--map-relief-3000);
  fill-opacity: var(--map-relief-3000-opacity);
}

.relief__band--4000 {
  fill: var(--map-relief-4000);
  fill-opacity: var(--map-relief-4000-opacity);
}

.country {
  fill: transparent;
  stroke: var(--map-border);
  stroke-width: 0.85;
  vector-effect: non-scaling-stroke;
  cursor: pointer;
  outline: none;
  -webkit-tap-highlight-color: transparent;
  transition: fill 120ms ease;
}

/* Canvas paints the ordinary borders; SVG remains the accessible hit and
   highlight layer, so selected and hovered borders still render above it. */
.world-map--canvas .country:not(:focus-visible, .country--identity-hover, .country--selected, .country--related, .country--quiz-correct, .country--quiz-correct-related, .country--quiz-wrong, .country--quiz-wrong-related) {
  stroke: none;
}

.country-outline {
  stroke: var(--map-border);
  stroke-width: 0.85;
  vector-effect: non-scaling-stroke;
  pointer-events: none;
}

.country--quiz-inactive {
  pointer-events: none;
}

.world-map--canvas .country.country--hit-only {
  fill: none;
  stroke: none;
  /* Invisible hit paths need no fixed-width stroke calculations on zoom. */
  vector-effect: none;
  pointer-events: visibleFill;
  transition: none;
}

/* Pinches cannot select countries. Suspend only invisible hit geometry;
   neutral land and answer highlights stay visible, and SVG fallback stays intact. */
.map-container--fast-touch-zoom .world-map--canvas .country--hit-only { display: none; }

.world-map--canvas .country--hit-only.country--quiz-inactive,
.map-container--dragging .world-map--canvas .country--hit-only {
  pointer-events: none;
}

.world-map--canvas .country.country--hit-only:focus-visible {
  fill: rgb(247 192 122 / 82%);
  stroke: #172d38;
  vector-effect: non-scaling-stroke;
}

.country--visual {
  pointer-events: none;
  transition: none;
}

.map-container--dragging .world-map,
.map-container--dragging .country {
  cursor: grabbing;
}

.map-container--dragging .country {
  pointer-events: none;
}

.map-container--interacting .country {
  transition: none;
}

:global(html[data-input-modality='keyboard'] .country:focus-visible) {
  fill: rgb(247 192 122 / 82%);
}

:global(html[data-input-modality='keyboard'] .country:focus-visible) {
  stroke: #172d38;
  stroke-width: 2;
}

.country--related,
:global(html[data-input-modality='keyboard'] .country--related:focus-visible) {
  fill: rgb(247 192 122 / 38%);
  stroke: #c39362;
  stroke-width: 0.95;
}

.country--selected,
.supplemental-land.country--selected,
:global(html[data-input-modality='keyboard'] .country--selected:focus-visible) {
  fill: rgb(239 151 72 / 88%);
  stroke: #a85d2c;
  stroke-width: 1.2;
}

.country--identity-hover:not(.country--selected, .country--related) {
  fill: rgb(247 192 122 / 82%);
}

.country--quiz-question-related { fill: rgb(190 169 218 / 80%); stroke: #80619e; stroke-width: 1.1; }
.country--quiz-question { fill: rgb(143 108 183 / 88%); stroke: #593779; stroke-width: 1.5; }
.small-country-distribution { fill: var(--ui-ink); stroke: var(--ui-surface); stroke-width: 2; pointer-events: none; }
.named-question-markers { fill: none; stroke: #8f6cb7; stroke-width: 2.5; pointer-events: none; }
.named-question-markers__back { stroke: var(--ui-surface); stroke-width: 4.5; }
.world-map--naming .country,
.world-map--naming .country.country--hit-only { pointer-events: none; cursor: grab; }

.country--quiz-correct-related,
:global(html[data-input-modality='keyboard'] .country--quiz-correct-related:focus-visible) {
  fill: rgb(169 220 188 / 72%);
  stroke: #59916e;
  stroke-width: 1.05;
}

.country--quiz-correct,
:global(html[data-input-modality='keyboard'] .country--quiz-correct:focus-visible) {
  fill: rgb(105 190 137 / 82%);
  stroke: #26774a;
  stroke-width: 1.5;
}

.country--quiz-wrong-related,
:global(html[data-input-modality='keyboard'] .country--quiz-wrong-related:focus-visible) {
  fill: rgb(241 182 160 / 70%);
  stroke: #ba7866;
  stroke-width: 1.05;
}

.country--quiz-wrong,
:global(html[data-input-modality='keyboard'] .country--quiz-wrong:focus-visible) {
  fill: rgb(231 111 81 / 82%);
  stroke: #8f3522;
  stroke-width: 1.5;
}

@media (hover: hover) and (pointer: fine) {
  .world-map:not(.world-map--quiz) .country:not(.country--selected, .country--related, .country--hit-only):hover {
    fill: rgb(247 192 122 / 82%);
  }

  .country--related:hover {
    fill: rgb(247 192 122 / 48%);
    stroke: #c39362;
  }

  .country--selected:hover {
    fill: rgb(247 163 84 / 90%);
  }

  .country--quiz-correct-related.country--identity-hover {
    fill: rgb(188 229 201 / 76%);
  }

  .country--quiz-correct.country--identity-hover {
    fill: rgb(124 204 153 / 84%);
  }

  .country--quiz-wrong-related.country--identity-hover {
    fill: rgb(245 198 181 / 76%);
  }

  .country--quiz-wrong.country--identity-hover {
    fill: rgb(237 134 106 / 84%);
  }
}

:global(html[data-input-modality='keyboard'] .country--split-fill:focus-visible + .country-outline) {
  stroke: #172d38;
  stroke-width: 2;
}

.regional-division {
  fill: none;
  stroke: var(--map-regional-division);
  stroke-width: 1;
  stroke-dasharray: var(--map-regional-division-dash);
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
  pointer-events: none;
}

.internal-boundary {
  stroke: var(--map-internal-boundary);
  stroke-width: var(--map-internal-boundary-width);
  stroke-dasharray: var(--map-internal-boundary-dash);
}

.disputed-boundary {
  fill: none;
  stroke: var(--map-border);
  stroke-width: 1;
  stroke-dasharray: 5 3;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
  pointer-events: none;
}

.supplemental-land {
  fill: var(--map-land);
  stroke: none;
  pointer-events: visibleFill;
  vector-effect: non-scaling-stroke;
  outline: none;
  -webkit-tap-highlight-color: transparent;
}

.supplemental-land--named { cursor: pointer; }
.supplemental-land--named:hover { fill: #f5edda; }
.supplemental-land--selected { fill: #efe3c9; }
/* Affiliated Explore land shares the country fill, not its national border. */
.supplemental-land.country--selected { stroke: none; }
:global(html[data-input-modality='keyboard'] .supplemental-land--named:focus-visible) {
  stroke: #172d38;
  stroke-width: 1.5;
  vector-effect: non-scaling-stroke;
}

.map-tools {
  position: absolute;
  z-index: 3;
  right: 1.5rem;
  bottom: 1.4rem;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  max-width: calc(100% - 3rem);
  align-items: center;
  gap: 0.6rem;
  color: var(--ui-text);
  font-size: var(--ui-text-control);
  font-weight: var(--ui-weight);
  pointer-events: none;
}

.map-container--water-editor :deep(.map-settings-panel) { z-index: 7; }

/* Opt-in movement diagnostics, available on desktop and mobile. */
.touch-zoom-preview-status {
  position: absolute;
  z-index: 4;
  left: 0.75rem;
  bottom: calc(5.5rem + env(safe-area-inset-bottom));
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  padding: var(--ui-space-2) var(--ui-space-3);
  border: 2px solid var(--ui-ink);
  border-radius: var(--ui-radius-control);
  color: var(--ui-ink);
  background: var(--ui-paper);
  font-size: var(--ui-text-control);
  font-weight: var(--ui-weight-emphasis);
  pointer-events: auto;
  cursor: pointer;
}
.touch-zoom-preview-status:disabled { cursor: default; opacity: 1; }
:global(html[data-input-modality='keyboard'] .touch-zoom-preview-status:focus-visible) { outline: 2px solid var(--ui-focus); outline-offset: 3px; }
.touch-zoom-preview-status--active { color: var(--ui-paper); background: var(--ui-ink); border-color: var(--ui-accent); }
.touch-zoom-preview-status__dot { width: 0.5rem; height: 0.5rem; border-radius: 50%; background: currentColor; }
.touch-zoom-preview-status--active .touch-zoom-preview-status__dot { background: var(--ui-accent); }

.map-tools span,
.map-tools button {
  padding: 0.4rem 0.65rem;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-control);
  background: var(--ui-panel);
  box-shadow: var(--ui-shadow-control);
}

.map-tools button {
  color: var(--ui-ink);
  cursor: pointer;
  pointer-events: auto;
  white-space: nowrap;
}

.map-tools button:hover { background: var(--ui-surface); }
:global(html[data-input-modality='keyboard'] .map-tools button:focus-visible),
:global(html[data-input-modality='keyboard'] .scale-units-control select:focus-visible) {
  outline: 2px solid var(--ui-focus);
  outline-offset: 2px;
}

@media (max-width: 1100px) {
  .map-tools { top: 0.8rem; bottom: auto; }
  .map-tools--with-scale { top: auto; bottom: 1.4rem; }
  .map-tools span { display: none; }
}

@media (max-width: 850px) {
  .map-tools { top: auto; right: 0.75rem; bottom: calc(0.75rem + env(safe-area-inset-bottom)); }
}

@media (prefers-reduced-motion: reduce) {
  .map-projection-snapshot,
  .map-loading-overlay,
  .world-map,
  .country {
    transition: none;
  }
}
</style>

<style>
/* TreeSelect portals its popup outside the inert map. Hide that portal while
   the map is busy; disabling the selector also closes its internal menu. */
body:has(.map-stage--busy) .vue3-treeselect__menu {
  visibility: hidden;
}
</style>
