<script setup lang="ts">
import { computed, nextTick, ref, toRef, watch } from 'vue'
import MapDetailToggle from './MapDetailToggle.vue'
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
const hoveredUnit = ref<{ id: string; entityId: string } | null>(null)
const projectionLoading = ref(false)
const projectionBlurred = ref(false)
const interactionLocked = computed(() => props.detailLoading || projectionLoading.value)
const mapBlurred = computed(() => props.detailBlurred || projectionBlurred.value)
const { width: measuredWidth } = useElementSize(container)
const mapWidth = computed(() => Math.max(measuredWidth.value, 320))
const mapHeight = computed(() => Math.max(280, Math.min(620, mapWidth.value * 0.56)))
const { geographicPaths, hasCachedPaths, projectPoint, spherePath } = useMapProjection(
  toRef(props, 'geographicUnits'),
  mapWidth,
  mapHeight,
  projectionId,
  toRef(props, 'activeRegion'),
  toRef(props, 'visibleMapUnitIds'),
)
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

function geographicUnitClasses(unit: GeographicUnitFeature) {
  const entityId = unit.properties.entityId
  const clicked = unit.id === props.selectedGeographicUnitId

  if (!props.quizMode) {
    const selected = isPrimarySelectedExploreUnit(unit)
    return {
      'country--selected': selected,
      'country--related': entityId === props.selectedCountryId && !selected,
      'country--identity-hover': hoveredUnit.value?.entityId === entityId,
    }
  }

  const answered = props.quizAnswerId !== null
  const correct = answered && entityId === props.quizQuestionId
  const wrong = answered && entityId === props.quizAnswerId && !correct
  const relatedAnswer = !clicked && props.selectedGeographicUnitId !== null

  return {
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
  consumeDragClick,
  endPan,
  isDragging,
  isZoomed,
  movePan,
  resetZoom,
  startPan,
  zoomFromWheel,
  zoomToBounds,
  zoomToPoint,
} = useMapZoom(mapWidth, mapHeight, mapContent)

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
watch(projectionId, () => focusActiveRegion(false), { flush: 'post' })
watch([mapWidth, mapHeight], () => focusActiveRegion(false), { flush: 'post' })

function selectCountry(
  countryId: string,
  geographicUnitId: string,
  bounds: MapBounds,
  focusPoint: MapPoint | undefined,
  event?: MouseEvent | KeyboardEvent,
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
    const x0 = Math.min(...sharedPaths.map(({ displayBounds }) => displayBounds[0][0]))
    const y0 = Math.min(...sharedPaths.map(({ displayBounds }) => displayBounds[0][1]))
    const x1 = Math.max(...sharedPaths.map(({ displayBounds }) => displayBounds[1][0]))
    const y1 = Math.max(...sharedPaths.map(({ displayBounds }) => displayBounds[1][1]))
    zoomToBounds([[x0, y0], [x1, y1]])
  } else {
    zoomToBounds(bounds, focusPoint)
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

function requestDetailChange(enabled: boolean) {
  emit(
    'detail-change',
    enabled,
    enabled && props.detailedGeographicUnits !== null && hasCachedPaths(props.detailedGeographicUnits),
  )
}

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
  <div class="map-stage" :class="{ 'map-stage--busy': interactionLocked }">
    <div
      ref="container"
      class="map-container"
      :class="{
        'map-container--dragging': isDragging,
        'map-container--detail-blurred': mapBlurred,
      }"
      :aria-busy="interactionLocked"
      :inert="interactionLocked"
    >
      <svg
        ref="svg"
        class="world-map"
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
          <path class="map-sphere" :d="spherePath" />
          <g class="countries">
            <g
              v-for="{ unit, path, outlinePath, divisionPath, bounds, focusPoint } in paintedGeographicPaths"
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
                :tabindex="isGeographicUnitVisible(unit) && (!quizMode || (quizQuestionId && quizAnswerId === null)) ? 0 : -1"
                :aria-label="countryName(unit.properties.entityId)"
                :aria-hidden="!isGeographicUnitVisible(unit)"
                :aria-disabled="quizMode && (quizQuestionId === null || quizAnswerId !== null)"
                :aria-pressed="quizMode ? unit.id === selectedGeographicUnitId : isPrimarySelectedExploreUnit(unit)"
                @click="selectCountry(unit.properties.entityId, unit.id, bounds, focusPoint, $event)"
                @pointerenter="hoveredUnit = { id: unit.id, entityId: unit.properties.entityId }"
                @pointerleave="clearHoveredUnit(unit.id)"
                @keydown.enter.prevent="selectCountry(unit.properties.entityId, unit.id, bounds, focusPoint, $event)"
                @keydown.space.prevent="selectCountry(unit.properties.entityId, unit.id, bounds, focusPoint, $event)"
              >
                <title v-if="canShowCountryTooltip(unit.properties.entityId, props)">{{ countryName(unit.properties.entityId) }}</title>
              </path>
              <path
                v-if="outlinePath"
                class="country-outline"
                :class="geographicUnitClasses(unit)"
                :d="outlinePath"
                aria-hidden="true"
              />
              <path
                v-if="divisionPath"
                class="regional-division"
                :d="divisionPath"
                aria-hidden="true"
              />
            </g>
          </g>
        </g>
      </svg>

      <div class="map-controls">
        <div class="region-control">
          <RegionSelector
            :model-value="activeRegion.id"
            :options="regionOptions"
            @update:model-value="emit('region-change', $event)"
          />
        </div>
        <div class="projection-control">
          <ProjectionSelector
            :model-value="projectionId"
            :disabled="interactionLocked"
            :options="projectionOptions"
            @update:model-value="setProjection"
          />
        </div>
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
}

