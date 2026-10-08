export interface SmallCountryAnchor {
  // Distinguishes location cues within one country without adding quiz identities.
  anchorId?: string
  countryId: string
  unitId: string
  x: number
  y: number
  width: number
  height: number
}

export interface SmallCountryTarget extends SmallCountryAnchor {
  offset: number
  screenX: number
  screenY: number
}

export interface SmallCountryMarker {
  key: string
  x: number
  y: number
  targets: SmallCountryTarget[]
}

export interface SmallCountryFeedbackMarker extends SmallCountryTarget {
  status: 'correct' | 'wrong'
}

interface Camera {
  x: number
  y: number
  scale: number
}

const MAX_SHAPE_PIXELS = 10
export const SMALL_COUNTRY_HIT_RADIUS = 16

// Keep every tiny quiz country visible without enlarging or changing its
// geography. Overlapping hit areas become one zoom target, never an arbitrary
// answer chosen by SVG paint order.
export function smallCountryMarkers(
  anchors: readonly SmallCountryAnchor[],
  camera: Camera,
  copyOffsets: readonly number[],
  width: number,
  height: number,
  groupingDistance = SMALL_COUNTRY_HIT_RADIUS * 2,
): SmallCountryMarker[] {
  const targets: SmallCountryTarget[] = []
  for (const anchor of anchors) {
    if (Math.max(anchor.width, anchor.height) * camera.scale >= MAX_SHAPE_PIXELS) continue
    for (const offset of copyOffsets) {
      const screenX = camera.x + camera.scale * (anchor.x + offset)
      const screenY = camera.y + camera.scale * anchor.y
      if (
        screenX < -SMALL_COUNTRY_HIT_RADIUS || screenX > width + SMALL_COUNTRY_HIT_RADIUS
        || screenY < -SMALL_COUNTRY_HIT_RADIUS || screenY > height + SMALL_COUNTRY_HIT_RADIUS
      ) continue
      targets.push({ ...anchor, offset, screenX, screenY })
    }
  }

  const parents = targets.map((_, index) => index)
  function root(index: number): number {
    while (parents[index] !== index) {
      parents[index] = parents[parents[index]]
      index = parents[index]
    }
    return index
  }
  for (let first = 0; first < targets.length; first++) {
    for (let second = first + 1; second < targets.length; second++) {
      if (Math.hypot(
        targets[first].screenX - targets[second].screenX,
        targets[first].screenY - targets[second].screenY,
      ) < groupingDistance) parents[root(second)] = root(first)
    }
  }

  const groups = new Map<number, SmallCountryTarget[]>()
  for (const [index, target] of targets.entries()) {
    const id = root(index)
    const group = groups.get(id) ?? []
    group.push(target)
    groups.set(id, group)
  }

  return [...groups.values()].map((group) => ({
    key: `${group[0].anchorId ?? group[0].countryId}:${group[0].offset}`,
    x: group.reduce((sum, target) => sum + target.screenX, 0) / group.length,
    y: group.reduce((sum, target) => sum + target.screenY, 0) / group.length,
    targets: group,
  }))
}
