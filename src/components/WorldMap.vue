<script setup lang="ts">
import { computed, nextTick, ref, toRef, useId, watch } from 'vue'
import MapDetailToggle from './MapDetailToggle.vue'
import CanvasMap from './CanvasMap.vue'
import MarineLabels from './MarineLabels.vue'
import ProjectionSelector from './ProjectionSelector.vue'
import RegionSelector from './RegionSelector.vue'
import { useElementSize } from '../composables/useElementSize'
import {
  projectionOptions,
  useMapProjection,
  type MapProjectionId,
} from '../composables/useMapProjection'
import { useMapZoom, type MapBounds, type MapPoint } from '../composables/useMapZoom'
import type { GeographicUnitFeature } from '../types/country'
import type { CanvasMapScene } from '../types/mapCanvas'
import type { MapRegion, MapRegionId } from '../data/regions'
import { afterPaint, wait } from '../utils/paint'
import { canShowCountryTooltip } from '../utils/countryTooltipVisibility'
import { countryName, t } from '../i18n'
import { isCountryLevelSelection, sharedFocusUnitIds } from '../data/mapSelection'

const props = defineProps<{
  geographicUnits: GeographicUnitFeature[]
  detailedGeographicUnits: GeographicUnitFeature[] | null
  detailLoading: boolean
  detailBlurred: boolean
  highDetailEnabled: boolean
  settingsOpen: boolean
  activeRegion: MapRegion
  regionOptions: readonly MapRegion[]
  selectedCountryId: string | null
  selectedGeographicUnitId: string | null
  quizMode: boolean
  quizComplete: boolean
  quizQuestionId: string | null
  quizAnswerId: string | null
  visibleMapUnitIds: ReadonlySet<string>
}>()

const emit = defineEmits<{
  select: [countryId: string | null, geographicUnitId: string | null]
  'quiz-next': []
  'detail-change': [enabled: boolean, pathsCached: boolean]
  'region-change': [regionId: MapRegionId]
}>()

const container = ref<HTMLElement | null>(null)
const svg = ref<SVGSVGElement | null>(null)
const mapContent = ref<SVGGElement | null>(null)
const projectionId = ref<MapProjectionId>('mercator')
const controlsOpen = ref(false)
const bathymetryEnabled = ref(true)
const reliefEnabled = ref(true)
const marineLabelsEnabled = ref(true)
// Keep the SVG renderer available for a direct performance comparison.
const canvasRendererEnabled = new URLSearchParams(window.location.search).get('renderer') !== 'svg'
const canvasReady = ref(false)
const canvasRendererActive = computed(() => canvasRendererEnabled && canvasReady.value)
// Temporary A/B switch while evaluating a replacement renderer. Full detail
// is the default; ?motion-fallback=1 restores the old interaction shortcuts.
const useSimplifiedMotionRendering = new URLSearchParams(window.location.search)
  .get('motion-fallback') === '1'
