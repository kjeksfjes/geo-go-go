<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import packageInfo from '../../package.json'
import { marineLabels } from '../data/marineLabels'
import { marineLabelPaths, type MarineLabelPath } from '../data/marineLabelPaths'
import type { MapPoint } from '../composables/useMapZoom'
import { sampleLabelGuide } from '../logic/marineLabelLayout'
import { normalizeCountrySearch } from '../logic/countrySuggestions'
import { clone, createHistory, editablePlacement, makeDraft, mapPlacement, placementPivot, readDraft, samePlacement, validPlacement, type Placements } from './waterLabelDraft'

const props = defineProps<{
  width: number
  height: number
  transform: Readonly<{ x: number; y: number; scale: number }>
  projectPoint: (point: MapPoint) => MapPoint | undefined
  unprojectPoint: (point: MapPoint) => MapPoint | undefined
  wrapPeriod: number | null
  copyOffsets: readonly number[]
  disabled: boolean
  warning: string
}>()
const selectedId = defineModel<string>('selectedId', { required: true })
const emit = defineEmits<{
  preview: [placements: Placements | undefined]
  editing: [enabled: boolean]
  focus: [points: MapPoint[]]
}>()

// Settings reset clears geo-go-go.*; keep editorial work outside that prefix.
const storageKey = 'geo-go-go-editor.water-label-draft.v1'
const ids = new Set(marineLabels.map(label => label.id))
// The four oceans without authored guides need a starting horizontal frame.
const baseline: Placements = Object.fromEntries(marineLabels.map(label => {
  const [x, y] = label.point
  return [label.id, marineLabelPaths[label.id] ?? {
    points: [[x - 10, y], [x, y], [x + 10, y]], layout: 'horizontal', anchor: [x, y],
    bounds: [[x - 15, Math.max(-90, y - 5)], [x + 15, Math.min(90, y + 5)]],
  }]
}))
const edits = shallowRef<Placements>({})
const status = ref('')
const storageError = ref(false)
const storageConflict = ref(false)
const recovery = ref<string | null>(null)
let lastSaved: string | null = null
try {
  const saved = localStorage.getItem(storageKey)
  lastSaved = saved
  if (saved) {
    try { edits.value = readDraft(saved, baseline, ids).placements }
    catch (error) { recovery.value = saved; status.value = String((error as Error).message) }
  }
} catch { storageError.value = true }
const history = createHistory(edits.value)
const historyRevision = ref(0)
const canUndo = computed(() => { void historyRevision.value; return history.canUndo })
const canRedo = computed(() => { void historyRevision.value; return history.canRedo })
const placements = computed(() => ({ ...marineLabelPaths, ...edits.value }))
const changedIds = computed(() => Object.keys(edits.value))
const selectedLabel = computed(() => marineLabels.find(label => label.id === selectedId.value))
const selected = computed(() => {
  const source = edits.value[selectedId.value] ?? baseline[selectedId.value]
  if (!source) return null
  const value = editablePlacement(source)
  // Edit the guide the renderer actually uses, including its readable variant.
  if (value.readablePoints) { value.points = value.readablePoints; delete value.readablePoints }
  return value
})
const query = ref('')
const changedOnly = ref(false)
const results = computed(() => {
  const search = normalizeCountrySearch(query.value)
  return marineLabels.filter(label => (!changedOnly.value || Object.hasOwn(edits.value, label.id))
    && normalizeCountrySearch(`${label.name} ${label.nameNb} ${label.id}`).includes(search))
    .sort((a, b) => a.name.localeCompare(b.name))
})
const collapsed = ref(false)
const showHandles = ref(true)
const previewOriginal = ref(false)
const selectedNode = ref(0)
const fileInput = ref<HTMLInputElement | null>(null)
const overlay = ref<SVGSVGElement | null>(null)
const editLocked = computed(() => props.disabled || previewOriginal.value || recovery.value !== null)

watch([placements, previewOriginal, recovery], () => {
  emit('preview', previewOriginal.value || recovery.value ? undefined : placements.value)
}, { immediate: true })
watch([editLocked, showHandles], () => emit('editing', !editLocked.value && showHandles.value), { immediate: true })
watch(selectedId, () => { finishDrag(); selectedNode.value = 0 })

