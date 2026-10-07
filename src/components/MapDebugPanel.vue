<script setup lang="ts">
import { copyText } from '../utils/copyText'
import { onBeforeUnmount, ref } from 'vue'
import type { ProjectionDebugState } from '../composables/useMapProjection'
import type { MapPoint } from '../composables/useMapZoom'

interface VerticalFit {
  span: number
  topGap: number
  bottomGap: number
}

const props = defineProps<{
  disabled: boolean
  zoom: number
  countryFocus: string
  center: MapPoint | null
  regionVerticalFit: VerticalFit | null
  selectionVerticalFit: VerticalFit | null
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
}>()
const emit = defineEmits<{
  'reset-settings': []
}>()
const copyState = ref<'idle' | 'copied' | 'failed'>('idle')
const resetState = ref<'idle' | 'reset'>('idle')
let copyStateTimer: number | undefined
let resetStateTimer: number | undefined

function coordinate(value: number, positive: string, negative: string) {
  const direction = value < 0 ? negative : positive
  return `${Math.abs(value).toFixed(2)}° ${direction}`
}

function centerLabel() {
  if (!props.center) return 'Unavailable'
  return `${coordinate(props.center[0], 'E', 'W')}, ${coordinate(props.center[1], 'N', 'S')}`
}

function durationLabel(milliseconds: number) {
  return milliseconds < 0.1 ? '<0.1 ms' : `${milliseconds.toFixed(1)} ms`
}

