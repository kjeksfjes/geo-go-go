<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { createTouchZoomPreview, touchZoomPreviewPixelRatio, touchPanBathymetryPreviewPixelRatio } from '../logic/touchZoomPreview'
import type { GestureWorkerEvent } from '../logic/gestureDiagnostics'
import type { CanvasCamera, CanvasMapScene, CanvasWorkerFrame, CanvasWorkerRequest } from '../types/mapCanvas'

const props = defineProps<{
  width: number
  height: number
  scene: CanvasMapScene
  camera: Readonly<CanvasCamera>
  interacting: boolean
  panning: boolean
  wheelZooming: boolean
  animating: boolean
  firefoxPreview: boolean
  touchZooming: boolean
  animatedZooming: boolean
  touchPanning: boolean
  diagnosticsActive: boolean
  wrapOffset: number | null
  wrapPeriod: number | null
}>()

const emit = defineEmits<{ 'ready-change': [ready: boolean]; 'preview-change': [active: boolean]; 'render-diagnostic': [event: GestureWorkerEvent]; 'context-ready': [kind: 'bitmaprenderer' | '2d']; 'restoring-change': [active: boolean] }>()
const zoomPreview = createTouchZoomPreview()
let previewActive = false
let previewBridge = false
let bridgeFromPinch = false
let restoringDetail = false
const canvasA = ref<HTMLCanvasElement | null>(null)
const canvasB = ref<HTMLCanvasElement | null>(null)
const overviewCanvas = ref<HTMLCanvasElement | null>(null)
const settledCanvas = ref<HTMLCanvasElement | null>(null)
// Leave enough image outside the viewport for several wheel events while the
// worker prepares the next frame. The overlap prevents exposed bitmap edges.
const overscan = 1.8
// Touch pans need more translation runway while a replacement is in flight.
const touchPanOverscan = 3
// Firefox movement needs enough runway for fast drags and expanding zooms.
const firefoxPreviewOverscan = 3
const firefoxPreviewDensity = 0.75
const firefoxPreviewMaximumScale = 3.5
const firefoxPreviewReuseWindow = 1000
// At minimum zoom, the camera can move by 65% of the viewport in either
// direction. Keep a complete map snapshot available for fast zoom-outs.
const overviewOverscan = 2.4
const overviewIndex = 2
const settledIndex = 3
const settleDelay = 180
const maximumFrameScale = 2
let worker: Worker | null = null
let contexts: Array<ImageBitmapRenderingContext | CanvasRenderingContext2D | null> = [null, null, null, null]
let sceneVersion = 0
let requestId = 0
let settledRequestId = 0
let pending = false
let refreshAfterPending = false
let forceAfterPending = false
let settleTimer: number | undefined
let restorationDeadline: number | undefined
let pendingSettledCamera: { camera: CanvasCamera; width: number; height: number; version: number } | null = null
let wheelStartedAt = -Infinity
let wheelEndedAt = -Infinity
let animationStartedAt = -Infinity
let animationEndedAt = -Infinity
let visibleIndex = 0
let hasShownDetail = false
let ready = false
let configuredCoordinates: { key: string; width: number; height: number } | null = null
type Snapshot = {
  installedAt: number
  movementPreview?: boolean
  camera: CanvasCamera
  width: number
  height: number
  overscan: number
  pixelRatio: number
  version: number
  requestId: number
  purpose: CanvasWorkerFrame['purpose']
}
let panCarry: { snapshot: Snapshot; ratio: number; until: number } | null = null
let currentShownIndex = -1
let reportedDisplayedFrame: Snapshot | null = null
let reportedProxy = false
let showingProxy = false
let snapshots: Array<Snapshot | null> = [null, null, null, null]

function canvases() {
  return [canvasA.value, canvasB.value, overviewCanvas.value, settledCanvas.value]
}

function currentCamera(): CanvasCamera {
  return { x: props.camera.x, y: props.camera.y, scale: props.camera.scale }
}

function pixelRatio(imageOverscan = overscan) {
  // Keep each backing bitmap within common canvas limits on any screen size.
  return Math.min(window.devicePixelRatio || 1, 2, 4096 / (props.width * imageOverscan), 4096 / (props.height * imageOverscan))
}