function save() {
  if (recovery.value || storageConflict.value) return
  try {
    if (localStorage.getItem(storageKey) !== lastSaved) { storageConflict.value = true; return }
    const saved = JSON.stringify(makeDraft(edits.value, baseline, packageInfo.version))
    localStorage.setItem(storageKey, saved)
    lastSaved = saved
    storageError.value = false
  } catch { storageError.value = true }
}
function commit() {
  history.push(edits.value)
  historyRevision.value++
  save()
}
function update(value: MarineLabelPath | null) {
  if (editLocked.value || !value || !validPlacement(value)) { status.value = 'That adjustment is outside the supported map coordinates.'; return }
  const next = { ...edits.value }
  if (samePlacement(value, baseline[selectedId.value]!)) delete next[selectedId.value]
  else next[selectedId.value] = clone(value)
  edits.value = next
  status.value = ''
}
function step(action: 'undo' | 'redo') {
  edits.value = history[action]()
  historyRevision.value++
  selectedNode.value = 0
  save()
}
function resetLabel() {
  const next = { ...edits.value }
  delete next[selectedId.value]
  edits.value = next
  selectedNode.value = 0
  commit()
}
function number(event: Event) { return Number((event.target as HTMLInputElement).value) }
function field(key: 'textScale' | 'center' | 'spanFraction', event: Event) {
  const source = edits.value[selectedId.value] ?? baseline[selectedId.value]
  if (source) update({ ...clone(source), [key]: number(event) })
}

function project(point: MapPoint, referenceX?: number): MapPoint | undefined {
  const p = props.projectPoint(point)
  if (!p?.every(Number.isFinite)) return undefined
  const x = props.wrapPeriod && referenceX !== undefined
    ? p[0] + Math.round((referenceX - p[0]) / props.wrapPeriod) * props.wrapPeriod : p[0]
  return [x, p[1]]
}
function inverse(point: MapPoint, reference: MapPoint): MapPoint | undefined {
  const p = props.unprojectPoint(point)
  if (!p?.every(Number.isFinite)) return undefined
  return [p[0] + Math.round((reference[0] - p[0]) / 360) * 360, p[1]]
}
const pivot = computed(() => selected.value && project(placementPivot(selected.value)))
const displayOffset = computed(() => {
  if (!pivot.value) return 0
  return [...props.copyOffsets].sort((a, b) =>
    Math.abs(props.transform.x + props.transform.scale * (pivot.value![0] + a) - props.width / 2)
    - Math.abs(props.transform.x + props.transform.scale * (pivot.value![0] + b) - props.width / 2))[0] ?? 0
})
function screen(point: MapPoint): MapPoint | undefined {
  const p = project(point, pivot.value?.[0])
  return p && [props.transform.x + props.transform.scale * (p[0] + displayOffset.value),
    props.transform.y + props.transform.scale * p[1]]
}
const nodes = computed(() => selected.value?.points.map(screen) ?? [])
const guidePath = computed(() => {
  const points = selected.value && sampleLabelGuide(selected.value.points).map(screen)
  if (!points || points.some(p => !p)) return ''
  return points.map((p, i) => `${i ? 'L' : 'M'}${p![0]},${p![1]}`).join(' ')
})
const anchor = computed(() => selected.value && screen(placementPivot(selected.value)))
const frame = computed(() => {
  const bounds = selected.value?.bounds
  if (!bounds || selected.value?.layout !== 'horizontal') return ''
  const [[x0, y0], [x1, y1]] = bounds
  const points = ([[x0, y0], [x1, y0], [x1, y1], [x0, y1]] as MapPoint[]).map(screen)
  return points.every(p => p) ? points.map(p => p!.join(',')).join(' ') : ''
})
function focus() {
  if (!selected.value) return
  emit('focus', selected.value.layout === 'horizontal' && selected.value.bounds
    ? selected.value.bounds : selected.value.points)
}
function choose(id: string) { selectedId.value = id; void nextTick(focus) }

function nudge(direction: string) {
  if (!selected.value || !pivot.value) return
  const dx = (direction === '←' ? -2 : direction === '→' ? 2 : 0) / props.transform.scale
  const dy = (direction === '↑' ? -2 : direction === '↓' ? 2 : 0) / props.transform.scale
  const origin = pivot.value
  update(mapPlacement(selected.value, p => {
    const q = project(p, origin[0])
    return q && inverse([q[0] + dx, q[1] + dy], p)
  }))
  commit()
}

