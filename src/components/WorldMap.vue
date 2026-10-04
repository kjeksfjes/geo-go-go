<script setup lang="ts">
import { geoArea, geoDistance } from 'd3-geo'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, toRef, useId, watch } from 'vue'
import MapDetailToggle from './MapDetailToggle.vue'
import CanvasMap from './CanvasMap.vue'
import LoadingIndicator from './LoadingIndicator.vue'
import MapDebugPanel from './MapDebugPanel.vue'
import MarineLabels from './MarineLabels.vue'
import MapScaleBar from './MapScaleBar.vue'
import ProjectionSelector from './ProjectionSelector.vue'
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
  type MapBounds,
  type MapHomeView,
  type MapPoint,
  type MapViewConstraint,
} from '../composables/useMapZoom'
import type { GeographicUnitFeature } from '../types/country'
import type { CanvasMapScene } from '../types/mapCanvas'
import type { MapRegion } from '../data/regions'
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
import { mapScaleBar, scaleUnitSystems, type ScaleUnitSystem } from '../logic/mapScale'
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
import {
  smallCountryMarkers as groupSmallCountryMarkers,
  type SmallCountryAnchor,
  type SmallCountryFeedbackMarker,
  type SmallCountryMarker,
} from '../logic/smallCountryMarkers'

const PREFERRED_COUNTRY_FOCUS_SCALE = 5
const mapSettingKeys = {
  projection: 'geo-go-go.map.projection',
  limitedCountryZoom: 'geo-go-go.map.limit-automatic-country-zoom',
  bathymetry: 'geo-go-go.map.bathymetry',
  relief: 'geo-go-go.map.relief',
  marineLabels: 'geo-go-go.map.water-names',
  scaleBar: 'geo-go-go.map.scale-bar',
  scaleUnits: 'geo-go-go.map.scale-units',
} as const

function initialProjection(): MapProjectionId {
  const saved = readStoredValue(mapSettingKeys.projection)
  return projectionOptions.some(({ id }) => id === saved) ? saved as MapProjectionId : 'mercator'
}

function initialScaleUnits(): ScaleUnitSystem {
  const saved = readStoredValue(mapSettingKeys.scaleUnits)
  return scaleUnitSystems.find((units) => units === saved) ?? 'metric'
}

const props = defineProps<{
  geographicUnits: GeographicUnitFeature[]
  detailedGeographicUnits: GeographicUnitFeature[] | null
  detailLoading: boolean
  detailBlurred: boolean
  highDetailEnabled: boolean
  settingsOpen: boolean
  locale: Locale
  activeRegion: MapRegion
  selectedCountryId: string | null
  selectedGeographicUnitId: string | null
  selectedLandAreaId: string | null
  quizMode: boolean
  quizComplete: boolean
  quizQuestionId: string | null
  quizAnswerId: string | null
  alwaysShowWrongAnswer: boolean
  visibleMapUnitIds: ReadonlySet<string>
}>()

const emit = defineEmits<{
  select: [countryId: string | null, geographicUnitId: string | null]
  'land-select': [id: string | null]
  'quiz-next': []
  'detail-change': [enabled: boolean, pathsCached: boolean]
  'locale-change': [locale: Locale]
  'reset-settings': []
}>()

