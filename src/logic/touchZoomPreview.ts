// Log-scale speed is independent of viewport size and zoom level. Hysteresis
// avoids changing bitmap quality on every small change in finger speed.
const enterSpeed = 1.5
const exitSpeed = 0.8
const smoothingMs = 50
const slowDelayMs = 120
export const touchZoomPreviewPixelRatio = 1

export function createTouchZoomPreview() {
  let previousScale = 1
  let previousTime = 0
  let speed = 0
  let slowSince: number | null = null
  let active = false

  function reset(scale: number, now: number) {
    previousScale = scale
    previousTime = now
    speed = 0
    slowSince = null
    active = false
  }

  function update(scale: number, now: number) {
    const elapsed = now - previousTime
    if (elapsed <= 0 || scale <= 0) return active
    const instantSpeed = Math.abs(Math.log(scale / previousScale)) * 1000 / elapsed
    speed += (instantSpeed - speed) * (1 - Math.exp(-elapsed / smoothingMs))
    previousScale = scale
    previousTime = now
    if (!active && speed >= enterSpeed) active = true
    if (active && speed < exitSpeed) {
      slowSince ??= now
      if (now - slowSince >= slowDelayMs) active = false
    } else slowSince = null
    return active
  }

  return { reset, update }
}