function transformGeometry(degrees: number, scale = 1) {
  if (!selected.value || !pivot.value) return
  const origin = pivot.value
  const angle = degrees * Math.PI / 180
  const changed = mapPlacement(selected.value, p => {
    const q = project(p, origin[0])
    if (!q) return undefined
    const x = (q[0] - origin[0]) * scale, y = (q[1] - origin[1]) * scale
    return inverse([origin[0] + x * Math.cos(angle) - y * Math.sin(angle),
      origin[1] + x * Math.sin(angle) + y * Math.cos(angle)], p)
  })
  if (changed?.layout === 'horizontal') {
    // Keep the horizontal fitting frame fixed when rotating its text.
    if (degrees) changed.bounds = selected.value.bounds
    changed.rotation = ((selected.value.rotation ?? 0) + degrees + 540) % 360 - 180
  }
  update(changed)
  commit()
}
function layout(event: Event) {
  if (!selected.value) return
  const value = clone(selected.value)
  if ((event.target as HTMLSelectElement).value === 'horizontal') {
    const center = placementPivot(value)
    value.layout = 'horizontal'
    value.anchor = center
    if (!value.bounds) {
      const xs = value.points.map(p => p[0]), ys = value.points.map(p => p[1])
      const halfWidth = Math.max(0.001, (Math.max(...xs) - Math.min(...xs)) / 2)
      const halfHeight = Math.max(halfWidth / 3, (Math.max(...ys) - Math.min(...ys)) / 2)
      const [x, y] = value.anchor
      value.bounds = [[x - halfWidth, Math.max(-90, y - halfHeight)], [x + halfWidth, Math.min(90, y + halfHeight)]]
    }
  } else {
    delete value.layout; delete value.anchor; delete value.bounds; delete value.rotation
  }
  update(value); commit()
}
function editNode(axis: number, event: Event) {
  if (!selected.value?.points[selectedNode.value]) return
  const value = clone(selected.value)
  value.points[selectedNode.value]![axis] = number(event)
  update(value); commit()
}
function addNode() {
  if (!selected.value || selected.value.points.length >= 128) return
  const value = clone(selected.value)
  const index = Math.min(selectedNode.value, value.points.length - 2)
  const a = value.points[index]!, b = value.points[index + 1]!
  value.points.splice(index + 1, 0, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])
  selectedNode.value = index + 1
  update(value); commit()
}
function removeNode() {
  if (!selected.value || selected.value.points.length <= 3) return
  const value = clone(selected.value)
  value.points.splice(selectedNode.value, 1)
  selectedNode.value = Math.min(selectedNode.value, value.points.length - 1)
  update(value); commit()
}

let drag: { pointerId: number; index: number | null; start: MapPoint; placement: MarineLabelPath; offset: number; before: Placements } | undefined
function mousePoint(event: PointerEvent): MapPoint | undefined {
  const box = overlay.value?.getBoundingClientRect()
  if (!box?.width || !box.height) return undefined
  return [(event.clientX - box.left) * props.width / box.width, (event.clientY - box.top) * props.height / box.height]
}
function startDrag(event: PointerEvent, index: number | null) {
  if (event.button !== 0 || editLocked.value || !selected.value || drag) return
  const start = mousePoint(event)
  if (!start) return
  if (index !== null) selectedNode.value = index
  drag = { pointerId: event.pointerId, index, start, placement: clone(selected.value), offset: displayOffset.value, before: edits.value }
  overlay.value?.setPointerCapture(event.pointerId)
}
function moveDrag(event: PointerEvent) {
  if (!drag || drag.pointerId !== event.pointerId || props.disabled) return
  const current = mousePoint(event)
  if (!current) return
  if (drag.index === null) {
    const dx = (current[0] - drag.start[0]) / props.transform.scale
    const dy = (current[1] - drag.start[1]) / props.transform.scale
    const referenceX = project(placementPivot(drag.placement))?.[0]
    update(mapPlacement(drag.placement, p => {
      const q = project(p, referenceX)
      return q && inverse([q[0] + dx, q[1] + dy], p)
    }))
  } else {
    const value = clone(drag.placement)
    const p = inverse([(current[0] - props.transform.x) / props.transform.scale - drag.offset,
      (current[1] - props.transform.y) / props.transform.scale], value.points[drag.index]!)
    if (p) { value.points[drag.index] = p; update(value) }
  }
}
function finishDrag(event?: PointerEvent) {
  if (!drag || (event && drag.pointerId !== event.pointerId)) return
  const id = drag.pointerId
  drag = undefined
  if (overlay.value?.hasPointerCapture(id)) overlay.value.releasePointerCapture(id)
  commit()
}
function cancelDrag(event: PointerEvent) {
  if (!drag || drag.pointerId !== event.pointerId) return
  edits.value = drag.before
  finishDrag(event)
}
watch(() => props.disabled, value => { if (value) finishDrag() })

