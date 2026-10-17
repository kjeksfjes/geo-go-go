import type { MarineLabelPath } from '../data/marineLabelPaths'
import type { MapPoint } from '../composables/useMapZoom'
import type { MarineLabel, MarineLabelText } from '../data/marineLabels'

export type Placements = Record<string, MarineLabelPath>
export interface CustomWaterLabel extends MarineLabel { boundaryId?: string }
export const oceanPartNames: Record<string, string> = {
  'ocean:atlantic:north': 'North Atlantic Ocean', 'ocean:atlantic:south': 'South Atlantic Ocean',
  'ocean:pacific:north': 'North Pacific Ocean', 'ocean:pacific:south': 'South Pacific Ocean',
}
export const waterKinds = ['ocean', 'sea', 'gulf', 'bay', 'strait', 'sound', 'channel', 'fjord', 'inlet']
export interface WaterLabelDraft {
  format: 'geo-go-go-water-label-edits'
  version: 3
  baseVersion: string
  originals: Placements
  placements: Placements
  customLabels: Record<string, CustomWaterLabel>
  hiddenIds: string[]
  labelText: Record<string, MarineLabelText>
}

export function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) }

export function waterLabelBaseline(labels: readonly MarineLabel[], paths: Placements): Placements {
  return Object.fromEntries(labels.map(label => {
    const [x, y] = label.point
    return [label.id, paths[label.id] ?? {
      points: [[x - 10, y], [x, y], [x + 10, y]], layout: 'horizontal', anchor: [x, y],
      bounds: [[x - 15, Math.max(-90, y - 5)], [x + 15, Math.min(90, y + 5)]],
    }]
  }))
}

// Freeze the currently rendered reference size before geometry changes can
// trigger automatic fitting, including the first placement of an ocean label.
export function preservePlacementFontSize(source: MarineLabelPath, currentSize: number | undefined): MarineLabelPath {
  const value = clone(source)
  if (value.textSize === undefined && currentSize !== undefined && Number.isFinite(currentSize)
    && currentSize >= 0.000001 && currentSize <= 1000) {
    value.textSize = currentSize
    delete value.textScale
  }
  return value
}

const point = (value: unknown): value is MapPoint => Array.isArray(value) && value.length === 2
  && value.every(Number.isFinite) && Math.abs(value[0]) <= 720 && Math.abs(value[1]) <= 90
const fields = new Set(['points', 'readablePoints', 'center', 'offset', 'layout', 'anchor', 'bounds',
  'fontSize', 'spanFraction', 'sizeScale', 'textScale', 'textSize', 'letterSpacing', 'rotation', 'text', 'textNb', 'additionalPlacements', 'textPosition', 'curve'])

export function validPlacement(input: unknown): input is MarineLabelPath {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false
  const value = input as Record<string, unknown>
  if (Object.keys(value).some(key => !fields.has(key))) return false
  if (value.curve !== undefined && value.curve !== 'natural') return false
  for (const key of ['text', 'textNb']) {
    const text = value[key]
    if (text !== undefined && (typeof text !== 'string' || !text.trim() || text.length > 120 || /[\r\n]/.test(text))) return false
  }
  if (value.additionalPlacements !== undefined) {
    if (!Array.isArray(value.additionalPlacements) || value.additionalPlacements.length > 11
      || (value.additionalPlacements.length > 0 && value.textSize === undefined)) return false
    for (const placement of value.additionalPlacements) {
      if (!placement || typeof placement !== 'object'
        || ['additionalPlacements', 'textSize', 'letterSpacing', 'textScale', 'fontSize', 'sizeScale'].some(key => Object.hasOwn(placement, key))
        || !validPlacement(placement)) return false
    }
  }
  for (const key of ['points', 'readablePoints']) {
    const points = value[key]
    if (key === 'readablePoints' && points === undefined) continue
    if (!Array.isArray(points) || points.length < 3 || points.length > 128 || !points.every(point)) return false
  }
  for (const key of ['anchor', 'offset']) if (value[key] !== undefined && !point(value[key])) return false
  if (value.layout !== undefined && value.layout !== 'horizontal') return false
  if (value.bounds !== undefined) {
    if (!Array.isArray(value.bounds) || value.bounds.length !== 2 || !value.bounds.every(point)
      || ![0, 1].every(axis => (value.bounds as MapPoint[])[0]![axis]! < (value.bounds as MapPoint[])[1]![axis]!)) return false
  }
  if (value.layout === 'horizontal' && (!point(value.anchor) || !Array.isArray(value.bounds))) return false
  const ranges: Record<string, [number, number]> = {
    center: [0, 1], textPosition: [0, 1], spanFraction: [0.05, 1], fontSize: [0.01, 1000],
    sizeScale: [0.001, 1000], textScale: [0.1, 10], textSize: [0.000001, 1000], letterSpacing: [-0.1, 2], rotation: [-180, 180],
  }
  for (const [key, [min, max]] of Object.entries(ranges)) {
    const number = value[key]
    if (number !== undefined && (typeof number !== 'number' || !Number.isFinite(number) || number < min || number > max)) return false
  }
  return true
}

