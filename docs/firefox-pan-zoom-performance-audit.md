# Firefox pan and zoom investigation

Status: The user accepts the current desktop revision for commit; release and further device checks are not requested. Recorded: 2026-10-10. Browser testing is performed by the user.

The experiment flags described in the historical entries below have been removed. The current bordered-preview policy is automatic on desktop Firefox; gesture-debug remains available for optional diagnostics.

## Initial pan reports

Two user reports use desktop Firefox, the Canvas worker with bitmaprenderer, 10m detail, Mercator World view, Bathymetry on, and a 1688 × 937 viewport at device pixel ratio 2. The first pan has 287–310 ms worker draws, two renderer transitions, and RAF gaps up to 333 ms. The second pan has 407–409 ms detail draws, four renderer transitions, and RAF gaps up to 400 ms. Input handlers are at most 1 ms and measured bitmap handoffs at most 2 ms. Large RAF gaps overlap Canvas/SVG transitions; the first report also has a large gap without a transition. These observations identify a candidate but do not establish painting/compositing cost or causation.

## Earlier desktop pan refresh experiment

The normal 1.8× detail crop is replaced when only 8% of viewport width/height remains around the visible view. In the second report, the first replacement request is at approximately 245 ms, Canvas falls back at 313 ms, and the replacement arrives at 659 ms: only about 68 ms of lead time for a 414 ms round trip.

With `?gesture-debug&early-pan-refresh`, the desktop pan margin increases to 30%. Touch pan retains its existing 45% margin; raster density, crop size, zoom behavior, and animation behavior remain unchanged. The report records the experiment flag and desktop pan margin. The flag is ignored unless gesture-debug is enabled. Normal sessions retain the baseline policy.

The user should compare similar pans with the flag present and absent, checking perceived lag, Canvas/SVG transitions, RAF gaps, and worker activity. Faster worker drawing is not the intended effect; avoiding coverage loss while waiting is. The experiment is pending user evaluation, and no performance improvement is claimed yet. Wheel and automatic animation reports remain separate follow-up inputs.

## First experiment report

The user still observes lag with earlyPanRefresh enabled. This pan is at 2.01×, travels approximately 635 viewport units over 1170 ms, and has three highlighted paths, so it is not a controlled comparison with the earlier pans. The largest RAF gap is approximately 349 ms and precedes the Canvas-to-SVG transition at 354 ms. The detail request then takes 496 ms, including 492 ms of worker drawing; Canvas returns at 851 ms. There are only four recorded input events. Earlier refresh has not eliminated the reported lag or coverage loss. SVG fallback is therefore insufficient to explain the initial stall; browser-side profiling is the next proposed diagnostic rather than further refresh-margin tuning. No causal attribution or performance improvement is established.

## User Firefox profiler capture

The user supplied a local Firefox profile covering approximately 3.56 seconds, with the application page on content thread 23 and its raster worker on thread 24. Summing sampled thread-CPU deltas over matching call stacks gives approximately 1145 ms in worker drawScene, including 826 ms in OffscreenCanvas 2D stroke and 326 ms in fill. These are inclusive estimates, not independent wall-clock timings to add together. The worker code strokes country borders and division lines; Bathymetry is filled, so the expensive stroke samples are not evidence that Bathymetry itself is the dominant drawing pass.

The application main thread has approximately 631 ms of sampled CPU, including 234 ms under Vue flushJobs, 165 ms under patchElement, 74 ms under SVG path-value parsing, and 125 ms under WebRender Canvas image-key updates. SVG parsing includes path mounting via Vue and setAttribute. The renderer thread also shows image-copy work. These samples demonstrate costs missed by the short synchronous bitmap-handoff timer; they do not prove every observed pause has the same cause.

## Desktop movement preview experiment