function download(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url; link.download = filename
  document.body.appendChild(link); link.click(); link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function exportDraft() {
  commit()
  download(JSON.stringify(makeDraft(edits.value, baseline, packageInfo.version), null, 2) + '\n', 'geo-go-go-water-label-edits.json')
  status.value = 'Exported. Keep this file and hand it back when your edits are ready.'
}
async function importDraft(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    if (file.size > 2_000_000) throw new Error('This file is too large for a water-label draft.')
    const value = readDraft(await file.text(), baseline, ids)
    if (changedIds.value.length && !window.confirm('Replace your current edits with this file? Export first to keep both versions.')) return
    edits.value = value.placements
    selectedNode.value = 0
    commit()
    status.value = 'Draft imported.'
  } catch (error) { status.value = (error as Error).message }
  finally { input.value = '' }
}
function discardRecovery() {
  if (!window.confirm('Discard the saved draft that could not be restored? Download it first if it contains work to keep.')) return
  recovery.value = null
  status.value = ''
  save()
}
function storageChanged(event: StorageEvent) {
  if (event.storageArea === localStorage && (event.key === storageKey || event.key === null)
    && event.newValue !== lastSaved) storageConflict.value = true
}
onMounted(() => {
  window.addEventListener('pagehide', save)
  window.addEventListener('storage', storageChanged)
})
onBeforeUnmount(() => {
  finishDrag(); save(); emit('preview', undefined); emit('editing', false)
  window.removeEventListener('pagehide', save)
  window.removeEventListener('storage', storageChanged)
})
</script>