export function validLabelText(input: unknown): input is MarineLabelText {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false
  return Object.entries(input).every(([key, text]) => {
    if (typeof text !== 'string') return false
    if (key === 'name' || key === 'nameNb') return !!text.trim() && text.length <= 120 && !/[\r\n]/.test(text)
    if (key !== 'stackedText' && key !== 'stackedTextNb') return false
    if (text === '') return true // Explicitly restore automatic wrapping over a saved override.
    const lines = text.split('\n')
    return text.length <= 240 && !text.includes('\r') && lines.length <= 4 && lines.every(line => line.trim())
  })
}

export function readDraft(text: string, baseline: Placements, ids: ReadonlySet<string>): WaterLabelDraft {
  if (text.length > 2_000_000) throw new Error('This file is too large for a water-label draft.')
  const value = JSON.parse(text)
  if (value?.format !== 'geo-go-go-water-label-edits' || ![1, 2, 3].includes(value.version)
    || typeof value.baseVersion !== 'string' || value.baseVersion.length > 40) throw new Error('Unsupported water-label draft.')
  const customLabels = value.version === 1 ? {} : value.customLabels
  const hiddenIds = value.version === 1 ? [] : value.hiddenIds
  if (!customLabels || typeof customLabels !== 'object' || Array.isArray(customLabels)
    || Object.keys(customLabels).length > 100) throw new Error('Invalid custom-name collection (maximum 100).')
  const knownIds = new Set(ids)
  for (const [id, input] of Object.entries(customLabels)) {
    const label = input as CustomWaterLabel
    if (!/^custom:[a-z0-9-]{1,80}$/.test(id) || ids.has(id) || !label || typeof label !== 'object'
      || label.id !== id || !validLabelText({ name: label.name, nameNb: label.nameNb })
      || !waterKinds.includes(label.kind) || !point(label.point) || Math.abs(label.point[0]) > 180
      || !Number.isInteger(label.rank) || label.rank < 0 || label.rank > 9
      || !Number.isFinite(label.minLabel) || !Number.isFinite(label.maxLabel)
      || label.minLabel < 0 || label.maxLabel > 10 || label.minLabel > label.maxLabel
      || (label.boundaryId !== undefined && !ids.has(label.boundaryId) && !Object.hasOwn(oceanPartNames, label.boundaryId))
      || Object.keys(label).some(key => !['id', 'name', 'nameNb', 'kind', 'point', 'rank', 'minLabel', 'maxLabel', 'boundaryId'].includes(key))) {
      throw new Error(`Invalid custom water name: ${id}`)
    }
    knownIds.add(id)
  }
  if (!Array.isArray(hiddenIds) || hiddenIds.length > ids.size || new Set(hiddenIds).size !== hiddenIds.length
    || !hiddenIds.every(id => typeof id === 'string' && ids.has(id))) throw new Error('Invalid removed-name collection.')
  const labelText = value.version < 3 ? {} : value.labelText
  if (!labelText || typeof labelText !== 'object' || Array.isArray(labelText)
    || Object.keys(labelText).length > knownIds.size
    || Object.entries(labelText).some(([id, text]) => !knownIds.has(id) || !validLabelText(text))) {
    throw new Error('Invalid water-name text edits.')
  }
  for (const key of ['placements', 'originals'] as const) {
    const entries = value[key]
    if (!entries || typeof entries !== 'object' || Array.isArray(entries)
      || Object.keys(entries).length > knownIds.size) throw new Error('Invalid placement collection.')
    for (const [id, placement] of Object.entries(entries)) {
      if (!(key === 'originals' ? ids : knownIds).has(id) || !validPlacement(placement)) throw new Error(`Invalid placement: ${id}`)
    }
  }
  const originalIds = Object.keys(value.placements).filter(id => ids.has(id))
  if (Object.keys(value.originals).length !== originalIds.length) throw new Error('Draft originals do not match its edits.')
  for (const id of Object.keys(customLabels)) if (!Object.hasOwn(value.placements, id)) throw new Error(`Missing custom placement: ${id}`)
  for (const id of Object.keys(value.placements)) {
    if (!ids.has(id)) continue
    if (!Object.hasOwn(value.originals, id)) throw new Error(`Missing original placement: ${id}`)
    if (!samePlacement(value.originals[id], baseline[id]!)) {
      throw new Error(`The source placement for ${id} has changed. Keep this export and ask for its edits to be reconciled.`)
    }
  }
  return clone({ format: value.format, version: 3, baseVersion: value.baseVersion,
    originals: value.originals, placements: value.placements, customLabels, hiddenIds, labelText })
}