With `?gesture-debug&desktop-preview`, fine-pointer desktop movement uses a 0.75 raster-density detail preview throughout pans, wheel zooms, and camera animations. The existing 1.8× crop and refresh timing are retained, and normal quality is requested directly after movement. Canvas/SVG coverage guards remain, so this trial does not guarantee no fallback. At the reported viewport, detail density falls from roughly 1.35 to 0.75, reducing bitmap pixels to approximately 31% while retaining the same source geometry. This targets both raster drawing and image-copy pressure; actual gains require user evaluation.

The flag is diagnostic-only, ignored without gesture-debug or on coarse-pointer devices. It leaves normal desktop and accepted mobile behavior unchanged. Test it without early-pan-refresh first to distinguish the experiments. Reports include desktopPreview and desktopPreviewPixelRatio. Browser testing and the comparison pan remain with the user.

## Combined preview and earlier-refresh report

The user supplied a pan with both desktop-preview and early-pan-refresh enabled. In this capture, worker draws are 77–99 ms, median RAF gap is 16.66 ms, p95 is 16.7 ms, and the largest gap is 133.36 ms. Renderer transitions still show a Canvas-to-SVG fallback at 875 ms and return at 995 ms, despite svgFallbackSamples being zero: the fallback occurred between recorded RAF samples. Absence of sampled SVG frames must not be interpreted as continuous Canvas coverage.

The run differs from previous captures in scale, selected highlight paths, and relative displacement; it is encouraging but not a controlled before/after measurement. User-perceived smoothness is pending feedback. No permanent rendering policy is selected yet; wheel zoom and camera animations still need user evaluation.

## Border-free desktop preview experiment

The user authorized isolating border stroke cost before the SVG-hit-layer experiment. Add no-preview-borders to gesture-debug and desktop-preview; early-pan-refresh can remain enabled for comparison with the combined run. The worker omits base country, context-country, and division-line strokes only for active desktop detail previews. Land, Bathymetry, Relief, geographic identities, hit geometry, and selection/highlight overlays remain unchanged. Overview and settled requests retain borders, and full-quality bordered detail is requested after movement. SVG fallback can still show borders.

The report records omitPreviewBorders as context and bordersOmitted on received and displayed frames. Border-free frames cannot count as sharp restored frames. The flag is ignored without the desktop preview experiment, and normal Chrome/iPhone rendering remains unchanged. The user should compare the same movement with and without no-preview-borders, checking worker draw times, RAF gaps, fallback transitions, and perceived lag. Evaluation is pending; this is diagnostic isolation, not a proposed permanent removal of borders.

## Border-preview acceptance and rapid re-drag fix

The user finds the border-free experiment smooth overall, but reports flashes of bordered rendering and lag when releasing and starting another drag immediately. One report proves a stale bordered detail requested before the gesture replaced the already displayed border-free preview at 124 ms; it took 432 ms to draw. A 192 ms bordered settled draw was also received and discarded during the gesture. The following border-free draw took 96 ms but had a 323 ms round trip, demonstrating queue/delivery delay beyond its draw time. An independent 350 ms RAF gap remains in this capture, so the report does not establish the cause of every stall or prove a wrap-seam defect.

The border-free trial now rejects late bordered detail replies during active movement and retains a usable border-free crop for re-drag. On release, it restores only the sharp settled viewport after the existing 180 ms quiet interval, avoiding simultaneous full bordered-crop and settled requests; a new gesture cancels an unsent settled timer. An already running worker draw cannot be interrupted by these changes. SVG fallback also omits ordinary border strokes during this experiment while retaining active selection/quiz outlines, preventing inconsistent line flashes when coverage is temporarily unavailable. Borders return at rest. The changes are gated by the diagnostic experiment and are pending user evaluation.

## Pan acceptance and wider zoom coverage

The user reports panning is now pretty smooth after the rapid re-drag changes. Wheel zoom still lags. One zoom-out from 5.91× to 2.68× over 424 ms loses Canvas coverage twice (120–241 ms and 252–411 ms), despite zero sampled SVG frames. Worker draws are 24–86 ms; one 33 ms draw takes 154 ms to arrive. The biggest measured RAF gap is 116.68 ms and overlaps the first fallback. These observations point to coverage and delivery during view expansion, rather than the original expensive border draws alone.