function matchesCurrentCamera(snapshot: Pick<Snapshot, 'camera' | 'width' | 'height'> | null) {
  return snapshot !== null
    && snapshot.width === props.width
    && snapshot.height === props.height
    && snapshot.camera.x === props.camera.x
    && snapshot.camera.y === props.camera.y
    && snapshot.camera.scale === props.camera.scale
}

function presentation(index: number) {
  const snapshot = snapshots[index]
  if (!snapshot) return null
  const camera = currentCamera()
  const ratio = camera.scale / snapshot.camera.scale
  const padX = snapshot.width * (snapshot.overscan - 1) / 2
  const padY = snapshot.height * (snapshot.overscan - 1) / 2
  let x = camera.x - ratio * (snapshot.camera.x + padX)
  const y = camera.y - ratio * (snapshot.camera.y + padY)
  if (props.wrapPeriod) {
    // The camera is normalized by one world width after crossing a seam.
    // Keep the already-painted bitmap on its nearest equivalent copy instead
    // of letting that normalization look like a one-frame jump.
    const cameraCenter = (props.width / 2 - camera.x) / camera.scale
    const snapshotCenter = (snapshot.width / 2 - snapshot.camera.x) / snapshot.camera.scale
    const copy = Math.round((cameraCenter - snapshotCenter) / props.wrapPeriod)
    x += copy * camera.scale * props.wrapPeriod
  }
  return { x, y, ratio, width: snapshot.width * snapshot.overscan, height: snapshot.height * snapshot.overscan }
}

function updatePresentation() {
  for (const [index, element] of canvases().entries()) {
    const frame = presentation(index)
    if (!element || !frame) continue
    const container = element.parentElement
    const displayScaleX = container ? container.clientWidth / props.width : 1
    const displayScaleY = container ? container.clientHeight / props.height : 1
    element.style.transform = `translate(${frame.x * displayScaleX}px, ${frame.y * displayScaleY}px) scale(${frame.ratio})`
  }
  updateVisibility()
}

function coversViewport(index: number) {
  const frame = presentation(index)
  // Allow for subpixel rounding between SVG viewBox units and CSS pixels.
  const tolerance = 1
  return frame !== null
    && frame.x <= tolerance && frame.y <= tolerance
    && frame.x + frame.ratio * frame.width >= props.width - tolerance
    && frame.y + frame.ratio * frame.height >= props.height - tolerance
}

function detailMagnificationLimit(index: number) {
  if (!props.firefoxPreview) return maximumFrameScale
  const snapshot = snapshots[index]
  const now = performance.now()
  if (props.firefoxPreview && props.panning && previewBridge
    && snapshot?.version === sceneVersion && panCarry?.snapshot === snapshot && now <= panCarry.until) {
    const frame = presentation(index)
    // Carry only the already visible magnification, never zoom further during pan.
    if (frame && frame.ratio <= panCarry.ratio + 0.000001) return panCarry.ratio + 0.000001
  }
  const wheelWindow = props.wheelZooming
    ? now - wheelStartedAt <= firefoxPreviewReuseWindow || (!!snapshot && now - snapshot.installedAt <= firefoxPreviewReuseWindow)
    : !props.interacting && now - wheelEndedAt <= firefoxPreviewReuseWindow
  const animationWindow = props.animating
    ? now - animationStartedAt <= firefoxPreviewReuseWindow || (!!snapshot && now - snapshot.installedAt <= firefoxPreviewReuseWindow)
    : !props.interacting && now - animationEndedAt <= firefoxPreviewReuseWindow
  // Scene-valid primed crops bridge wheel and automatic zooms, including the
  // brief restoration window. The overview keeps its independent 2× guard.
  return props.firefoxPreview && (wheelWindow || animationWindow)
    && !props.panning && previewBridge && snapshot?.movementPreview
    && snapshot.version === sceneVersion ? firefoxPreviewMaximumScale : maximumFrameScale
}

