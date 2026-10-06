<script setup lang="ts">
import type { MapScaleBar as ScaleBar } from '../logic/mapScale'
import { t } from '../i18n'

defineProps<{ scale: ScaleBar }>()
</script>

<template>
  <div
    class="map-scale-bar"
    role="img"
    :aria-label="t('scaleAtMapCenter', { distance: scale.total })"
  >
    <div class="map-scale-bar__ruler" :style="{ width: `${scale.width}px` }">
      <span class="map-scale-bar__label map-scale-bar__label--start">0</span>
      <span class="map-scale-bar__label map-scale-bar__label--middle">{{ scale.midpoint }}</span>
      <span class="map-scale-bar__label map-scale-bar__label--end">{{ scale.total }}</span>
      <span class="map-scale-bar__middle-tick" aria-hidden="true" />
    </div>
  </div>
</template>

<style scoped>
.map-scale-bar {
  position: absolute;
  z-index: 3;
  bottom: calc(4.4rem + env(safe-area-inset-bottom));
  right: calc(3rem + env(safe-area-inset-right));
  color: #40545d;
  font-size: var(--ui-text-control);
  font-weight: var(--ui-weight);
  line-height: 1;
  pointer-events: none;
}

.map-scale-bar__ruler {
  position: relative;
  height: 1rem;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  border-left: 2px solid currentColor;
}

.map-scale-bar__label {
  position: absolute;
  bottom: calc(100% + 0.28rem);
  white-space: nowrap;
}

.map-scale-bar__label--start { left: 1px; transform: translateX(-50%); }
.map-scale-bar__label--middle { left: 50%; transform: translateX(-50%); }
.map-scale-bar__label--end { right: 1px; transform: translateX(50%); }

.map-scale-bar__middle-tick {
  position: absolute;
  bottom: 0;
  left: 50%;
  height: 0.85rem;
  border-left: 2px solid currentColor;
}

@media (max-width: 850px) {
  .map-scale-bar {
    bottom: calc(3.25rem + env(safe-area-inset-bottom));
  }
}
</style>