<template>
  <div class="water-editor" @keydown.stop @pointerdown.stop @click.stop @dblclick.stop @wheel.stop @touchstart.stop @touchmove.stop @selectstart.stop @contextmenu.stop>
    <svg v-if="showHandles && !previewOriginal && !recovery && selected" ref="overlay" class="water-editor-overlay"
      :viewBox="`0 0 ${width} ${height}`" aria-label="Water label path editor"
      @pointermove="moveDrag" @pointerup="finishDrag" @pointercancel="cancelDrag" @lostpointercapture="finishDrag">
      <g v-if="!disabled">
        <polygon v-if="frame" :points="frame" class="water-editor-frame" />
        <template v-if="selected.layout !== 'horizontal'">
          <path :d="guidePath" class="water-editor-guide" />
          <path :d="guidePath" class="water-editor-hit" @pointerdown.stop.prevent="startDrag($event, null)"><title>Drag the whole path</title></path>
          <template v-for="(p, index) in nodes" :key="index">
            <circle v-if="p" :cx="p[0]" :cy="p[1]" :r="index === selectedNode ? 7 : 5"
              :class="['water-editor-node', { 'water-editor-node--selected': index === selectedNode }]"
              @pointerdown.stop.prevent="startDrag($event, index)"><title>Point {{ index + 1 }}: drag to reshape</title></circle>
          </template>
        </template>
        <g v-if="anchor" class="water-editor-move" @pointerdown.stop.prevent="startDrag($event, null)">
          <circle :cx="anchor[0]" :cy="anchor[1] - 28" r="11" />
          <path :d="`M${anchor[0]-5},${anchor[1]-28}h10 M${anchor[0]},${anchor[1]-33}v10`" />
          <title>Drag to move this label and its path</title>
        </g>
      </g>
    </svg>

    <aside class="water-editor-panel" aria-label="Water name editor">
      <header><strong>Water name editor</strong><button type="button" @click="collapsed = !collapsed" :aria-expanded="!collapsed">{{ collapsed ? 'Expand' : 'Minimize' }}</button></header>
      <p class="water-editor-summary">Local draft · {{ changedIds.length }} changed · {{ storageConflict ? 'Autosave paused — another tab changed the draft' : storageError ? 'Autosave unavailable — export to keep work' : recovery ? 'Saved draft needs attention' : 'Autosaves in this browser' }}</p>
      <div v-show="!collapsed" class="water-editor-body">
        <template v-if="recovery">
          <p role="alert">{{ status }}</p>
          <button type="button" @click="download(recovery!, 'geo-go-go-water-label-recovery.json')">Download saved draft</button>
          <button type="button" @click="discardRecovery">Discard saved draft</button>
        </template>
        <template v-else>
          <p v-if="storageConflict" role="alert">Another tab changed the saved draft. Export this tab's work before reloading; its edits will not overwrite the other tab.</p>
          <div class="water-editor-actions">
            <button type="button" :disabled="!canUndo || disabled" @click="step('undo')">Undo</button>
            <button type="button" :disabled="!canRedo || disabled" @click="step('redo')">Redo</button>
            <button type="button" @click="exportDraft">Export</button>
            <button type="button" @click="fileInput?.click()">Import</button>
            <input ref="fileInput" hidden type="file" accept=".json,application/json" @change="importDraft" />
          </div>
          <label class="water-editor-check"><input v-model="previewOriginal" type="checkbox" /> Compare with original placements</label>
          <label class="water-editor-check"><input v-model="showHandles" type="checkbox" /> Show editing handles</label>
          <label>Find a water name<input v-model="query" type="search" placeholder="English, Norwegian, or ID" /></label>
          <label class="water-editor-check"><input v-model="changedOnly" type="checkbox" /> Changed names only</label>
          <select class="water-editor-results" size="4" aria-label="Water names" :value="selectedId" @change="choose(($event.target as HTMLSelectElement).value)">
            <option v-for="label in results" :key="label.id" :value="label.id">{{ edits[label.id] ? '● ' : '' }}{{ label.name }} / {{ label.nameNb }}</option>
          </select>
          <p v-if="!results.length">No matching names.</p>
          <template v-if="selected && selectedLabel">
            <div class="water-editor-selection"><strong>{{ selectedLabel.name }}</strong><span>{{ selectedLabel.nameNb }} · {{ selectedLabel.id }}</span></div>
            <p v-if="warning" class="water-editor-warning" role="status">{{ warning }}</p>
            <div class="water-editor-actions"><button type="button" :disabled="disabled" @click="focus">Find on map</button><button type="button" :disabled="editLocked || !edits[selectedId]" @click="resetLabel">Reset this name</button></div>
            <fieldset :disabled="editLocked">
              <label>Layout<select :value="selected.layout ?? 'curve'" @change="layout"><option value="curve">Text along path</option><option value="horizontal">Horizontal / stacked</option></select></label>
              <label>Text size ×{{ (selected.textScale ?? 1).toFixed(2) }}<input type="range" min="0.1" max="5" step="0.05" :value="selected.textScale ?? 1" @input="field('textScale', $event)" @change="commit" /></label>
              <p class="water-editor-hint">Text size scales independently of the path/frame. Larger text can extend beyond its ends.</p>
              <div class="water-editor-actions"><span>Rotate</span><button v-for="angle in [-10, -1, 1, 10]" :key="angle" type="button" @click="transformGeometry(angle)">{{ angle > 0 ? '+' : '' }}{{ angle }}°</button></div>
              <div class="water-editor-actions"><span>{{ selected.layout === 'horizontal' ? 'Frame' : 'Path' }} size</span><button type="button" @click="transformGeometry(0, 0.9)">−10%</button><button type="button" @click="transformGeometry(0, 1.1)">+10%</button></div>
              <template v-if="selected.layout !== 'horizontal'">
                <label>Text position along path {{ Math.round((selected.center ?? 0.5) * 100) }}%<input type="range" min="0" max="1" step="0.01" :value="selected.center ?? 0.5" @input="field('center', $event)" @change="commit" /></label>
                <label>Use {{ Math.round((selected.spanFraction ?? 0.85) * 100) }}% of path<input type="range" min="0.05" max="1" step="0.01" :value="selected.spanFraction ?? 0.85" @input="field('spanFraction', $event)" @change="commit" /></label>
                <label>Path point<select v-model.number="selectedNode"><option v-for="(_, i) in selected.points" :key="i" :value="i">Point {{ i + 1 }}</option></select></label>
                <div class="water-editor-coordinates">
                  <label>Longitude<input type="number" step="0.001" :value="selected.points[selectedNode]?.[0]" @change="editNode(0, $event)" /></label>
                  <label>Latitude<input type="number" min="-90" max="90" step="0.001" :value="selected.points[selectedNode]?.[1]" @change="editNode(1, $event)" /></label>
                </div>
                <div class="water-editor-actions"><button type="button" :disabled="selected.points.length >= 128" @click="addNode">Insert point after</button><button type="button" :disabled="selected.points.length <= 3" @click="removeNode">Remove point</button></div>
              </template>
              <div class="water-editor-actions"><span>Nudge</span><button v-for="direction in ['←', '↑', '↓', '→']" :key="direction" type="button" @click="nudge(direction)">{{ direction }}</button></div>
            </fieldset>
          </template>
          <p v-else>Select a name above or click a visible water label.</p>
          <p class="water-editor-hint">Drag the cross to move; drag points to reshape. Pan/zoom on the map background. Use normal language, projection, and detail controls to compare. Choose World for names outside the current region.</p>
          <p v-if="status" role="status">{{ status }}</p>
        </template>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.water-editor { position: absolute; inset: 0; z-index: 6; pointer-events: none; }