function recordFallback() {
  if (!props.diagnosticsActive) return
  const fallbackCandidates = [visibleIndex, 1 - visibleIndex, settledIndex, overviewIndex].map((index) => {
    const snapshot = snapshots[index]
    const frame = presentation(index)
    const scaleLimit = index === overviewIndex ? maximumFrameScale
      : index === settledIndex ? (previewBridge ? (bridgeFromPinch && !props.touchPanning && !props.animatedZooming ? null : maximumFrameScale) : 1.35)
        : detailMagnificationLimit(index)
    return {
      buffer: index === visibleIndex ? 'detail-front' : index === 1 - visibleIndex ? 'detail-back' : index === settledIndex ? 'settled' : 'overview',
      available: !!snapshot && !!frame,
      eligible: index === overviewIndex ? hasShownDetail : index === 1 - visibleIndex ? !!(props.firefoxPreview && previewActive && props.interacting && snapshot?.movementPreview) : true,
      coversViewport: coversViewport(index),
      displayScale: frame?.ratio ?? null,
      scaleLimit,
      overScaleLimit: !!frame && scaleLimit !== null && frame.ratio > scaleLimit,
      bordersOmitted: false,
    }
  })
  recordRender('fallback', { version: sceneVersion, requestId, purpose: 'fallback', pixelRatio: 0 }, { fallbackCandidates })
}

function updateVisibility() {
  // The sharp frame has no overscan, so prefer it at its exact resting
  // camera. It can also bridge a small zoom-in if it still covers the view.
  // Ordinary movement retains its sharpness guard. A fast touch preview can
  // bridge worker latency with a softer cached raster, but never exposed edges.
  const overview = presentation(overviewIndex)
  const settled = presentation(settledIndex)
  const detail = presentation(visibleIndex)
  let shownIndex = !props.interacting && matchesCurrentCamera(snapshots[settledIndex])
    ? settledIndex
    : detail && detail.ratio <= detailMagnificationLimit(visibleIndex) && coversViewport(visibleIndex)
      ? visibleIndex
      : settled && settled.ratio <= 1.35 && coversViewport(settledIndex)
        ? settledIndex
        : hasShownDetail && overview && overview.ratio <= maximumFrameScale && coversViewport(overviewIndex)
          ? overviewIndex : -1
  // Keep a usable moving crop ahead of late full-density restoration buffers
  // when another drag begins. Do not blank the map if no such crop exists yet.
  if (props.firefoxPreview && previewActive && props.interacting) {
    for (const index of [visibleIndex, 1 - visibleIndex]) {
      const frame = presentation(index)
      if (snapshots[index]?.movementPreview && frame && frame.ratio <= detailMagnificationLimit(index) && coversViewport(index)) {
        shownIndex = index
        break
      }
    }
  }
  if (shownIndex === -1 && previewBridge) {
    let bestDensity = -Infinity
    for (const index of [visibleIndex, settledIndex, overviewIndex]) {
      if (index === overviewIndex && !hasShownDetail) continue
      const frame = presentation(index)
      const snapshot = snapshots[index]
      if (!frame || !snapshot || !coversViewport(index)) continue
      // The overview always retains its 2× guard. A recent lower-density detail
      // can bridge desktop wheel bursts; physical pinch behavior is unchanged.
      if (index === overviewIndex && frame.ratio > maximumFrameScale) continue
      if ((!bridgeFromPinch || props.touchPanning || props.animatedZooming)
        && frame.ratio > detailMagnificationLimit(index)) continue
      const density = snapshot.pixelRatio / frame.ratio
      if (density > bestDensity) { bestDensity = density; shownIndex = index }
    }
  }
  const shownSnapshot = snapshots[shownIndex]
  const shownPresentation = presentation(shownIndex)
  const sharp = shownSnapshot && !shownSnapshot.movementPreview && shownPresentation
    && shownSnapshot.pixelRatio >= pixelRatio() / 1.1 && Math.abs(shownPresentation.ratio - 1) <= 0.01
  if (previewBridge && !previewActive && sharp) previewBridge = false
  showingProxy = shownIndex !== -1 && previewBridge && !sharp
  const restoring = showingProxy && !previewActive
  if (restoring !== restoringDetail) {
    restoringDetail = restoring
    emit('restoring-change', restoring)
  }
  for (const [index, element] of canvases().entries()) {
    element?.style.setProperty('opacity', index === shownIndex ? '1' : '0')
  }
  currentShownIndex = shownIndex
  const shown = snapshots[shownIndex]
  if (props.diagnosticsActive && shown && (shown !== reportedDisplayedFrame || showingProxy !== reportedProxy)) {
    recordRender('displayed', shown, { proxy: showingProxy, displayScale: shownPresentation?.ratio })
    reportedDisplayedFrame = shown
    reportedProxy = showingProxy
  }
  const nextReady = shownIndex !== -1
  if (nextReady !== ready) {
    if (!nextReady) recordFallback()
    ready = nextReady
    emit('ready-change', ready)
  }
}

