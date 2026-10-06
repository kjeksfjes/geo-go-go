# Pan and zoom performance audit — 2026-10-05

Baseline: `f316114`, the committed loading optimization on `codex/performance-audit`. The measured hit-path styling and immediate mouse-drag update are implemented locally and accepted by the user as a small perceived improvement. Application changes and audit files remain uncommitted; no merge, push or release has been requested.

## Method

The existing production-preview harness ran three sequential repetitions for desktop/mobile proxy and canvas/SVG, with fresh disposable Chromium contexts, bathymetry/relief off and the default scale bar/water names enabled. Desktop is 1200 × 800 DPR 1; mobile proxy is 390 × 844 DPR 3 with 4× host-relative CPU throttling. These are local Chromium diagnostics, not Safari, real-device FPS, LCP or INP. No signed-in browser access, screenshots or visual acceptance was performed.

Zoom dispatches 45 wheel events at animation-frame intervals with delta −8. Pan uses 45 trusted mouse moves on desktop and real Chromium TouchEvents on the mobile proxy, each moving two CSS pixels per step. Pinch uses 30 two-contact touch moves. Phase measurements include the existing 300 ms settling window and readiness check; task time is total main-thread work for the whole prescribed sequence, not latency per input. Driver round trips and instrumentation influence cadence. RAF p95 records callback intervals, not proof of visible compositor frames.

Traced single runs separately record Chromium main-thread Layout/Paint/HitTest/EventDispatch and worker handler elapsed time. Trace categories nest and overlap, so their totals must not be added together. Worker elapsed time includes drawing and bitmap transfer; it is not a calibrated GPU measurement. The mobile trace's main-thread throttle may also influence scheduling, and worker timings must not be interpreted as real iPhone rendering times.

Browser-only experiments freeze the SVG interaction group's transform or override styling in disposable contexts. Freezing is intentionally incorrect interaction geometry during movement and is only a causal diagnostic, never an implementation proposal. Ordinary baseline geometry, click targets and game semantics remain unchanged.

## Controlled gesture baseline

Medians across three repetitions. Low means 50m and high means 10m. All twelve runs completed without page errors. All ordinary canvas gestures stayed in canvas mode at sampled animation frames and posted zero new scenes; SVG profile samples are deliberately always SVG and must not be described as canvas fallbacks.

| Profile | Renderer | Phase | Main-thread task ms | Layout ms | RAF interval p95 ms | Detail worker requests |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| desktop | canvas | lowZoom | 223 | 57.5 | 9.0 | 2 |
| desktop | canvas | lowPan | 171 | 2.0 | 9.1 | 1 |
| desktop | canvas | highZoom | 380 | 205.0 | 8.8 | 2 |
| desktop | canvas | highPan | 178 | 3.4 | 8.8 | 1 |
| desktop | svg | lowZoom | 259 | 61.8 | 9.1 | 0 |
| desktop | svg | lowPan | 193 | 1.9 | 9.2 | 0 |
| desktop | svg | highZoom | 1570 | 228.4 | 42.3 | 0 |
| desktop | svg | highPan | 997 | 3.3 | 16.8 | 0 |
| mobile-proxy | canvas | lowZoom | 871 | 212.5 | 25.2 | 2 |
| mobile-proxy | canvas | lowPan | 559 | 5.0 | 9.2 | 1 |
| mobile-proxy | canvas | highZoom | 1450 | 780.6 | 34.2 | 2 |
| mobile-proxy | canvas | highPan | 591 | 7.8 | 9.2 | 1 |
| mobile-proxy | canvas | highPinch | 986 | 501.9 | 25.5 | 2 |
| mobile-proxy | svg | lowZoom | 877 | 238.2 | 24.9 | 0 |
| mobile-proxy | svg | lowPan | 585 | 4.1 | 9.2 | 0 |
| mobile-proxy | svg | highZoom | 1622 | 845.5 | 41.1 | 0 |
| mobile-proxy | svg | highPan | 639 | 5.9 | 9.3 | 0 |
| mobile-proxy | svg | highPinch | 1072 | 529.6 | 25.4 | 0 |

