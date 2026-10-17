<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import packageInfo from '../../package.json'
import type { Geometry } from 'geojson'
import { geoCentroid } from 'd3-geo'
import waterBoundaries from './water-boundaries.json'
import { marineLabels, type MarineLabel, type MarineLabelText } from '../data/marineLabels'
import { marineLabelPaths, type MarineLabelPath } from '../data/marineLabelPaths'
import type { MapPoint } from '../composables/useMapZoom'
import { replaceWaterLabelPlacements, updateWaterLabelPlacement, waterLabelPlacements } from '../logic/marineLabelPlacements'
import { sampleLabelGuide } from '../logic/marineLabelLayout'
import { normalizeCountrySearch } from '../logic/countrySuggestions'
import { isIntegratedWaterDraft } from './integratedWaterDraft'
import { clone, createHistory, editablePlacement, makeDraft, mapPlacement, oceanPartNames, placementPivot, preservePlacementFontSize, readDraft, samePlacement, validLabelText, validPlacement, waterLabelBaseline, waterKinds, type CustomWaterLabel, type Placements } from './waterLabelDraft'

const props = defineProps<{
  width: number
  height: number
  transform: Readonly<{ x: number; y: number; scale: number }>
  projectPoint: (point: MapPoint) => MapPoint | undefined
  projectGeometry: (geometry: Geometry) => string
  unprojectPoint: (point: MapPoint) => MapPoint | undefined
  wrapPeriod: number | null
  copyOffsets: readonly number[]
  disabled: boolean
  warning: string
  fontSize: { id: string; size: number; pixels: number; placementIndex: number } | null
}>()
const selectedId = defineModel<string>('selectedId', { required: true })
const placementIndex = defineModel<number>('placementIndex', { required: true })
const emit = defineEmits<{
  preview: [placements: Placements | undefined]
  editing: [enabled: boolean]
  focus: [points: MapPoint[]]
  labels: [labels: MarineLabel[] | undefined]
}>()

// Settings reset clears geo-go-go.*; keep editorial work outside that prefix.
const storageKey = 'geo-go-go-editor.water-label-draft.v1'
const sourceLabels = shallowRef<MarineLabel[]>(marineLabels)
const sourcePaths = shallowRef<Placements>(marineLabelPaths)
let ids = new Set(marineLabels.map(label => label.id))
let baseline = waterLabelBaseline(marineLabels, marineLabelPaths)
const projectRevision = ref('')
const projectSaving = ref(false)
const projectError = ref('')
const edits = shallowRef<Placements>({})
const customLabels = shallowRef<Record<string, CustomWaterLabel>>({})
const hiddenIds = shallowRef<string[]>([])
const labelText = shallowRef<Record<string, MarineLabelText>>({})
const status = ref('')
const storageError = ref(false)
const storageConflict = ref(false)
const recovery = ref<string | null>(null)
let lastSaved: string | null = null
try {
  const saved = localStorage.getItem(storageKey)
  lastSaved = saved
  if (saved) {
    try { restoreSnapshot(readDraft(saved, baseline, ids)) }
    catch (error) {
      recovery.value = saved; status.value = String((error as Error).message)
      void resumeIntegratedDraft(saved)
    }
  }
} catch { storageError.value = true }
async function resumeIntegratedDraft(saved: string) {
  try {
    if (!await isIntegratedWaterDraft(saved) || recovery.value !== saved) return
    if (localStorage.getItem(storageKey) !== saved) { storageConflict.value = true; return }
    // Keep the full original before starting a fresh draft on the new baseline.
    localStorage.setItem(`${storageKey}.integrated-backup`, saved)
    const fresh = JSON.stringify(makeDraft({}, baseline, packageInfo.version))
    localStorage.setItem(storageKey, fresh)
    lastSaved = fresh
    recovery.value = null
    status.value = 'Your previous draft is already integrated. The editor is ready for new changes on the updated map; a local backup of the old draft is retained.'
  } catch { /* Keep recovery controls and the original draft if matching or storage fails. */ }
}
function snapshot() { return { placements: edits.value, customLabels: customLabels.value, hiddenIds: hiddenIds.value, labelText: labelText.value } }
function restoreSnapshot(value: ReturnType<typeof snapshot>) {
  edits.value = value.placements; customLabels.value = value.customLabels; hiddenIds.value = value.hiddenIds; labelText.value = value.labelText
}
let history = createHistory(snapshot())
const historyRevision = ref(0)
const canUndo = computed(() => { void historyRevision.value; return history.canUndo })
const canRedo = computed(() => { void historyRevision.value; return history.canRedo })
const placements = computed(() => ({ ...sourcePaths.value, ...edits.value }))
const changedIds = computed(() => [...new Set([...Object.keys(edits.value), ...Object.keys(labelText.value), ...hiddenIds.value])])
const allLabels = computed<MarineLabel[]>(() => [...sourceLabels.value, ...Object.values(customLabels.value)]
  .map(label => ({ ...label, ...labelText.value[label.id] })))
