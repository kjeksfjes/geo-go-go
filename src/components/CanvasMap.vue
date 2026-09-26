<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { CanvasCamera, CanvasMapScene, CanvasWorkerFrame, CanvasWorkerRequest } from '../types/mapCanvas'

const props = defineProps<{
  width: number
  height: number
  scene: CanvasMapScene
  camera: Readonly<CanvasCamera>
  interacting: boolean
  wrapOffset: number | null
  wrapPeriod: number | null
}>()

const emit = defineEmits<{ 'ready-change': [ready: boolean] }>()
const canvasA = ref<HTMLCanvasElement | null>(null)
const canvasB = ref<HTMLCanvasElement | null>(null)
const overviewCanvas = ref<HTMLCanvasElement | null>(null)
// Leave enough image outside the viewport for several wheel events while the
// worker prepares the next frame. The overlap prevents exposed bitmap edges.
const overscan = 1.8
// At minimum zoom, the camera can move by 65% of the viewport in either
// direction. Keep a complete map snapshot available for fast zoom-outs.
const overviewOverscan = 2.4
let worker: Worker | null = null
let contexts: Array<ImageBitmapRenderingContext | CanvasRenderingContext2D | null> = [null, null, null]
let sceneVersion = 0
let requestId = 0
let pending = false
let refreshAfterPending = false
let forceAfterPending = false
let swapFrame: number | undefined
let visibleIndex = 0
let hasShownDetail = false
let ready = false
type Snapshot = {
  camera: CanvasCamera
  width: number
  height: number
  overscan: number
}
let snapshots: Array<Snapshot | null> = [null, null, null]

function canvases() {
  return [canvasA.value, canvasB.value, overviewCanvas.value]
}

function currentCamera(): CanvasCamera {
  return { x: props.camera.x, y: props.camera.y, scale: props.camera.scale }
}

