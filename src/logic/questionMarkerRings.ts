import type { SmallCountryMarker } from './smallCountryMarkers'

export interface QuestionMarkerRing extends SmallCountryMarker { radius: number }

// Used only for Name-the-country location cues. Merge visible circle extents,
// not click-target distances, and retain every represented island location.
export function mergeQuestionMarkerRings(rings: readonly QuestionMarkerRing[], gap = 0): QuestionMarkerRing[] {
  const result = [...rings]
  let changed = true
  while (changed) {
    changed = false
    outer: for (let first = 0; first < result.length; first++) {
      for (let second = first + 1; second < result.length; second++) {
        const a = result[first]!
        const b = result[second]!
        const distance = Math.hypot(b.x - a.x, b.y - a.y)
        if (distance > a.radius + b.radius + gap) continue
        let x = a.x, y = a.y, radius = a.radius
        if (b.radius >= distance + a.radius) {
          x = b.x; y = b.y; radius = b.radius
        } else if (a.radius < distance + b.radius) {
          radius = (distance + a.radius + b.radius) / 2
          const fraction = (radius - a.radius) / distance
          x += (b.x - a.x) * fraction
          y += (b.y - a.y) * fraction
        }
        result[first] = { key: a.key, x, y, radius, targets: [...a.targets, ...b.targets] }
        result.splice(second, 1)
        changed = true
        break outer
      }
    }
  }
  return result
}
