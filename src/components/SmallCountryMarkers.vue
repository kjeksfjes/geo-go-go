<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import {
  SMALL_COUNTRY_HIT_RADIUS,
  type SmallCountryFeedbackMarker,
  type SmallCountryMarker,
} from '../logic/smallCountryMarkers'
import { countryName, t } from '../i18n'

const props = defineProps<{
  width: number
  height: number
  markers: readonly SmallCountryMarker[]
  feedbackMarkers: readonly SmallCountryFeedbackMarker[]
  temporaryMarkers: readonly SmallCountryMarker[]
  alwaysShowWrongAnswer: boolean
  hideCorrectName?: boolean
}>()
const emit = defineEmits<{
  activate: [marker: SmallCountryMarker, event: MouseEvent | KeyboardEvent]
  hover: [marker: SmallCountryMarker | null]
}>()

function markerLabel(marker: SmallCountryMarker) {
  return marker.targets.length === 1
    ? t('chooseSmallCountry')
    : t('zoomHere')
}

const displayMarkers = computed(() => [
  ...props.markers.map((marker) => ({ ...marker, temporary: false })),
  ...props.temporaryMarkers.map((marker) => ({ ...marker, temporary: true })),
])

const groupAreas = computed(() => props.markers.filter((marker) => marker.targets.length > 1)
  .map((marker) => ({
    key: marker.key,
    x: marker.x,
    y: marker.y,
    // Tiny-country bounds are under ten screen pixels. Add breathing room
    // around the farthest target and keep the outline outside the count badge.
    radius: Math.max(24, ...marker.targets.map((target) => Math.hypot(target.screenX - marker.x, target.screenY - marker.y) + 8)),
  })))

const activeMarkerKey = ref<string | null>(null)
const tooltipText = ref<SVGTextElement | null>(null)
const measuredTooltipText = ref<{ label: string; width: number } | null>(null)
const markerTooltip = computed(() => {
  const key = activeMarkerKey.value
  const marker = displayMarkers.value.find((marker) => marker.key === key)
  if (!marker) return null
  const label = markerLabel(marker)
  const textWidth = measuredTooltipText.value?.label === label ? measuredTooltipText.value.width : label.length * 7.5
  const width = textWidth + 16
  const height = 28
  const above = marker.y - 22 - height
  return {
    x: Math.max(4, Math.min(props.width - width - 4, marker.x - width / 2)),
    y: Math.max(4, Math.min(props.height - height - 4, above >= 4 ? above : marker.y + 22)),
    width,
    height,
    label,
  }
})
function measureTooltipText() {
  const label = markerTooltip.value?.label
  const width = tooltipText.value?.getComputedTextLength()
  if (label && width && Number.isFinite(width)) measuredTooltipText.value = { label, width }
}
watch(() => markerTooltip.value?.label, async () => {
  await nextTick()
  measureTooltipText()
})
void document.fonts.ready.then(measureTooltipText)
function hoverMarker(marker: SmallCountryMarker, event: PointerEvent) {
  if (event.pointerType !== 'touch') activeMarkerKey.value = marker.key
  emit('hover', marker)
}
function leaveMarker(marker: SmallCountryMarker) {
  if (activeMarkerKey.value === marker.key) activeMarkerKey.value = null
  emit('hover', null)
}
function focusMarker(marker: SmallCountryMarker) {
  activeMarkerKey.value = marker.key
  emit('hover', marker)
}
function feedbackLabel(marker: SmallCountryFeedbackMarker) {
  if (marker.status === 'correct' && props.hideCorrectName) return t('highlightedCountry')
  if (marker.status === 'wrong' && !props.alwaysShowWrongAnswer) return t('wrongAnswerMarker')
  return t(marker.status === 'correct' ? 'correctSmallCountry' : 'wrongSmallCountry', {
    name: countryName(marker.countryId),
  })
}
</script>