const selectedLabel = computed(() => allLabels.value.find(label => label.id === selectedId.value))
const selectedRoot = computed(() => edits.value[selectedId.value] ?? baseline[selectedId.value])
const placementCount = computed(() => 1 + (selectedRoot.value?.additionalPlacements?.length ?? 0))
const selected = computed(() => {
  const root = selectedRoot.value
  const source = root && waterLabelPlacements(root)[placementIndex.value]
  if (!source) return null
  const value = editablePlacement(source)
  // Edit the guide the renderer actually uses, including its readable variant.
  if (value.readablePoints) { value.points = value.readablePoints; delete value.readablePoints }
  return value
})
const query = ref('')
const changedOnly = ref(false)
const showRemoved = ref(false)
const adding = ref(false)
const newName = ref(''), newNameNb = ref(''), newKind = ref('ocean'), newBoundary = ref('')
const results = computed(() => {
  const search = normalizeCountrySearch(query.value)
  return allLabels.value.filter(label => (showRemoved.value || !hiddenIds.value.includes(label.id))
    && (!changedOnly.value || changedIds.value.includes(label.id))
    && normalizeCountrySearch(`${label.name} ${label.nameNb} ${label.id}`).includes(search))
    .sort((a, b) => a.name.localeCompare(b.name))
})
const collapsed = ref(false)
const showHandles = ref(true)
const showWaterArea = ref(true)
const boundaries: Record<string, Geometry> = { ...waterBoundaries.boundaries as unknown as Record<string, Geometry> }
for (const ocean of ['atlantic', 'pacific']) {
  const geometry = boundaries[`ocean:${ocean}`]
  if (geometry?.type === 'GeometryCollection') {
    boundaries[`ocean:${ocean}:north`] = geometry.geometries[0]!
    boundaries[`ocean:${ocean}:south`] = geometry.geometries[1]!
  }
}
// Source geometry is independent of the editable placement and its fitting box.
const boundaryPath = computed(() => {
  const geometry = boundaries[selectedLabel.value?.boundaryId ?? selectedId.value]
  return geometry ? props.projectGeometry(geometry) : ''
})
const previewOriginal = ref(false)
const selectedNode = ref(0)
const fileInput = ref<HTMLInputElement | null>(null)
const overlay = ref<SVGSVGElement | null>(null)
const editLocked = computed(() => props.disabled || projectSaving.value || previewOriginal.value || recovery.value !== null
  || hiddenIds.value.includes(selectedId.value)
  // Wait for the first size measurement before editing an automatic label.
  || (!!selectedId.value && selected.value?.textSize === undefined && (props.fontSize?.id !== selectedId.value || props.fontSize.placementIndex !== placementIndex.value)))

watch([placements, previewOriginal, recovery], () => {
  emit('preview', recovery.value ? undefined : previewOriginal.value ? sourcePaths.value : placements.value)
}, { immediate: true })
watch([allLabels, hiddenIds, previewOriginal, recovery], () => {
  emit('labels', recovery.value ? undefined : previewOriginal.value ? sourceLabels.value
    : allLabels.value.filter(label => !hiddenIds.value.includes(label.id)))
}, { immediate: true })
watch([editLocked, showHandles], () => emit('editing', !editLocked.value && showHandles.value), { immediate: true })
watch([selectedId, placementIndex], () => { finishDrag(); selectedNode.value = 0 })
watch([selectedRoot, placementCount], () => { if (!selectedRoot.value || placementIndex.value >= placementCount.value) placementIndex.value = 0 })