const container = ref<HTMLElement | null>(null)
const svg = ref<SVGSVGElement | null>(null)
const mapContent = ref<SVGGElement | null>(null)
const projectionId = ref<MapProjectionId>(initialProjection())
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
const limitedCountryZoomEnabled = ref(readStoredBoolean(mapSettingKeys.limitedCountryZoom, true))
// Keep the SVG renderer available for a direct performance comparison.
const canvasRendererEnabled = new URLSearchParams(window.location.search).get('renderer') !== 'svg'
const canvasReady = ref(false)
const canvasRendererActive = computed(() => canvasRendererEnabled && canvasReady.value)
watch(projectionId, (value) => writeStoredValue(mapSettingKeys.projection, value))
watch(limitedCountryZoomEnabled, (value) => writeStoredValue(mapSettingKeys.limitedCountryZoom, value))
watch(bathymetryEnabled, (value) => writeStoredValue(mapSettingKeys.bathymetry, value))
watch(reliefEnabled, (value) => writeStoredValue(mapSettingKeys.relief, value))
watch(marineLabelsEnabled, (value) => writeStoredValue(mapSettingKeys.marineLabels, value))
watch(scaleBarEnabled, (value) => writeStoredValue(mapSettingKeys.scaleBar, value))
watch(scaleUnits, (value) => writeStoredValue(mapSettingKeys.scaleUnits, value))
const reliefClipId = `relief-land-${useId()}`
const hoveredUnit = ref<{ id: string; entityId: string } | null>(null)
const interactionState = computed<MapInteractionState>(() => ({
  selectedCountryId: props.selectedCountryId,
  selectedGeographicUnitId: props.selectedGeographicUnitId,
  hoveredEntityId: hoveredUnit.value?.entityId ?? null,
  quizMode: props.quizMode,
  quizComplete: props.quizComplete,
  quizQuestionId: props.quizQuestionId,
  quizAnswerId: props.quizAnswerId,
}))
const highlightRevision = ref(0)
const projectionLoading = ref(false)
const projectionBlurred = ref(false)
const debugEnabled = new URLSearchParams(window.location.search).has('debug')
const highlightRestoredLand = ref(false)
const reviewedLandId = ref('')
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
const { width: measuredWidth, height: measuredHeight } = useElementSize(container)
const mapWidth = computed(() => Math.max(measuredWidth.value, 320))
const mapHeight = computed(() => Math.max(measuredHeight.value, 280))
const {
  bathymetryPaths,
  contextGeographicPaths,
  disputedBoundaryPaths,
  geographicPaths,
  hasCachedPaths,
  horizontalWrap,
  interactionGeographicPaths,
  projectPoint,
  projectionDebug,
  projectionScale,
  reliefClipPath,
  reliefPaths,
  spherePath,
  supplementalLandPaths,
  supplementalExploreLandPaths,
  unprojectPoint,
} = useMapProjection(
  toRef(props, 'geographicUnits'),
  mapWidth,
  mapHeight,
  projectionId,
  toRef(props, 'activeRegion'),
  toRef(props, 'visibleMapUnitIds'),
  bathymetryBands,
  reliefBands,
  toRef(props, 'quizMode'),
)
const visibleSupplementalLandPaths = computed(() => props.quizMode
  ? supplementalLandPaths.value.filter((area) => !quizMergedSourceIds.has(area.id))
  : supplementalExploreLandPaths.value,
)
function reviewRestoredLand(id: string) {
  reviewedLandId.value = id
  highlightRestoredLand.value = true
  const area = supplementalLandPaths.value.find((area) => area.id === id)
  if (!area) return
  const [[left, top], [right, bottom]] = area.bounds
  if (![left, top, right, bottom].every(Number.isFinite)) return
  // Leave room around tiny islands and long buffer zones for geographic context.
  const scale = Math.min(2048, Math.max(8,
    Math.min(mapWidth.value / Math.max(right - left, 0.001),
      mapHeight.value / Math.max(bottom - top, 0.001)) * 0.35))
  zoomToPoint([(left + right) / 2, (top + bottom) / 2], scale)
}
// Global projections keep their world-sized canvas. At minimum zoom, center
// the filtered region within that canvas instead of returning to world origin.
const minimumZoomPoint = computed<MapPoint | null>(() => {
  if (props.activeRegion.id === 'world' || projectionId.value === 'regional-equal-area') return null
  const center = props.activeRegion.view?.center
  return center ? projectPoint(center) ?? null : null
})
const regionViewConstraint = computed<MapViewConstraint | null>(() => {
  if (props.activeRegion.id === 'world') return null
  if (projectionId.value !== 'regional-equal-area') {
    const view = props.activeRegion.view
    const center = view && projectPoint(view.center)
    if (!view || !center) return null
    // The global projections need an explicit region-centered navigation
    // envelope. A member's remote geometry must not open up the whole world.
    const reach = view.panReach ?? 0.45
    const radiusX = mapWidth.value * reach / view.zoom
    const radiusY = mapHeight.value * reach / view.zoom
    return {
      minScale: Math.max(1.15, view.zoom * 0.8),
      bounds: [
        [center[0] - radiusX, center[1] - radiusY],
        [center[0] + radiusX, center[1] + radiusY],
      ],
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
  if (projectionId.value === 'regional-equal-area') return null

  const regionalView = props.activeRegion.view
  const center = regionalView?.center
    ?? (usesMobileMapDefaults && props.activeRegion.id === 'world' ? [24, 31] as const : null)
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
  const regional = unit.regionalDisplayGeometry?.[props.activeRegion.id]?.geometry
  if (regional?.type === 'GeometryCollection' && regional.geometries.length === 0) return false
  return unit.properties.mapUnitIds.some((id) => props.visibleMapUnitIds.has(id))
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
  minimumZoomPoint,
  regionViewConstraint,
  homeView,
)

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
        props.visibleMapUnitIds,
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
    region: regionName(props.activeRegion),
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
    ? (props.quizAnswerId === null ? [] : [props.quizAnswerId, props.quizQuestionId])
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
  .join(' '))
const canvasScene = computed<CanvasMapScene>(() => ({
  coordinateKey: projectionId.value === 'regional-equal-area'
    ? `${projectionId.value}:${props.activeRegion.id}` : projectionId.value,
  spherePath: spherePath.value,
  bathymetry: bathymetryEnabled.value ? bathymetryPaths.value : [],
  contextCountries: contextGeographicPaths.value,
  relief: reliefEnabled.value ? reliefPaths.value : [],
  reliefClipPath: reliefEnabled.value ? reliefClipPath.value : '',
  countries: geographicPaths.value
    .filter(({ unit }) => isGeographicUnitVisible(unit))
    .map(({ unit, path, outlinePath, divisionPath, displayBounds }) => ({
      path, outlinePath, divisionPath, bounds: displayBounds,
      internalBoundary: !!unit.divisionGeometry,
    })),
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

const copyOffsets = computed(() => {
  const wrap = horizontalWrap.value
  if (!wrap) return [0]
  // A narrow projected world can expose more than one repeat on very wide
  // screens. At closer zoom, only the neighbor toward the seam is needed.
  if (!needsBothNeighbors.value) return [0, wrapNeighborDirection.value * wrap.period]
  const count = visibleCopyCount.value
  return [
    0,
    ...Array.from({ length: count }, (_, index) => -(index + 1) * wrap.period),
    ...Array.from({ length: count }, (_, index) => (index + 1) * wrap.period),
  ]
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

const quizSmallCountryMarkers = computed(() =>
  props.quizMode && props.quizAnswerId === null && !props.quizComplete && !isInteracting.value
    ? groupSmallCountryMarkers(
        smallCountryAnchors.value, transform, copyOffsets.value, mapWidth.value, mapHeight.value,
      )
    : [],
)

const quizFeedbackMarkers = computed<SmallCountryFeedbackMarker[]>(() => {
  if (!props.quizMode || props.quizAnswerId === null || props.quizComplete || isInteracting.value) return []
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
  // This projection is already fitted to the selected region at scale 1.
  if (projectionId.value === 'regional-equal-area') {
    resetZoom(animated)
    restoreHoverUnderPointer()
    return
  }
  const view = props.activeRegion.view
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
  emit('select', null, null)
  focusActiveRegion(true, true)
}

watch(
  () => props.activeRegion.id,
  () => focusActiveRegion(projectionId.value !== 'regional-equal-area'),
  { flush: 'post' },
)
watch(() => props.quizMode, (active) => {
  hoveredUnit.value = null
  if (active) focusActiveRegion(true, true)
}, { flush: 'post' })
watch([() => props.activeRegion.id, () => props.geographicUnits], () => {
  hoveredUnit.value = null
})
watch([() => props.quizQuestionId, () => props.quizAnswerId], () => {
  hoveredUnit.value = null
})
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

function selectCountry(
  countryId: string,
  geographicUnitId: string,
  bounds: MapBounds,
  focusPoint: MapPoint | undefined,
  event?: MouseEvent | KeyboardEvent,
  horizontalOffset = 0,
) {
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
  const detailed = canvasRendererActive.value
    ? detailedGeographicPathById.value.get(geographicUnitId)
    : undefined
  const target = selectionFocusTarget(
    geographicUnitId,
    detailed?.bounds ?? bounds,
    detailed?.focusPoint ?? focusPoint,
    geographicPaths.value,
    props.visibleMapUnitIds,
    horizontalOffset,
  )
  zoomToBounds(
    target.bounds,
    target.focusPoint,
    limitedCountryZoomEnabled.value
      ? { preferredScale: PREFERRED_COUNTRY_FOCUS_SCALE }
      : undefined,
  )
  restoreHoverUnderPointer()
}

function focusCountry(countryId: string) {
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
    props.visibleMapUnitIds,
    0,
  )
  zoomToBounds(
    target.bounds,
    target.focusPoint,
    limitedCountryZoomEnabled.value
      ? { preferredScale: PREFERRED_COUNTRY_FOCUS_SCALE }
      : undefined,
  )
  restoreHoverUnderPointer()
}

defineExpose({ focusCountry })

function handleMapClick(event: MouseEvent) {
  if (!props.quizMode) {
    if (!consumeDragClick() && (props.selectedLandAreaId !== null
      || backgroundClickAction(event.detail, interactionState.value) === 'clear')) {
      emit('select', null, null)
    }
    return
  }
  if (props.quizAnswerId === null) return
  if (consumeDragClick()) return
  if (backgroundClickAction(event.detail, interactionState.value) === 'next') emit('quiz-next')
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
  rememberHoverPointer(event)
  if (svg.value) {
    zoomFromWheel(event, svg.value)
  }
}

function handlePointerDown(event: PointerEvent) {
  if (event.pointerType === 'touch') return
  rememberHoverPointer(event)
  if (svg.value) startPan(event, svg.value)
}

function handlePointerMove(event: PointerEvent) {
  if (event.pointerType === 'touch') return
  rememberHoverPointer(event)
  movePan(event)
}

function handlePointerLeave(event: PointerEvent) {
  if (event.pointerType === 'touch') return
  lastHoverPointer = null
  hoveredUnit.value = null
}

function handlePointerEnd(event: PointerEvent) {
  if (event.pointerType === 'touch') return
  if (!svg.value) return
  endPan(event, svg.value)
}

function handleTouch(event: TouchEvent) {
  if (!svg.value) return
  const tap = updateTouches(event, svg.value)
  if (event.type === 'touchcancel') {
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
  const tapTarget = tap?.target
  if (consumeDragClick() || !tap || !(tapTarget instanceof Element) || !tapTarget.isConnected) return

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
  if (!event.isTrusted || !suppressCompatibilityClick) return
  suppressCompatibilityClick = false
  event.preventDefault()
  event.stopPropagation()
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
    if (isInteracting.value) return
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
  if (!isInteracting.value) hoveredUnit.value = { id: unit.id, entityId: unit.properties.entityId }
}

function hoverSmallCountryMarker(marker: SmallCountryMarker | null) {
  const target = marker?.targets.length === 1 ? marker.targets[0] : null
  hoveredUnit.value = target && !isInteracting.value
    ? { id: target.unitId, entityId: target.countryId }
    : null
}

function activateSmallCountryMarker(marker: SmallCountryMarker, event: MouseEvent | KeyboardEvent) {
  if (event instanceof MouseEvent && (consumeDragClick() || event.detail > 1)) return
  if (!canActivateGeographicUnit(interactionState.value)) return

  if (marker.targets.length === 1) {
    const target = marker.targets[0]
    emit('select', target.countryId, target.unitId)
    return
  }

  const xs = marker.targets.map((target) => target.screenX)
  const ys = marker.targets.map((target) => target.screenY)
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1)
  const factor = Math.min(24, Math.max(6, Math.min(mapWidth.value, mapHeight.value) * 0.3 / span))
  zoomToPoint(
    [(marker.x - transform.x) / transform.scale, (marker.y - transform.y) / transform.scale],
    transform.scale * factor,
  )
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
  highlightRestoredLand.value = false
  reviewedLandId.value = ''
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
  if (debugTimer !== undefined) window.clearInterval(debugTimer)
  if (compatibilityClickTimer !== undefined) window.clearTimeout(compatibilityClickTimer)
  if (hoverRestoreFrame !== undefined) cancelAnimationFrame(hoverRestoreFrame)
})

async function setProjection(nextId: MapProjectionId) {
  if (nextId === projectionId.value || interactionLocked.value) return

  if (!props.highDetailEnabled || hasCachedPaths(props.geographicUnits, nextId)) {
    projectionId.value = nextId
    return
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  projectionLoading.value = true
  projectionBlurred.value = true
  try {
    // Give the selector time to close and paint the blurred current projection
    // before projecting the detailed atlas on the main thread.
    await nextTick()
    await afterPaint()
    // The filter needs time to become visibly blurred before synchronous work
    // blocks the main thread.
    if (!reducedMotion) await wait(280)
    projectionId.value = nextId
    await nextTick()
    await afterPaint()
    // Updating an existing SVG can take another frame to rasterize. Keep the
    // newly projected paths blurred long enough to appear before deblurring.
    if (!reducedMotion) await wait(160)
  } finally {
    projectionBlurred.value = false
    if (!reducedMotion) {
      await nextTick()
      await afterPaint()
      await wait(280)
    }
    projectionLoading.value = false
  }
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
      :style="mapPaletteCssVariables"
      :class="{
        'map-container--dragging': isDragging,
        'map-container--interacting': isInteracting,
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
        :wrap-offset="canvasWrapOffset"
        :wrap-period="horizontalWrap?.period ?? null"
        @ready-change="canvasReady = $event"
      />
      <svg
        ref="svg"
        class="world-map"
        :class="{
          'world-map--wrapped': wrapActive,
          'world-map--canvas': canvasRendererActive,
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
            v-for="offset in canvasRendererActive ? [] : copyOffsets"
            :key="`sphere-${offset}`"
            class="map-sphere"
            :d="spherePath"
            :transform="offset === 0 ? undefined : `translate(${offset} 0)`"
          />
          <g v-if="bathymetryEnabled && !canvasRendererActive" class="bathymetry" aria-hidden="true">
            <g
              v-for="offset in copyOffsets"
              :key="offset"
              :transform="offset === 0 ? undefined : `translate(${offset} 0)`"
            >
              <path
                v-for="band in bathymetryPaths"
                :key="band.depth"
                class="bathymetry__band"
                :class="`bathymetry__band--${band.depth}`"
                :d="band.path"
              />
            </g>
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
          </g>
          <g
            v-for="offset in copyOffsets"
            :key="offset"
            class="countries"
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
                role="button"
                :tabindex="offset === 0 && isGeographicUnitVisible(unit) && canActivateGeographicUnit(interactionState) ? 0 : -1"
                :aria-label="geographicUnitLabel(unit)"
                :aria-hidden="!isGeographicUnitVisible(unit)"
                :aria-disabled="!canActivateGeographicUnit(interactionState)"
                :aria-pressed="quizMode ? unit.id === selectedGeographicUnitId : isPrimarySelectedExploreUnit(unit)"
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
                  'supplemental-land--review': debugEnabled && highlightRestoredLand,
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
                <title v-else-if="debugEnabled && highlightRestoredLand">{{ area.name }} (unassigned land)</title>
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
              <circle
                v-if="debugEnabled && highlightRestoredLand && (area.bounds[1][0] - area.bounds[0][0]) * transform.scale < 10 && (area.bounds[1][1] - area.bounds[0][1]) * transform.scale < 10"
                class="supplemental-land-marker"
                :cx="(area.bounds[0][0] + area.bounds[1][0]) / 2"
                :cy="(area.bounds[0][1] + area.bounds[1][1]) / 2"
                :r="5 / transform.scale"
              />
            </g>
          </g>
        </g>
        <SmallCountryMarkers
          v-if="quizSmallCountryMarkers.length || quizFeedbackMarkers.length"
          :markers="quizSmallCountryMarkers"
          :feedback-markers="quizFeedbackMarkers"
          :always-show-wrong-answer="alwaysShowWrongAnswer"
          @activate="activateSmallCountryMarker"
          @hover="hoverSmallCountryMarker"
        />
        <MarineLabels
          :visible="marineLabelsEnabled && !isInteracting"
          :width="mapWidth"
          :height="mapHeight"
          :transform="transform"
          :projection-scale="projectionScale"
          :project-point="projectPoint"
          :copy-offsets="copyOffsets"
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

      <div v-show="settingsOpen" id="map-settings-panel" class="map-settings-panel">
        <div class="map-settings-language">
          <span>{{ t('language') }}</span>
          <div class="language-selector" role="group" :aria-label="t('language')">
            <button type="button" :aria-pressed="locale === 'en'" lang="en" @click="emit('locale-change', 'en')">EN</button>
            <button type="button" :aria-pressed="locale === 'nb'" lang="nb" @click="emit('locale-change', 'nb')">NO</button>
          </div>
        </div>
        <div class="projection-control">
          <svg class="control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true">
            <path d="m2 5 6-2 8 2 6-2v16l-6 2-8-2-6 2V5Zm6-2v16m8-14v16" />
          </svg>
          <ProjectionSelector
            :model-value="projectionId"
            :disabled="interactionLocked"
            :options="projectionOptions"
            @update:model-value="setProjection"
          />
        </div>
        <MapDetailToggle
          :label="t('limitAutomaticCountryZoom')"
          :model-value="limitedCountryZoomEnabled"
          @update:model-value="limitedCountryZoomEnabled = $event"
        />
        <MapDetailToggle
          :label="t('bathymetry')"
          :loading="bathymetryLoading"
          :disabled="interactionLocked"
          :model-value="bathymetryEnabled"
          @update:model-value="setBathymetryEnabled"
        />
        <MapDetailToggle
          :label="t('relief')"
          :loading="reliefLoading"
          :disabled="interactionLocked"
          :model-value="reliefEnabled"
          @update:model-value="setReliefEnabled"
        />
        <MapDetailToggle
          :label="t('waterNames')"
          :disabled="interactionLocked"
          :model-value="marineLabelsEnabled"
          @update:model-value="marineLabelsEnabled = $event"
        />
        <MapDetailToggle
          :label="t('showScaleBar')"
          :model-value="scaleBarEnabled"
          @update:model-value="scaleBarEnabled = $event"
        />
        <label class="scale-units-control" for="map-scale-units">
          <span>{{ t('scaleUnits') }}</span>
          <select id="map-scale-units" v-model="scaleUnits">
            <option value="metric">{{ t('metricUnits') }}</option>
            <option value="imperial">{{ t('imperialUnits') }}</option>
            <option value="nautical">{{ t('nauticalUnits') }}</option>
          </select>
        </label>
        <MapDetailToggle
          :loading="detailLoading"
          :disabled="projectionLoading"
          :model-value="highDetailEnabled"
          @update:model-value="requestDetailChange"
        />
      </div>

      <div class="map-tools" :class="{ 'map-tools--with-scale': scaleBar }">
        <span>
          {{ quizMode && quizAnswerId !== null ? t('continueHint') : t('mapHint') }}
        </span>
        <button v-if="isZoomed" type="button" @click="resetView">
          {{ t('resetView') }}
        </button>
      </div>
      <MapScaleBar v-if="scaleBar" :scale="scaleBar" />
      <MapDebugPanel
        v-if="debugEnabled && debugMetrics"
        v-bind="debugMetrics"
        :disabled="interactionLocked"
        :restored-land="supplementalLandPaths"
        :highlight-restored-land="highlightRestoredLand"
        :reviewed-land-id="reviewedLandId"
        :can-review-land="activeRegion.id === 'world' && projectionId !== 'regional-equal-area'"
        @toggle-restored-land="highlightRestoredLand = !highlightRestoredLand"
        @review-land="reviewRestoredLand"
        @reset-settings="resetMapSettings"
      />
    </div>
    <div
      v-if="interactionLocked"
      class="map-loading-overlay"
      :class="{ 'map-loading-overlay--blurred': mapBlurred }"
    >
      <LoadingIndicator v-if="mapBlurred" :label="t('loadingMap')" />
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

.map-loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: grid;
  place-items: center;
  cursor: default;
  backdrop-filter: blur(0);
  transition: backdrop-filter 280ms ease;
}

.map-loading-overlay--blurred {
  backdrop-filter: blur(5px);
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
  pointer-events: visibleFill;
  transition: none;
}

.world-map--canvas .country--hit-only.country--quiz-inactive,
.map-container--dragging .world-map--canvas .country--hit-only {
  pointer-events: none;
}

.world-map--canvas .country.country--hit-only:focus-visible {
  fill: rgb(247 192 122 / 82%);
  stroke: #172d38;
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
  fill: rgb(239 144 72 / 70%);
  stroke: #bd7842;
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
  .country:hover {
    fill: rgb(247 192 122 / 82%);
  }

  .country--related:hover {
    fill: rgb(247 162 86 / 80%);
    stroke: #bd7842;
  }

  .country--selected:hover {
    fill: rgb(247 163 84 / 90%);
  }

  .country--quiz-correct-related:hover {
    fill: rgb(188 229 201 / 76%);
  }

  .country--quiz-correct:hover {
    fill: rgb(124 204 153 / 84%);
  }

  .country--quiz-wrong-related:hover {
    fill: rgb(245 198 181 / 76%);
  }

  .country--quiz-wrong:hover {
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

.supplemental-land.supplemental-land--review {
  fill: #e850b4;
  stroke: #9d126c;
  stroke-width: 1.25;
  vector-effect: non-scaling-stroke;
}

.supplemental-land-marker {
  fill: none;
  stroke: #9d126c;
  stroke-width: 1.5;
  vector-effect: non-scaling-stroke;
  pointer-events: none;
}

.map-tools {
  position: absolute;
  z-index: 3;
  right: 1.5rem;
  bottom: 1.4rem;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: #52676e;
  font-size: 0.72rem;
  font-weight: 650;
  pointer-events: none;
}

.projection-control {
  --map-select-arrow-right: 0.8rem;
  display: flex;
  align-items: center;
  min-width: 0;
  border: 1px solid rgba(82, 103, 110, 0.18);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.86);
}

.projection-control :deep(.map-select-field) {
  min-width: 0;
  flex: 1;
}

.projection-control :deep(.map-select-field .vue3-treeselect) {
  width: 100%;
  min-width: 0;
}

.projection-control :deep(.vue3-treeselect__single-value) { padding-right: 1.75rem; }

.control-icon {
  width: 1.4rem;
  height: 1.4rem;
  flex: none;
  margin-left: 0.65rem;
  color: #17374b;
}

.map-settings-panel {
  position: absolute;
  z-index: 4;
  top: 0.85rem;
  right: 1.25rem;
  display: grid;
  width: min(18rem, calc(100% - 1.5rem));
  gap: 0.35rem;
  padding: 0.5rem;
  border: 1px solid rgba(82, 103, 110, 0.18);
  border-radius: 16px;
  background: rgba(250, 252, 252, 0.95);
  box-shadow: 0 12px 30px rgba(23, 45, 56, 0.15);
  backdrop-filter: blur(12px);
}

.map-settings-panel :deep(.detail-toggle) {
  width: 100%;
  min-height: 2.55rem;
  justify-content: space-between;
  border-radius: 12px;
}

.map-settings-language {
  display: none;
}

.scale-units-control {
  display: flex;
  min-height: 2.55rem;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
  padding: 0.45rem 0.7rem;
  border: 1px solid rgba(82, 103, 110, 0.18);
  border-radius: 12px;
  color: #52676e;
  background: rgba(255, 255, 255, 0.86);
  font-size: 0.72rem;
  font-weight: 700;
}

.scale-units-control select {
  min-width: 0;
  max-width: 9rem;
  padding: 0.25rem;
  border: 1px solid rgba(82, 103, 110, 0.25);
  border-radius: 6px;
  color: #17374b;
  background: #fff;
  font: inherit;
}

.map-tools span,
.map-tools button {
  padding: 0.4rem 0.65rem;
  border: 1px solid rgba(82, 103, 110, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 3px 12px rgba(23, 45, 56, 0.08);
  backdrop-filter: blur(7px);
}

.map-tools button {
  color: #172d38;
  cursor: pointer;
  pointer-events: auto;
  white-space: nowrap;
}

.map-tools button:hover,
:global(html[data-input-modality='keyboard'] .map-tools button:focus-visible) {
  background: #fff;
}

@media (max-width: 1100px) {
  .map-tools { top: 0.8rem; bottom: auto; }
  .map-tools--with-scale { top: auto; bottom: 1.4rem; }
  .map-tools span { display: none; }
}

@media (max-width: 850px) {
  .map-tools { top: auto; right: 0.75rem; bottom: calc(0.75rem + env(safe-area-inset-bottom)); }
  .map-settings-panel { top: 0.75rem; right: 0.75rem; }
}

@media (max-width: 680px) {
  .map-settings-panel {
    max-height: calc(100% - 1.5rem);
    overflow-y: auto;
  }

  .map-settings-language {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.35rem;
    padding: 0.2rem 0.2rem 0.55rem;
    border-bottom: 1px solid rgba(82, 103, 110, 0.18);
    color: #52676e;
    font-size: 0.72rem;
    font-weight: 700;
  }

  .map-settings-language :deep(.language-selector) { padding: 0.15rem; }

  .map-settings-language :deep(.language-selector button) {
    min-height: 2.05rem;
    padding: 0.25rem 0.6rem;
  }
}

@media (prefers-reduced-motion: reduce) {
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