function needsRefresh() {
  const frame = presentation(visibleIndex)
  if (!frame) return true
  // Request Firefox pan replacements early enough to bridge worker latency.
  // Keep the existing touch and other desktop refresh margins.
  const margin = props.touchPanning ? 0.45 : props.firefoxPreview && props.panning ? 0.3 : 0.08
  const marginX = props.width * margin
  const marginY = props.height * margin
  return frame.ratio > 1.35 || frame.ratio < 0.8
    || frame.x > -marginX || frame.y > -marginY
    || frame.x + frame.ratio * frame.width < props.width + marginX
    || frame.y + frame.ratio * frame.height < props.height + marginY
}

function recordRender(stage: GestureWorkerEvent['stage'], frame: { version: number; requestId: number; purpose: string; pixelRatio: number; overscan?: number; movementPreview?: boolean; timings?: CanvasWorkerFrame['timings'] }, display: { proxy?: boolean; displayScale?: number; mainWork?: GestureWorkerEvent['mainWork']; fallbackCandidates?: GestureWorkerEvent['fallbackCandidates'] } = {}) {
  if (!props.diagnosticsActive) return
  emit('render-diagnostic', { stage, key: `${frame.version}:${frame.purpose}:${frame.requestId}`, purpose: frame.purpose, pixelRatio: frame.pixelRatio, overscan: frame.overscan, omitBorders: false, at: performance.now(), workerDrawMs: frame.timings?.drawMs, workerExportMs: frame.timings?.exportMs, ...display })
}

function requestFrame(force = false) {
  // In Firefox, retain the lower-density moving crop for the next drag.
  // Restore only the settled viewport after the existing quiet interval, rather
  // than queueing an expensive full-density crop and a settled draw on every release.
  if (props.firefoxPreview && !props.interacting
    && snapshots[visibleIndex]?.movementPreview && snapshots[visibleIndex]?.version === sceneVersion) {
    scheduleSettledFrame()
    return
  }
  if (!worker || !canvasA.value || !canvasB.value || sceneVersion === 0) return
  if (pending) {
    refreshAfterPending = true
    forceAfterPending ||= force
    return
  }
  pending = true
  requestId += 1
  const primeZoomPreview = props.firefoxPreview && !props.interacting
    && snapshots[visibleIndex]?.version !== sceneVersion
  if (primeZoomPreview) previewBridge = true
  const firefoxPreviewRequest = props.firefoxPreview && (previewActive || primeZoomPreview)
  const imageOverscan = firefoxPreviewRequest ? firefoxPreviewOverscan
    : props.touchPanning || props.animatedZooming ? touchPanOverscan : overscan
  const previewDensity = props.touchPanning && props.scene.bathymetry.length > 0
    ? touchPanBathymetryPreviewPixelRatio : touchZoomPreviewPixelRatio
  const message: CanvasWorkerRequest = {
    type: 'render',
    purpose: 'detail',
    movementPreview: props.firefoxPreview && (primeZoomPreview || (previewActive && props.interacting)),
    version: sceneVersion,
    requestId,
    width: props.width,
    height: props.height,
    pixelRatio: firefoxPreviewRequest
      ? Math.min(firefoxPreviewDensity, pixelRatio(imageOverscan))
      : previewActive && (props.touchZooming || props.touchPanning || props.animatedZooming)
        ? Math.min(previewDensity, pixelRatio(imageOverscan)) : pixelRatio(imageOverscan),
    overscan: imageOverscan,
    camera: currentCamera(),
    wrapOffset: props.wrapOffset,
  }
  recordRender('requested', message)
  worker.postMessage(message)
}

function requestOverview() {
  if (!worker) return
  const message: CanvasWorkerRequest = {
    type: 'render',
    purpose: 'overview',
    version: sceneVersion,
    requestId: 0,
    width: props.width,
    height: props.height,
    pixelRatio: Math.min(1, pixelRatio(overviewOverscan)),
    overscan: overviewOverscan,
    camera: { x: 0, y: 0, scale: 1 },
    wrapOffset: props.wrapPeriod,
  }
  recordRender('requested', message)
  worker.postMessage(message)
}

