# Performance audit — 0.8.0 — 2026-10-05

Status: First optimization approved and implemented; build and computational/browser comparisons complete. Real-device and visual acceptance remain with Joakim. Audit branch: `codex/performance-audit`; baseline: `92c3c3689dee6e82005d252c9f85457e5325ed6f`. TASK-005 records the remaining device acceptance and deferred follow-up.

## Findings and implemented change

The dominant measured initialization cost is repeated geographic-area calculation while finding the largest landmass in `src/logic/mapFocus.ts`. Its reduction evaluates both the candidate and the current largest polygon on every iteration. For a country with hundreds of islands, this repeatedly scans its complex mainland. This work runs on the main thread before the raster worker receives its scene, so switching renderers does not remove the initialization stall.

The implementation computes each candidate's area once, retains the winning area during the scan, and keeps the existing strict-greater comparison and first-polygon tie behavior. This is a local algorithm correction: no geometry simplification, new dependency, global cache, click-target change, or worker architecture change is needed. The implemented change preserves identical paths and focus outputs against the original release algorithm.

Across three Node repetitions, the implementation reduces high-detail Mercator projection from 3.34 to 1.16 seconds (65%). Its improvements apply to all five tested projections and also reduce low-detail and regional preparation. Browser comparisons show first high-detail activation falling from 3.86 to 1.82 seconds on desktop canvas and from 14.49 to 5.12 seconds on the mobile canvas proxy. These are local Chromium measurements, not a promised iPhone speedup.

Joakim reports a clearly noticeable desktop improvement, but little noticeable gain on his iPhone. Treat the mobile Chromium proxy gains as diagnostic evidence only; they have not translated into a confirmed phone improvement. Pan/zoom performance is the next separately authorized audit.

## Environment and method

