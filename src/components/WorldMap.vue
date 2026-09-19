<script setup lang="ts">
import { computed, ref, toRef, watch } from 'vue'
import MapDetailToggle from './MapDetailToggle.vue'
import ProjectionSelector from './ProjectionSelector.vue'
import { useElementSize } from '../composables/useElementSize'
import {
  projectionOptions,
  useMapProjection,
  type MapProjectionId,
} from '../composables/useMapProjection'
import { useMapZoom, type MapBounds, type MapPoint } from '../composables/useMapZoom'
import type { CountryFeature } from '../types/country'

const props = defineProps<{
  countries: CountryFeature[]
  detailLoading: boolean
  highDetailEnabled: boolean
  selectedCountryId: string | null
}>()

const emit = defineEmits<{
  select: [countryId: string]
  'detail-change': [enabled: boolean]
}>()

const container = ref<HTMLElement | null>(null)
const svg = ref<SVGSVGElement | null>(null)
const mapContent = ref<SVGGElement | null>(null)
const projectionId = ref<MapProjectionId>('mercator')
const { width: measuredWidth } = useElementSize(container)
const mapWidth = computed(() => Math.max(measuredWidth.value, 320))
const mapHeight = computed(() => Math.max(280, Math.min(620, mapWidth.value * 0.56)))
const { countryPaths, spherePath } = useMapProjection(
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
} = useMapZoom(mapWidth, mapHeight, mapContent)

watch(projectionId, () => resetZoom(false))

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
</script>

<template>
  <div
    ref="container"
    class="map-container"
    :class="{ 'map-container--dragging': isDragging }"
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
            class="country"
            :class="{ 'country--selected': country.id === selectedCountryId }"
            :data-country-id="country.id"
            role="button"
            tabindex="0"
            :aria-label="country.properties.name"
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
      <div class="projection-control">
        <ProjectionSelector v-model="projectionId" :options="projectionOptions" />
      </div>
      <MapDetailToggle
        :loading="detailLoading"
        :model-value="highDetailEnabled"
        @update:model-value="emit('detail-change', $event)"
      />
    </div>

    <div class="map-tools">
      <span>Scroll to zoom · Drag to move</span>
      <button v-if="isZoomed" type="button" @click="resetZoom()">Reset view</button>
    </div>
  </div>
</template>

<style scoped>
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
.country:focus-visible {
  fill: #efc06a;
  filter: brightness(1.03);
}

.country:focus-visible {
  stroke: #172d38;
  stroke-width: 2;
}

.country--selected,
.country--selected:hover,
.country--selected:focus-visible {
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

.projection-control {
  padding: 0.45rem 0.7rem;
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
.map-tools button:focus-visible {
  background: #fff;
}

@media (prefers-reduced-motion: reduce) {
  .country {
    transition: none;
  }
}
</style>