The desktop preview experiment now retains the accepted 1.8× / 0.75 pan crop and uses a 3× / 0.5 crop for zooms and camera animations. Relative to the previous zoom preview, the extra crop increases bitmap pixels by approximately 23%, rather than 178% at unchanged density. The texture is softer during zoom, while source geographic detail and the 2× magnification guard remain unchanged. Quality restores at rest; Chrome/iPhone normal rendering remains unchanged. Reports include actual cropOverscan on received/displayed frames and desktop zoom policy metadata. The user will evaluate wheel zoom using the same experiment URL before any permanent policy is chosen.

## Short wheel-burst cache reuse

The user finds zoom mostly smooth but reports occasional lag. One zoom-in begins with a cached border-free 3× crop already displayed at 1.96× magnification. It loses Canvas at 81 ms and returns via a cached bordered settled frame at 286 ms, before a new border-free detail arrives at 341 ms. An older 279 ms settled draw was discarded; the first new preview took 172 ms to draw but 332 ms to arrive. The original 2× detail limit creates a fallback cliff while that replacement is in flight.

During the border-free desktop wheel experiment only, current-scene border-free detail buffers installed within the last 1000 ms may be magnified up to 3.5× while they fully cover the viewport. This can briefly soften the image; it does not expose uncovered edges. Overview and settled buffer limits, accepted pan behavior, automatic-animation limits, and normal Chrome/iPhone policies remain unchanged. Reports identify the temporary wheel magnification and buffer-age limits. The change is pending user evaluation with the same flags; it does not cancel an already running old worker draw.

## Wheel report without sampled callbacks

A user report has seven input events over 280 ms, no diagnostic RAF callbacks, no camera change, and a 180 ms border-free draw. It cannot be treated as evidence of zero RAF gaps. The recorder now reports null gap statistics when no callbacks were sampled, the wait from the last callback or gesture start to gesture end, and vertical wheel-event counts plus normalized net/absolute deltas without pointer coordinates. This distinguishes callback starvation from zero vertical input or cancelling wheel deltas.

The input controller also flushes a pending RAF-batched wheel update before its 140 ms idle timer marks movement finished. This prevents a delayed camera update from occurring after the movement lifecycle has already ended. Ordinary bursts whose RAF update already ran are unaffected. Browser acceptance remains with the user.

## First-zoom preparation and restoration grace

The user reports initial zooms are worse and later interaction is smoother. A first zoom from 1× to 2.94× starts with a bordered detail buffer; an older 526 ms settled draw delays the border-free preview, which arrives at 376 ms. Canvas also drops to SVG at wheel end (499 ms) because the wheel-only magnification allowance expires before a final-scale bitmap arrives at 661 ms. This matches the benefit of having a suitable preview cached; it does not prove JavaScript JIT or browser warm-up is the cause.

The border-free desktop experiment now primes its 3× / 0.5 zoom crop as the first detail request for a new scene, before requesting settled quality. It can reuse a scene-valid primed crop for the first second of a wheel burst even if the crop was installed earlier; later in a long burst it requires a recently installed buffer. The same 3.5× allowance continues for up to 1000 ms after wheel end while bordered quality restores, preventing an immediate guard change from forcing SVG at release. Coverage checks and scene identity remain mandatory, the overview still has its 2× guard, and pan/animation policies are unchanged. Browser acceptance is pending with the same URL flags.

## Manual movement acceptance and Reset view pause

The user reports manual movement is now much smoother, with one remaining Reset view hitch. The animation report captures a 7.88× to 1× reset taking 1230 ms with an 866.74 ms RAF gap. Worker draws range from 31 to 224 ms, with replies received inside that callback gap. A smaller 150 ms gap overlaps a Canvas/SVG fallback; the largest gap is not accounted for by a single measured worker draw. This does not establish the exact browser task responsible.