function pixelRatio(imageOverscan = overscan) {
  // Keep the overscanned backing bitmap within common mobile canvas limits.
  return Math.max(0.5, Math.min(window.devicePixelRatio || 1, 2, 4096 / (props.width * imageOverscan), 4096 / (props.height * imageOverscan)))
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

function updateVisibility() {
  // Never expose the edge of a detail bitmap. The overview is shown instead
  // of underneath it, so the two camera snapshots cannot form a visible seam.
  const shownIndex = coversViewport(visibleIndex)
    ? visibleIndex
    : hasShownDetail && coversViewport(2) ? 2 : -1
  for (const [index, element] of canvases().entries()) {
    element?.style.setProperty('opacity', index === shownIndex ? '1' : '0')
  }
  const nextReady = shownIndex !== -1
  if (nextReady !== ready) {
    ready = nextReady
    emit('ready-change', ready)
  }
}

function needsRefresh() {
  const frame = presentation(visibleIndex)
  if (!frame) return true
  const marginX = props.width * 0.08
  const marginY = props.height * 0.08
  return frame.ratio > 1.35 || frame.ratio < 0.8
    || frame.x > -marginX || frame.y > -marginY
    || frame.x + frame.ratio * frame.width < props.width + marginX
    || frame.y + frame.ratio * frame.height < props.height + marginY
}

function requestFrame(force = false) {
  if (!worker || !canvasA.value || !canvasB.value || sceneVersion === 0) return
  if (pending) {
    refreshAfterPending = true
    forceAfterPending ||= force
    return
  }
  pending = true
  requestId += 1
  const message: CanvasWorkerRequest = {
    type: 'render',
    purpose: 'detail',
    version: sceneVersion,
    requestId,
    width: props.width,
    height: props.height,
    pixelRatio: pixelRatio(),
    overscan,
    camera: currentCamera(),
    wrapOffset: props.wrapOffset,
  }
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
  worker.postMessage(message)
}

function paintBitmap(index: number, frame: CanvasWorkerFrame) {
  const element = canvases()[index]
  const context = contexts[index]
  if (!element || !context) {
    frame.bitmap.close()
    return false
  }
  // Only ever resize a hidden canvas. Resizing clears its front buffer.
  if (element.width !== frame.bitmap.width) element.width = frame.bitmap.width
  if (element.height !== frame.bitmap.height) element.height = frame.bitmap.height
  if ('transferFromImageBitmap' in context) {
    context.transferFromImageBitmap(frame.bitmap)
  } else {
    context.clearRect(0, 0, element.width, element.height)
    context.drawImage(frame.bitmap, 0, 0)
    frame.bitmap.close()
  }
  snapshots[index] = { camera: frame.camera, width: frame.width, height: frame.height, overscan: frame.overscan }
  element.style.width = `${frame.overscan * 100}%`
  element.style.height = `${frame.overscan * 100}%`
  updatePresentation()
  return true
}

function receiveFrame(frame: CanvasWorkerFrame) {
  if (frame.version !== sceneVersion || (frame.purpose === 'detail' && frame.requestId !== requestId)) {
    frame.bitmap.close()
    return
  }
  if (frame.purpose === 'overview') {
    paintBitmap(2, frame)
    return
  }
  const backIndex = 1 - visibleIndex
  // Resize and replace only the hidden back buffer. The front image remains
  // visible until the replacement is ready to be shown in one paint.
  if (!paintBitmap(backIndex, frame)) return
  if (!coversViewport(backIndex)) {
    // A wheel/animation gesture outran the worker. Do not show this stale
    // snapshot; ask for one at the camera position we have now.
    pending = false
    refreshAfterPending = false
    forceAfterPending = false
    requestFrame(true)
    return
  }
  swapFrame = requestAnimationFrame(() => {
    swapFrame = undefined
    if (frame.version !== sceneVersion || !canvases()[backIndex]) return
    visibleIndex = backIndex
    hasShownDetail = true
    updatePresentation()
    pending = false

    const refresh = refreshAfterPending
    const force = forceAfterPending
    refreshAfterPending = false
    forceAfterPending = false
    if (refresh && (force || needsRefresh())) requestFrame()
  })
}

function configureScene() {
  if (!worker || !canvasA.value || !canvasB.value || !overviewCanvas.value) return
  sceneVersion += 1
  if (swapFrame !== undefined) cancelAnimationFrame(swapFrame)
  swapFrame = undefined
  pending = false
  refreshAfterPending = false
  forceAfterPending = false
  snapshots = [null, null, null]
  visibleIndex = 0
  hasShownDetail = false
  for (const element of canvases()) element?.style.setProperty('opacity', '0')
  ready = false
  emit('ready-change', false)
  const message: CanvasWorkerRequest = { type: 'scene', version: sceneVersion, scene: props.scene }
  worker.postMessage(message)
  requestFrame()
  requestOverview()
}

watch(() => [props.scene, props.width, props.height], configureScene, { flush: 'post' })
watch(
  () => [props.camera.x, props.camera.y, props.camera.scale],
  () => {
    updatePresentation()
    if (needsRefresh()) requestFrame()
  },
  // setTransform writes x, y and scale separately. Batch them so a frame is
  // never requested with a camera assembled from two animation steps.
  { flush: 'post' },
)
watch(() => props.wrapOffset, () => requestFrame(true))
watch(() => props.interacting, (active) => {
  if (!active) requestFrame()
})

onMounted(() => {
  if (!canvasA.value || !canvasB.value || !overviewCanvas.value || typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return
  contexts = canvases().map((element) => element?.getContext('bitmaprenderer') ?? element?.getContext('2d') ?? null)
  if (contexts.some((context) => !context)) return
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
    emit('ready-change', false)
  }
  configureScene()
})

onBeforeUnmount(() => {
  if (swapFrame !== undefined) cancelAnimationFrame(swapFrame)
  worker?.terminate()
  worker = null
})
</script>

<template>
  <div class="canvas-map-layer" aria-hidden="true">
    <canvas ref="overviewCanvas" class="canvas-map" />
    <canvas ref="canvasA" class="canvas-map" />
    <canvas ref="canvasB" class="canvas-map" />
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
