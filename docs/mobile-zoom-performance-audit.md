# Mobile zoom performance audit — 2026-10-07

Latest acceptance: the user confirms that both pinch zoom and touch panning are much improved on the iPhone with high detail enabled. Bathymetry testing is pending. Earlier trial results and reports below record the investigation rather than superseding this acceptance.

Baseline: 0.10.0 (`f81c853`) plus the pending quiz-hover fix and Asia region cleanup. The renderer was restored after all three trials; none of those rendering trials is retained. The later adaptive-preview experiment below is a separate, user-requested trial. A subsequent input-path cleanup shares one live viewport measurement between both pinch contacts. The existing pending changes are preserved. This follow-up investigates the user's renewed concern about mobile zoom responsiveness after the earlier accepted pan/zoom improvement.

## Method

The existing production-preview harness uses disposable Chromium contexts at 390 × 844 CSS pixels, DPR 3, and 4× host-relative CPU throttling. Canvas is the default renderer, Mercator is selected, and bathymetry/relief are disabled to isolate land rendering. Settings and browser data belong to the disposable contexts. No screenshots, visual acceptance, or actual iPhone/Safari measurements were performed.

The harness now supports `PROFILE_GESTURE_INTERVAL_MS` for a scheduled input cadence, `PROFILE_PINCH_OUT` for reverse two-finger gestures, and `PROFILE_PINCH_STEP` for pinch range. Default behavior retains the earlier RAF-paced workload. Fixed-cadence runs schedule inputs 16.667ms apart; CDP round trips, browser event coalescing, and throttling can still delay actual delivery. Wheel stress uses 120 events at delta ±16. Touch pinch uses 30 moves, with a normal half-gap of 35→64 CSS pixels (about 1.83× zoom) or a wider 35→93 range (about 2.66×), followed by its reverse. Each phase includes settling and readiness checks.

Task and layout timings are totals for the complete phase, not per-input latency. Trace categories nest and overlap and must not be added together. RAF callback intervals include settling/idle frames and are not visible compositor FPS. Worker instrumentation and tracing affect execution; these results identify browser-proxy behavior, not expected iPhone speed.

## Results

Three fixed-cadence baseline repetitions completed without page errors, new worker scenes during gestures, 50ms long tasks, or sampled SVG fallback frames. Median main-thread task totals were:

| Detail | Wheel zoom in / out | Touch pinch in / out |
| --- | ---: | ---: |
| 50m | 1,756 / 1,588ms | 430 / 409ms |
| 10m | 1,741 / 1,869ms | 484 / 468ms |

The normal-range fixed-cadence workload did not reproduce a substantial stall. A separate wider-pinch baseline did: high-detail pinch-in/out recorded maximum long tasks of 166/71ms and 1/2 sampled SVG fallback frames. Its low-detail pinch-in/out recorded neither long tasks nor fallback frames. This is one targeted reproduction, not a repeated real-device result.

A separate RAF-paced stress baseline also recorded a 173ms long task and one SVG fallback sample during high-detail zoom-out. The faster cadence is not a matched comparison with the fixed-cadence runs. High-detail touch input therefore deserves investigation independently of artificial wheel stress; the wider real-touch sequence provides the stronger reproduction.

## Rejected trials

- **Batch canvas dimension reads before transform writes:** reduced repeated container reads while preserving equivalent transforms at normal, CSS-scaled, and resized dimensions. It did not show a consistent improvement in the browser workload, and high-detail stress still stalled. Reverted.
- **Canvas compositor hint (`will-change: transform`):** injected only into a disposable browser. Some high-detail paint totals fell, but other movement phases worsened, and zoom-out still produced a 178ms long task and a fallback sample. No reliable overall improvement or real-device memory benefit was established. Not applied to the app.
- **Earlier scaling refresh:** trialed frame-ratio thresholds of >1.2/<0.9 instead of >1.35/<0.8, preserving bitmap resolution and existing viewport/quality guards. Wider high-detail pinch-in/out still produced 152/57ms long tasks and 1/2 fallback samples, with additional raster requests. Reverted.

These are single diagnostic trials, not sufficient evidence to characterize small timing differences as regressions or gains. They are sufficient to reject adopting the candidates as established mobile performance improvements.

## Reported device settings

After these measurements, the user clarified that the observed mobile slowdown occurs with High detail, Bathymetry, and Relief all off. The reproduced high-detail bitmap/fallback stalls therefore do not explain the reported case. Low-detail Chromium pinch runs did not reproduce it; this is a limitation of the proxy, not evidence against the user's observation.