The SVG interaction loop currently mounts and unmounts wrapped copies as the camera changes between one and both neighbors. The prior profiler demonstrated SVG path mounting/parsing costs. In the desktop-preview experiment, all wrapped hit copies needed at minimum zoom are now retained, with unused copies hidden via display:none. The active copy set, geometry, wrapping, click targets, markers, and painted highlight copies remain unchanged. This trades retention of some hidden SVG nodes for avoiding path reconstruction when zooming to World or crossing the wrap seam. Normal sessions and mobile policies retain their original DOM policy. Reset view evaluation is pending with the same flags.

## Fast-pan coverage and restoration deadline

The user reports continued improvement but catches a fast pan travelling approximately 1270 pixels in 282 ms. Worker draws are 40–43 ms, yet the last reply takes 287 ms and is discarded after it no longer covers the final viewport. Canvas falls back at 150 ms; the last callback-to-end wait is 132.8 ms, despite no large completed RAF gaps. The final captured renderer is still SVG. This supports coverage loss plus delayed frame delivery, rather than slow stroke rendering, as the immediate failure in this run.

The desktop experiment now uses the same 3× / 0.5 preview crop for pans and zooms. Relative to the earlier 1.8× / 0.75 pan crop, bitmap pixels increase by approximately 23%, with more translation coverage and softer motion detail. This also avoids switching bitmap dimensions between pan and zoom previews. Normal rendering remains unchanged.

Bordered restoration is now scheduled against the release deadline instead of waiting another 180 ms every time a late reply triggers scheduling. A settled draw for the same scene/camera cannot be duplicated while already pending. A new interaction still cancels an unsent restoration timer. Browser acceptance is pending using the same flags.

## Immediate wheel-to-pan handoff

The user supplies a pan immediately following zoom. Canvas drops to SVG at 5 ms and returns at 231 ms. The new pan image takes 55 ms to draw but 224 ms to arrive; RAF gaps of 133, 250, and 183 ms occur early in the run. Settled quality restores correctly at 1257 ms. The initial report lacks a displayed-buffer sample before the fallback, so it does not prove whether the cache lost coverage or exceeded its magnification limit. The policy does have a possible wheel-to-pan discontinuity: wheel previews can exceed 2×, while pans return immediately to 2×.

The border-free experiment now carries an already cached, scene-valid border-free wheel buffer into a pan started within 1000 ms of wheel input. It retains at most the magnification at pan start, for at most 1000 ms, and still requires complete viewport coverage. A fresh detail swap or pan end clears the carry. Ordinary pan limits, overview limits, and nonexperimental rendering remain unchanged. This targets the handoff without relaxing normal pan magnification or inventing new geometry. Evaluation is pending with the same flags.

## Automatic zoom-in cache bridge and fallback reasons

An automatic zoom from 1.15× to 5× takes 1243 ms and has RAF gaps of 150 and 717 ms overlapping SVG fallback transitions. Worker preview draws are 137–194 ms and additional replies arrive inside the long callback gap. The report lacks candidate coverage/limit details, so it cannot prove whether automatic movement lost coverage, exceeded the 2× detail guard, or incurred another browser task.

The desktop border-free experiment now gives automatic camera animations the same brief 3.5×, scene-valid detail reuse and restoration grace as wheel zoom. Overview, settled, and normal/mobile policies retain their existing limits. A following pan can retain the current cached animation preview without increasing its magnification, under the existing handoff time and coverage conditions. This is pending user evaluation.

Reports now include bounded fallback candidate snapshots: availability, eligibility, coverage, magnification, applicable scale limit, whether that limit was exceeded, and border-omission state. They contain no absolute camera or pointer coordinates. This distinguishes coverage failures from limit crossings directly rather than inferring a cause from transition timings alone.

## Russia highlight-stroke trial

The user reports that movement is very close to acceptable, with significant lag when clicking Russia. This animation remains on Canvas throughout, with no fallback candidates or renderer transitions. Its 14 sampled callbacks have a 50 ms median gap and a 200 ms maximum; only one moving raster arrives, at 211 ms, with a 205 ms worker draw and negligible synchronous main handoff. Slow callbacks continue after that reply. Three SVG highlight paths remain active, so bitmap coverage alone cannot explain the sustained cadence.