function scheduleSettledFrame() {
  if (settleTimer !== undefined) window.clearTimeout(settleTimer)
  settleTimer = undefined
  // On small viewports the moving frame is already at its target resolution.
  const needsQualityRestore = () => !!snapshots[visibleIndex]?.movementPreview || (snapshots[visibleIndex]?.pixelRatio ?? pixelRatio()) < pixelRatio(1) / 1.1
  if (props.interacting || (!needsQualityRestore() && pixelRatio(1) <= pixelRatio() * 1.1)) return
  settleTimer = window.setTimeout(() => {
    settleTimer = undefined
    if (!worker || props.interacting || matchesCurrentCamera(snapshots[settledIndex])) return
    if (!needsQualityRestore() && pixelRatio(1) <= pixelRatio() * 1.1) return
    if (props.firefoxPreview && pendingSettledCamera?.version === sceneVersion && matchesCurrentCamera(pendingSettledCamera)) return
    settledRequestId += 1
    const message: CanvasWorkerRequest = {
      type: 'render',
      purpose: 'settled',
      version: sceneVersion,
      requestId: settledRequestId,
      width: props.width,
      height: props.height,
      pixelRatio: pixelRatio(1),
      overscan: 1,
      camera: currentCamera(),
      wrapOffset: props.wrapOffset,
    }
    pendingSettledCamera = { camera: message.camera, width: message.width, height: message.height, version: message.version }
    recordRender('requested', message)
    worker.postMessage(message)
  }, props.firefoxPreview && restorationDeadline !== undefined
    ? Math.max(0, restorationDeadline - performance.now()) : settleDelay)
}

function paintBitmap(index: number, frame: CanvasWorkerFrame, activateDetail = false) {
  const element = canvases()[index]
  const context = contexts[index]
  if (!element || !context) {
    frame.bitmap.close()
    return false
  }
  const workStarted = props.diagnosticsActive ? performance.now() : 0
  // Only ever resize a hidden canvas. Resizing clears its front buffer.
  if (element.width !== frame.bitmap.width) element.width = frame.bitmap.width
  if (element.height !== frame.bitmap.height) element.height = frame.bitmap.height
  const resizeFinished = props.diagnosticsActive ? performance.now() : 0
  if ('transferFromImageBitmap' in context) {
    context.transferFromImageBitmap(frame.bitmap)
  } else {
    context.clearRect(0, 0, element.width, element.height)
    context.drawImage(frame.bitmap, 0, 0)
    frame.bitmap.close()
  }
  const transferFinished = props.diagnosticsActive ? performance.now() : 0
  snapshots[index] = { installedAt: performance.now(), movementPreview: frame.movementPreview ?? false, camera: frame.camera, width: frame.width, height: frame.height, overscan: frame.overscan, pixelRatio: frame.pixelRatio, version: frame.version, requestId: frame.requestId, purpose: frame.purpose }
  element.style.width = `${frame.overscan * 100}%`
  element.style.height = `${frame.overscan * 100}%`
  // Installing and selecting the hidden buffer in one task prevents the old
  // frame from triggering SVG fallback while an already-ready bitmap waits.
  if (activateDetail && coversViewport(index)) {
    panCarry = null
    visibleIndex = index
    hasShownDetail = true
  }
  updatePresentation()
  if (props.diagnosticsActive) {
    const finished = performance.now()
    recordRender('handoff', frame, { mainWork: { resizeMs: resizeFinished - workStarted, transferMs: transferFinished - resizeFinished, presentationMs: finished - transferFinished, totalMs: finished - workStarted } })
  }
  return true
}

