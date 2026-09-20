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
import type { CountryFeature } from '../types/country'
import type { MapRegion, MapRegionId } from '../data/regions'
import { afterPaint, wait } from '../utils/paint'

const props = defineProps<{
  countries: CountryFeature[]
  detailedCountries: CountryFeature[] | null
  detailLoading: boolean
  detailBlurred: boolean
  highDetailEnabled: boolean
  activeRegion: MapRegion
  regionOptions: readonly MapRegion[]
  selectedCountryId: string | null
  visibleCountryIds: ReadonlySet<string>
}>()

const emit = defineEmits<{
  select: [countryId: string]
  'detail-change': [enabled: boolean, pathsCached: boolean]
  'region-change': [regionId: MapRegionId]
}>()

const container = ref<HTMLElement | null>(null)
const svg = ref<SVGSVGElement | null>(null)
const mapContent = ref<SVGGElement | null>(null)
const projectionId = ref<MapProjectionId>('mercator')
const projectionLoading = ref(false)
const projectionBlurred = ref(false)
const interactionLocked = computed(() => props.detailLoading || projectionLoading.value)
const mapBlurred = computed(() => props.detailBlurred || projectionBlurred.value)
const { width: measuredWidth } = useElementSize(container)
const mapWidth = computed(() => Math.max(measuredWidth.value, 320))
const mapHeight = computed(() => Math.max(280, Math.min(620, mapWidth.value * 0.56)))
const { countryPaths, hasCachedPaths, projectPoint, spherePath } = useMapProjection(
  toRef(props, 'countries'),
  mapWidth,
  mapHeight,
  projectionId,
)
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

function focusActiveRegion(animated: boolean) {
  const view = props.activeRegion.view
  if (!view) {
    resetZoom(animated)
    return
  }

  const point = projectPoint(view.center)
  if (point) zoomToPoint(point, view.zoom, animated)
}

watch(() => props.activeRegion.id, () => focusActiveRegion(true), { flush: 'post' })
watch(projectionId, () => focusActiveRegion(false), { flush: 'post' })
watch([mapWidth, mapHeight], () => focusActiveRegion(false), { flush: 'post' })

function selectCountry(
  countryId: string,
  bounds: MapBounds,
  focusPoint: MapPoint | undefined,
  event?: MouseEvent,
) {
  if (event && consumeDragClick()) return
  emit('select', countryId)
  zoomToBounds(bounds, focusPoint)
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

function requestDetailChange(enabled: boolean) {
  emit(
    'detail-change',
    enabled,
    enabled && props.detailedCountries !== null && hasCachedPaths(props.detailedCountries),
  )
}

async function setProjection(nextId: MapProjectionId) {
  if (nextId === projectionId.value || interactionLocked.value) return

  if (!props.highDetailEnabled || hasCachedPaths(props.countries, nextId)) {
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
        aria-label="Interactive world map"
        @wheel.prevent="handleWheel"
        @pointerdown="handlePointerDown"
        @pointermove="movePan"
        @pointerup="handlePointerEnd"
        @pointercancel="handlePointerEnd"
      >
        <g ref="mapContent" class="map-content">
          <path class="map-sphere" :d="spherePath" />
          <g class="countries">
            <path
              v-for="{ country, path, bounds, focusPoint } in countryPaths"
              :key="country.id"
              :d="path"
              v-show="visibleCountryIds.has(country.id)"
              class="country"
              :class="{ 'country--selected': country.id === selectedCountryId }"
              :data-country-id="country.id"
              role="button"
              :tabindex="visibleCountryIds.has(country.id) ? 0 : -1"
              :aria-label="country.properties.name"
              :aria-hidden="!visibleCountryIds.has(country.id)"
              :aria-pressed="country.id === selectedCountryId"
              @click="selectCountry(country.id, bounds, focusPoint, $event)"
              @keydown.enter.prevent="selectCountry(country.id, bounds, focusPoint)"
              @keydown.space.prevent="selectCountry(country.id, bounds, focusPoint)"
            >
              <title>{{ country.properties.name }}</title>
            </path>
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
        <span>Scroll to zoom · Drag to move</span>
        <button v-if="isZoomed" type="button" @click="focusActiveRegion(true)">
          Reset view
        </button>
      </div>
    </div>
    <div v-if="interactionLocked" class="map-loading-overlay">
      <p v-if="mapBlurred" class="map-loading-status" role="status">
        Loading detailed map…
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

.country--selected,
.country--selected:hover,
:global(html[data-input-modality='keyboard'] .country--selected:focus-visible) {
  fill: #e76f51;
  stroke: #8f3522;
  stroke-width: 1.2;
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
