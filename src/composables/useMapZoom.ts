import { computed, onBeforeUnmount, reactive, ref, watch, type Ref } from 'vue'
import type { HorizontalWrap } from './useMapProjection'

export type MapBounds = [[number, number], [number, number]]
export type MapPoint = [number, number]

const MIN_ZOOM = 1
// Keep a finite safety ceiling while allowing 1:50m microstate geometries to
// become practically visible. High zoom reveals no detail beyond the source.
const MAX_ZOOM = 256

export function useMapZoom(
  width: Ref<number>,
  height: Ref<number>,
  mapContent: Ref<SVGGElement | null>,
  horizontalWrap: Ref<HorizontalWrap | null>,
) {
  const transform = reactive({ x: 0, y: 0, scale: 1 })
  const isDragging = ref(false)
  let animationFrame: number | undefined
  let dragState: {
    pointerId: number
    startClientX: number
    startClientY: number
    startX: number
    startY: number
    unitsPerPixelX: number
    unitsPerPixelY: number
    moved: boolean
    svg: SVGSVGElement
  } | undefined
  let suppressNextClick = false

  const isZoomed = computed(() => transform.scale > MIN_ZOOM + 0.01)
  const wrapActive = computed(() => {
    const wrap = horizontalWrap.value
    return wrap !== null && transform.scale * wrap.period >= width.value
  })
  const wrapNeighborDirection = computed(() => {
    const wrap = horizontalWrap.value
    if (!wrap) return 1
    const mapCenterX = (width.value / 2 - transform.x) / transform.scale
    return mapCenterX >= wrap.centerX ? 1 : -1
  })

  function stopAnimation() {
    if (animationFrame !== undefined) {
      cancelAnimationFrame(animationFrame)
      animationFrame = undefined
    }
  }

  function constrainTransform(x: number, y: number, scale: number) {
    // Let either edge travel as far as the viewport center. This keeps the map
    // recoverable while allowing countries near the antimeridian to be centered.
    const minX = width.value * (0.5 - scale)
    const maxX = width.value * 0.5
    const minY = height.value * (0.5 - scale)
    const maxY = height.value * 0.5

    const wrap = horizontalWrap.value
    if (wrap && scale * wrap.period >= width.value) {
      const mapCenterX = (width.value / 2 - x) / scale
      const centered = mapCenterX - wrap.centerX + wrap.period / 2
      const wrapped = ((centered % wrap.period) + wrap.period) % wrap.period
      x = width.value / 2 - scale * (wrap.centerX + wrapped - wrap.period / 2)
    } else {
      x = Math.max(minX, Math.min(maxX, x))
    }

    return {
      x,
      y: Math.max(minY, Math.min(maxY, y)),
      scale,
    }
  }

  function setTransform(x: number, y: number, scale: number) {
    const next = constrainTransform(x, y, scale)
    transform.x = next.x
    transform.y = next.y
    transform.scale = next.scale

    // This attribute changes on every animation frame. Updating it directly
    // avoids making Vue diff hundreds of large SVG path strings each frame.
    mapContent.value?.setAttribute(
      'transform',
      `translate(${next.x} ${next.y}) scale(${next.scale})`,
    )
  }

  function animateTo(
    x: number,
    y: number,
    scale: number,
    duration = 750,
    motion: 'balanced' | 'zoom-out' = 'balanced',
  ) {
    stopAnimation()

    const start = { ...transform }
    const target = constrainTransform(x, y, scale)
    const wrap = horizontalWrap.value
    if (wrap && scale * wrap.period >= width.value) {
      // Animate toward the nearest equivalent world copy, then normalize each
      // painted frame. Otherwise a click across the seam takes the long way.
      const startCenterX = (width.value / 2 - start.x) / start.scale
      const targetCenterX = (width.value / 2 - target.x) / target.scale
      const copies = Math.round((startCenterX - targetCenterX) / wrap.period)
      target.x -= copies * target.scale * wrap.period
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTransform(target.x, target.y, target.scale)
      return
    }

    const targetAnchor = {
      x: (width.value / 2 - target.x) / target.scale,
      y: (height.value / 2 - target.y) / target.scale,
    }
    const startAnchorPosition = {
      x: start.x + start.scale * targetAnchor.x,
      y: start.y + start.scale * targetAnchor.y,
    }
    const targetAnchorPosition = {
      x: target.x + target.scale * targetAnchor.x,
      y: target.y + target.scale * targetAnchor.y,
    }
    const scaleRatio = target.scale / start.scale
    const zoomingOut = motion === 'zoom-out' && target.scale < start.scale
    const startCenter = {
      x: (width.value / 2 - start.x) / start.scale,
      y: (height.value / 2 - start.y) / start.scale,
    }
    const startedAt = performance.now()

    function frame(now: number) {
      const progress = Math.min(1, (now - startedAt) / duration)
      const eased = progress * progress * (3 - 2 * progress)
      if (zoomingOut) {
        // Pull back around the current view first. Pan toward the destination
        // more gradually, with both motions still finishing together.
        const zoomEased = 1 - (1 - progress) * (1 - progress)
        const nextScale = start.scale * Math.pow(scaleRatio, zoomEased)
        const centerX = startCenter.x + (targetAnchor.x - startCenter.x) * eased
        const centerY = startCenter.y + (targetAnchor.y - startCenter.y) * eased
        setTransform(
          width.value / 2 - nextScale * centerX,
          height.value / 2 - nextScale * centerY,
          nextScale,
        )
      } else {
        const nextScale = start.scale * Math.pow(scaleRatio, eased)
        const anchorX = startAnchorPosition.x
          + (targetAnchorPosition.x - startAnchorPosition.x) * eased
        const anchorY = startAnchorPosition.y
          + (targetAnchorPosition.y - startAnchorPosition.y) * eased

        setTransform(
          anchorX - nextScale * targetAnchor.x,
          anchorY - nextScale * targetAnchor.y,
          nextScale,
        )
      }

      if (progress < 1) {
        animationFrame = requestAnimationFrame(frame)
      } else {
        animationFrame = undefined
      }
    }

    animationFrame = requestAnimationFrame(frame)
  }

  function zoomToBounds(bounds: MapBounds, focusPoint?: MapPoint) {
    const [[x0, y0], [x1, y1]] = bounds
    const boundsWidth = Math.max(1, x1 - x0)
    const boundsHeight = Math.max(1, y1 - y0)
    const scale = Math.max(
      1.8,
      Math.min(MAX_ZOOM, 0.68 / Math.max(boundsWidth / width.value, boundsHeight / height.value)),
    )

    // When moving from a small target to a larger one, pull back around the
    // current view before traversing the map. The balanced (target-anchored)
    // motion can otherwise sweep across the scene while still highly zoomed.
    animateTo(
      width.value / 2 - scale * (focusPoint?.[0] ?? (x0 + x1) / 2),
      height.value / 2 - scale * (focusPoint?.[1] ?? (y0 + y1) / 2),
      scale,
      750,
      scale < transform.scale ? 'zoom-out' : 'balanced',
    )
  }

  function zoomToPoint(
    point: MapPoint,
    scale: number,
    animated = true,
    zoomOutFirst = false,
  ) {
    const targetScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale))
    const x = width.value / 2 - targetScale * point[0]
    const y = height.value / 2 - targetScale * point[1]

    if (animated) {
      animateTo(x, y, targetScale, 750, zoomOutFirst ? 'zoom-out' : 'balanced')
    } else {
      stopAnimation()
      setTransform(x, y, targetScale)
    }
  }

  function zoomFromWheel(event: WheelEvent, svg: SVGSVGElement) {
    stopAnimation()

    const rect = svg.getBoundingClientRect()
    const pointerX = (event.clientX - rect.left) * width.value / rect.width
    const pointerY = (event.clientY - rect.top) * height.value / rect.height
    const delta = event.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? event.deltaY * 16
      : event.deltaY
    const nextScale = Math.max(
      MIN_ZOOM,
      Math.min(MAX_ZOOM, transform.scale * Math.exp(-delta * 0.0015)),
    )
    const ratio = nextScale / transform.scale

    setTransform(
      pointerX - (pointerX - transform.x) * ratio,
      pointerY - (pointerY - transform.y) * ratio,
      nextScale,
    )

    if (nextScale === MIN_ZOOM) {
      setTransform(0, 0, MIN_ZOOM)
    }
  }

  function resetZoom(animated = true) {
    if (animated) {
      animateTo(0, 0, MIN_ZOOM, 500, 'zoom-out')
    } else {
      stopAnimation()
      setTransform(0, 0, MIN_ZOOM)
    }
  }

  function startPan(event: PointerEvent, svg: SVGSVGElement) {
    if (event.button !== 0 || (transform.scale <= MIN_ZOOM && !wrapActive.value)) return

    stopAnimation()
    suppressNextClick = false
    const rect = svg.getBoundingClientRect()
    dragState = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: transform.x,
      startY: transform.y,
      unitsPerPixelX: width.value / rect.width,
      unitsPerPixelY: height.value / rect.height,
      moved: false,
      svg,
    }
  }

  function movePan(event: PointerEvent) {
    if (!dragState || event.pointerId !== dragState.pointerId) return

    const deltaX = event.clientX - dragState.startClientX
    const deltaY = event.clientY - dragState.startClientY

    if (!dragState.moved && Math.hypot(deltaX, deltaY) > 3) {
      dragState.moved = true
      isDragging.value = true
      dragState.svg.setPointerCapture(event.pointerId)
    }

    if (dragState.moved) {
      setTransform(
        dragState.startX + deltaX * dragState.unitsPerPixelX,
        dragState.startY + deltaY * dragState.unitsPerPixelY,
        transform.scale,
      )
    }
  }

  function endPan(event: PointerEvent, svg: SVGSVGElement) {
    if (!dragState || event.pointerId !== dragState.pointerId) return

    suppressNextClick = dragState.moved
    isDragging.value = false
    if (svg.hasPointerCapture(event.pointerId)) {
      svg.releasePointerCapture(event.pointerId)
    }
    dragState = undefined
  }

  function consumeDragClick() {
    if (!suppressNextClick) return false
    suppressNextClick = false
    return true
  }

  watch([width, height], () => resetZoom(false))
  onBeforeUnmount(stopAnimation)

  return {
    isZoomed,
    isDragging,
    wrapActive,
    wrapNeighborDirection,
    consumeDragClick,
    endPan,
    movePan,
    resetZoom,
    startPan,
    zoomFromWheel,
    zoomToBounds,
    zoomToPoint,
  }
}