function receiveFrame(frame: CanvasWorkerFrame) {
  recordRender('received', frame)
  if (frame.purpose === 'settled' && frame.requestId === settledRequestId) pendingSettledCamera = null
  if (frame.version !== sceneVersion
    || (frame.purpose === 'detail' && frame.requestId !== requestId)
    || (frame.purpose === 'settled' && frame.requestId !== settledRequestId)) {
    recordRender('discarded', frame)
    frame.bitmap.close()
    return
  }
  if (frame.purpose === 'detail' && props.firefoxPreview && previewActive && props.interacting
    && !frame.movementPreview) {
    // A full-quality request from the previous release must not displace the
    // cached moving preview or force an expensive raster handoff during the gesture.
    recordRender('discarded', frame)
    frame.bitmap.close()
    pending = false
    refreshAfterPending = false
    forceAfterPending = false
    requestFrame(true)
    return
  }
  if (frame.purpose === 'overview') {
    paintBitmap(overviewIndex, frame)
    return
  }
  if (frame.purpose === 'settled') {
    if (props.interacting || !matchesCurrentCamera(frame)) {
      recordRender('discarded', frame)
      frame.bitmap.close()
      return
    }
    paintBitmap(settledIndex, frame)
    return
  }
  const backIndex = 1 - visibleIndex
  // Resize and replace only the hidden back buffer. The front image remains
  // visible until the replacement is ready to be shown in one paint.
  if (!paintBitmap(backIndex, frame, true)) return
  if (!coversViewport(backIndex)) {
    recordRender('discarded', frame)
    // A wheel/animation gesture outran the worker. Do not show this stale
    // snapshot; ask for one at the camera position we have now.
    pending = false
    refreshAfterPending = false
    forceAfterPending = false
    requestFrame(true)
    return
  }
  pending = false
  const refresh = refreshAfterPending
  const force = forceAfterPending
  refreshAfterPending = false
  forceAfterPending = false
  if (refresh && (force || needsRefresh() || (previewBridge && !props.interacting))) requestFrame()
}

function configureScene() {
  panCarry = null
  restorationDeadline = undefined
  pendingSettledCamera = null
  if (!worker || canvases().some((canvas) => !canvas)) return
  const keepFrontFrame = ready && coversViewport(visibleIndex) && configuredCoordinates?.key === props.scene.coordinateKey
    && configuredCoordinates.width === props.width && configuredCoordinates.height === props.height
  configuredCoordinates = { key: props.scene.coordinateKey, width: props.width, height: props.height }
  sceneVersion += 1
  if (settleTimer !== undefined) window.clearTimeout(settleTimer)
  settleTimer = undefined
  pending = false
  refreshAfterPending = false
  forceAfterPending = false
  if (keepFrontFrame) {
    // Keep the front buffer while an updated scene renders in the back.
    // Projection/viewport changes still discard incompatible coordinates.
    snapshots = snapshots.map((snapshot, index) => index === visibleIndex ? snapshot : null)
    updatePresentation()
  } else {
    snapshots = [null, null, null, null]
    visibleIndex = 0
    hasShownDetail = false
    for (const element of canvases()) element?.style.setProperty('opacity', '0')
    ready = false
    emit('ready-change', false)
  }
  const message: CanvasWorkerRequest = { type: 'scene', version: sceneVersion, scene: props.scene }
  worker.postMessage(message)
  requestFrame()
  requestOverview()
  scheduleSettledFrame()
}

function setPreview(active: boolean) {
  if (active) {
    previewBridge = true
    bridgeFromPinch = props.touchZooming && !props.touchPanning && !props.animatedZooming
  }
  if (previewActive === active) return
  previewActive = active
  emit('preview-change', active)
  // A quality change needs a replacement even if the camera still fits.
  requestFrame(true)
}

watch(() => props.diagnosticsActive, (active) => {
  reportedDisplayedFrame = null
  const shown = snapshots[currentShownIndex]
  if (active && !shown) recordFallback()
  if (active && shown) {
    recordRender('displayed', shown, { proxy: showingProxy, displayScale: presentation(currentShownIndex)?.ratio })
    reportedDisplayedFrame = shown
    reportedProxy = showingProxy
  }
})

watch([() => props.touchZooming, () => props.touchPanning, () => props.animatedZooming], ([pinching, panning, animating]) => {
  zoomPreview.reset(props.camera.scale, performance.now())
  if (panning) setPreview(true)
  else if (!pinching && !animating) setPreview(false)
})