const reliefClipId = `relief-land-${useId()}`
const hoveredUnit = ref<{ id: string; entityId: string } | null>(null)
const projectionLoading = ref(false)
const projectionBlurred = ref(false)
const interactionLocked = computed(() => props.detailLoading || projectionLoading.value)
const mapBlurred = computed(() => props.detailBlurred || projectionBlurred.value)
const { width: measuredWidth, height: measuredHeight } = useElementSize(container)
const mapWidth = computed(() => Math.max(measuredWidth.value, 320))
const mapHeight = computed(() => Math.max(measuredHeight.value, 280))
const {
  bathymetryPaths,
  geographicPaths,
  hasCachedPaths,
  horizontalWrap,
  interactionGeographicPaths,
  projectPoint,
  projectionScale,
  reliefClipPath,
  reliefPaths,
  spherePath,
} = useMapProjection(
  toRef(props, 'geographicUnits'),
  mapWidth,
  mapHeight,
  projectionId,
  toRef(props, 'activeRegion'),
  toRef(props, 'visibleMapUnitIds'),
)
// Global projections keep their world-sized canvas. At minimum zoom, center
// the filtered region within that canvas instead of returning to world origin.
const minimumZoomPoint = computed<MapPoint | null>(() => {
  if (props.activeRegion.id === 'world' || projectionId.value === 'regional-equal-area') return null
  const center = props.activeRegion.view?.center
  return center ? projectPoint(center) ?? null : null
})
function geographicUnitClasses(unit: GeographicUnitFeature) {
  const entityId = unit.properties.entityId
  const clicked = unit.id === props.selectedGeographicUnitId

  if (!props.quizMode) {
    const selected = isPrimarySelectedExploreUnit(unit)
    return {
      'country--selected': selected,
      'country--related': entityId === props.selectedCountryId && !selected,
      'country--identity-hover': hoveredUnit.value?.entityId === entityId
        && entityId !== props.selectedCountryId,
    }
  }

  const answered = props.quizAnswerId !== null
  const correct = answered && entityId === props.quizQuestionId
  const wrong = answered && entityId === props.quizAnswerId && !correct
  const relatedAnswer = !clicked && props.selectedGeographicUnitId !== null

  return {
    'country--identity-hover': (props.quizComplete || (!answered && props.quizQuestionId !== null))
      && hoveredUnit.value?.entityId === entityId,
    'country--quiz-correct': correct && !(relatedAnswer && props.quizAnswerId === props.quizQuestionId),
    'country--quiz-correct-related': correct && relatedAnswer && props.quizAnswerId === props.quizQuestionId,
    'country--quiz-wrong': wrong && !relatedAnswer,
    'country--quiz-wrong-related': wrong && relatedAnswer,
    'country--quiz-inactive': answered && !correct && !wrong,
  }
}

function isPrimarySelectedExploreUnit(unit: GeographicUnitFeature) {
  if (unit.properties.entityId !== props.selectedCountryId) return false
  return isCountryLevelSelection(props.selectedCountryId, props.selectedGeographicUnitId)
    || unit.id === props.selectedGeographicUnitId
}

function isGeographicUnitVisible(unit: GeographicUnitFeature) {
  return unit.properties.mapUnitIds.some((id) => props.visibleMapUnitIds.has(id))
}
const {
  transform,
  consumeDragClick,
  endPan,
  isDragging,
  isInteracting,
  isZoomed,
  movePan,
  resetZoom,
  startPan,
  wrapActive,
  wrapNeighborDirection,
  zoomFromWheel,
  zoomToBounds,
  zoomToPoint,
} = useMapZoom(mapWidth, mapHeight, mapContent, horizontalWrap, minimumZoomPoint)

// Interaction uses the stable 50m country layer even when the final map is
// rendered at 10m. The semantic units and IDs are identical, so selection,
// accessibility and regional behavior do not change when the paths swap.
const renderedGeographicPaths = computed(() =>
  useSimplifiedMotionRendering && isInteracting.value
    ? interactionGeographicPaths.value
    : geographicPaths.value,
)