The dominant measured high-detail canvas zoom cost is browser layout, rather than JavaScript handlers or scene preparation. The mobile proxy spends about 781 ms in layout across 45 zoom steps, versus 8 ms during the translation-only pan. Its 30-step high-detail pinch spends about 502 ms in layout. A traced run confirms about 777 ms zoom layout (largest individual layout 19 ms), while HitTest totals about 7 ms. High-detail zoom posts no scene changes and only two detail requests, so repeatedly rebuilding the worker scene is not the cause of the main-thread layout cost.

Canvas movement already batches camera changes per animation frame and reuses cached projected paths. The default renderer's pan cost grows little between detail levels; the desktop SVG fallback has substantially more painting work during high-detail movement. Keyboard highlight and selected-country overlays may add cost in other views and require acceptance coverage in any later implementation.

## Further measurements and recommendation

Three matched mobile-canvas repetitions of each browser-only experiment isolate the interaction layer:

| Mobile canvas operation | Baseline task / layout ms | Frozen hit transform task / layout ms | Invisible hit-path styling task / layout ms |
| --- | ---: | ---: | ---: |
| 50m zoom | 871 / 213 | 621 / 25 | 652 / 36 |
| 10m zoom | 1450 / 781 | 633 / 29 | 635 / 39 |
| 10m pinch | 986 / 502 | 459 / 22 | 505 / 33 |
| 10m pan | 591 / 8 | 577 / 25 | 573 / 6 |

The styling experiment injects `.world-map--canvas .country--hit-only:not(:focus-visible) { vector-effect: none !important; }` into the disposable browser. Ordinary country paths inherit `vector-effect: non-scaling-stroke` even when their fill and stroke are disabled for the canvas interaction layer. Changing that unused stroke policy sharply reduces layout work while letting the full SVG geometry continue to move correctly. This is experimental evidence from Chromium, not a claim that every browser uses the same internal algorithm. The retained `:focus-visible` exception preserves the existing keyboard focus outline policy. Painted canvas borders, separate highlight paths, country outlines and the SVG fallback are outside the injected selector.

The styling experiment reduces total high-detail zoom task time by 56% and pinch task time by 49%; high-detail layout falls by about 95%. RAF interval p95 falls from 34.2 to 18.3 ms during zoom and 25.5 to 10.2 ms during pinch. These are instrumented callback intervals, not promised device frame rates. All three baseline and styling runs return the same 118 land hits from the deterministic 400-point high-detail batch; SVG country path counts and characters are unchanged. These checks do not replace physical small-island selection or keyboard-focus acceptance.

A desktop canvas styling check also lowers high-detail zoom task work from the baseline median 380 ms to 178 ms, with layout falling from 205 to 10 ms. This is one targeted sample, not a three-run comparison. Pan remains near the original result (173 versus 178 ms).

A separate single mobile-canvas stress run uses 120 wheel events at delta ±16, followed by touch pan/pinch, covering zoom in and out at both detail levels. At sampled RAFs no SVG fallback occurred, no gesture posted a new scene, and no 50 ms long task was recorded. High-detail zoom-in/out each spends about 2.0 seconds in aggregate layout work across the longer sequence, with 10–12 detail worker requests. The highest recorded frame intervals are about 42 ms. A lack of long tasks does not establish smooth animation: many tasks smaller than 50 ms can still miss frames. This workload does not cover arbitrary projection seams or every rapid real-device gesture.

A targeted single desktop run with default bathymetry keeps canvas high-detail zoom/pan task work around 393/199 ms, versus the land-only medians 380/178 ms. The SVG fallback with bathymetry is substantially more expensive: 2,668/1,786 ms. A later Europe view with bathymetry and relief takes 225/126 ms for canvas zoom/pan and 1,188/801 ms for SVG. Those Europe values use a different camera and regional geometry, so they cannot isolate relief's incremental cost or be compared directly with the world medians. Optional-layer canvas movements also post no new scenes and stay in canvas mode at sampled frames.

Repeating the long mobile stress sequence with the candidate styling reduces high-detail zoom-in task time from 3811 to 1831 ms and zoom-out from 3714 to 1981 ms. The candidate records three SVG samples during high-detail zoom-out and 152–201 ms maximum long tasks during high-detail zoom-in/out, despite lower aggregate work; the baseline stress run records no 50 ms long task. The RAF-paced event schedule runs faster when layout is cheaper, so it is not a matched input-frequency experiment. Faster camera updates may expose worker/frame availability limits, but the untraced candidate run does not establish the cause of every stall. No page error occurs. This is a single targeted comparison and does not establish the cause of each recorded stall. Neither trace provided useful JavaScript call stacks for its layout events, so the causal styling/frozen-transform comparisons are stronger evidence than inferred callers from the trace.