function save() {
  if (recovery.value || storageConflict.value) return
  try {
    if (localStorage.getItem(storageKey) !== lastSaved) { storageConflict.value = true; return }
    const saved = JSON.stringify(currentDraft())
    localStorage.setItem(storageKey, saved)
    lastSaved = saved
    storageError.value = false
  } catch { storageError.value = true }
}
function currentDraft() { return makeDraft(edits.value, baseline, packageInfo.version, customLabels.value, hiddenIds.value, labelText.value) }
function commit() {
  history.push(snapshot())
  historyRevision.value++
  save()
}
function storePlacement(value: MarineLabelPath | null) {
  if (editLocked.value || !value || !validPlacement(value)) { status.value = 'That adjustment is outside the supported map coordinates.'; return false }
  const next = { ...edits.value }
  if (baseline[selectedId.value] && samePlacement(value, baseline[selectedId.value]!)) delete next[selectedId.value]
  else next[selectedId.value] = clone(value)
  edits.value = next
  status.value = ''
  return true
}
function update(value: MarineLabelPath | null) {
  storePlacement(value && selectedRoot.value ? updateWaterLabelPlacement(selectedRoot.value, placementIndex.value, value) : null)
}
function step(action: 'undo' | 'redo') {
  restoreSnapshot(history[action]())
  if (!allLabels.value.some(label => label.id === selectedId.value)) selectedId.value = ''
  historyRevision.value++
  selectedNode.value = 0
  save()
}
function resetLabel() {
  if (customLabels.value[selectedId.value]) return
  const next = { ...edits.value }
  delete next[selectedId.value]
  edits.value = next
  const text = { ...labelText.value }; delete text[selectedId.value]; labelText.value = text
  selectedNode.value = 0
  commit()
}
function removeName() {
  const id = selectedId.value
  if (!id || props.disabled || previewOriginal.value) return
  if (customLabels.value[id]) {
    const names = { ...customLabels.value }, placements = { ...edits.value }
    delete names[id]; delete placements[id]
    customLabels.value = names; edits.value = placements
    const text = { ...labelText.value }; delete text[id]; labelText.value = text
  } else hiddenIds.value = [...new Set([...hiddenIds.value, id])]
  selectedId.value = ''
  commit()
}
function restoreName() {
  hiddenIds.value = hiddenIds.value.filter(id => id !== selectedId.value)
  commit()
  void nextTick(focus)
}
function addName() {
  if (props.disabled || previewOriginal.value || recovery.value) return
  const name = newName.value.trim(), nameNb = newNameNb.value.trim()
  if (!name || !nameNb || name.length > 120 || nameNb.length > 120) { status.value = 'Enter an English and Norwegian name (up to 120 characters each).'; return }
  if (Object.keys(customLabels.value).length >= 100) { status.value = 'A draft can contain up to 100 added names.'; return }
  if (allLabels.value.some(label => !hiddenIds.value.includes(label.id) && normalizeCountrySearch(label.name) === normalizeCountrySearch(name))) {
    status.value = 'That English name already exists. Select it to edit its placement.'; return
  }
  const geometry = boundaries[newBoundary.value]
  const center = geometry ? geoCentroid(geometry) : props.unprojectPoint([
    (props.width / 2 - props.transform.x) / props.transform.scale,
    (props.height / 2 - props.transform.y) / props.transform.scale,
  ])
  if (!center?.every(Number.isFinite)) { status.value = 'Pan to a usable map center before adding a name.'; return }
  const x = ((center[0] + 180) % 360 + 360) % 360 - 180
  const y = Math.max(-89.999, Math.min(89.999, center[1]))
  const id = `custom:${crypto.randomUUID()}`
  const label: CustomWaterLabel = {
    id, name, nameNb, kind: newKind.value, point: [x, y],
    rank: newKind.value === 'ocean' ? 0 : 2, minLabel: 1, maxLabel: 10,
    ...(newBoundary.value ? { boundaryId: newBoundary.value } : {}),
  }
  const size = props.fontSize?.id === selectedId.value && props.fontSize.placementIndex === placementIndex.value ? props.fontSize.size : newKind.value === 'ocean' ? 20 : 8
  const placement: MarineLabelPath = {
    points: [[x - 8, y], [x, y], [x + 8, y]], layout: 'horizontal', anchor: [x, y],
    bounds: [[x - 12, Math.max(-90, y - 5)], [x + 12, Math.min(90, y + 5)]], textSize: size,
  }
  customLabels.value = { ...customLabels.value, [id]: label }
  edits.value = { ...edits.value, [id]: placement }
  selectedId.value = id
  placementIndex.value = 0
  query.value = ''; changedOnly.value = false; showRemoved.value = false
  adding.value = false; newName.value = ''; newNameNb.value = ''; newBoundary.value = ''
  status.value = 'Name added to this draft. Export when ready for integration.'
  commit()
  void nextTick(focus)
}
function number(event: Event) { return Number((event.target as HTMLInputElement).value) }
function preserveSize(placement: MarineLabelPath) {
  return preservePlacementFontSize(placement, props.fontSize?.id === selectedId.value && props.fontSize.placementIndex === placementIndex.value ? props.fontSize.size : undefined)
}
function field(key: 'center' | 'spanFraction', event: Event) {
  const source = selected.value
  if (source) update({ ...clone(source), [key]: number(event) })
}