The next investigation should use the reported mobile browser and its actual renderer path. Canvas initialization can fall back to SVG if worker/OffscreenCanvas/context creation fails, and the DOM retains nearly opaque cards with backdrop blur over the moving map. Browser-specific rendering or compositing cost is a hypothesis to test, not an established diagnosis. The user reports modest zoom lag on an iPhone 17; the user confirmed Canvas worker on the phone; browser/OS details remain unconfirmed. The performance target is supported phones generally, not that particular model. No rendering change is justified by the current low-detail measurements.

## Standard-detail card check

A follow-up single diagnostic pass exercised Explore with Kenya selected, Find the country, and Name the country, each with its card visible. All used 50m, optional layers off, the same mobile Chromium proxy, seeded questions, and a 2.66× two-finger pinch-in/out. A paired browser-only trial disabled the card's backdrop filter and substituted the opaque paper surface. No app styling changed.

All six contexts completed without page errors, 50ms long tasks, or sampled SVG fallback frames. Paired camera transforms matched exactly. Removing blur lowered some pinch-in task totals but did not consistently improve pinch-out or Explore; it is not a validated optimization. This still does not measure iOS compositing/GPU cost, and a lack of 50ms tasks does not establish smoothness at a high refresh rate. No card-style change is justified by this pass; the blur trial remains browser-only.

## Retained input cleanup

The user confirmed Canvas worker on the iPhone with standard detail and optional layers off. Inspection found duplicate `getBoundingClientRect()` calls for both contacts: three reads at pinch start and two on each update. Both points now share the same fresh rectangle, reducing those counts to one each. No rectangle is cached across events, so viewport offsets and CSS sizing changes remain live. Camera math, RAF scheduling, bitmap quality, and geometry are unchanged.

Eighteen before/after gesture cases produced identical camera transforms and release behavior, covering normal/CSS-scaled/changing rectangles, horizontal wrapping, regional constraints, batched moves, uneven finger release, and tap suppression. The sampled cases removed 1,116 duplicate rectangle reads. This establishes less redundant measurement work, not a measured iPhone frame-rate or perceptible latency improvement. Device acceptance remains with the user.

## Adaptive fast touch preview trial

The user requested a rasterized fast-zoom proxy limited to mobile. The implementation reuses the canvas worker and existing buffers on no-hover, coarse-pointer devices while two fingers pinch. It measures smoothed absolute log-scale change per second, entering at 1.5 and exiting below 0.8 after 120ms of slow samples; smoothing uses a 50ms time constant. Gesture end resets the policy. Desktop wheel/trackpad and automatic camera animations never activate it.

While active, replacement detail frames use at most one physical pixel per CSS pixel, retaining the normal overscan, geometry, and bitmap coverage guards. Only invisible canvas hit paths are hidden during the pinch. Neutral land, geographic outlines, and selected/question/answer highlights remain visible. The SVG fallback is outside the hiding rule. Hit targets return when preview mode exits; full-density rendering is requested even if the camera still fits the current bitmap, with a sharp resting-frame request as a safety net when needed. Restoration is asynchronous, preserving map interaction rather than blocking it while a worker frame arrives.

Policy checks cover both zoom directions, different starting scales, slow zoom, hysteresis, zero-duration samples, and reset. Disposable mobile browser checks verify preview activation, reduced-density requests, full-density restoration, retained Canvas rendering, and restored hit paths in Explore and quiz modes. Desktop wheel checks verify no preview activation and no reduced-density detail requests.

A single fixed-cadence wider-pinch diagnostic run recorded no high-detail long tasks or fallback samples, versus 166/71ms and 1/2 samples in the earlier reproduction. This is not a repeated paired comparison or an iPhone result. Low-detail task totals did not establish a consistent gain. The experiment therefore needs the user's review of responsiveness and temporary softness on their actual phone before retention or publication. A temporary touch-device badge now shows Normal zoom, Fast zoom preview, or SVG renderer, changing its colors when preview mode is active. All visual acceptance remains exclusively with the user.

## Country geometry rendering cache

The user found no noticeable improvement from the fast-zoom preview. A subsequent code audit identified a separate cost: camera-driven WorldMap renders still rebuilt the country-path VNode loop, despite unchanged projected geometry and answer state. The country-copy groups now use Vue's `v-memo` with explicit geometry, visible-region, locale, hover/selection/quiz, renderer, and answer-reveal dependencies. Copy-offset arrays retain their identity when their values are unchanged. Camera transforms remain live and independent of this cache.