watch(() => [props.scene, props.width, props.height], configureScene, { flush: 'post' })
watch(
  () => [props.camera.x, props.camera.y, props.camera.scale],
  () => {
    if ((props.touchZooming || props.animatedZooming) && !props.touchPanning) setPreview(zoomPreview.update(props.camera.scale, performance.now()))
    updatePresentation()
    if (needsRefresh()) requestFrame()
    scheduleSettledFrame()
  },
  // setTransform writes x, y and scale separately. Batch them so a frame is
  // never requested with a camera assembled from two animation steps.
  { flush: 'post' },
)
watch(() => props.wrapOffset, () => {
  snapshots[settledIndex] = null
  settledRequestId += 1
  updateVisibility()
  requestFrame(true)
  scheduleSettledFrame()
})
watch(() => props.panning, (active) => {
  panCarry = null
  if (!active || !props.firefoxPreview) return
  const now = performance.now()
  if (!props.wheelZooming && now - wheelEndedAt > firefoxPreviewReuseWindow && !props.animating && now - animationEndedAt > firefoxPreviewReuseWindow) return
  // Restored settled quality may hide the wheel crop just before the drag.
  // Reuse that crop too, if it still covers the new view at the current scale.
  for (const index of new Set([currentShownIndex, visibleIndex, 1 - visibleIndex])) {
    const snapshot = snapshots[index]
    const frame = presentation(index)
    if (snapshot?.movementPreview && snapshot.version === sceneVersion && frame
      && frame.ratio > maximumFrameScale && frame.ratio <= firefoxPreviewMaximumScale && coversViewport(index)) {
      panCarry = { snapshot, ratio: frame.ratio, until: now + firefoxPreviewReuseWindow }
      break
    }
  }
}, { flush: 'sync' })

watch(() => props.animating, (active, previous) => {
  if (active) animationStartedAt = performance.now()
  else if (previous) animationEndedAt = performance.now()
}, { flush: 'sync' })
watch(() => props.wheelZooming, (active, previous) => {
  if (active) wheelStartedAt = performance.now()
  else if (previous) wheelEndedAt = performance.now()
}, { flush: 'sync' })
watch(() => props.interacting, (active) => {
  if (props.firefoxPreview) {
    restorationDeadline = active ? undefined : performance.now() + settleDelay
  }
  // Reduce Firefox raster work throughout movement and restore quality after
  // the settled quiet interval. Other desktop and touch policies stay intact.
  if (props.firefoxPreview) setPreview(active)
  updateVisibility()
  if (!active) requestFrame()
  scheduleSettledFrame()
})

onMounted(() => {
  if (canvases().some((canvas) => !canvas) || typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return
  contexts = canvases().map((element) => element?.getContext('bitmaprenderer') ?? element?.getContext('2d') ?? null)
  if (contexts.some((context) => !context)) return
  emit('context-ready', contexts.every((context) => context !== null && 'transferFromImageBitmap' in context) ? 'bitmaprenderer' : '2d')
  try {
    worker = new Worker(new URL('../workers/mapRaster.worker.ts', import.meta.url), { type: 'module' })
  } catch {
    // Browsers without worker support continue with the existing SVG renderer.
    return
  }
  worker.onmessage = (event: MessageEvent<CanvasWorkerFrame>) => {
    if (event.data.type === 'frame') receiveFrame(event.data)
  }
  worker.onerror = () => {
    worker?.terminate()
    worker = null
    for (const element of canvases()) element?.style.setProperty('opacity', '0')
    currentShownIndex = -1
    reportedDisplayedFrame = null
    previewBridge = false
    restoringDetail = false
    emit('restoring-change', false)
    emit('ready-change', false)
  }
  configureScene()
})

onBeforeUnmount(() => {
  emit('preview-change', false)
  emit('restoring-change', false)
  if (settleTimer !== undefined) window.clearTimeout(settleTimer)
  worker?.terminate()
  worker = null
})
</script>

<template>
  <div class="canvas-map-layer" aria-hidden="true">
    <canvas ref="overviewCanvas" class="canvas-map" />
    <canvas ref="canvasA" class="canvas-map" />
    <canvas ref="canvasB" class="canvas-map" />
    <canvas ref="settledCanvas" class="canvas-map" />
  </div>
</template>

<style scoped>
.canvas-map-layer {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.canvas-map {
  position: absolute;
  top: 0;
  left: 0;
  display: block;
  width: 180%;
  height: 180%;
  opacity: 0;
  transform-origin: 0 0;
  pointer-events: none;
}

</style>