function setFontSize(event: Event, completed = true) {
  const source = selected.value
  if (!source) return
  const input = event.target as HTMLInputElement
  const size = input.value.trim() ? Number(input.value) : NaN
  if (!Number.isFinite(size) || size < 0.000001 || size > 1000) {
    status.value = 'Enter a font size between 0.000001 and 1000.'
    return
  }
  const value = clone(source)
  value.textSize = size
  delete value.textScale
  update(value)
  if (completed) commit()
}
function setLetterSpacing(event: Event | null, completed = true) {
  if (editLocked.value) return
  const source = selected.value
  if (!source) return
  const input = event?.target as HTMLInputElement | undefined
  const spacing = input?.value.trim() ? Number(input.value) : NaN
  if (event && (!Number.isFinite(spacing) || spacing < -0.1 || spacing > 2)) {
    status.value = 'Enter letter spacing between -0.1 and 2 em.'
    return
  }
  const value = preserveSize(source)
  if (event) value.letterSpacing = spacing
  else delete value.letterSpacing
  update(value)
  if (completed) commit()
}
function setLabelText(key: keyof MarineLabelText, event: Event) {
  if (editLocked.value) return
  const id = selectedId.value
  const original = customLabels.value[id] ?? sourceLabels.value.find(label => label.id === id)
  if (!original) return
  const input = event.target as HTMLInputElement | HTMLTextAreaElement
  const text = input.value.replace(/\r\n?/g, '\n').split('\n').map(line => line.trim()).join('\n').trim()
  const next = { ...labelText.value[id] }
  if ((!text && (key === 'stackedText' || key === 'stackedTextNb') && !original[key]) || text === original[key]) delete next[key]
  else next[key] = text
  if (!validLabelText(next)) {
    status.value = 'Names need one line (up to 120 characters); stacked text allows up to four nonempty lines (240 characters total).'
    return
  }
  const source = selected.value
  if (source) update(preserveSize(source))
  const changes = { ...labelText.value }
  if (Object.keys(next).length) changes[id] = next
  else delete changes[id]
  labelText.value = changes
  status.value = ''
  commit()
}
function automaticFontSize() {
  if (placementCount.value > 1) return
  const source = selected.value
  if (!source) return
  const value = clone(source)
  delete value.textSize; delete value.textScale
  update(value); commit()
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
function focus() {
  if (!selected.value) return
  emit('focus', selected.value.layout === 'horizontal' && selected.value.bounds
    ? selected.value.bounds : selected.value.points)
}
function choose(id: string) { selectedId.value = id; placementIndex.value = 0; void nextTick(focus) }

function addPlacement(duplicate: boolean) {
  if (editLocked.value || !selectedRoot.value || !selected.value || placementCount.value >= 12) return
  const frozen = preserveSize(selected.value)
  if (frozen.textSize === undefined) return
  const root = updateWaterLabelPlacement(selectedRoot.value, placementIndex.value, frozen)
  let added: MarineLabelPath | null
  if (duplicate) {
    const origin = project(placementPivot(frozen))
    added = origin ? mapPlacement(frozen, p => {
      const q = project(p, origin[0])
      return q && inverse([q[0] + 50 / props.transform.scale, q[1]], p)
    }) : null
  } else {
    const center = props.unprojectPoint([(props.width / 2 - props.transform.x) / props.transform.scale,
      (props.height / 2 - props.transform.y) / props.transform.scale])
    if (!center?.every(Number.isFinite)) { status.value = 'Pan to a usable map center before adding a placement.'; return }
    const [x, y] = center
    added = { points: [[x - 2, y], [x, y], [x + 2, y]], layout: 'horizontal', anchor: [x, y],
      bounds: [[x - 3, Math.max(-90, y - 1)], [x + 3, Math.min(90, y + 1)]] }
  }
  if (!added) { status.value = 'Could not place a copy here. Pan to a usable map area.'; return }
  if (!storePlacement(replaceWaterLabelPlacements(root, [...waterLabelPlacements(root), added]))) return
  placementIndex.value = placementCount.value - 1
  commit()
  void nextTick(focus)
}
function removePlacement() {
  if (editLocked.value || !selectedRoot.value || placementCount.value <= 1) return
  const remaining = waterLabelPlacements(selectedRoot.value).filter((_, index) => index !== placementIndex.value)
  if (!storePlacement(replaceWaterLabelPlacements(selectedRoot.value, remaining))) return
  placementIndex.value = Math.min(placementIndex.value, remaining.length - 1)
  commit()
}
function setPlacementText(key: 'text' | 'textNb', event: Event) {
  if (!selected.value || editLocked.value) return
  const value = preserveSize(selected.value)
  const text = (event.target as HTMLInputElement).value.trim()
  if (text) value[key] = text
  else delete value[key]
  update(value); commit()
}

function nudge(direction: string) {
  if (!selected.value || !pivot.value) return
  const dx = (direction === '←' ? -2 : direction === '→' ? 2 : 0) / props.transform.scale
  const dy = (direction === '↑' ? -2 : direction === '↓' ? 2 : 0) / props.transform.scale
  const origin = pivot.value
  update(mapPlacement(preserveSize(selected.value), p => {
    const q = project(p, origin[0])
    return q && inverse([q[0] + dx, q[1] + dy], p)
  }))
  commit()
}

function transformGeometry(degrees: number, scale = 1) {
  if (!selected.value || !pivot.value) return
  const origin = pivot.value
  const angle = degrees * Math.PI / 180
  const changed = mapPlacement(preserveSize(selected.value), p => {
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
  const value = preserveSize(selected.value)
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
  const value = preserveSize(selected.value)
  value.points[selectedNode.value]![axis] = number(event)
  update(value); commit()
}
function addNode() {
  if (!selected.value || selected.value.points.length >= 128) return
  const value = preserveSize(selected.value)
  const index = Math.min(selectedNode.value, value.points.length - 2)
  const a = value.points[index]!, b = value.points[index + 1]!
  value.points.splice(index + 1, 0, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])
  selectedNode.value = index + 1
  update(value); commit()
}
function removeNode() {
  if (!selected.value || selected.value.points.length <= 3) return
  const value = preserveSize(selected.value)
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
  drag = { pointerId: event.pointerId, index, start, placement: preserveSize(selected.value), offset: displayOffset.value, before: edits.value }
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
  download(JSON.stringify(currentDraft(), null, 2) + '\n', 'geo-go-go-water-label-edits.json')
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
    restoreSnapshot(value)
    if (!allLabels.value.some(label => label.id === selectedId.value)) selectedId.value = ''
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
interface ProjectState { revision: string; labels: MarineLabel[]; placements: Placements }
const projectEndpoint = '/__geo_go_go/water-label-project'
async function loadProjectRevision() {
  try {
    const response = await fetch(projectEndpoint, { cache: 'no-store' })
    const value = await response.json() as ProjectState & { error?: string }
    if (!response.ok) throw new Error(value.error ?? 'Project saving is unavailable.')
    if (JSON.stringify(value.labels) !== JSON.stringify(sourceLabels.value)
      || JSON.stringify(value.placements) !== JSON.stringify(sourcePaths.value)) {
      throw new Error('Project data changed since this page loaded. Export your draft and reload before saving.')
    }
    projectRevision.value = value.revision
    projectError.value = ''
  } catch (error) { projectError.value = (error as Error).message }
}
async function saveToProject() {
  if (!projectRevision.value || projectSaving.value || props.disabled || previewOriginal.value || recovery.value || storageConflict.value) return
  finishDrag()
  commit()
  projectSaving.value = true
  projectError.value = ''
  try {
    const response = await fetch(projectEndpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ revision: projectRevision.value, draft: currentDraft() }),
    })
    const value = await response.json() as ProjectState & { error?: string }
    if (!response.ok) {
      if (response.status === 409) projectRevision.value = ''
      throw new Error(value.error ?? 'Could not save project data.')
    }
    sourceLabels.value = value.labels
    sourcePaths.value = value.placements
    ids = new Set(value.labels.map(label => label.id))
    baseline = waterLabelBaseline(value.labels, value.placements)
    restoreSnapshot({ placements: {}, customLabels: {}, hiddenIds: [], labelText: {} })
    if (!ids.has(selectedId.value)) selectedId.value = ''
    history = createHistory(snapshot()); historyRevision.value++
    projectRevision.value = value.revision
    save()
    status.value = 'Saved to project. This is the new editing baseline; other tabs pick it up on reload. Commit and publish separately.'
  } catch (error) { projectError.value = (error as Error).message }
  finally { projectSaving.value = false }
}
function storageChanged(event: StorageEvent) {
  if (event.storageArea === localStorage && (event.key === storageKey || event.key === null)
    && event.newValue !== lastSaved) storageConflict.value = true
}
onMounted(() => {
  void loadProjectRevision()
  window.addEventListener('pagehide', save)
  window.addEventListener('storage', storageChanged)
})
onBeforeUnmount(() => {
  finishDrag(); save(); emit('preview', undefined); emit('labels', undefined); emit('editing', false)
  window.removeEventListener('pagehide', save)
  window.removeEventListener('storage', storageChanged)
})
</script>