The border-free desktop experiment previously retained active selection and quiz coastline strokes. It now also omits those SVG strokes and their non-scaling-stroke calculations during movement, in both the Canvas highlight overlay and SVG fallback. Coloured selection/question/answer fills, tiny-country location rings, keyboard focus outlines, geographic identities, and hit geometry remain. Coastline strokes return at rest; normal sessions and mobile rendering are unchanged. Reports identify omitMovingHighlightStrokes. Detailed highlight painting is a hypothesis, not a proven cause; the user will compare Russia framing using the same experiment URL. No browser testing was performed.

## Acceptance and default activation

The user considers the final experiment acceptable, including Russia framing after omitting moving highlight strokes. Further tuning stops here. The accepted behaviour is enabled by default when the browser user-agent identifies Firefox and its primary input supports a fine pointer with hover; Firefox on iPhone and touch-first devices do not match this policy. This deliberately limits a measured browser-specific tradeoff rather than assuming the same changes benefit every browser. Chrome and existing mobile rendering policies remain in place.

The three independent experiment props and query switches are consolidated into one Firefox preview input. Cache coverage, scene validity, overview magnification, bounded zoom/pan carry, stale-reply rejection, and release-anchored settled restoration retain the accepted values. The diagnostic report now describes the active renderingPolicy instead of historical experiment switches; recording remains disabled without gesture-debug. Historical reports remain unchanged. No new dependency, setting, geometry simplification, or country-specific rendering branch is introduced.

The user should reload the plain development URL and briefly check Firefox pan, wheel zoom, Reset view, and Russia framing, including outline restoration, plus a Chrome/iPhone regression check. Both map detail levels and quiz highlights remain subject to the user's browser acceptance. No agent browser testing was performed. Changes remain uncommitted and unpublished.

The default-activation build and whitespace checks passed. The existing bundle-size warning remains; browser acceptance is pending with the user.

## Restored movement borders

The user clarified that removing country lines during movement was not the intended tradeoff. Base-map borders and selected-country/quiz outlines now remain visible throughout movement. The worker always draws the border passes, and the CSS rule suppressing SVG coastline strokes is removed. Wider 3× / 0.5-density previews, early refresh, cache reuse, coverage guards, and full-density restoration remain in place.

The cache identifies moving snapshots through an explicit movementPreview field rather than treating omitted borders as the indicator of a reusable low-density crop. Worker replies preserve that metadata, so priming, front/back preview preference, zoom/pan carry, stale full-density reply rejection, and settled restoration remain functional with visible borders. Diagnostic border-omission fields now report false. The user will check the revised appearance and performance; the earlier border-free acceptance does not establish responsiveness for this version. Changes remain uncommitted and unpublished.

The restored-border build and whitespace checks passed; browser performance and appearance remain unverified by the agent.

## Chrome appearance follow-up

The user reports degraded appearance in Chrome as well as Firefox. A source comparison confirms that the 0.5-density, 3×-crop preview and relaxed cache reuse are gated to desktop Firefox, while worker border drawing matches the released implementation. This does not establish the cause of the reported Chrome regression; whether it affects motion, settled quality, borders, or colours is still being clarified.

The remaining shared changes to pending-settled-request deduplication and wheel-idle flushing are restricted to the Firefox policy. Additional camera-copy dependencies in the country memo loop are likewise active only for Firefox; non-Firefox magnification evaluation immediately returns its released 2× guard. This restores those non-Firefox code paths to their previous policy without claiming that any one of them caused the appearance problem. Browser verification remains with the user.

The user reports that the latest revision is better and requests a commit. The latest build and whitespace checks passed. This is user-reported desktop acceptance; no agent browser testing or fresh iPhone acceptance is claimed. The work is saved on the feature branch without merging, pushing, or releasing.