- macOS arm64 host, Node 22.17.0, isolated headless Chromium 148.0.7778.96 using an existing bundled Playwright installation. No dependency or lockfile changes, signed-in browser access, screenshots, or visual acceptance testing.
- Production build served through `npm run preview`, with fresh browser contexts and HTTP cache disabled. Loopback serves gzip-compressed assets; response encodings and encoded sizes were checked. Download results exclude internet latency and mobile-network variability.
- Desktop: 1200 × 800 CSS pixels, DPR 1, unthrottled CPU. Mobile proxy: 390 × 844 CSS pixels, DPR 3, touch-capable viewport, 4× CPU throttling. The latter is not Safari or a calibrated iPhone model. [Chrome documents that CPU throttling is relative to the host and cannot truly reproduce mobile CPUs](https://developer.chrome.com/docs/devtools/performance/reference).
- Three sequential baseline repetitions per profile and renderer, with bathymetry and relief disabled to isolate land rendering; water names and the scale bar retain their defaults. Additional single-run checks enable desktop's default bathymetry, relief, trusted pointer sweeps, touch pan/pinch, and diagnostic worker instrumentation. These additional samples are not statistical medians.
- Startup ends after SVG countries exist, the interaction lock is clear, the requested renderer is active, and two animation frames have elapsed. This is a functional readiness bound, not a screenshot-confirmed first visible paint, LCP, or INP measurement. Rendering visibility and long-task/animation-frame observations are collected inside the page.
- Browser phases measure wall time, main-thread task time, layout/style time, long tasks, and animation-frame intervals. [Long tasks mean main-thread tasks of at least 50 ms](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongTaskTiming). Frame intervals are diagnostics; they do not establish device FPS. Driver round trips affect real pointer/touch timing.
- Baseline zoom dispatches 45 wheel events on animation frames; pan uses 45 trusted mouse moves, including in the mobile-sized proxy. Separate targeted mobile checks use actual TouchEvents via Chromium touch input and a 30-step two-contact pinch. Country activation uses keyboard Enter on Kenya's country path; physical island selection and visual gesture quality remain user acceptance work.
- Pure Node measurements run the actual application modules and projection composable at 1200 × 650. Source modules are transpiled in memory; initial module timings include that overhead and local data loading. Focus calls are timed separately. Node and browser timings are deliberately not combined.

## Browser baseline

Median milliseconds over three runs. First high-detail activation includes loading, rendering, and the existing blur/unlock transition. The largest long task shows the initialization stall that averages or frame percentiles can obscure.

| Profile | Renderer | Base-map readiness | First 10m activation | Largest 10m long task | Warm 10m return | First quiz entry | First Europe selection |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| desktop | canvas | 1253 | 3856 | 3034 | 67 | 193 | 78 |
| desktop | svg | 1075 | 3934 | 3055 | 81 | 371 | 159 |
| mobile-proxy | canvas | 4413 | 14492 | 12846 | 113 | 609 | 380 |
| mobile-proxy | svg | 3916 | 14660 | 12943 | 296 | 665 | 432 |

Europe's first selection occurs after the app has had time to prewarm its regional paths. It is a first UI selection, not a proven cold regional cache. The Node section separately measures cold regional preparation. Warm 10m return occurs after a zoom change; occasional garbage collection or SVG repainting still affects it.

The desktop baseline spends about 3.34 seconds of main-thread task time during first high-detail activation. A focused trace measures a 2.975-second microtask containing the synchronous update; layout totals about 12 ms and the largest individual layout is about 11 ms. Six 10m downloads finish roughly 0.48 seconds after activation starts on loopback. Compilation events are small in this trace, but they do not independently measure JSON parsing or all module evaluation; do not infer those phases cost zero. Node module loading and geometry assembly are separate diagnostics below. Trace categories overlap and must not be added together.

## Browser comparison after implementation

Median milliseconds over three sequential runs using the same production-preview workload and profiles. No application geometry, path counts or hit targets changed.

| Profile | Renderer | Base-map readiness before → after | First 10m before → after | Largest 10m long task before → after | Warm 10m before → after | Quiz before → after | Europe before → after |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| desktop | canvas | 1253 → 940 | 3856 → 1825 | 3034 → 995 | 67 → 67 | 193 → 168 | 78 → 78 |
| desktop | svg | 1075 → 830 | 3934 → 1874 | 3055 → 1039 | 81 → 77 | 371 → 363 | 159 → 160 |
| mobile-proxy | canvas | 4413 → 3225 | 14492 → 5116 | 12846 → 4225 | 113 → 184 | 609 → 611 | 380 → 387 |
| mobile-proxy | svg | 3916 → 2910 | 14660 → 5269 | 12943 → 4311 | 296 → 137 | 665 → 655 | 432 → 465 |

Cold activation improves by 52–65% across the four profiles; the largest long task improves by 66–67%. High-detail pan/zoom task time changes by roughly −7% to +1.3%; retained heap after collection remains about 76–83 MB. The single-pass calculation removes repeated work during preparation, so it does not promise faster steady-state gestures.

The first warm mobile canvas return is slower in this sequence (184 versus 113 ms), with higher layout/task time. This cannot honestly be described as an across-the-board improvement. A separate exact-release preview and optimized preview each ran seven additional warm cycles with garbage collection before each cycle: high-detail return medians were 101.5 and 103.3 ms, layout medians about 17.5 and 17.5 ms, and neither recorded a 50 ms long task. This shows no persistent penalty in controlled repeated switches, but does not establish the cause of the initial warm-return difference; garbage collection and later-cycle state are both different from the primary sequence. First warm return and Europe switching should be checked on Joakim's phone before release; do not add a speculative renderer change to conceal this result.

## Interaction and SVG hit layer

Task time measures the browser's main-thread work over each prescribed gesture, including drawing, event handling and supporting updates. It is not event latency per sample. These baseline values keep full visible-land hit geometry.

| Profile | Renderer | 50m zoom task ms | 10m zoom task ms | 50m pan task ms | 10m pan task ms | 50m / 10m hit-query ms |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| desktop | canvas | 228 | 385 | 180 | 192 | 21.1 / 42.1 |
| desktop | svg | 257 | 1639 | 188 | 1053 | 41.5 / 172.1 |
| mobile-proxy | canvas | 847 | 1507 | 602 | 649 | 50.6 / 131.2 |
| mobile-proxy | svg | 889 | 1651 | 613 | 721 | 73.7 / 508.2 |

Hit-query measurements execute 400 deterministic `elementFromPoint` calls in one batch at the current camera, not 400 ordinary user pointer events. They reveal a high-detail cost but should not be presented as real-world pointer latency. The desktop hit layer contains 679 path elements and about 19.8 million path characters after wrapping; the mobile-sized view contains 432 and about 13.2 million. Counts include wrapped copies, not unique countries or source vertices.

The targeted desktop high-detail hover sweep uses 129 ms main-thread task time with canvas versus 1,092 ms with SVG; its low-detail equivalents use 71 and 307 ms. The targeted mobile canvas touch pan uses 634 ms task time over 45 moves, and pinch uses 1,083 ms over 30 moves; neither shows a 50 ms long task in that sample. SVG equivalents use 697 and 1,177 ms. These are single Chromium samples, not phone acceptance results.

Canvas already provides a useful movement advantage. The SVG fallback, high-detail pointer work, and quiz switching remain secondary costs; reducing hit geometry would recreate the visible-but-unclickable island regression and is not recommended. Recheck them after removing the dominant calculation cost, preserving both renderers.

## Projection and focus diagnostics

Median milliseconds over three Node repetitions, comparing the released algorithm with the implemented change. Checksums cover projected path strings, separate outlines/divisions, display and focus bounds, and focus points for every returned unit.

| Operation | Baseline ms | Implemented ms | Output checksums |
| --- | ---: | ---: | --- |
| low | 375.2 | 236.0 | Identical in all three runs |
| high | 3338.4 | 1156.0 | Identical in all three runs |
| quizCold | 38.5 | 35.6 | Identical in all three runs |
| exploreCached | 0.0 | 0.0 | Identical in all three runs |
| europe | 386.2 | 113.1 | Identical in all three runs |
| naturalEarth | 3517.5 | 1163.5 | Identical in all three runs |
| miller | 3592.0 | 1200.1 | Identical in all three runs |
| winkel | 3719.9 | 1291.4 | Identical in all three runs |
| regional | 861.5 | 354.4 | Identical in all three runs |

Initial module setup: 156.9 ms; detailed module loading, validation and assembly: 199.1 ms. These Node values exclude browser download/paint and include diagnostic module-transpilation overhead. The high-detail focus subtotal is 2988.1 ms (about 89% of that projection's elapsed time).

The isolated largest-polygon scan for Canada (412 polygons) takes 812 ms with repeated area evaluation versus 6.8 ms with one evaluation per candidate; Russia's remainder (212 polygons) takes 474 versus 3.5 ms. Both select the exact same polygon object. This unusually large local improvement does not remove the remaining bounds, centroid, path-generation and geometry-validation work.

## Worker, payload and memory

A targeted worker wrapper measures high-detail scene preparation (Path2D parsing/reuse) at 20.5 ms, detail raster execution at 72 ms, and overview execution at 96.5 ms on the desktop host. Scene posting spends about 3 ms on the main thread. Ordinary worker round-trip timings are higher because they include queueing and main-thread message delivery; those delays are not pure worker CPU time. Worker timings are single diagnostic samples and do not represent iPhone GPU performance.

| Asset group | Gzip size |
| --- | ---: |
| Initial game JavaScript | 1.50 MB |
| Initial game CSS | 0.096 MB |
| Six detailed geometry modules together | 5.41 MB |
| Optional bathymetry | 2.44 MB |
| Optional relief | 0.409 MB |

The largest 10m atlas module is 10.83 MB decoded and 3.71 MB gzip; meaningful subunits add 3.67 MB decoded and 1.25 MB gzip. Download remains important on real connections even after the calculation fix. As an arithmetic estimate only, 5.41 MB takes about 4.3 seconds at 10 Mbit/s before latency and processing; this audit did not run a throttled-network field test. Any later data consolidation should first inventory unused/repeated geometry and preserve source/component/quiz and regional distinctions rather than replace everything with simplified country polygons.

After the measured sequence and explicit garbage collection, retained main-page JS heap is about 76–83 MB across baseline profiles. Heap readings before collection vary greatly and are not leak evidence. Canvas backing dimensions correspond to about 43.5 MB desktop / 39.5 MB mobile proxy at four nominal RGBA bytes per pixel, separate from JS heap. These are backing-size estimates, not total GPU/process memory; worker Path2D storage and additional surfaces are not included. No memory leak has been established.

Default desktop bathymetry is loaded after the base map: its additional 2.44 MB transfer takes roughly 0.28–0.35 seconds on loopback in the targeted samples. It raises SVG movement/hover cost; phones already default this layer off. Relief activation in the Europe view takes 206–274 ms desktop and 335–362 ms mobile proxy in the targeted runs, with a 220–227 ms long task on the proxy. Additional idle waits in those scenarios are settling windows, not measurements of time to readiness. Neither layer should be removed or silently downgraded as part of the first optimization.

## Ranked follow-up

1. **Single-pass area scan implemented.** Exact output checksums match for all 27 recorded operation pairs. An additional comparison of 5,710 feature/quiz/region/detail/projection combinations produces identical focus output. The target of at least 50% lower Node high-detail projection time is met (65%), and browser cold activation and maximum long task both improve materially. Warm-return variability remains documented above.
2. **Re-profile remaining focus traversals afterward.** Bounds and centroid work remains meaningful after the first change. Reusing already computed bounds when the focus feature is unchanged may be worthwhile, but measure its contribution before adding more logic.
3. **Investigate payload/retained data if network or phone memory becomes the limit.** Existing detailed imports preserve valuable semantic and regional shapes. A reproducible compiled display asset could avoid unused source data, but its pipeline and maintenance tradeoffs need a separate proposal backed by an inventory. Do not start by reducing coastline accuracy.
4. **Revisit SVG and quiz/region update costs using the faster baseline.** Preserve full hit targets, keyboard access, pointer correctness, and sharp settled frames; no speculative index or extra cache is proposed now.

Joakim approved the first optimization after reviewing the baseline. It is implemented locally; no changes have been committed, pushed, merged, or published. Further optimizations require a separate decision backed by measurements. The earlier release-page publication issue is separate from this performance work.

## Reproduction and remaining acceptance

Run from the repository root after a clean production build:

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4178 --strictPort
# In another terminal, point to an existing Playwright package and matching browser binary:
PLAYWRIGHT_PACKAGE=/path/to/playwright BROWSER_EXECUTABLE=/path/to/chrome-headless-shell node scripts/profile-map-browser.mjs http://127.0.0.1:4178/ 3 > /tmp/map-browser-profile.json
node scripts/profile-map-node.mjs > /tmp/map-node-profile.json
PROFILE_FOCUS_REF=v0.8.0 node scripts/profile-map-node.mjs > /tmp/map-node-original-focus.json
```

For targeted layer/hover/touch checks, set `PROFILE_LAYERS=1 PROFILE_TOUCH=1` and use one repetition. For worker execution and tracing, set `PROFILE_WORKER=1 PROFILE_TRACE=1 PROFILE_DEVICE=desktop PROFILE_RENDERER=canvas` and use one repetition. The worker wrapper runs only in the disposable diagnostic browser, never in the production bundle. Its timing messages are ignored by the application. The Node reference option loads the chosen Git revision of `mapFocus.ts` in memory while retaining current data and other modules. For an exact browser baseline, build a disposable checkout of the release and serve it on a separate port; set `PROFILE_BUILD_REF=v0.8.0` when profiling that server so metadata identifies its focus source. Run builds and timed workloads sequentially. For controlled repeated warm switches, use `PROFILE_WARM_REPEAT=7 PROFILE_DEVICE=mobile-proxy PROFILE_RENDERER=canvas` with one repetition; this deliberately collects garbage before each additional cycle and changes the workload.

Machine-readable baseline measurements are in `performance-baseline-0.8.0.json`; implementation comparisons and controlled warm checks are in `performance-results-0.8.0.json`. The primary twelve browser comparison runs and optional-layer/touch checks completed without page errors. One optional desktop/canvas sample overlapped a baseline build and was replaced with a sequential rerun; it is excluded from reported comparisons. Projection/bounds/focus checksums matched for all 27 operation pairs, and 5,710 additional focus cases matched exactly. `npm run build`, both diagnostic script syntax checks and whitespace checks passed; there is no permanent test suite. The initial game bundle grows by 54 decoded bytes / 13 gzip bytes, with unchanged geometry payloads. Instrumentation has some overhead, so future comparisons must use the same method. Network measurements, paint readiness, optional-layer runs and CPU proxies have the limits described above.

Still needed before release acceptance: real Safari/iPhone cold and warm measurements, lock/unlock behavior against production-like preview rather than Vite development HMR, visual acceptance of gestures and both map detail levels, and device process/GPU memory observations if available. Device comparisons should cover the same controlled scenarios and optional layers; verify no meaningful steady-state interaction regression and no geometry/identity/click-target changes. Joakim owns visual acceptance.