Functional development-browser checks confirmed that the same country-group VNode was reused across 15 consecutive camera updates in each renderer, while language, mode, submitted-answer classes, and detail changes refreshed the cached content. No page errors were recorded. These are cache/state checks, not screenshots or visual acceptance. The production build and whitespace checks passed. The change removes redundant rendering-node work; a perceptible mobile gain has not been established and remains for the user to assess.

## Last-pinch diagnostic report

The mobile zoom-status badge now copies the last completed two-finger gesture report. Recording starts when the gesture becomes a pinch, stops RAF sampling when it ends, and captures worker/long-task replies for another 300ms. A new touch starts a separate record rather than appending history. No recording loop or long-task observer runs outside the gesture and its short settling window. Only the latest report is retained in memory.

Schema v2 adds timestamped preview, renderer, and displayed source-frame density transitions. Each entry is marked as occurring during the gesture or the settling window. Summary counts identify preview exits and re-entries during the pinch, and slow RAF gaps list the transitions within their time range. This can test whether switching accompanies a laggy gesture without treating temporal correlation as proof of cause. State-edge watches capture changes between RAF samples; displayed density is recorded when a buffer is actually shown rather than when merely requested or received.

Reports include browser/app version, viewport/DPR, renderer and canvas context type, map settings and path counts, net zoom direction/ratio, handler timings, RAF gap summaries and slow samples, preview/SVG samples, render request/reply/discard counts, and matched worker round trips. Supported long-task entries are optional; unsupported Safari metrics are marked unavailable. Timing arrays are bounded. No geographic position or touch coordinates are recorded, and copying does not transmit anything. Modern clipboard access uses a legacy local-preview fallback shared with the existing debug panel. Copied/failed feedback is localized.

These are instrumented main-thread callback and message timings, not compositor FPS or isolated worker CPU timings. Measurement adds some work; data should diagnose a particular observed gesture rather than claim a calibrated frame-rate improvement. Automated collector and clipboard-path checks passed. Visual and real-device acceptance remain exclusively with the user.

## Real-device report and raster coverage bridge

The user's schema-v2 report recorded a 948ms, approximately 5.95× zoom-in gesture. This particular run used 10m detail, no bathymetry or relief, Canvas worker with bitmaprenderer, and no highlighted paths. Preview entered at 78ms with no exit or re-entry during the gesture; it exited after release at 950ms. The renderer switched to SVG at 194ms and remained SVG at capture. The longest matched worker round trip was 1,115ms. Only five RAF samples were captured, all before that renderer transition; the zero sampled SVG frames therefore do not mean no fallback occurred. Long-task observation was unsupported.

This does not support preview-mode flapping as the explanation for that run. The renderer change and delayed replies are the useful evidence. Inspection found that the experiment still enforced the ordinary 2× bitmap magnification guard during fast zoom, defeating the cached proxy on sufficiently large zooms even when the bitmap still covered the viewport. The report does not identify the exact guard branch taken, so the cause of every measured delay is not proven.

The revised touch trial can retain the sharpest available cached raster that covers the viewport while awaiting a replacement, including temporarily enlarged rasters. It bridges beyond release until a normal-density, unscaled replacement is available, showing Restoring detail. Coverage checks remain mandatory, coordinate-incompatible frames remain invalid, and the ordinary desktop sharpness guard remains unchanged. No new bitmap cache is introduced. Reports now also record actual proxy-display transitions, distinct from preview policy and source-density changes.

Pure selector/state checks verify ordinary magnification rejection, fast proxy retention, post-release bridging, normal-quality restoration, and rejection of uncovered viewports. This intentionally permits temporary softness and enlarged raster borders in the touch experiment; appearance and actual iPhone responsiveness remain exclusively for the user to evaluate. No visual testing was performed.

## Recommendation

Focus further investigation on bitmap availability during quick high-detail scaling and the cost of temporarily switching to full SVG rendering. The reproduced stalls coincide with fallback samples, but the current aggregate traces do not prove which internal operation causes every stall. Gesture updates are already batched and the workload posts no new scenes, so repeatedly rebuilding projection/scene data is not the demonstrated problem.

A useful next experiment would evaluate either predicting the next camera footprint to prepare a usable bitmap sooner, or using a lower-resolution moving frame followed by the existing sharp resting frame. The first can increase processing or bitmap memory; the second changes temporary sharpness. The adaptive-resolution option is now implemented as the experimental trial above; predictive camera footprints remain unimplemented. Preserve land coverage, full settled hit targets, keyboard focus, projection seams, quiz highlights, and the SVG fallback. Include default bathymetry, optional relief, selected-country/quiz overlays, and actual Safari/device acceptance before claiming a general mobile improvement.