<template>
  <div class="water-editor" @keydown.stop @pointerdown.stop @click.stop @dblclick.stop @wheel.stop @touchstart.stop @touchmove.stop @selectstart.stop @contextmenu.stop>
    <svg v-if="showWaterArea && boundaryPath && !recovery" class="water-editor-boundary" :viewBox="`0 0 ${width} ${height}`" aria-hidden="true">
      <g :transform="`translate(${transform.x} ${transform.y}) scale(${transform.scale})`">
        <path v-for="offset in copyOffsets" :key="offset" :d="boundaryPath"
          :transform="offset ? `translate(${offset} 0)` : undefined" vector-effect="non-scaling-stroke" />
      </g>
    </svg>
    <svg v-if="showHandles && !previewOriginal && !recovery && selected && !hiddenIds.includes(selectedId)" ref="overlay" class="water-editor-overlay"
      :viewBox="`0 0 ${width} ${height}`" aria-label="Water label path editor"
      @pointermove="moveDrag" @pointerup="finishDrag" @pointercancel="cancelDrag" @lostpointercapture="finishDrag">
      <g v-if="!disabled">
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
      <fieldset v-show="!collapsed" class="water-editor-body" :disabled="projectSaving">
        <template v-if="recovery">
          <p role="alert">{{ status }}</p>
          <button type="button" @click="download(recovery!, 'geo-go-go-water-label-recovery.json')">Download saved draft</button>
          <button type="button" @click="discardRecovery">Discard saved draft</button>
        </template>
        <template v-else>
          <p v-if="storageConflict" role="alert">Another tab changed the saved draft. Export this tab's work before reloading; its edits will not overwrite the other tab.</p>
          <div class="water-editor-actions">
            <button type="button" :disabled="!projectRevision || !changedIds.length || disabled || previewOriginal || storageConflict" @click="saveToProject">{{ projectSaving ? 'Saving…' : 'Save to project' }}</button>
            <button type="button" :disabled="!canUndo || disabled" @click="step('undo')">Undo</button>
            <button type="button" :disabled="!canRedo || disabled" @click="step('redo')">Redo</button>
            <button type="button" @click="exportDraft">Export</button>
            <button type="button" @click="fileInput?.click()">Import</button>
            <button type="button" :disabled="disabled || previewOriginal" @click="adding = !adding">Add name</button>
            <input ref="fileInput" hidden type="file" accept=".json,application/json" @change="importDraft" />
          </div>
          <form v-if="adding" class="water-editor-add" @submit.prevent="addName">
            <label>English name<input v-model="newName" required maxlength="120" placeholder="North Atlantic Ocean" /></label>
            <label>Norwegian name<input v-model="newNameNb" required maxlength="120" placeholder="Nord-Atlanteren" /></label>
            <label>Water type<select v-model="newKind"><option v-for="kind in waterKinds" :key="kind" :value="kind">{{ kind }}</option></select></label>
            <label>Boundary reference<select v-model="newBoundary">
              <option value="">None — start at map center</option>
              <optgroup label="Ocean source regions"><option v-for="(name, id) in oceanPartNames" :key="id" :value="id">{{ name }}</option></optgroup>
              <optgroup label="Existing water regions"><option v-for="label in sourceLabels" :key="label.id" :value="label.id">{{ label.name }}</option></optgroup>
            </select></label>
            <p class="water-editor-hint">New names start at the map center or the chosen region's geographic center. Both languages are required.</p>
            <div class="water-editor-actions"><button type="submit" :disabled="disabled || previewOriginal">Create name</button><button type="button" @click="adding = false">Cancel</button></div>
          </form>
          <label class="water-editor-check"><input v-model="previewOriginal" type="checkbox" /> Compare with original placements</label>
          <label class="water-editor-check"><input v-model="showHandles" type="checkbox" /> Show editing handles</label>
          <label class="water-editor-check"><input v-model="showWaterArea" type="checkbox" /> Show approximate water boundary</label>
          <label>Find a water name<input v-model="query" type="search" placeholder="English, Norwegian, or ID" /></label>
          <label class="water-editor-check"><input v-model="changedOnly" type="checkbox" /> Changed names only</label>
          <label class="water-editor-check"><input v-model="showRemoved" type="checkbox" /> Show removed names</label>
          <select class="water-editor-results" size="4" aria-label="Water names" :value="selectedId" @change="choose(($event.target as HTMLSelectElement).value)">
            <option v-for="label in results" :key="label.id" :value="label.id">{{ hiddenIds.includes(label.id) ? 'Removed · ' : customLabels[label.id] ? 'Added · ' : edits[label.id] || labelText[label.id] ? '● ' : '' }}{{ label.name }} / {{ label.nameNb }}</option>
          </select>
          <p v-if="!results.length">No matching names.</p>
          <template v-if="selected && selectedLabel">
            <div class="water-editor-selection"><strong>{{ selectedLabel.name }}</strong><span>{{ selectedLabel.nameNb }} · {{ selectedLabel.id }}</span></div>
            <p v-if="showWaterArea && boundaryPath" class="water-editor-hint">Purple area: Natural Earth's approximate marine extent. It stays fixed as you edit; it is guidance, not a placement restriction.</p>
            <p v-if="customLabels[selectedId] && !boundaryPath" class="water-editor-hint">This added name has no boundary reference.</p>
            <p v-if="warning" class="water-editor-warning" role="status">{{ warning }}</p>
            <div class="water-editor-actions">
              <button type="button" :disabled="disabled" @click="focus">Find on map</button>
              <button v-if="!customLabels[selectedId]" type="button" :disabled="editLocked || (!edits[selectedId] && !labelText[selectedId])" @click="resetLabel">Reset this name</button>
              <button v-if="hiddenIds.includes(selectedId)" type="button" :disabled="disabled || previewOriginal" @click="restoreName">Restore name</button>
              <button v-else type="button" :disabled="disabled || previewOriginal" @click="removeName">Remove name</button>
            </div>
            <fieldset :disabled="editLocked">
              <label>Placement<select v-model.number="placementIndex"><option v-for="index in placementCount" :key="index" :value="index - 1">Placement {{ index }}</option></select></label>
              <div class="water-editor-actions">
                <button type="button" :disabled="placementCount >= 12" @click="addPlacement(false)">Add placement</button>
                <button type="button" :disabled="placementCount >= 12" @click="addPlacement(true)">Duplicate placement</button>
                <button type="button" :disabled="placementCount <= 1" @click="removePlacement">Remove placement</button>
              </div>
              <label>Placement text · English<input :value="selected.text ?? ''" maxlength="120" placeholder="Empty repeats the full name" @change="setPlacementText('text', $event)" /></label>
              <label>Placement text · Norwegian<input :value="selected.textNb ?? ''" maxlength="120" placeholder="Empty repeats the full name" @change="setPlacementText('textNb', $event)" /></label>
              <p class="water-editor-hint">Each placement has its own position, path, rotation, and optional single-line text in each language. For split names, enter e.g. Northwest / Nordvest- here and Passage / passasjen on another placement. Font size and letter spacing are shared by all placements. Multiple placements use an explicit shared font size.</p>
              <label>English name<input :value="selectedLabel.name" maxlength="120" @change="setLabelText('name', $event)" /></label>
              <label>Norwegian name<input :value="selectedLabel.nameNb" maxlength="120" @change="setLabelText('nameNb', $event)" /></label>
              <label>English horizontal/stacked text<textarea :value="selectedLabel.stackedText ?? ''" rows="2" maxlength="240" placeholder="Leave empty for automatic wrapping" @change="setLabelText('stackedText', $event)" /></label>
              <label>Norwegian horizontal/stacked text<textarea :value="selectedLabel.stackedTextNb ?? ''" rows="2" maxlength="240" placeholder="Leave empty for automatic wrapping" @change="setLabelText('stackedTextNb', $event)" /></label>
              <p class="water-editor-hint">Use Enter for line breaks and type any dash explicitly (up to four lines). Empty stacked text uses automatic wrapping. Text along path always uses the single-line name; stacked text is kept when switching layouts.</p>
              <label>Layout<select :value="selected.layout ?? 'curve'" @change="layout"><option value="curve">Text along path</option><option value="horizontal">Horizontal / stacked</option></select></label>
              <label>Font size<input type="number" min="0.000001" max="1000" step="0.1"
                :value="selected.textSize ?? (fontSize?.id === selectedId ? Number(fontSize.size.toFixed(6)) : undefined)"
                placeholder="Enter size" @change="setFontSize" /></label>
              <label>Font size slider · 0.1–20<input type="range" min="0.1" max="20" step="0.1"
                :value="Math.min(20, Math.max(0.1, selected.textSize ?? (fontSize?.id === selectedId ? fontSize.size : 0.1)))"
                @input="setFontSize($event, false)" @change="commit" /></label>
              <div class="water-editor-actions">
                <button type="button" :disabled="placementCount > 1 || (selected.textSize === undefined && selected.textScale === undefined)" @click="automaticFontSize">Automatic size</button>
                <span v-if="fontSize?.id === selectedId && !previewOriginal">Currently {{ fontSize.pixels.toFixed(1) }} px</span>
              </div>
              <p class="water-editor-hint">Use the number input for sizes outside the slider's range. Equal values give equal font size in the same view. The number is font pixels on a 1600px-wide reference map; zoom changes the current pixel size. Larger curved text can extend beyond the path's ends.</p>
              <label>Letter spacing (em)<input type="number" min="-0.1" max="2" step="0.01"
                :value="selected.letterSpacing ?? (selectedLabel.kind === 'ocean' ? 0.25 : 0.11)" @change="setLetterSpacing" /></label>
              <label>Letter spacing slider · −0.1–0.5 em<input type="range" min="-0.1" max="0.5" step="0.01"
                :value="Math.min(0.5, selected.letterSpacing ?? (selectedLabel.kind === 'ocean' ? 0.25 : 0.11))"
                @input="setLetterSpacing($event, false)" @change="commit" /></label>
              <div class="water-editor-actions"><button type="button" :disabled="selected.letterSpacing === undefined" @click="setLetterSpacing(null)">Default letter spacing</button></div>
              <p class="water-editor-hint">0 means no extra spacing; larger values spread letters apart and negative values tighten them. Spacing follows font size and applies to both languages and layouts. The number input accepts values beyond the slider's range.</p>
              <div class="water-editor-actions"><span>Rotate</span><button v-for="angle in [-10, -1, 1, 10]" :key="angle" type="button" @click="transformGeometry(angle)">{{ angle > 0 ? '+' : '' }}{{ angle }}°</button></div>
              <template v-if="selected.layout !== 'horizontal'">
                <div class="water-editor-actions"><span>Path size</span><button type="button" @click="transformGeometry(0, 0.9)">−10%</button><button type="button" @click="transformGeometry(0, 1.1)">+10%</button></div>
                <label>Text position along path {{ Math.round((selected.center ?? 0.5) * 100) }}%<input type="range" min="0" max="1" step="0.01" :value="selected.center ?? 0.5" @input="field('center', $event)" @change="commit" /></label>
                <label v-if="selected.textSize === undefined">Auto-size path use {{ Math.round((selected.spanFraction ?? 0.85) * 100) }}%<input type="range" min="0.05" max="1" step="0.01" :value="selected.spanFraction ?? 0.85" @input="field('spanFraction', $event)" @change="commit" /></label>
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
          <p v-if="projectError" class="water-editor-warning" role="alert">{{ projectError }}</p>
          <p v-if="status" role="status">{{ status }}</p>
        </template>
      </fieldset>
    </aside>
  </div>
