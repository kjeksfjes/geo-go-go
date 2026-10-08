import { computed, onBeforeUnmount, reactive, ref, watch, type Ref } from 'vue'
import type { HorizontalWrap } from './useMapProjection'

export type MapBounds = [[number, number], [number, number]]
export type MapPoint = [number, number]
export interface MapViewConstraint {
  minScale: number
  bounds: MapBounds
}
export interface MapHomeView {
  point: MapPoint
  scale: number
}
export interface ZoomToBoundsOptions {
  preferredScale?: number
  viewport?: MapBounds
}

const MIN_ZOOM = 1
// Allow a little more room to pull the map away from an edge while keeping
// roughly a third of the projected viewport available to drag it back.
const MAX_EMPTY_VIEWPORT_FRACTION = 0.65
// The true 1:10m outlines of microstates are much smaller than their 1:50m
// counterparts. Keep a finite ceiling, but let them become visible up close.
const MAX_ZOOM = 16_384
// Keep enough tolerance for tap jitter without a noticeable drag dead zone.
const TOUCH_DRAG_THRESHOLD = 4
const PINCH_PAN_THRESHOLD = 10

export function useMapZoom(
  width: Ref<number>,
  height: Ref<number>,
  mapContent: Ref<SVGGElement | null>,
  horizontalWrap: Ref<HorizontalWrap | null>,
  viewConstraint: Ref<MapViewConstraint | null>,
  homeView: Ref<MapHomeView | null>,
) {
  const transform = reactive({ x: 0, y: 0, scale: 1 })
  const isDragging = ref(false)
  const isPinching = ref(false)
  const isWheeling = ref(false)
  const isAnimating = ref(false)
  let manualZoomScale: number | undefined
  let animationFrame: number | undefined
  let panFrame: number | undefined
  let wheelFrame: number | undefined
  let wheelEndTimer: number | undefined
  let pendingPan: { x: number; y: number; scale: number } | undefined
  let pendingWheel: { delta: number; pointerX: number; pointerY: number } | undefined
  let dragState: {
    pointerId: number
    startClientX: number
    startClientY: number
    startX: number
    startY: number
    unitsPerPixelX: number
    unitsPerPixelY: number
    threshold: number
    moved: boolean
    svg: SVGSVGElement
  } | undefined
  const activeTouches = new Map<number, Touch>()
  const suppressedTouchTaps = new Set<number>()
  let pinchState: {
    identifiers: [number, number]
    distance: number
    scale: number
    center: MapPoint
    anchor: MapPoint
    unitsPerPixelX: number
    unitsPerPixelY: number
    svg: SVGSVGElement
  } | undefined
  let suppressNextClick = false

  const isZoomed = computed(() => {
    const home = homeTransform()
    return Math.abs(transform.scale - home.scale) > 0.01
      || Math.abs(transform.x - home.x) > 1
      || Math.abs(transform.y - home.y) > 1
  })
  const isInteracting = computed(() =>
    isDragging.value || isPinching.value || isWheeling.value || isAnimating.value,
  )
  const wrapActive = computed(() => horizontalWrap.value !== null)
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
    isAnimating.value = false
  }

  function cancelPanUpdate() {
    if (panFrame !== undefined) {
      cancelAnimationFrame(panFrame)
      panFrame = undefined
    }
    pendingPan = undefined
  }

  function cancelWheelUpdate() {
    if (wheelFrame !== undefined) {
      cancelAnimationFrame(wheelFrame)
      wheelFrame = undefined
    }
    pendingWheel = undefined
  }

  function constrainTransform(x: number, y: number, scale: number) {
    const regionalView = viewConstraint.value
    scale = Math.max(regionalView?.minScale ?? MIN_ZOOM, scale)
    if (regionalView) {
      // Bounds already include the selected region's intentional breathing
      // room. They affect navigation, never quiz membership.
      const [[left, top], [right, bottom]] = regionalView.bounds
      let requestedCenterX = (width.value / 2 - x) / scale
      const wrap = horizontalWrap.value
      if (wrap) {
        // Regional bounds use one continuous longitude range. Resolve a target
        // across the date line into that range before clamping it.
        requestedCenterX += Math.round(((left + right) / 2 - requestedCenterX) / wrap.period) * wrap.period
      }
      const centerX = Math.max(left, Math.min(right, requestedCenterX))
      const centerY = Math.max(top, Math.min(bottom, (height.value / 2 - y) / scale))
      return {
        x: width.value / 2 - scale * centerX,
        y: height.value / 2 - scale * centerY,
        scale,
      }
    }

    // Permit empty space beyond the projected edges without losing the map.
    const visibleFraction = 1 - MAX_EMPTY_VIEWPORT_FRACTION
    const minX = width.value * (visibleFraction - scale)
    const maxX = width.value * MAX_EMPTY_VIEWPORT_FRACTION
    const minY = height.value * (visibleFraction - scale)
    const maxY = height.value * MAX_EMPTY_VIEWPORT_FRACTION

    const wrap = horizontalWrap.value
    if (wrap) {
      const mapCenterX = (width.value / 2 - x) / scale
      const centered = mapCenterX - wrap.centerX + wrap.period / 2
      const wrapped = ((centered % wrap.period) + wrap.period) % wrap.period
      x = width.value / 2 - scale * (wrap.centerX + wrapped - wrap.period / 2)
    } else {
      x = Math.max(minX, Math.min(maxX, x))
    }

    return {
      x,
      // At the fully zoomed-out world view there is no useful vertical area
      // to reveal. Keep the map centered while still allowing Mercator's
      // horizontal wrap to move at minimum zoom.
      y: scale <= MIN_ZOOM ? 0 : Math.max(minY, Math.min(maxY, y)),
      scale,
    }
  }

  function setTransform(x: number, y: number, scale: number, constrain = true) {
    const next = constrain ? constrainTransform(x, y, scale) : { x, y, scale }
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

  function homeTransform() {
    const home = homeView.value
    if (!home) return constrainTransform(0, 0, MIN_ZOOM)
    return constrainTransform(
      width.value / 2 - home.scale * home.point[0],
      height.value / 2 - home.scale * home.point[1],
      home.scale,
    )
  }

  function applyPendingPan() {
    panFrame = undefined
    const pending = pendingPan
    pendingPan = undefined
    if (pending) setTransform(pending.x, pending.y, pending.scale)
  }

  function schedulePan(x: number, y: number, scale: number) {
    pendingPan = { x, y, scale }
    panFrame ??= requestAnimationFrame(applyPendingPan)
  }

  function flushPendingPan() {
    if (panFrame !== undefined) {
      cancelAnimationFrame(panFrame)
      panFrame = undefined
    }
    const pending = pendingPan
    pendingPan = undefined
    if (pending) setTransform(pending.x, pending.y, pending.scale)
  }

  function animateTo(
    x: number,
    y: number,
    scale: number,
    duration = 750,
    motion: 'balanced' | 'zoom-out' = 'balanced',
  ) {
    stopAnimation()
    cancelWheelUpdate()

    const start = { ...transform }
    const canonicalTarget = constrainTransform(x, y, scale)
    const target = { ...canonicalTarget }
    const wrap = horizontalWrap.value
    if (wrap) {
      // Animate toward the nearest equivalent world copy, then normalize each
      // painted frame. Otherwise a click across the seam takes the long way.
      const startCenterX = (width.value / 2 - start.x) / start.scale
      const targetCenterX = (width.value / 2 - target.x) / target.scale
      const copies = Math.round((startCenterX - targetCenterX) / wrap.period)
      target.x -= copies * target.scale * wrap.period
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTransform(canonicalTarget.x, canonicalTarget.y, canonicalTarget.scale)
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
    const regionalView = viewConstraint.value
    const enteringRegionalView = regionalView !== null && (
      start.scale < regionalView.minScale
      || startCenter.x < regionalView.bounds[0][0]
      || startCenter.x > regionalView.bounds[1][0]
      || startCenter.y < regionalView.bounds[0][1]
      || startCenter.y > regionalView.bounds[1][1]
    )
    const startedAt = performance.now()
    isAnimating.value = true

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
          !enteringRegionalView,
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
          !enteringRegionalView,
        )
      }

      if (progress < 1) {
        animationFrame = requestAnimationFrame(frame)
      } else {
        if (enteringRegionalView) {
          setTransform(canonicalTarget.x, canonicalTarget.y, canonicalTarget.scale)
        }
        animationFrame = undefined
        isAnimating.value = false
      }
    }

    animationFrame = requestAnimationFrame(frame)
  }

  function zoomToBounds(
    bounds: MapBounds,
    focusPoint?: MapPoint,
    { preferredScale, viewport = [[0, 0], [width.value, height.value]] }: ZoomToBoundsOptions = {},
  ) {
    const [[x0, y0], [x1, y1]] = bounds
    const [[viewLeft, viewTop], [viewRight, viewBottom]] = viewport
    const viewWidth = Math.max(1, viewRight - viewLeft)
    const viewHeight = Math.max(1, viewBottom - viewTop)
    const boundsWidth = Math.max(1, x1 - x0)
    const boundsHeight = Math.max(1, y1 - y0)
    const minimumScale = Math.max(1.8, viewConstraint.value?.minScale ?? MIN_ZOOM)
    const fitScale = Math.max(
      minimumScale,
      Math.min(MAX_ZOOM, 0.68 / Math.max(boundsWidth / viewWidth, boundsHeight / viewHeight)),
    )
    const requestedScale = preferredScale === undefined
      ? fitScale
      : Math.max(minimumScale, preferredScale, manualZoomScale ?? preferredScale)
    const scale = Math.min(fitScale, requestedScale)

    // A larger country can temporarily require a wider view. Keep the manual
    // preference so selecting a smaller country can restore that zoom level.
    if (preferredScale === undefined) manualZoomScale = undefined

    // When moving from a small target to a larger one, pull back around the
    // current view before traversing the map. The balanced (target-anchored)
    // motion can otherwise sweep across the scene while still highly zoomed.
    animateTo(
      (viewLeft + viewRight) / 2 - scale * (focusPoint?.[0] ?? (x0 + x1) / 2),
      (viewTop + viewBottom) / 2 - scale * (focusPoint?.[1] ?? (y0 + y1) / 2),
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
    manualZoomScale = undefined
    const targetScale = Math.max(viewConstraint.value?.minScale ?? MIN_ZOOM, Math.min(MAX_ZOOM, scale))
    const x = width.value / 2 - targetScale * point[0]
    const y = height.value / 2 - targetScale * point[1]

    if (animated) {
      animateTo(x, y, targetScale, 750, zoomOutFirst ? 'zoom-out' : 'balanced')
    } else {
      stopAnimation()
      cancelWheelUpdate()
      setTransform(x, y, targetScale)
    }
  }

  function applyPendingWheel() {
    wheelFrame = undefined
    const pending = pendingWheel
    pendingWheel = undefined
    if (!pending) return
    const { delta, pointerX, pointerY } = pending
    const minimumScale = viewConstraint.value?.minScale ?? MIN_ZOOM
    const nextScale = Math.max(
      minimumScale,
      Math.min(MAX_ZOOM, transform.scale * Math.exp(-delta * 0.0015)),
    )
    manualZoomScale = nextScale
    const ratio = nextScale / transform.scale

    const wheelX = pointerX - (pointerX - transform.x) * ratio
    const wheelY = pointerY - (pointerY - transform.y) * ratio
    if (nextScale === minimumScale && !viewConstraint.value) {
      setTransform(0, 0, MIN_ZOOM)
    } else {
      // Regional zoom remains pointer-anchored even near its minimum. The
      // separate Reset view action is responsible for returning to the region.
      setTransform(wheelX, wheelY, nextScale)
    }
  }

  function zoomFromWheel(event: WheelEvent, svg: SVGSVGElement) {
    stopAnimation()
    isWheeling.value = true
    if (wheelEndTimer !== undefined) window.clearTimeout(wheelEndTimer)
    wheelEndTimer = window.setTimeout(() => {
      isWheeling.value = false
      wheelEndTimer = undefined
    }, 140)

    const rect = svg.getBoundingClientRect()
    const pointerX = (event.clientX - rect.left) * width.value / rect.width
    const pointerY = (event.clientY - rect.top) * height.value / rect.height
    const delta = event.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? event.deltaY * 16
      : event.deltaY
    if (pendingWheel) {
      pendingWheel.delta += delta
      pendingWheel.pointerX = pointerX
      pendingWheel.pointerY = pointerY
    } else {
      pendingWheel = { delta, pointerX, pointerY }
    }
    wheelFrame ??= requestAnimationFrame(applyPendingWheel)
  }

  function resetZoom(animated = true) {
    manualZoomScale = undefined
    const home = homeTransform()
    if (animated) {
      animateTo(home.x, home.y, home.scale, 500, 'zoom-out')
    } else {
      stopAnimation()
      setTransform(home.x, home.y, home.scale)
    }
  }

  function mapPoint(clientX: number, clientY: number, rect: DOMRect): MapPoint {
    return [
      (clientX - rect.left) * width.value / rect.width,
      (clientY - rect.top) * height.value / rect.height,
    ]
  }

  function beginDrag(pointerId: number, clientX: number, clientY: number, svg: SVGSVGElement, threshold: number) {
    if (transform.scale <= MIN_ZOOM && !wrapActive.value && !viewConstraint.value) return
    const rect = svg.getBoundingClientRect()
    dragState = {
      pointerId,
      startClientX: clientX,
      startClientY: clientY,
      startX: transform.x,
      startY: transform.y,
      unitsPerPixelX: width.value / rect.width,
      unitsPerPixelY: height.value / rect.height,
      threshold,
      moved: false,
      svg,
    }
  }

  function beginPinch(svg: SVGSVGElement) {
    flushPendingPan()
    const rect = svg.getBoundingClientRect()
    const [firstTouch, secondTouch] = [...activeTouches.values()]
    const first = mapPoint(firstTouch.clientX, firstTouch.clientY, rect)
    const second = mapPoint(secondTouch.clientX, secondTouch.clientY, rect)
    const centerX = (first[0] + second[0]) / 2
    const centerY = (first[1] + second[1]) / 2
    pinchState = {
      identifiers: [firstTouch.identifier, secondTouch.identifier],
      distance: Math.max(Math.hypot(first[0] - second[0], first[1] - second[1]), 1),
      scale: transform.scale,
      center: [centerX, centerY],
      anchor: [(centerX - transform.x) / transform.scale, (centerY - transform.y) / transform.scale],
      unitsPerPixelX: width.value / rect.width,
      unitsPerPixelY: height.value / rect.height,
      svg,
    }
    dragState = undefined
    isDragging.value = false
    isPinching.value = true
    suppressNextClick = true
  }

  function startPan(event: PointerEvent, svg: SVGSVGElement) {
    if (event.pointerType === 'touch' || activeTouches.size > 0 || event.button !== 0) return

    stopAnimation()
    cancelWheelUpdate()
    cancelPanUpdate()
    suppressNextClick = false
    beginDrag(event.pointerId, event.clientX, event.clientY, svg, 3)
  }

  function movePan(event: PointerEvent) {
    if (event.pointerType === 'touch' || activeTouches.size > 0) return
    moveDrag(event.pointerId, event.clientX, event.clientY, false)
  }

  function movePinch() {
    const pinch = pinchState
    if (!pinch) return
    const [firstTouch, secondTouch] = pinch.identifiers.map((id) => activeTouches.get(id)!)
    // Both fingers use the same live viewport measurement. Avoid repeated
    // layout reads without caching a rectangle across movement or resize.
    const rect = pinch.svg.getBoundingClientRect()
    const first = mapPoint(firstTouch.clientX, firstTouch.clientY, rect)
    const second = mapPoint(secondTouch.clientX, secondTouch.clientY, rect)
    const distance = Math.hypot(first[0] - second[0], first[1] - second[1])
    const scale = Math.max(viewConstraint.value?.minScale ?? MIN_ZOOM,
      Math.min(MAX_ZOOM, pinch.scale * distance / pinch.distance))
    manualZoomScale = scale
    const centerX = (first[0] + second[0]) / 2
    const centerY = (first[1] + second[1]) / 2
    const deltaX = centerX - pinch.center[0]
    const deltaY = centerY - pinch.center[1]
    const drift = Math.hypot(deltaX / pinch.unitsPerPixelX, deltaY / pinch.unitsPerPixelY)
    // Ignore small midpoint drift, then add only the movement beyond the
    // threshold so deliberate two-finger panning starts without a jump.
    const panWeight = drift > PINCH_PAN_THRESHOLD ? 1 - PINCH_PAN_THRESHOLD / drift : 0
    schedulePan(
      pinch.center[0] + deltaX * panWeight - pinch.anchor[0] * scale,
      pinch.center[1] + deltaY * panWeight - pinch.anchor[1] * scale,
      scale,
    )
  }

  function moveDrag(identifier: number, clientX: number, clientY: number, touch: boolean) {
    if (!dragState || identifier !== dragState.pointerId) return

    const deltaX = clientX - dragState.startClientX
    const deltaY = clientY - dragState.startClientY
    const nextX = dragState.startX + deltaX * dragState.unitsPerPixelX
    const nextY = dragState.startY + deltaY * dragState.unitsPerPixelY

    if (!dragState.moved) {
      if (Math.hypot(deltaX, deltaY) <= dragState.threshold) return
      dragState.moved = true
      isDragging.value = true
      if (!touch) dragState.svg.setPointerCapture(identifier)
      // Start following either input on this event. Subsequent movements
      // stay batched, but the initial drag need not wait another frame.
      setTransform(nextX, nextY, transform.scale)
      return
    }

    // Pointer events can arrive faster than the browser can paint. Keep only
    // the latest position and update the expensive SVG scene once per frame.
    schedulePan(nextX, nextY, transform.scale)
  }

  function endPan(event: PointerEvent, svg: SVGSVGElement) {
    if (event.pointerType === 'touch' || activeTouches.size > 0
      || !dragState || event.pointerId !== dragState.pointerId) return

    flushPendingPan()
    const moved = dragState.moved
    suppressNextClick ||= moved
    isDragging.value = false
    if (svg.hasPointerCapture(event.pointerId)) {
      svg.releasePointerCapture(event.pointerId)
    }
    dragState = undefined
  }

  function updateTouches(event: TouchEvent, svg: SVGSVGElement): Touch | undefined {
    // Use the complete browser snapshot, not incremental pointer-down/up
    // bookkeeping. Include contacts on different SVG descendants, but not
    // fingers that began on controls outside the map.
    const touches = Array.from(event.touches)
      .filter((touch) => activeTouches.has(touch.identifier)
        || (touch.target instanceof Node && svg.contains(touch.target)))
      .sort((a, b) => a.identifier - b.identifier)
    const previousIds = [...activeTouches.keys()]
    const remainingIds = new Set(touches.map((touch) => touch.identifier))
    const ended = Array.from(event.changedTouches).find((touch) =>
      activeTouches.has(touch.identifier) && !remainingIds.has(touch.identifier),
    )
    const tap = event.type === 'touchend' && previousIds.length === 1 && ended
      && !suppressedTouchTaps.has(ended.identifier) && !dragState?.moved
      ? ended : undefined
    const contactsChanged = previousIds.length !== touches.length
      || previousIds.some((id) => !remainingIds.has(id))
    if (contactsChanged) flushPendingPan()
    activeTouches.clear()
    for (const touch of touches) activeTouches.set(touch.identifier, touch)
    for (const id of suppressedTouchTaps) {
      if (!remainingIds.has(id)) suppressedTouchTaps.delete(id)
    }

    if (touches.length >= 2) {
      stopAnimation()
      cancelWheelUpdate()
      for (const touch of touches) suppressedTouchTaps.add(touch.identifier)
      if (!pinchState || pinchState.identifiers.some((id) => !remainingIds.has(id))) {
        beginPinch(svg)
      } else {
        movePinch()
      }
    } else {
      pinchState = undefined
      isPinching.value = false
      if (dragState && !remainingIds.has(dragState.pointerId)) {
        suppressNextClick ||= dragState.moved
        dragState = undefined
        isDragging.value = false
      }
      const touch = touches[0]
      // An uneven pinch release must not become a new one-finger drag.
      if (touch && !suppressedTouchTaps.has(touch.identifier)) {
        if (!dragState) {
          stopAnimation()
          cancelWheelUpdate()
          cancelPanUpdate()
          suppressNextClick = false
          beginDrag(touch.identifier, touch.clientX, touch.clientY, svg, TOUCH_DRAG_THRESHOLD)
        } else {
          moveDrag(touch.identifier, touch.clientX, touch.clientY, true)
        }
      }
    }
    return tap
  }

  function consumeDragClick() {
    if (!suppressNextClick) return false
    suppressNextClick = false
    return true
  }

  watch([width, height], () => resetZoom(false))
  onBeforeUnmount(() => {
    stopAnimation()
    cancelWheelUpdate()
    cancelPanUpdate()
    activeTouches.clear()
    suppressedTouchTaps.clear()
    if (wheelEndTimer !== undefined) window.clearTimeout(wheelEndTimer)
  })

  return {
    transform,
    isZoomed,
    isDragging,
    isPinching,
    isWheeling,
    isAnimating,
    isInteracting,
    wrapActive,
    wrapNeighborDirection,
    consumeDragClick,
    endPan,
    movePan,
    resetZoom,
    startPan,
    updateTouches,
    zoomFromWheel,
    zoomToBounds,
    zoomToPoint,
  }
}