## Reproduction and evidence

Use an existing Playwright installation and Chromium binary; no package installation is needed. Start a production preview, then run timed workloads sequentially:

```sh
PLAYWRIGHT_PACKAGE=/path/to/playwright BROWSER_EXECUTABLE=/path/to/chrome-headless-shell PROFILE_DEVICE=mobile-proxy PROFILE_RENDERER=canvas PROFILE_GESTURE_AUDIT=1 PROFILE_GESTURE_TRACE=1 PROFILE_TOUCH=1 PROFILE_WORKER=1 PROFILE_STRESS=1 PROFILE_LOW_PINCH=1 PROFILE_PINCH_OUT=1 PROFILE_GESTURE_INTERVAL_MS=16.667 node scripts/profile-map-browser.mjs http://127.0.0.1:4180/ 3 > /tmp/mobile-zoom-fixed.json
```

Add `PROFILE_PINCH_STEP=2` to reproduce the wider gesture; leave it unset for the normal range. Omit the interval setting for the earlier RAF-paced stress workload. Compact per-phase results, workload settings, browser version, and trial outcomes are preserved in [mobile-zoom-performance-results.json](mobile-zoom-performance-results.json).

The production build, profiling-script syntax check, and whitespace checks passed. No measured visible mobile performance improvement is claimed, and none of this follow-up work has been published.

## Touch panning follow-up

The user's next pinch report showed Canvas throughout, preview active until release, and a longest worker round trip of 146ms. The user confirmed that pinching now feels fast and responsive, but panning still lags. That report does not measure panning. The same raster coverage bridge is now enabled when a touch-first device crosses the existing one-finger drag threshold, with a Pan preview badge label. Desktop dragging is excluded. This is a small trial awaiting the user's device acceptance; no pan speedup is claimed from the pinch report.

## Combined pinch and pan logging

The same copy button now records whichever touch gesture completed most recently. One-finger panning starts recording only after the existing drag threshold; taps do not replace the report. A transition from panning to pinching closes the pan record and starts a separate pinch record. The existing suppressed lone-finger release after a pinch does not create a false pan. Schema `geo-go-go.last-gesture.v3` identifies the gesture, with a matching copied header. Pan reports include direction and relative camera displacement without absolute map position or touch coordinates. Timing, renderer transitions, worker replies, short settling capture, and latest-only in-memory retention are shared.

## Pan preview quality limit and device power state

The user supplied a pan report showing Canvas throughout, preview active throughout, a 72ms maximum worker round trip, median RAF gap 33ms, and maximum observed raster magnification 6.59. Their screenshot shows unacceptable enlarged pixels and borders, consistent with reusing a world overview at close zoom. The unlimited magnification bridge intended for fast pinch transitions now remains restricted to pinch-origin bridges; touch panning rejects frames magnified beyond the existing 2× guard, including after release. Reports include a bounded displayed-buffer history (detail/overview/settled, source density, magnification, proxy state) for confirmation.