// SVG paths paint in DOM order. Put related geographic units above ordinary
// countries, the clicked unit above its siblings, and correct above wrong.
const paintedGeographicPaths = computed(() => {
  const paths = renderedGeographicPaths.value
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

const visibleLandPath = computed(() => renderedGeographicPaths.value
  .filter(({ unit }) => isGeographicUnitVisible(unit))
  .map(({ path }) => path)
  .join(' '))
const renderedBathymetryPaths = computed(() => useSimplifiedMotionRendering && isInteracting.value
  ? bathymetryPaths.value.filter(({ depth }) => depth === 200 || depth === 6000)
  : bathymetryPaths.value)
const renderedReliefPaths = computed(() => useSimplifiedMotionRendering && isInteracting.value
  ? reliefPaths.value.filter(({ elevation }) => elevation === 500 || elevation === 2250)
  : reliefPaths.value)

const canvasScene = computed<CanvasMapScene>(() => ({
  spherePath: spherePath.value,
  landPath: geographicPaths.value
    .filter(({ unit }) => isGeographicUnitVisible(unit))
    .map(({ path }) => path)
    .join(' '),
  bathymetry: bathymetryEnabled.value ? bathymetryPaths.value : [],
  relief: reliefEnabled.value ? reliefPaths.value : [],
  reliefClipPath: reliefEnabled.value ? reliefClipPath.value : '',
  countries: geographicPaths.value
    .filter(({ unit }) => isGeographicUnitVisible(unit))
    .map(({ path, outlinePath, divisionPath }) => ({ path, outlinePath, divisionPath })),
}))
const canvasWrapOffset = computed(() => wrapActive.value
  ? horizontalWrap.value?.period ?? null
  : null)

const wrappedGeographicPaths = computed(() => {
  const centerX = horizontalWrap.value?.centerX
  if (centerX === undefined) return []
  // At wrap-active zoom, the viewport is at most one projected world wide.
  // Only the adjoining half of the neighboring copy can enter it.
  return paintedGeographicPaths.value.filter(({ displayBounds }) =>
    wrapNeighborDirection.value > 0
      ? displayBounds[0][0] <= centerX
      : displayBounds[1][0] >= centerX,
  )
})

function wrapOffset(copyIndex: number) {
  return copyIndex === 0 ? 0 : wrapNeighborDirection.value * (horizontalWrap.value?.period ?? 0)
}

function offsetBounds(bounds: MapBounds, offset: number): MapBounds {
  return [[bounds[0][0] + offset, bounds[0][1]], [bounds[1][0] + offset, bounds[1][1]]]
}

function focusActiveRegion(animated: boolean, zoomOutFirst = false) {
  // This projection is already fitted to the selected region at scale 1.
  if (projectionId.value === 'regional-equal-area') {
    resetZoom(animated)
    return
  }
  const view = props.activeRegion.view
  if (!view) {
    resetZoom(animated)
    return
  }

  const point = projectPoint(view.center)
  if (point) zoomToPoint(point, view.zoom, animated, zoomOutFirst)
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
watch(isInteracting, (active) => {
  if (active) hoveredUnit.value = null
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
  if (props.quizMode) {
    // Ignore the second click of a double-click, including if the first click
    // advanced from the previous question.
    if (event instanceof MouseEvent && event.detail > 1) {
      event.stopPropagation()
      return
    }
    if (props.quizQuestionId && props.quizAnswerId === null) {
      event?.stopPropagation()
      emit('select', countryId, geographicUnitId)
    }
    return
  }
  emit('select', countryId, geographicUnitId)
  const group = sharedFocusUnitIds(geographicUnitId)
  const sharedPaths = group && geographicPaths.value.filter(({ unit }) =>
    group.includes(unit.id) && isGeographicUnitVisible(unit),
  )
  if (sharedPaths && sharedPaths.length > 1) {
    const x0 = Math.min(...sharedPaths.map(({ displayBounds }) => displayBounds[0][0])) + horizontalOffset
    const y0 = Math.min(...sharedPaths.map(({ displayBounds }) => displayBounds[0][1]))
    const x1 = Math.max(...sharedPaths.map(({ displayBounds }) => displayBounds[1][0])) + horizontalOffset
    const y1 = Math.max(...sharedPaths.map(({ displayBounds }) => displayBounds[1][1]))
    zoomToBounds([[x0, y0], [x1, y1]])
  } else {
    zoomToBounds(
      offsetBounds(bounds, horizontalOffset),
      focusPoint ? [focusPoint[0] + horizontalOffset, focusPoint[1]] : undefined,
    )
  }
}

function handleMapClick(event: MouseEvent) {
  if (!props.quizMode || props.quizAnswerId === null) return
  if (consumeDragClick() || event.detail > 1) return
  emit('quiz-next')
}

function handleWheel(event: WheelEvent) {
  if (svg.value) {
    zoomFromWheel(event, svg.value)
  }
}

function handlePointerDown(event: PointerEvent) {
  if (svg.value) startPan(event, svg.value)
}

function handlePointerEnd(event: PointerEvent) {
  if (svg.value) endPan(event, svg.value)
}

function clearHoveredUnit(id: string) {
  if (hoveredUnit.value?.id === id) hoveredUnit.value = null
}

function hoverGeographicUnit(unit: GeographicUnitFeature) {
  if (!isInteracting.value) {
    hoveredUnit.value = { id: unit.id, entityId: unit.properties.entityId }
  }
}

function requestDetailChange(enabled: boolean) {
  emit(
    'detail-change',
    enabled,
    enabled && props.detailedGeographicUnits !== null && hasCachedPaths(props.detailedGeographicUnits),
  )
}

function changeRegion(regionId: MapRegionId) {
  controlsOpen.value = false
  emit('region-change', regionId)
}

async function setProjection(nextId: MapProjectionId) {
  controlsOpen.value = false
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
  <div class="map-stage" :class="{ 'map-stage--busy': interactionLocked }" @keydown.esc="controlsOpen = false">
    <div
      ref="container"
      class="map-container"
      :class="{
        'map-container--dragging': isDragging,
        'map-container--interacting': useSimplifiedMotionRendering && isInteracting,
        'map-container--detail-blurred': mapBlurred,
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
        :class="{ 'world-map--wrapped': wrapActive, 'world-map--canvas': canvasRendererActive }"
        :viewBox="`0 0 ${mapWidth} ${mapHeight}`"
        role="group"
        :aria-label="t('interactiveMap')"
        @wheel.prevent="handleWheel"
        @pointerdown="handlePointerDown"
        @pointermove="movePan"
        @pointerup="handlePointerEnd"
        @pointercancel="handlePointerEnd"
        @click="handleMapClick"
      >
        <g ref="mapContent" class="map-content">
          <defs v-if="!canvasRendererActive">
            <clipPath :id="reliefClipId" clipPathUnits="userSpaceOnUse">
              <path :d="reliefClipPath" />
            </clipPath>
          </defs>
          <path
            v-for="copyIndex in canvasRendererActive ? [] : [0, 1]"
            :key="`sphere-${copyIndex}`"
            v-show="copyIndex === 0 || wrapActive"
            class="map-sphere"
            :d="spherePath"
            :transform="copyIndex === 0 ? undefined : `translate(${wrapOffset(copyIndex)} 0)`"
          />
          <g v-if="bathymetryEnabled && !canvasRendererActive" class="bathymetry" aria-hidden="true">
            <g
              v-for="copyIndex in [0, 1]"
              :key="copyIndex"
              v-show="copyIndex === 0 || wrapActive"
              :transform="copyIndex === 0 ? undefined : `translate(${wrapOffset(copyIndex)} 0)`"
            >
              <path
                v-for="band in renderedBathymetryPaths"
                :key="band.depth"
                class="bathymetry__band"
                :class="`bathymetry__band--${band.depth}`"
                :d="band.path"
              />
            </g>
          </g>
          <g
            v-for="copyIndex in canvasRendererActive ? [] : [0, 1]"
            :key="`terrain-${copyIndex}`"
            v-show="copyIndex === 0 || wrapActive"
            class="terrain"
            :transform="copyIndex === 0 ? undefined : `translate(${wrapOffset(copyIndex)} 0)`"
            aria-hidden="true"
          >
            <path class="terrain__land" :d="visibleLandPath" />
            <g v-if="reliefEnabled" class="relief" :clip-path="`url(#${reliefClipId})`">
              <path
                v-for="band in renderedReliefPaths"
                :key="band.elevation"
                class="relief__band"
                :class="`relief__band--${band.elevation}`"
                :d="band.path"
              />
            </g>
          </g>
          <g
            v-for="copyIndex in [0, 1]"
            :key="copyIndex"
            v-show="copyIndex === 0 || wrapActive"
            class="countries"
            :transform="copyIndex === 0 ? undefined : `translate(${wrapOffset(copyIndex)} 0)`"
            :aria-hidden="copyIndex === 1"
          >
            <g
              v-for="{ unit, path, outlinePath, divisionPath, bounds, focusPoint } in copyIndex === 0 ? paintedGeographicPaths : wrappedGeographicPaths"
              :key="unit.id"
              v-show="isGeographicUnitVisible(unit)"
            >
              <path
                :d="path"
                class="country"
                :class="[geographicUnitClasses(unit), { 'country--split-fill': !!outlinePath }]"
                :style="outlinePath ? { stroke: 'none' } : undefined"
                :data-country-id="unit.properties.entityId"
                :data-geographic-unit-id="unit.id"
                role="button"
                :tabindex="copyIndex === 0 && isGeographicUnitVisible(unit) && (!quizMode || (quizQuestionId && quizAnswerId === null)) ? 0 : -1"
                :aria-label="countryName(unit.properties.entityId)"
                :aria-hidden="!isGeographicUnitVisible(unit)"
                :aria-disabled="quizMode && (quizQuestionId === null || quizAnswerId !== null)"
                :aria-pressed="quizMode ? unit.id === selectedGeographicUnitId : isPrimarySelectedExploreUnit(unit)"
                @click="selectCountry(unit.properties.entityId, unit.id, bounds, focusPoint, $event, wrapOffset(copyIndex))"
                @pointerenter="hoverGeographicUnit(unit)"
                @pointerleave="clearHoveredUnit(unit.id)"
                @keydown.enter.prevent="selectCountry(unit.properties.entityId, unit.id, bounds, focusPoint, $event, wrapOffset(copyIndex))"
                @keydown.space.prevent="selectCountry(unit.properties.entityId, unit.id, bounds, focusPoint, $event, wrapOffset(copyIndex))"
              >
                <title v-if="canShowCountryTooltip(unit.properties.entityId, props)">{{ countryName(unit.properties.entityId) }}</title>
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
                :d="divisionPath"
                aria-hidden="true"
              />
            </g>
          </g>
          <MarineLabels
            :visible="marineLabelsEnabled && !isInteracting"
            :width="mapWidth"
            :height="mapHeight"
            :transform="transform"
            :projection-scale="projectionScale"
            :project-point="projectPoint"
            :wrap="horizontalWrap"
            :wrap-active="wrapActive"
            :wrap-direction="wrapNeighborDirection"
          />
        </g>
      </svg>

      <button
        class="map-controls-toggle"
        type="button"
        :aria-expanded="controlsOpen"
        aria-controls="map-controls"
        @click="controlsOpen = !controlsOpen"
      >{{ t('mapControls') }}</button>
      <div id="map-controls" class="map-controls" :class="{ 'map-controls--open': controlsOpen }">
        <div class="region-control">
          <svg class="control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3Z" />
          </svg>
          <RegionSelector
            :model-value="activeRegion.id"
            :options="regionOptions"
            @update:model-value="changeRegion"
          />
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
          :label="t('bathymetry')"
          :loading="interactionLocked"
          :model-value="bathymetryEnabled"
          @update:model-value="bathymetryEnabled = $event"
        />
        <MapDetailToggle
          :label="t('relief')"
          :loading="interactionLocked"
          :model-value="reliefEnabled"
          @update:model-value="reliefEnabled = $event"
        />
        <MapDetailToggle
          :label="t('waterNames')"
          :loading="interactionLocked"
          :model-value="marineLabelsEnabled"
          @update:model-value="marineLabelsEnabled = $event"
        />
      </div>

      <div v-show="settingsOpen" id="map-settings-panel" class="map-settings-panel">
        <MapDetailToggle
          :loading="interactionLocked"
          :model-value="highDetailEnabled"
          @update:model-value="requestDetailChange"
        />
      </div>

      <div class="map-tools">
        <span>
          {{ quizMode && quizAnswerId !== null ? t('continueHint') : t('mapHint') }}
        </span>
        <button v-if="isZoomed" type="button" @click="resetView">
          {{ t('resetView') }}
        </button>
      </div>
    </div>
    <div v-if="interactionLocked" class="map-loading-overlay">
      <p v-if="mapBlurred" class="map-loading-status" role="status">
        {{ t('loadingMap') }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.map-stage {
  position: relative;
  width: 100%;
  height: 100%;
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
  z-index: 1;
  display: block;
  width: 100%;
  height: 100%;
  cursor: grab;
  user-select: none;
  transition: filter 280ms ease;
}

.map-container--detail-blurred .world-map,
.map-container--detail-blurred .canvas-map-layer {
  filter: blur(5px);
}

.map-loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: grid;
  place-items: center;
  cursor: default;
}

.map-loading-status {
  margin: 0;
  padding: 0.7rem 1rem;
  border: 1px solid rgba(82, 103, 110, 0.18);
  border-radius: 999px;
  color: #172d38;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 8px 24px rgba(23, 45, 56, 0.14);
  font-size: 0.8rem;
  font-weight: 700;
}

.map-sphere {
  fill: #b7d4e1;
}

/* Match the repeated sphere where two Mercator copies meet at a pixel edge. */
.world-map--wrapped {
  background-color: #b7d4e1;
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
  fill: #a6c9d9;
}

.bathymetry__band--2000 {
  fill: #95bdcf;
}

.bathymetry__band--6000 {
  fill: #89b2c7;
}

.terrain,
.relief {
  pointer-events: none;
}

.terrain__land {
  fill: #f9f7ef;
}

.relief__band {
  stroke: none;
}

.relief__band--500 {
  fill: #d9e3d6;
  fill-opacity: 0.3;
}

.relief__band--1000 {
  fill: #cfdbcc;
  fill-opacity: 0.22;
}

.relief__band--1500 {
  fill: #c5d2c3;
  fill-opacity: 0.19;
}

.relief__band--2250 {
  fill: #bac9b8;
  fill-opacity: 0.17;
}

.relief__band--3000 {
  fill: #afc0af;
  fill-opacity: 0.15;
}

.country {
  fill: transparent;
  stroke: #9aa9a9;
  stroke-width: 0.65;
  vector-effect: non-scaling-stroke;
  cursor: pointer;
  outline: none;
  transition: fill 120ms ease, filter 120ms ease;
}

/* Canvas paints the ordinary borders; SVG remains the accessible hit and
   highlight layer, so selected and hovered borders still render above it. */
.world-map--canvas .country:not(:hover, :focus-visible, .country--identity-hover, .country--selected, .country--related, .country--quiz-correct, .country--quiz-correct-related, .country--quiz-wrong, .country--quiz-wrong-related) {
  stroke: none;
}

.country-outline {
  stroke: #9aa9a9;
  stroke-width: 0.65;
  vector-effect: non-scaling-stroke;
  pointer-events: none;
}

.country--quiz-inactive {
  pointer-events: none;
}

.map-container--dragging .world-map,
.map-container--dragging .country {
  cursor: grabbing;
}

.map-container--dragging .country {
  pointer-events: none;
}

.map-container--interacting .country {
  filter: none;
  transition: none;
}

.country:hover,
:global(html[data-input-modality='keyboard'] .country:focus-visible) {
  fill: rgb(239 192 106 / 72%);
  filter: brightness(1.03);
}

:global(html[data-input-modality='keyboard'] .country:focus-visible) {
  stroke: #172d38;
  stroke-width: 2;
}

.country--related,
:global(html[data-input-modality='keyboard'] .country--related:focus-visible) {
  fill: rgb(241 182 160 / 70%);
  stroke: #ba7866;
  stroke-width: 0.95;
}

.country--related:hover {
  fill: rgb(244 195 177 / 76%);
  stroke: #ba7866;
}

.country--selected,
:global(html[data-input-modality='keyboard'] .country--selected:focus-visible) {
  fill: rgb(231 111 81 / 82%);
  stroke: #8f3522;
  stroke-width: 1.2;
}

.country--selected:hover {
  fill: rgb(237 134 106 / 84%);
}

.country--identity-hover:not(.country--selected, .country--related) {
  fill: rgb(239 192 106 / 72%);
  filter: brightness(1.03);
}

.country--quiz-correct-related,
:global(html[data-input-modality='keyboard'] .country--quiz-correct-related:focus-visible) {
  fill: rgb(169 220 188 / 72%);
  stroke: #59916e;
  stroke-width: 1.05;
}

.country--quiz-correct-related:hover {
  fill: rgb(188 229 201 / 76%);
}

.country--quiz-correct,
:global(html[data-input-modality='keyboard'] .country--quiz-correct:focus-visible) {
  fill: rgb(105 190 137 / 82%);
  stroke: #26774a;
  stroke-width: 1.5;
}

.country--quiz-correct:hover {
  fill: rgb(124 204 153 / 84%);
}

.country--quiz-wrong-related,
:global(html[data-input-modality='keyboard'] .country--quiz-wrong-related:focus-visible) {
  fill: rgb(241 182 160 / 70%);
  stroke: #ba7866;
  stroke-width: 1.05;
}

.country--quiz-wrong-related:hover {
  fill: rgb(245 198 181 / 76%);
}

.country--quiz-wrong,
:global(html[data-input-modality='keyboard'] .country--quiz-wrong:focus-visible) {
  fill: rgb(231 111 81 / 82%);
  stroke: #8f3522;
  stroke-width: 1.5;
}

.country--quiz-wrong:hover {
  fill: rgb(237 134 106 / 84%);
}

:global(html[data-input-modality='keyboard'] .country--split-fill:focus-visible + .country-outline) {
  stroke: #172d38;
  stroke-width: 2;
}

.regional-division {
  fill: none;
  stroke: #6f8991;
  stroke-width: 0.9;
  stroke-dasharray: 3 3;
  stroke-linecap: round;
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

.map-controls {
  position: absolute;
  z-index: 3;
  bottom: 1.4rem;
  left: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0;
  padding: 0.25rem 0.35rem;
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 999px;
  background: rgba(250, 252, 252, 0.9);
  box-shadow: 0 8px 25px rgba(23, 45, 56, 0.13);
  backdrop-filter: blur(10px);
}

.map-controls > * + * {
  border-left: 1px solid rgba(82, 103, 110, 0.18);
}

.projection-control,
.region-control {
  display: flex;
  align-items: center;
  min-width: 0;
}

.projection-control {
  border-right: 1px solid rgba(82, 103, 110, 0.18);
}

.control-icon {
  width: 1.4rem;
  height: 1.4rem;
  flex: none;
  margin-left: 0.65rem;
  color: #17374b;
}

.map-controls :deep(.detail-toggle) {
  min-height: 2.55rem;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
}

.map-controls-toggle {
  display: none;
}

.map-settings-panel {
  position: absolute;
  z-index: 4;
  top: 0.85rem;
  right: 1.25rem;
  padding: 0.5rem;
  border: 1px solid rgba(82, 103, 110, 0.18);
  border-radius: 16px;
  background: rgba(250, 252, 252, 0.95);
  box-shadow: 0 12px 30px rgba(23, 45, 56, 0.15);
  backdrop-filter: blur(12px);
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
}

.map-tools button:hover,
:global(html[data-input-modality='keyboard'] .map-tools button:focus-visible) {
  background: #fff;
}

@media (max-width: 1100px) {
  .map-tools { top: 0.8rem; bottom: auto; }
  .map-tools span { display: none; }
}

@media (max-width: 850px) {
  .map-controls-toggle {
    position: absolute;
    z-index: 3;
    bottom: max(0.75rem, env(safe-area-inset-bottom));
    left: 0.75rem;
    display: block;
    padding: 0.7rem 0.9rem;
    border: 1px solid rgba(82, 103, 110, 0.16);
    border-radius: 999px;
    color: #172d38;
    background: rgba(250, 252, 252, 0.92);
    box-shadow: 0 8px 25px rgba(23, 45, 56, 0.13);
    font-size: 0.8rem;
    font-weight: 750;
    cursor: pointer;
  }

  :global(html[data-input-modality='keyboard'] .map-controls-toggle:focus-visible) {
    outline: 2px solid #172d38;
    outline-offset: 2px;
  }

  .map-controls {
    bottom: calc(max(0.75rem, env(safe-area-inset-bottom)) + 3rem);
    left: 0.75rem;
    display: none;
    width: min(18rem, calc(100% - 1.5rem));
    max-height: min(25rem, 65%);
    flex-direction: column;
    align-items: stretch;
    overflow-y: auto;
    border-radius: 16px;
    padding: 0.45rem;
  }

  .map-controls--open { display: flex; }
  .map-controls > * + * { border-left: 0; border-top: 1px solid rgba(82, 103, 110, 0.18); }
  .projection-control { border-right: 0; }
  .map-controls :deep(.detail-toggle) { width: 100%; justify-content: space-between; }
  .map-tools { top: auto; right: 0.75rem; bottom: max(0.75rem, env(safe-area-inset-bottom)); }
  .map-tools button { max-width: 8rem; text-align: center; }
  .map-settings-panel { top: 0.75rem; right: 0.75rem; }
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