.map-container {
  position: relative;
  width: 100%;
  overflow: hidden;
}

.world-map {
  display: block;
  width: 100%;
  height: auto;
  max-height: 65vh;
  cursor: grab;
  user-select: none;
  transition: filter 280ms ease;
}

.map-container--detail-blurred .world-map {
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
  fill: #dcebf1;
}

.country {
  fill: #f5f2e9;
  stroke: #9aa9a9;
  stroke-width: 0.65;
  vector-effect: non-scaling-stroke;
  cursor: pointer;
  outline: none;
  transition: fill 120ms ease, filter 120ms ease;
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

.country:hover,
:global(html[data-input-modality='keyboard'] .country:focus-visible) {
  fill: #efc06a;
  filter: brightness(1.03);
}

:global(html[data-input-modality='keyboard'] .country:focus-visible) {
  stroke: #172d38;
  stroke-width: 2;
}

.country--related,
:global(html[data-input-modality='keyboard'] .country--related:focus-visible) {
  fill: #f1b6a0;
  stroke: #ba7866;
  stroke-width: 0.95;
}

.country--related:hover {
  fill: #efc06a;
  stroke: #a7783d;
}

.country--selected,
:global(html[data-input-modality='keyboard'] .country--selected:focus-visible) {
  fill: #e76f51;
  stroke: #8f3522;
  stroke-width: 1.2;
}

.country--selected:hover {
  fill: #ed866a;
}

.country--identity-hover:not(.country--selected) {
  fill: #efc06a;
  filter: brightness(1.03);
}

.country--quiz-correct-related,
:global(html[data-input-modality='keyboard'] .country--quiz-correct-related:focus-visible) {
  fill: #a9dcbc;
  stroke: #59916e;
  stroke-width: 1.05;
}

.country--quiz-correct-related:hover {
  fill: #bce5c9;
}

.country--quiz-correct,
:global(html[data-input-modality='keyboard'] .country--quiz-correct:focus-visible) {
  fill: #69be89;
  stroke: #26774a;
  stroke-width: 1.5;
}

.country--quiz-correct:hover {
  fill: #7ccc99;
}

.country--quiz-wrong-related,
:global(html[data-input-modality='keyboard'] .country--quiz-wrong-related:focus-visible) {
  fill: #f1b6a0;
  stroke: #ba7866;
  stroke-width: 1.05;
}

.country--quiz-wrong-related:hover {
  fill: #f5c6b5;
}

.country--quiz-wrong,
:global(html[data-input-modality='keyboard'] .country--quiz-wrong:focus-visible) {
  fill: #e76f51;
  stroke: #8f3522;
  stroke-width: 1.5;
}

.country--quiz-wrong:hover {
  fill: #ed866a;
}

.country-outline {
  fill: none;
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
  right: 0.8rem;
  bottom: 0.8rem;
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
  top: 0.8rem;
  left: 0.8rem;
  right: 0.8rem;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 0.5rem;
  pointer-events: none;
}

.map-controls > * {
  pointer-events: auto;
}

.projection-control,
.region-control {
  border: 1px solid rgba(82, 103, 110, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 3px 12px rgba(23, 45, 56, 0.08);
  backdrop-filter: blur(7px);
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
