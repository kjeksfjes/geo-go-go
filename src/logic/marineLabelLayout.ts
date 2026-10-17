import type { MapPoint } from '../composables/useMapZoom'

// Sample a gentle spline once in geographic coordinates; projection changes
// then reuse this small guide instead of inspecting the detailed coastline.
export function sampleLabelGuide(points: readonly MapPoint[]): MapPoint[] {
  const sampled: MapPoint[] = []
  for (let segment = 0; segment < points.length - 1; segment++) {
    const a = points[Math.max(0, segment - 1)]!
    const b = points[segment]!
    const c = points[segment + 1]!
    const d = points[Math.min(points.length - 1, segment + 2)]!
    for (let step = 0; step < 12; step++) {
      const t = step / 12
      sampled.push([0, 1].map((axis) => 0.5 * (
        2 * b[axis]! + (-a[axis]! + c[axis]!) * t
        + (2 * a[axis]! - 5 * b[axis]! + 4 * c[axis]! - d[axis]!) * t * t
        + (-a[axis]! + 3 * b[axis]! - 3 * c[axis]! + d[axis]!) * t * t * t
      )) as MapPoint)
    }
  }
  sampled.push(points[points.length - 1]!)
  return sampled
}

export function labelGuideLengths(points: readonly MapPoint[]): number[] {
  const lengths = [0]
  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1]!
    const point = points[index]!
    lengths.push(lengths[index - 1]! + Math.hypot(point[0] - previous[0], point[1] - previous[1]))
  }
  return lengths
}

// Only the part beneath the text participates in viewport/collision checks.
// A long geographic guide must not make a small label occupy the whole sea.
export function centeredLabelGuide(points: readonly MapPoint[], lengths: readonly number[], span: number, centerFraction = 0.5): MapPoint[] | undefined {
  const total = lengths[lengths.length - 1] ?? 0
  // Extending a short guide at large projected coordinates loses precision
  // when subtracting its endpoints, then accumulates error over its segments.
  // Include that coordinate magnitude so an exact fit stays usable at every
  // text size, even when its recomputed length is microscopically shorter.
  const magnitude = points.reduce((largest, [x, y]) => Math.max(largest, Math.abs(x), Math.abs(y)), Math.max(total, span))
  const tolerance = magnitude * Number.EPSILON * Math.max(1, points.length) * 8
  if (!Number.isFinite(span) || !Number.isFinite(total) || span <= 0 || total <= 0 || span - total > tolerance) return undefined
  span = Math.min(span, total)
  const center = Math.max(span / 2, Math.min(total - span / 2, total * centerFraction))
  const start = center - span / 2
  const end = start + span
  const result: MapPoint[] = []
  for (let index = 1; index < points.length; index++) {
    const from = lengths[index - 1]!
    const to = lengths[index]!
    if (to <= from || to < start || from > end) continue
    const a = points[index - 1]!
    const b = points[index]!
    const interpolate = (distance: number): MapPoint => {
      const t = (distance - from) / (to - from)
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
    }
    if (!result.length) result.push(interpolate(Math.max(start, from)))
    result.push(interpolate(Math.min(end, to)))
  }
  if (result.length < 2) return undefined
  if (result[0]![0] > result[result.length - 1]![0]) result.reverse()
  return result
}

// Honor the requested center even near the endpoints. Extend the end tangents
// whenever the text would cross an endpoint, including text shorter than the
// full guide, so SVG neither clips it nor silently shifts it inward.
export function extendedLabelGuide(points: readonly MapPoint[], lengths: readonly number[], span: number,
  centerFraction = 0.5): MapPoint[] | undefined {
  const total = lengths.at(-1) ?? 0
  if (!Number.isFinite(span) || !Number.isFinite(total) || span <= 0 || total <= 0) return undefined
  const center = total * Math.max(0, Math.min(1, centerFraction))
  const before = Math.max(0, span / 2 - center)
  const after = Math.max(0, center + span / 2 - total)
  if (before === 0 && after === 0) return centeredLabelGuide(points, lengths, span, centerFraction)
  let first = 1, last = points.length - 2
  while (first < points.length && lengths[first] === 0) first++
  while (last >= 0 && lengths[last] === total) last--
  if (first >= points.length || last < 0) return undefined
  const start = points[0]!, end = points.at(-1)!
  const a = points[first]!, b = points[last]!
  const startLength = Math.hypot(a[0] - start[0], a[1] - start[1])
  const endLength = Math.hypot(end[0] - b[0], end[1] - b[1])
  const extended: MapPoint[] = [
    [start[0] - (a[0] - start[0]) * before / startLength, start[1] - (a[1] - start[1]) * before / startLength],
    ...points,
    [end[0] + (end[0] - b[0]) * after / endLength, end[1] + (end[1] - b[1]) * after / endLength],
  ]
  const extendedLengths = labelGuideLengths(extended)
  return centeredLabelGuide(extended, extendedLengths, span, (before + center) / extendedLengths.at(-1)!)
}

// Clip the guide to the usable viewport, then keep the preferred geographic
// center whenever possible. A partly visible sea can still carry its name.
export function visibleLabelGuide(points: readonly MapPoint[], lengths: readonly number[], span: number,
  viewport: [number, number, number, number], centerFraction = 0.5): MapPoint[] | undefined {
  const ranges: Array<[number, number]> = []
  const [left, top, right, bottom] = viewport
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1]!, b = points[index]!
    let enter = 0, leave = 1
    const dx = b[0] - a[0], dy = b[1] - a[1]
    let clipped = false
    for (const [p, q] of [[-dx, a[0] - left], [dx, right - a[0]], [-dy, a[1] - top], [dy, bottom - a[1]]]) {
      if (p === 0) { if (q! < 0) clipped = true; continue }
      const ratio = q! / p!
      if (p! < 0) enter = Math.max(enter, ratio)
      else leave = Math.min(leave, ratio)
    }
    if (clipped || enter > leave) continue
    const length = lengths[index]! - lengths[index - 1]!
    const start = lengths[index - 1]! + enter * length
    const end = lengths[index - 1]! + leave * length
    const previous = ranges.at(-1)
    if (previous && Math.abs(previous[1] - start) < 1e-6) previous[1] = end
    else ranges.push([start, end])
  }
  const total = lengths.at(-1) ?? 0
  if (!total) return undefined
  const preferred = total * centerFraction
  const centers = ranges.filter(([start, end]) => end - start >= span)
    .map(([start, end]) => Math.max(start + span / 2, Math.min(end - span / 2, preferred)))
    .sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred))
  return centers.length ? centeredLabelGuide(points, lengths, span, centers[0]! / total) : undefined
}