.water-editor-overlay { position: absolute; inset: 0; width: 100%; height: 100%; overflow: hidden; }
.water-editor-panel { position: absolute; top: 12px; right: 12px; width: min(310px, calc(100% - 24px)); max-height: calc(100% - 24px); overflow: auto; padding: 12px; color: var(--ui-ink); background: var(--ui-paper); border: 1px solid var(--ui-border); border-radius: 12px; box-shadow: var(--ui-shadow-panel); pointer-events: auto; font: 12px/1.45 var(--ui-font-body, sans-serif); }
header, .water-editor-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; }
header { justify-content: space-between; }
.water-editor-body, fieldset { display: grid; gap: 9px; }
fieldset { min-width: 0; margin: 0; padding: 0; border: 0; }
label { display: grid; gap: 3px; }
input:not([type=checkbox]), select { width: 100%; min-width: 0; box-sizing: border-box; }
input, select, button { color: inherit; font: inherit; accent-color: #276c8e; }
input { -webkit-user-select: text; user-select: text; }
input:not([type=range]), select, button { padding: 5px 7px; border: 1px solid var(--ui-border); border-radius: 5px; background: var(--ui-panel, white); }
button { cursor: pointer; }
button:disabled, fieldset:disabled { opacity: 0.5; }
button:disabled { cursor: default; }
.water-editor-check { display: flex; align-items: center; gap: 5px; }
.water-editor-coordinates { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.water-editor-selection { display: grid; }
.water-editor-summary, .water-editor-hint { color: var(--ui-text); font-size: 11px; }
.water-editor-warning { padding: 7px; border-left: 3px solid #b54219; }
p { margin: 6px 0; }
.water-editor-guide { fill: none; stroke: #b54219; stroke-width: 2; stroke-dasharray: 5 3; }
.water-editor-hit { fill: none; stroke: transparent; stroke-width: 16; pointer-events: stroke; cursor: move; touch-action: none; }
.water-editor-node { fill: #fff; stroke: #b54219; stroke-width: 2; pointer-events: all; cursor: pointer; touch-action: none; }
.water-editor-node:hover { stroke-width: 3; }
.water-editor-node--selected { fill: #ffc765; }
.water-editor-move { pointer-events: all; cursor: move; touch-action: none; }
.water-editor-move circle { fill: #fff; stroke: #276c8e; stroke-width: 2; }
.water-editor-move path { fill: none; stroke: #276c8e; stroke-width: 2; pointer-events: none; }
.water-editor-frame { fill: none; stroke: #276c8e; stroke-width: 1; stroke-dasharray: 4 4; }
@media (max-width: 700px) { .water-editor-panel { max-height: 50%; } }
</style>
