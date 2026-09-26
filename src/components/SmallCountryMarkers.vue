<script setup lang="ts">
import {
  SMALL_COUNTRY_HIT_RADIUS,
  type SmallCountryFeedbackMarker,
  type SmallCountryMarker,
} from '../logic/smallCountryMarkers'
import { countryName, t } from '../i18n'

defineProps<{
  markers: readonly SmallCountryMarker[]
  feedbackMarkers: readonly SmallCountryFeedbackMarker[]
}>()
const emit = defineEmits<{
  activate: [marker: SmallCountryMarker, event: MouseEvent | KeyboardEvent]
  hover: [marker: SmallCountryMarker | null]
}>()

function markerLabel(marker: SmallCountryMarker) {
  return marker.targets.length === 1
    ? t('selectSmallCountry', { name: countryName(marker.targets[0].countryId) })
    : t('zoomToSmallCountries', { count: marker.targets.length })
}

function feedbackLabel(marker: SmallCountryFeedbackMarker) {
  return t(marker.status === 'correct' ? 'correctSmallCountry' : 'wrongSmallCountry', {
    name: countryName(marker.countryId),
  })
}
</script>

<template>
  <g class="small-country-markers">
    <g
      v-for="marker in markers"
      :key="marker.key"
      class="small-country-marker"
      :transform="`translate(${marker.x} ${marker.y})`"
      role="button"
      tabindex="0"
      :aria-label="markerLabel(marker)"
      @pointerenter="emit('hover', marker)"
      @pointerleave="emit('hover', null)"
      @focus="emit('hover', marker)"
      @blur="emit('hover', null)"
      @click.stop="emit('activate', marker, $event)"
      @keydown.enter.prevent.stop="emit('activate', marker, $event)"
      @keydown.space.prevent.stop="emit('activate', marker, $event)"
    >
      <circle class="small-country-marker__hit" :r="SMALL_COUNTRY_HIT_RADIUS" />
      <circle class="small-country-marker__pin" :r="marker.targets.length > 1 ? 12 : 8" />
      <text v-if="marker.targets.length > 1" class="small-country-marker__count" text-anchor="middle" dy="0.34em">
        {{ marker.targets.length }}
      </text>
      <circle v-else class="small-country-marker__center" r="3" />
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
      <title>{{ countryName(marker.countryId) }}</title>
      <circle class="small-country-marker__hit" :r="SMALL_COUNTRY_HIT_RADIUS" />
      <circle class="small-country-marker__pin" r="9" />
      <circle class="small-country-marker__center" r="3" />
    </g>
  </g>
</template>

<style scoped>
.small-country-markers { pointer-events: none; }
.small-country-marker { pointer-events: all; cursor: pointer; outline: none; }
.small-country-marker__hit { fill: transparent; }
.small-country-marker__pin {
  fill: #17374b;
  stroke: #fff;
  stroke-width: 2;
}
.small-country-marker__center { fill: #fff; pointer-events: none; }
.small-country-marker--correct .small-country-marker__pin { fill: #26774a; }
.small-country-marker--wrong .small-country-marker__pin { fill: #a13d2c; }
.small-country-marker__count {
  fill: #fff;
  font-size: 11px;
  font-weight: 800;
  pointer-events: none;
  user-select: none;
}
.small-country-marker:not(.small-country-marker--feedback):hover .small-country-marker__pin,
:global(html[data-input-modality='keyboard'] .small-country-marker:not(.small-country-marker--feedback):focus-visible) .small-country-marker__pin {
  fill: #2e6279;
  stroke-width: 3;
}
</style>
