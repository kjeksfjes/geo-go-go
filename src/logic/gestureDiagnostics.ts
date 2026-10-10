export interface GestureSample {
  scale: number
  x: number
  y: number
  canvas: boolean
  preview: boolean
}

export interface GestureWheelInput { deltaY: number; deltaMode: number }

export interface GestureWorkerEvent {
  stage: 'requested' | 'received' | 'discarded' | 'displayed' | 'handoff' | 'fallback'
  key: string
  purpose: string
  pixelRatio: number
  omitBorders?: boolean
  overscan?: number
  at: number
  proxy?: boolean
  displayScale?: number
  workerDrawMs?: number
  workerExportMs?: number
  fallbackCandidates?: Array<{ buffer: string; available: boolean; eligible: boolean; coversViewport: boolean; displayScale: number | null; scaleLimit: number | null; overScaleLimit: boolean; bordersOmitted: boolean }>
  mainWork?: { resizeMs: number; transferMs: number; presentationMs: number; totalMs: number }
}

const round = (value: number) => Math.round(value * 100) / 100
const percentile = (values: number[], fraction: number) => {
  const sorted = [...values].sort((a, b) => a - b)
  return round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0)
}

// One bounded, in-memory gesture report; sampling is owned by the gesture lifecycle.
export function createGestureDiagnostics(context: Record<string, unknown>, start: number, initial: GestureSample) {
  let lastFrame = start
  let end: number | null = null
  let finalScale = initial.scale
  let finalX = initial.x
  let finalY = initial.y
  let cancelled = false
  let samples = 0
  let previewSamples = 0
  let svgSamples = 0
  let maxGap = 0
  let inputCount = 0
  let maxInputHandler = 0
  let wheelInputCount = 0
  let nonZeroVerticalWheelEvents = 0
  let wheelDeltaY = 0
  let absoluteWheelDeltaY = 0
  const gaps: number[] = []
  const frameTimes: number[] = []
  const slowFrames: Array<{ atMs: number; gapMs: number }> = []
  const fallbacks: Array<{ atMs: number; phase: 'gesture' | 'settle'; candidates: GestureWorkerEvent['fallbackCandidates'] }> = []
  const requests = new Map<string, number>()
  const roundTrips: number[] = []
  const frameTimings: Array<{ key: string; receivedAtMs: number; phase: 'gesture' | 'settle'; purpose: string; bordersOmitted: boolean; cropOverscan: number | null; roundTripMs: number | null; workerDrawMs: number | null; workerExportMs: number | null; mainWork?: GestureWorkerEvent['mainWork']; discarded?: boolean }> = []
  let requested = 0
  let received = 0
  let discarded = 0
  let lowDensityRequests = 0
  let maxObservedDisplayedScale = 0
  const displayedBuffers: Array<{ atMs: number; phase: 'gesture' | 'settle'; buffer: string; bordersOmitted: boolean; cropOverscan: number | null; sourceDensity: number; displayScale: number | null; proxy: boolean | null }> = []
  type TransitionKind = 'preview' | 'renderer' | 'displayedFrameDensity' | 'proxy'
  const state: Partial<Record<TransitionKind, boolean | number>> = { preview: initial.preview, renderer: initial.canvas }
  const transitions: Array<{ atMs: number; phase: 'gesture' | 'settle'; kind: TransitionKind; from: boolean | number | null; to: boolean | number }> = []
  let transitionCount = 0
  let omittedTransitions = 0
  let previewEntries = 0
  let previewExitsDuringGesture = 0

  function transition(kind: TransitionKind, value: boolean | number, now: number) {
    const previous = state[kind]
    if (previous === value) return
    state[kind] = value
    const phase = end === null ? 'gesture' : 'settle'
    if (previous !== undefined) transitionCount++
    if (kind === 'preview' && phase === 'gesture') {
      if (value === true) previewEntries++
      else if (previous === true) previewExitsDuringGesture++
    }
    if (transitions.length < 100) transitions.push({ atMs: round(now - start), phase, kind, from: previous ?? null, to: value })
    else omittedTransitions++
  }

  const longTasks: Array<{ atMs: number; durationMs: number }> = []

  function frame(now: number, sample: GestureSample) {
    // Settlement events are recorded separately from gesture frame cadence.
    if (end !== null) return
    const gap = now - lastFrame
    lastFrame = now
    maxGap = Math.max(maxGap, gap)
    if (gaps.length < 4096) { gaps.push(gap); frameTimes.push(now - start) }
    if (gap > 32 && slowFrames.length < 20) slowFrames.push({ atMs: round(now - start), gapMs: round(gap) })
    samples++
    previewSamples += Number(sample.preview)
    svgSamples += Number(!sample.canvas)
    finalScale = sample.scale
    finalX = sample.x
    finalY = sample.y
  }

  function input(duration: number, wheel?: GestureWheelInput) {
    if (end !== null) return
    inputCount++
    maxInputHandler = Math.max(maxInputHandler, duration)
    if (wheel) {
      const delta = wheel.deltaY * (wheel.deltaMode === 1 ? 16 : 1)
      wheelInputCount++
      nonZeroVerticalWheelEvents += Number(delta !== 0)
      wheelDeltaY += delta
      absoluteWheelDeltaY += Math.abs(delta)
    }
  }

  function worker(event: GestureWorkerEvent) {
    if (event.stage === 'fallback') {
      if (fallbacks.length < 20) fallbacks.push({ atMs: round(event.at - start), phase: end === null ? 'gesture' : 'settle', candidates: event.fallbackCandidates })
      return
    }
    if (event.stage === 'requested') {
      requested++
      lowDensityRequests += Number(event.pixelRatio <= 1 && event.purpose === 'detail')
      requests.set(event.key, event.at)
    } else if (event.stage === 'received') {
      received++
      const sent = requests.get(event.key)
      if (sent !== undefined && roundTrips.length < 100) roundTrips.push(event.at - sent)
      requests.delete(event.key)
      if (frameTimings.length < 30) frameTimings.push({ key: event.key, receivedAtMs: round(event.at - start), phase: end === null ? 'gesture' : 'settle', purpose: event.purpose, bordersOmitted: event.omitBorders ?? false, cropOverscan: event.overscan ?? null, roundTripMs: sent === undefined ? null : round(event.at - sent), workerDrawMs: event.workerDrawMs === undefined ? null : round(event.workerDrawMs), workerExportMs: event.workerExportMs === undefined ? null : round(event.workerExportMs) })
    } else if (event.stage === 'discarded') {
      discarded++
      const timing = frameTimings.find((entry) => entry.key === event.key)
      if (timing) timing.discarded = true
    } else if (event.stage === 'handoff') {
      const timing = frameTimings.find((entry) => entry.key === event.key)
      if (timing && event.mainWork) timing.mainWork = { resizeMs: round(event.mainWork.resizeMs), transferMs: round(event.mainWork.transferMs), presentationMs: round(event.mainWork.presentationMs), totalMs: round(event.mainWork.totalMs) }
    } else {
      if (event.displayScale !== undefined) maxObservedDisplayedScale = Math.max(maxObservedDisplayedScale, event.displayScale)
      if (displayedBuffers.length < 30) displayedBuffers.push({ atMs: round(event.at - start), phase: end === null ? 'gesture' : 'settle', buffer: event.purpose, bordersOmitted: event.omitBorders ?? false, cropOverscan: event.overscan ?? null, sourceDensity: event.pixelRatio, displayScale: event.displayScale === undefined ? null : round(event.displayScale), proxy: event.proxy ?? null })
      transition('displayedFrameDensity', event.pixelRatio, event.at)
      if (event.proxy !== undefined) transition('proxy', event.proxy, event.at)
    }
  }

  function longTask(at: number, duration: number) {
    if (at + duration >= start && longTasks.length < 20) longTasks.push({ atMs: round(Math.max(0, at - start)), durationMs: round(duration) })
  }

  function finish(now: number, sample: GestureSample, wasCancelled = false) {
    cancelled = wasCancelled
    end = now
    finalScale = sample.scale
    finalX = sample.x
    finalY = sample.y
  }

  function report(now: number, longTasksSupported: boolean) {
    const ratio = finalScale / initial.scale
    return {
      schema: 'geo-go-go.last-gesture.v4',
      ...context,
      cancelled,
      direction: context.gesture === 'pan'
        ? Math.hypot(finalX - initial.x, finalY - initial.y) < 1 ? 'stationary'
          : Math.abs(finalX - initial.x) >= Math.abs(finalY - initial.y) ? finalX > initial.x ? 'right' : 'left' : finalY > initial.y ? 'down' : 'up'
        : ratio > 1.01 ? 'in' : ratio < 0.99 ? 'out' : 'mixed-or-pan',
      pan: { deltaX: round(finalX - initial.x), deltaY: round(finalY - initial.y), distance: round(Math.hypot(finalX - initial.x, finalY - initial.y)), units: 'camera translation units; screen pixels at an unscaled map viewport' },
      durationMs: round((end ?? now) - start),
      capturedSettleMs: end === null ? 0 : round(now - end),
      zoom: { start: round(initial.scale), end: round(finalScale), ratio: round(ratio) },
      input: { events: inputCount, maxHandlerMs: round(maxInputHandler),
        wheel: context.gesture === 'wheel' ? { events: wheelInputCount, nonZeroVerticalEvents: nonZeroVerticalWheelEvents, normalizedDeltaY: round(wheelDeltaY), absoluteNormalizedDeltaY: round(absoluteWheelDeltaY), units: 'matches app normalization: line deltas multiplied by 16; other modes unchanged' } : undefined,
      },
      animationFrames: { samples, noCallbacksDuringGesture: samples === 0, trailingCallbackWaitMs: round(Math.max(0, (end ?? now) - lastFrame)), medianGapMs: samples ? percentile(gaps, 0.5) : null, p95GapMs: samples ? percentile(gaps, 0.95) : null, maxGapMs: samples ? round(maxGap) : null, retainedGapSamples: gaps.length, slowFrames },
      rendering: { fallbacks, previewSamples, svgFallbackSamples: svgSamples, requests: requested, received, discarded, lowDensityRequests, maxObservedDisplayedScale: round(maxObservedDisplayedScale), displayedBuffers, frameTimings, pendingAtCapture: requests.size, workerRoundTripP95Ms: percentile(roundTrips, 0.95), workerRoundTripMaxMs: round(Math.max(0, ...roundTrips)) },
      modeSwitching: {
        initial: { preview: initial.preview, canvas: initial.canvas },
        previewEntriesDuringGesture: previewEntries,
        previewExitsDuringGesture,
        previewReenteredDuringGesture: previewEntries > (initial.preview ? 0 : 1),
        transitionCount,
        omittedTransitions,
        entries: transitions.map((event) => {
          const nextFrame = frameTimes.findIndex((at) => at >= event.atMs)
          return { ...event, followingRafGapMs: nextFrame < 0 ? null : round(gaps[nextFrame]) }
        }),
        slowFrameCorrelations: slowFrames.map((gap) => ({ ...gap, transitionsWithinGap: transitions.filter((event) => event.from !== null && event.phase === 'gesture' && event.atMs >= gap.atMs - gap.gapMs && event.atMs <= gap.atMs) })),
      },
      longTasks: { supported: longTasksSupported, entries: longTasks },
      limits: 'RAF intervals are main-thread callback gaps, not compositor FPS. With no callbacks, gap statistics are unavailable; trailingCallbackWaitMs measures time from the last callback (or gesture start) to gesture end. Worker draw/export and main handoff timings measure synchronous API wall time, not isolated GPU work. Worker round trips include queueing and delivery; received counts can include requests predating the gesture. Transition timestamps can show correlation with slow RAF gaps, not prove causation. Displayed frame density is its source raster density, excluding current CSS scaling. Timing lists are bounded. Long-task entries are unavailable in some browsers. No location or touch coordinates are recorded.',
    }
  }

  return { frame, input, worker, transition, longTask, finish, report }
}