<template>
  <g class="small-country-markers">
    <g class="small-country-marker__areas" aria-hidden="true">
      <circle v-for="area in groupAreas" :key="area.key" :cx="area.x" :cy="area.y" :r="area.radius" />
    </g>
    <g
      v-for="marker in displayMarkers"
      :key="marker.key"
      class="small-country-marker"
      :class="{ 'small-country-marker--cluster': marker.targets.length > 1, 'small-country-marker--temporary': marker.temporary }"
      :transform="`translate(${marker.x} ${marker.y})`"
      :data-country-id="marker.targets.length === 1 ? marker.targets[0].countryId : undefined"
      :data-geographic-unit-id="marker.targets.length === 1 ? marker.targets[0].unitId : undefined"
      role="button"
      tabindex="0"
      :aria-label="markerLabel(marker)"
      @pointerenter="hoverMarker(marker, $event)"
      @pointerleave="leaveMarker(marker)"
      @focus="focusMarker(marker)"
      @blur="leaveMarker(marker)"
      @click.stop="emit('activate', marker, $event)"
      @keydown.enter.prevent.stop="emit('activate', marker, $event)"
      @keydown.space.prevent.stop="emit('activate', marker, $event)"
    >
      <circle class="small-country-marker__hit" :r="SMALL_COUNTRY_HIT_RADIUS" />
      <circle class="small-country-marker__pin" :r="marker.targets.length > 1 ? 16 : 8" />
      <text v-if="marker.targets.length > 1" class="small-country-marker__count" text-anchor="middle" dy="0.34em">
        {{ marker.targets.length }}
      </text>
    </g>
    <g
      v-for="marker in feedbackMarkers"
      :key="`${marker.countryId}:${marker.offset}`"
      class="small-country-marker small-country-marker--feedback"
      :class="`small-country-marker--${marker.status}`"
      :transform="`translate(${marker.screenX} ${marker.screenY})`"
      role="img"
      :aria-label="feedbackLabel(marker)"
    >
      <title v-if="marker.status === 'correct' ? !hideCorrectName : alwaysShowWrongAnswer">{{ countryName(marker.countryId) }}</title>
      <circle class="small-country-marker__hit" :r="SMALL_COUNTRY_HIT_RADIUS" />
      <circle class="small-country-marker__pin" r="9" />
      <circle class="small-country-marker__center" r="3" />
    </g>
    <g v-if="markerTooltip" class="small-country-marker__tooltip" :transform="`translate(${markerTooltip.x} ${markerTooltip.y})`" aria-hidden="true">
      <rect :width="markerTooltip.width" :height="markerTooltip.height" rx="6" />
      <text ref="tooltipText" :x="markerTooltip.width / 2" :y="markerTooltip.height / 2" dominant-baseline="central" text-anchor="middle">{{ markerTooltip.label }}</text>
    </g>
  </g>
</template>

<style scoped>
.small-country-markers { pointer-events: none; }
.small-country-marker { pointer-events: all; cursor: pointer; outline: none; }
.small-country-marker__areas { fill: var(--ui-ink); fill-opacity: 0.045; stroke: var(--ui-ink); stroke-opacity: 0.25; stroke-width: 1; pointer-events: none; }
.small-country-marker__hit { fill: transparent; }
.small-country-marker__pin {
  fill: #17374b;
  stroke: #fff;
  stroke-width: 2;
}
.small-country-marker__center { fill: #fff; pointer-events: none; }
.small-country-marker--correct .small-country-marker__pin { fill: #26774a; }
.small-country-marker--wrong .small-country-marker__pin { fill: #a13d2c; }
.small-country-marker--cluster .small-country-marker__pin { fill: var(--ui-surface); stroke: var(--ui-ink); }
.small-country-marker__count { fill: var(--ui-ink); font-size: 12px; font-weight: var(--ui-weight-emphasis); pointer-events: none; }
.small-country-marker--temporary .small-country-marker__pin { fill: var(--ui-hover); stroke: var(--ui-focus); stroke-width: 3; }
.small-country-marker--temporary { animation: small-country-marker-fade 3s linear forwards; }
@keyframes small-country-marker-fade { 0%, 33.333% { opacity: 1; } 100% { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .small-country-marker--temporary { animation: none; } }
.small-country-marker:not(.small-country-marker--feedback):hover .small-country-marker__pin,
:global(html[data-input-modality='keyboard'] .small-country-marker:not(.small-country-marker--feedback):focus-visible) .small-country-marker__pin { fill: #2e6279; stroke-width: 3; }
.small-country-marker.small-country-marker--temporary:hover .small-country-marker__pin,
.small-country-marker.small-country-marker--cluster:hover .small-country-marker__pin,
:global(html[data-input-modality='keyboard'] .small-country-marker.small-country-marker--temporary:focus-visible) .small-country-marker__pin,
:global(html[data-input-modality='keyboard'] .small-country-marker.small-country-marker--cluster:focus-visible) .small-country-marker__pin { fill: var(--ui-hover); }
.small-country-marker__tooltip { pointer-events: none; }
.small-country-marker__tooltip rect { fill: var(--ui-surface); stroke: var(--ui-border-strong); }
.small-country-marker__tooltip text { fill: var(--ui-ink); font-size: 13px; font-weight: var(--ui-weight); }
</style>