export function samePlacement(a: MarineLabelPath, b: MarineLabelPath): boolean {
  const ordered = (value: MarineLabelPath) => Object.fromEntries(Object.entries(clone(value)).sort(([a], [b]) => a.localeCompare(b)))
  return JSON.stringify(ordered(a)) === JSON.stringify(ordered(b))
}

export function makeDraft(placements: Placements, baseline: Placements, version: string,
  customLabels: Record<string, CustomWaterLabel> = {}, hiddenIds: string[] = [], labelText: Record<string, MarineLabelText> = {}): WaterLabelDraft {
  const originals = Object.fromEntries(Object.keys(placements).filter(id => Object.hasOwn(baseline, id)).map(id => [id, baseline[id]!]))
  return clone({ format: 'geo-go-go-water-label-edits', version: 3, baseVersion: version, originals, placements, customLabels, hiddenIds, labelText })
}

// Existing nudges taper over the sampled curve. Bake them into editable nodes
// once, so the handles and the rendered path share the same geographic shape.
export function editablePlacement(source: MarineLabelPath): MarineLabelPath {
  const value = clone(source)
  if (value.offset) {
    const offset = value.offset
    const nudge = (points: MapPoint[]) => points.map(([x, y], index) => {
      const weight = Math.sin(Math.PI * index / (points.length - 1)) ** 2
      return [x + offset[0] * weight, y + offset[1] * weight] as MapPoint
    })
    value.points = nudge(value.points)
    if (value.readablePoints) value.readablePoints = nudge(value.readablePoints)
    if (value.anchor) value.anchor = [value.anchor[0] + offset[0], value.anchor[1] + offset[1]]
    if (value.bounds) value.bounds = value.bounds.map(([x, y]) => [x + offset[0], y + offset[1]]) as [MapPoint, MapPoint]
    delete value.offset
  }
  return value
}

export function placementPivot(value: MarineLabelPath): MapPoint {
  if (value.layout === 'horizontal' && value.anchor) return value.anchor
  const points = value.readablePoints ?? value.points
  return points[Math.floor(points.length / 2)]!
}

export function mapPlacement(source: MarineLabelPath, map: (point: MapPoint) => MapPoint | undefined): MarineLabelPath | null {
  const value = editablePlacement(source)
  let invalid = false
  const move = (p: MapPoint) => {
    const next = map(p)
    if (!next || !point(next)) { invalid = true; return p }
    return next.map(number => Math.round(number * 1e8) / 1e8) as MapPoint
  }
  value.points = value.points.map(move)
  if (value.readablePoints) value.readablePoints = value.readablePoints.map(move)
  if (value.anchor) value.anchor = move(value.anchor)
  if (value.bounds) {
    const [[x0, y0], [x1, y1]] = value.bounds
    const corners = [[x0, y0], [x0, y1], [x1, y0], [x1, y1]].map(p => move(p as MapPoint))
    value.bounds = [[Math.min(...corners.map(p => p[0])), Math.min(...corners.map(p => p[1]))],
      [Math.max(...corners.map(p => p[0])), Math.max(...corners.map(p => p[1]))]]
  }
  return !invalid && validPlacement(value) ? value : null
}

export function createHistory<T>(initial: T) {
  let values = [clone(initial)]
  let index = 0
  return {
    get canUndo() { return index > 0 },
    get canRedo() { return index < values.length - 1 },
    push(value: T) {
      if (JSON.stringify(value) === JSON.stringify(values[index])) return
      values = values.slice(0, index + 1)
      values.push(clone(value))
      if (values.length > 100) values.shift()
      index = values.length - 1
    },
    undo() { index = Math.max(0, index - 1); return clone(values[index]!) },
    redo() { index = Math.min(values.length - 1, index + 1); return clone(values[index]!) },
  }
}