The screenshot also shows a yellow battery icon. [Apple documents that this indicates Low Power Mode](https://support.apple.com/en-kw/101604), and [WebKit documents a 30fps RAF throttle in that mode](https://bugs.webkit.org/show_bug.cgi?id=168837). The repeated 33ms gaps are consistent with that throttle; this is a hypothesis for the steady cadence, not an explanation for all 54–76ms spikes or the excessive pixelation. A comparison with Low Power Mode off is needed before attributing the regular cadence solely to app rendering. Visual testing remains with the user.

## Low-power-off pan coverage follow-up

With Low Power Mode off, the user's 503ms pan moved about 332 camera units at fixed scale 6.18. Renderer changed to SVG at 138ms and returned to Canvas at 760ms; the largest worker round trip was 520ms. Preview remained active throughout. The earlier 33ms regular cadence changed to a 17ms median, but the long fallback remains a separate issue.

Touch-pan detail snapshots now use 3× viewport overscan at the same preview pixel density, with replacement requests beginning while 45% of a viewport remains rather than 8%. This creates more coverage runway without magnifying the overview. Non-touch rendering, normal resting density, and the pan magnification guard are unchanged. The larger crop may cost more per raster request, so real-device benefit remains for the user to assess; no visual testing was performed.

## User acceptance — 2026-10-07

After the wider pan crop and earlier refresh requests, the user confirms that touch panning is much better and that both zoom and pan are very much improved, tested with high detail. This is user-reported real-device acceptance, not an automated iPhone benchmark. Bathymetry testing remains pending; no additional visual testing was performed by the assistant. The current improvements and diagnostics are committed together before that further testing.

## Bathymetry-enabled pan trial

The user's 716ms high-detail pan with bathymetry stayed on Canvas and in preview mode, with a 137ms maximum worker round trip and RAF gaps up to 93ms. The two large gaps preceded displayed replacement frames, while no mode transitions occurred during those gaps. Bitmap preparation/handoff is a hypothesis, not an isolated timing measurement.

Bathymetry-enabled touch-pan previews now use a 0.75 density cap instead of 1 at the same 3× overscan: roughly 44% fewer raster pixels. Non-bathymetry preview density, bathymetry geometry, normal resting quality, other movement previews, and desktop behavior remain unchanged. This can look slightly softer during the drag and awaits the user's comparison; no speedup or visual acceptance is claimed yet.

## Bathymetry density trial rejected; stage timing added

The user still observed lag with 0.75-density bathymetry pan previews. Their report recorded 126/99ms gaps shortly before buffers displayed at 179/451ms, with no renderer fallback or preview exits. The density trial is reverted to 1. These timings do not isolate worker drawing, bitmap export, or main-thread handoff, so no further quality change is made.

Gesture reports now include bounded per-frame timings for worker draw/export and main-thread resize, bitmap transfer, and presentation updates, together with the existing round trip and relative receipt time. These are synchronous API wall times, not GPU/compositor profiling. The next device report can distinguish expensive worker calls from a costly receiving/presentation path. No visual testing was performed.

## Immediate detail-buffer handoff trial

The user's next report showed a detail frame received at 143ms with 69ms worker draw, 1ms export, and 1ms main-thread installation. Yet it was not displayed until 405ms, with Canvas changing to SVG at 146ms. The implementation deferred the buffer swap to another RAF callback, while painting the hidden buffer first reevaluated visibility against the old front buffer. That can enter expensive SVG fallback despite a replacement already being installed and covering the viewport.

A coverage-valid detail buffer is now selected in the same task as its installation, before presentation/visibility updates. Stale-version and viewport-coverage guards remain. No additional animation callback is required for the swap. Main handoff timings still include presentation updates. The user also perceived a small benefit from the 0.75 bathymetry-pan density, so that value is restored as a trial. No visual testing was performed.

## Bathymetry pan acceptance and restoration cleanup

The user considers the latest bathymetry-enabled high-detail pan acceptable. Canvas remained active throughout, with a 17ms median RAF gap, 27ms p95, and one 125ms gap near the first replacement frame. That frame took 102ms in worker drawing and 1ms in main-thread installation; this suggests remaining bitmap-production cost, but does not isolate GPU work or prove the cause of the gap. No vector-to-bitmap renderer transition occurred.

The report also showed an intermediate density-1 request after release before restoring density 2. Reduced-density requests now require an active touch gesture as well as preview mode, so restoration requests full quality directly. This small cleanup does not claim to remove the measured mid-gesture gap. Visual acceptance remains with the user.

## Mobile Reset view preview

The user reports adequate pinch performance but lag during Reset view. Animated camera zooms previously bypassed the speed-based preview because only the physical pinch state enabled it. On touch-first devices, camera animations now enable the same policy, including the raster coverage bridge and full-quality restoration when the animation ends. This also applies to existing animated region and country framing; desktop behavior and reduced-motion handling remain unchanged. The user will assess performance and appearance; no visual testing was performed.

The user's consecutive frames then showed an excessively enlarged world overview during Reset view and country framing. Animated zooms now have a separate preview input: they share the speed policy but retain the ordinary 2× magnification guard, including during restoration. The world overview always retains that guard, even during pinches; the relaxed pinch bridge applies only to recent detail/settled buffers. Mobile animations request the same wider 3× detail crop as touch pans to provide more coverage. If no acceptable bitmap covers the viewport, SVG remains the fallback. Device performance and visual acceptance remain with the user.

## Release acceptance and optional diagnostics

The user accepts the final mobile movement behavior, including high detail, bathymetry, Reset view, and country-framing animations. Version 0.11.0 — Smooth Sailing includes these improvements. Gesture recording and the mobile status/copy button are now enabled only with the `gesture-debug` URL query flag, independently of the existing `debug` map panel. Without the flag, touch events do not start a recorder, sampling RAF loop, long-task observer, or settling capture. The rendering preview remains available during normal use. Visual acceptance was performed by the user.
