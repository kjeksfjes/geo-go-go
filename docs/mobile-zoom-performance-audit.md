# Mobile zoom performance audit — 2026-10-07

Baseline: 0.10.0 (`f81c853`) plus the pending quiz-hover fix and Asia region cleanup. The renderer was restored after all three trials; no rendering optimization is retained. A subsequent input-path cleanup shares one live viewport measurement between both pinch contacts. The existing pending changes are preserved. This follow-up investigates the user's renewed concern about mobile zoom responsiveness after the earlier accepted pan/zoom improvement.

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

## Recommendation

Focus further investigation on bitmap availability during quick high-detail scaling and the cost of temporarily switching to full SVG rendering. The reproduced stalls coincide with fallback samples, but the current aggregate traces do not prove which internal operation causes every stall. Gesture updates are already batched and the workload posts no new scenes, so repeatedly rebuilding projection/scene data is not the demonstrated problem.

A useful next experiment would evaluate either predicting the next camera footprint to prepare a usable bitmap sooner, or using a lower-resolution moving frame followed by the existing sharp resting frame. The first can increase processing or bitmap memory; the second changes temporary sharpness. Neither has been implemented or validated here. Preserve land coverage, full settled hit targets, keyboard focus, projection seams, quiz highlights, and the SVG fallback. Include default bathymetry, optional relief, selected-country/quiz overlays, and actual Safari/device acceptance before claiming a general mobile improvement.

## Reproduction and evidence

Use an existing Playwright installation and Chromium binary; no package installation is needed. Start a production preview, then run timed workloads sequentially:

```sh
PLAYWRIGHT_PACKAGE=/path/to/playwright BROWSER_EXECUTABLE=/path/to/chrome-headless-shell PROFILE_DEVICE=mobile-proxy PROFILE_RENDERER=canvas PROFILE_GESTURE_AUDIT=1 PROFILE_GESTURE_TRACE=1 PROFILE_TOUCH=1 PROFILE_WORKER=1 PROFILE_STRESS=1 PROFILE_LOW_PINCH=1 PROFILE_PINCH_OUT=1 PROFILE_GESTURE_INTERVAL_MS=16.667 node scripts/profile-map-browser.mjs http://127.0.0.1:4180/ 3 > /tmp/mobile-zoom-fixed.json
```

Add `PROFILE_PINCH_STEP=2` to reproduce the wider gesture; leave it unset for the normal range. Omit the interval setting for the earlier RAF-paced stress workload. Compact per-phase results, workload settings, browser version, and trial outcomes are preserved in [mobile-zoom-performance-results.json](mobile-zoom-performance-results.json).

The production build, profiling-script syntax check, and whitespace checks passed. No measured visible mobile performance improvement is claimed, and none of this follow-up work has been published.