</template>

<style scoped>
.water-editor { position: absolute; inset: 0; z-index: 6; pointer-events: none; }
.water-editor-overlay { position: absolute; inset: 0; width: 100%; height: 100%; overflow: hidden; }
.water-editor-boundary { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.water-editor-boundary path { fill: #7357b8; fill-opacity: 0.12; stroke: #6342a4; stroke-opacity: 0.8; stroke-width: 1.5; stroke-dasharray: 5 3; }
.water-editor-panel { position: absolute; top: 12px; right: 12px; width: min(310px, calc(100% - 24px)); max-height: calc(100% - 24px); overflow: auto; padding: 12px; color: var(--ui-ink); background: var(--ui-paper); border: 1px solid var(--ui-border); border-radius: 12px; box-shadow: var(--ui-shadow-panel); pointer-events: auto; font: 12px/1.45 var(--ui-font-body, sans-serif); }
header, .water-editor-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; }
header { justify-content: space-between; }
.water-editor-body, fieldset { display: grid; gap: 9px; }
.water-editor-add { display: grid; gap: 8px; padding: 9px; border: 1px solid var(--ui-border); border-radius: 6px; }
fieldset { min-width: 0; margin: 0; padding: 0; border: 0; }
label { display: grid; gap: 3px; }
input:not([type=checkbox]), select, textarea { width: 100%; min-width: 0; box-sizing: border-box; }
input, select, textarea, button { color: inherit; font: inherit; accent-color: #276c8e; }
input, textarea { -webkit-user-select: text; user-select: text; }
input:not([type=range]), select, textarea, button { padding: 5px 7px; border: 1px solid var(--ui-border); border-radius: 5px; background: var(--ui-panel, white); }
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
@media (max-width: 700px) { .water-editor-panel { max-height: 50%; } }
</style>