function signed(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(3)}`
}

function verticalFitLabel(fit: VerticalFit) {
  return `${fit.span.toFixed(3)} span · ${signed(1 - fit.span)} room`
}

function verticalGapsLabel(fit: VerticalFit) {
  return `top ${signed(fit.topGap)} · bottom ${signed(fit.bottomGap)}`
}

function debugText() {
  const lines = [
    'Map debug',
    `Region: ${props.region}`,
    `Center: ${centerLabel()}`,
    `Zoom: ${props.zoom.toFixed(2)}×`,
    `Country focus: ${props.countryFocus}`,
  ]
  if (props.regionVerticalFit) {
    lines.push(
      `Region V fit: ${verticalFitLabel(props.regionVerticalFit)}`,
      `Region gaps: ${verticalGapsLabel(props.regionVerticalFit)}`,
    )
  }
  if (props.selectionVerticalFit) {
    lines.push(
      `Selection V fit: ${verticalFitLabel(props.selectionVerticalFit)}`,
      `Selection gaps: ${verticalGapsLabel(props.selectionVerticalFit)}`,
    )
  }
  lines.push(
    `Projection: ${props.projection}`,
    `Detail: ${props.detail}`,
    `Renderer: ${props.renderer}`,
    `Viewport: ${Math.round(props.width)} × ${Math.round(props.height)} @ ${props.pixelRatio.toFixed(1)}×`,
    `Layers: Bathy ${props.bathymetry ? 'on' : 'off'} · Relief ${props.relief ? 'on' : 'off'} · Names ${props.waterNames ? 'on' : 'off'}`,
    `Gesture: ${props.gesture}`,
  )
  if (props.paths) {
    lines.push(
      `Paths: ${props.paths.result} · ${durationLabel(props.paths.durationMs)} · ${props.paths.unitCount} units`,
      `Path key: ${props.paths.key}`,
    )
  }
  return lines.join('\n')
}

function showCopyState(state: 'copied' | 'failed') {
  copyState.value = state
  if (copyStateTimer !== undefined) window.clearTimeout(copyStateTimer)
  copyStateTimer = window.setTimeout(() => {
    copyState.value = 'idle'
    copyStateTimer = undefined
  }, 1600)
}

async function copyDebugData() {
  showCopyState(await copyText(debugText()) ? 'copied' : 'failed')
}

function resetSettings() {
  emit('reset-settings')
  resetState.value = 'reset'
  if (resetStateTimer !== undefined) window.clearTimeout(resetStateTimer)
  resetStateTimer = window.setTimeout(() => {
    resetState.value = 'idle'
    resetStateTimer = undefined
  }, 1600)
}

onBeforeUnmount(() => {
  if (copyStateTimer !== undefined) window.clearTimeout(copyStateTimer)
  if (resetStateTimer !== undefined) window.clearTimeout(resetStateTimer)
})
</script>

<template>
  <aside class="map-debug-panel" aria-label="Map debug information">
    <div class="map-debug-panel__header">
      <strong>Map debug</strong>
      <div class="map-debug-panel__actions">
        <button
          class="map-debug-panel__reset"
          :class="`map-debug-panel__reset--${resetState}`"
          type="button"
          :disabled="disabled"
          :aria-label="resetState === 'reset' ? 'Settings reset to defaults' : 'Reset settings to defaults'"
          @click="resetSettings"
        >
          {{ resetState === 'reset' ? 'Reset' : 'Reset settings' }}
        </button>
        <button
          class="map-debug-panel__copy"
          :class="`map-debug-panel__copy--${copyState}`"
          type="button"
          :aria-label="copyState === 'copied' ? 'Map debug data copied' : copyState === 'failed' ? 'Could not copy map debug data' : 'Copy map debug data'"
          @click="copyDebugData"
        >
          <svg v-if="copyState === 'copied'" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m5 12 4 4L19 6" />
          </svg>
          <svg v-else-if="copyState === 'failed'" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 7v6m0 4h.01" />
            <circle cx="12" cy="12" r="9" />
          </svg>
          <svg v-else viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 7V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
            <rect x="4" y="7" width="11" height="13" rx="2" />
          </svg>
        </button>
      </div>
      <span class="map-debug-panel__copy-status" aria-live="polite">
        {{ copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : '' }}
      </span>
    </div>
    <dl>
      <dt>Zoom</dt>
      <dd>{{ zoom.toFixed(2) }}×</dd>
      <dt>Country focus</dt>
      <dd>{{ countryFocus }}</dd>
      <dt>Center</dt>
      <dd>{{ centerLabel() }}</dd>
      <template v-if="regionVerticalFit">
        <dt>Region V fit</dt>
        <dd>{{ verticalFitLabel(regionVerticalFit) }}</dd>
        <dt>Region gaps</dt>
        <dd>{{ verticalGapsLabel(regionVerticalFit) }}</dd>
      </template>
      <template v-if="selectionVerticalFit">
        <dt>Selection V fit</dt>
        <dd>{{ verticalFitLabel(selectionVerticalFit) }}</dd>
        <dt>Selection gaps</dt>
        <dd>{{ verticalGapsLabel(selectionVerticalFit) }}</dd>
      </template>
      <dt>Region</dt>
      <dd>{{ region }}</dd>
      <dt>Projection</dt>
      <dd>{{ projection }}</dd>
      <dt>Detail</dt>
      <dd>{{ detail }}</dd>
      <dt>Renderer</dt>
      <dd>{{ renderer }}</dd>
      <dt>Viewport</dt>
      <dd>{{ Math.round(width) }} × {{ Math.round(height) }} @ {{ pixelRatio.toFixed(1) }}×</dd>
      <dt>Layers</dt>
      <dd>Bathy {{ bathymetry ? 'on' : 'off' }} · Relief {{ relief ? 'on' : 'off' }} · Names {{ waterNames ? 'on' : 'off' }}</dd>
      <dt>Gesture</dt>
      <dd>{{ gesture }}</dd>
      <template v-if="paths">
        <dt>Paths</dt>
        <dd>{{ paths.result }} · {{ durationLabel(paths.durationMs) }} · {{ paths.unitCount }} units</dd>
        <dt>Path key</dt>
        <dd>{{ paths.key }}</dd>
      </template>
    </dl>
  </aside>
</template>

<style scoped>
.map-debug-panel {
  position: absolute;
  z-index: 5;
  bottom: max(0.75rem, env(safe-area-inset-bottom));
  left: max(0.75rem, env(safe-area-inset-left));
  max-width: calc(100% - 1.5rem);
  padding: 0.55rem 0.65rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  color: #edf7f8;
  background: rgba(10, 32, 44, 0.86);
  box-shadow: 0 8px 24px rgba(10, 32, 44, 0.22);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.64rem;
  line-height: 1.3;
  pointer-events: none;
  user-select: none;
  backdrop-filter: blur(8px);
}

.map-debug-panel__header {
  position: relative;
  display: flex;
  min-height: 1.75rem;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.25rem;
}

.map-debug-panel__actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

strong {
  display: block;
  margin: 0;
  font-size: 0.66rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.map-debug-panel__copy,
.map-debug-panel__reset {
  height: 1.75rem;
  flex: none;
  border: 0;
  border-radius: 6px;
  color: #edf7f8;
  background: rgba(255, 255, 255, 0.08);
  cursor: pointer;
  pointer-events: auto;
}

.map-debug-panel__copy {
  display: grid;
  width: 1.75rem;
  padding: 0.25rem;
  place-items: center;
}

.map-debug-panel__copy:hover,
.map-debug-panel__copy:focus-visible,
.map-debug-panel__reset:hover:not(:disabled),
.map-debug-panel__reset:focus-visible {
  background: rgba(255, 255, 255, 0.16);
}

.map-debug-panel__copy:focus-visible,
.map-debug-panel__reset:focus-visible {
  outline: 2px solid #edf7f8;
  outline-offset: 2px;
}

.map-debug-panel__copy--copied { color: #91e3b6; }
.map-debug-panel__copy--failed { color: #ffaaa0; }

.map-debug-panel__reset {
  padding: 0.25rem 0.45rem;
  font: inherit;
}

.map-debug-panel__reset:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.map-debug-panel__reset--reset { color: #91e3b6; }

.map-debug-panel__copy svg {
  width: 1.15rem;
  height: 1.15rem;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.map-debug-panel__copy-status {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  clip-path: inset(50%);
}

dl {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 0.12rem 0.65rem;
  margin: 0;
}

dt { color: #9fc0ca; }
dd { min-width: 0; margin: 0; overflow-wrap: anywhere; }

@media (max-width: 560px) {
  .map-debug-panel {
    max-width: calc(100% - 6rem);
    font-size: 0.58rem;
  }
}
</style>