### Trialed optimization and remaining investigation

The trial applied a narrow canvas-only `vector-effect: none` rule to invisible country hit paths and explicitly restored `non-scaling-stroke` for focus-visible paths. The application currently uses the candidate styling again for production-preview acceptance. This matches the measured browser styling experiment. This changes a redundant stroke policy rather than geometry or target coverage, has a small maintenance footprint, and has a measured causal benefit. Keep the existing SVG fallback and painted borders unchanged. The build and focused measurements pass, and the user accepts the small perceived improvement in production preview. The Chromium figures do not establish equivalent iPhone gains.

Do not start with simpler hit geometry, reduced coastline detail or another cache. Pan is comparatively inexpensive in the default renderer, actual hit-testing time is much smaller than scaling layout cost, and no repeated scene construction was observed. If movement still feels slow on the phone after the styling change, measure worker/presentation behavior on that device and complex selected-country overlays before changing overscan, frame freshness or pixel density. Those policies protect coverage and sharp settled frames.

## Reproduction

Build and serve with `npm run build` and `npm run preview -- --host 127.0.0.1 --port 4178 --strictPort`, then use an existing Playwright package and matching headless Chromium binary:

```sh
PLAYWRIGHT_PACKAGE=/path/to/playwright BROWSER_EXECUTABLE=/path/to/chrome-headless-shell PROFILE_GESTURE_AUDIT=1 PROFILE_TOUCH=1 node scripts/profile-map-browser.mjs http://127.0.0.1:4178/ 3 > /tmp/gestures-baseline.json
```

For causal experiments add `PROFILE_DEVICE=mobile-proxy PROFILE_RENDERER=canvas` and either `PROFILE_FREEZE_HIT=1` or `PROFILE_HIT_SCALING_STROKE=1`; use three repetitions. The frozen-transform experiment deliberately breaks target alignment during a gesture and must never enter the application. For traced diagnostics add `PROFILE_WORKER=1 PROFILE_GESTURE_TRACE=1`; run once because trace overhead changes timing. `PROFILE_LOW_PINCH=1` adds a low-detail pinch phase, altering later camera state. `PROFILE_STRESS=1` enables the longer zoom-in/out sequence. `PROFILE_LAYERS=1 PROFILE_LAYER_GESTURES=1 PROFILE_DEVICE=desktop` measures default bathymetry and later Europe relief movement. Run timed workloads and builds sequentially.

Machine-readable movement results are in `pan-zoom-performance-results.json`. The audit-only commit was undone at the user’s request while retaining its files; the accepted implementation and audit evidence remain local. Nothing has been pushed or published.

## Final validation and acceptance

The implemented changes remove unnecessary non-scaling stroke calculations from invisible canvas hit paths while preserving focus-visible outlines, and apply the first mouse-drag update immediately after its existing threshold. Subsequent movement remains RAF-batched; full geometry, click suppression, pan bounds, touch takeover and renderer policies are preserved.

Focused pointer-start measurements compare both stroke policies in production preview and development mode at both detail levels, starting over Canada, Algeria and ocean. First-camera-update medians are about 10 ms in preview and 14–17 ms in development in that workload. Additional bathymetry on/off checks use a 1600 × 900 DPR 2 viewport with canvas and SVG. With bathymetry enabled, the immediate-start change lowers canvas first-update medians from 10.1/10.7 ms (50m/10m) to 7.6/7.8 ms; SVG checks also complete at both detail levels. These are DOM mutation and next-RAF timings, not visible compositor or Safari latency. Results are retained in `pan-start-comparison.json` and `bathymetry-pan-start-comparison.json`; the focused harness is `scripts/profile-pan-start.mjs`.

`npm run build`, diagnostic script syntax checks and whitespace checks pass. The user notices a slight perceived gain in production preview and accepts the current behavior. No additional visual testing was performed by Codex. No further performance investigation is pending; the existing measurements remain diagnostic evidence, not a promise of equivalent gains on every device.
