# Changelog

Concise, user-facing notes for local releases. Add an **Unreleased** section when there are upcoming changes, then replace its heading with the versioned release heading before publishing.

## Unreleased

### Improvements

- Add a Norway county map with Explore, Find the county, and Name the county modes, all 15 counties, bilingual controls, shared quiz behavior, and a view that hides the rest of the world.
- Import official 2026 county boundaries, clipped to the atlas coastline, with lazy-loaded high-detail geometry, Canvas/SVG rendering, touch and keyboard navigation, small-county markers, and source attribution.
- Restore the shared settings panel for county maps, remove browser selection rectangles and quiz hover tooltips, and display all 15 county coats of arms in cards and answers.

- Keep water names hidden in Norway counties mode, with the setting disabled there.

- Smooth county selection by keeping the projection stable while the camera animates; honor the automatic zoom limit. Deselecting closes the card without moving the map.

- Cap automatic county zoom at a wider level between the fitted Trøndelag and Nordland views, even after manually zooming closer.

- Always use the finer county geometry and disable the High detail switch in county mode with an explanation.

- Add USA states with Explore, Find, and Name quizzes for all 50 states, locally bundled state flags, English/Bokmål names and search aliases, and no foreign land or territories.
- Share county/state map behavior, use marked Alaska/Hawaii insets with region-aware scale bars and zoom limits, and keep the shared settings panel with explanations for fixed-layout controls.

- Align the revealed-answer label with state/county names and flags or crests, and correct shared Name quiz layout selectors.

## 0.22.0 — Waterline Workshop — 2026-10-18

### Improvements

- Add a local development water-name editor with draggable placements and curve points, rotation, font sizes, letter spacing, horizontal/stacked layouts, bilingual wording and manual line breaks, undo/redo, browser autosave, and portable draft import/export.
- Save validated water-name edits directly to the maintained project file through the local development server, with atomic writes and conflict checks. Editing and project-save tools stay out of production builds.
- Add and remove names, repeat a name in multiple independently positioned placements, or split it into bilingual text parts. Share typography across placements and highlight approximate Natural Earth water boundaries as geographic guidance.
- Align curved names to the left, center, or right of their paths; preserve older saved positions until changed. Let edited endpoints follow their neighboring curves automatically.
- Integrate the user’s water-name placements, sizes, spacing, and English/Norwegian text refinements, including separate North and South Atlantic Ocean names.
- Give map cards larger flags, full-width quiz feedback beneath the header, and compact country details beneath the name; scale flags for narrow screens.

### Fixes

- Prevent water names from disappearing when resizing, changing layout, or switching duplicate placements; preserve their reference font size while moving and reshaping them.
- Measure rendered letter spacing to prevent Safari from clipping curved names, and use explicit font-relative baseline alignment for more consistent mobile and desktop placement.
- Preserve recoverable browser drafts after source changes, recognize the previously integrated draft, and allow clearing saved stacked text to restore automatic wrapping.

### Security

- Update the transitive `source-map-js` dependency to fix a denial-of-service vulnerability when build tooling processes malicious source maps (GHSA-68fv-2mgg-jv7q).

## 0.21.0 — Shared Horizons — 2026-10-17

### Improvements

- Share Explore map views with links containing position, zoom, region and projection. Add local development commands to show an animated view or read the last settled view in the most recently focused connected map tab, without changing its URL.

## 0.20.0 — Waterways Revealed — 2026-10-17

### Improvements

- Refine smaller water labels: center the Magellan curve, straighten and enlarge Marmara, reposition and enlarge Taiwan, extend the Bosporus baseline, stack Korea Strait west of Tsushima, and enlarge Cook Strait.

- Give Sea of Japan a stronger S-curve, reverse the Laccadive Sea bend, and enlarge Boknafjord along a longer curved water corridor.

- Give Sognefjord a gentle bend that rises through its middle and flattens toward the east; refine the restored Trondheimsfjord and Gulf of Ob baselines to follow their water corridors.

- Restore placements for all 15 previously hidden water names, following narrow passages and fjords with prepared geographic guides. Let their names use the available path length instead of restrictive coast-width font caps, accepting some coastline contact for readability. Check that every imported water label has a prepared placement.

- Keep language switching visible in the mobile header and add English/Norsk choices to the introductory help invitation.

- Simplify the first three guide steps in Norwegian and English, including the touch navigation equivalent.

- Remove the temporary water-label collision debug flag and overlay.

## 0.19.0 — Northern Names — 2026-10-17

### Improvements

- Update 101 Norwegian water names: apply 47 documented alternatives, then localize 54 remaining labels using reviewed Norwegian proper-name stems and water terms. Keep constructed forms and their evidence distinct in the audit.
- Keep water names visible independently when they overlap, including seas within larger oceans. Preserve geographic placement and map-edge clipping.
- Separate Sargasso Sea and Atlantic Ocean labels, and let Norwegian Sargassohavet break over two lines within its shifted water bounds.
- Add an opt-in `?water-label-debug` diagnostic that marks overlapping letter bounds and lists likely collisions after map movement settles.

## 0.18.0 — Coastal Lettering — 2026-10-13

### Improvements

- Scale water names directly with the map, including mobile world views, instead of resizing names to fit the zoomed viewport. Keep partly visible names geographically anchored and clip them at the map edges; collision checks use the visible portion.
- Prefer centered horizontal, balanced two-line names in broad waters, and meaningful curves or angles along directional water corridors. Refine placement for the Mediterranean, Red Sea, Persian Gulf, Foxe Basin, and northern seas.
- Base sea-label size tiers on geographic water area, keeping similarly sized seas comparable and avoiding polar projection exaggeration. Retain prepared water-space limits for coastline clearance.
- Prepare placement decisions offline against both detail levels, keeping runtime layout compact. Hide narrow waters without a prepared placement rather than enlarging names across land.

## 0.17.0 — Atlas Tides — 2026-10-13

### Improvements

- Give water names an atlas-style treatment with self-hosted EB Garamond Italic and weight 600 for large ocean names. Most sea names follow prepared geographic guides, with gentle curves where natural and refined placement for narrow or awkward waters.
- Measure actual text widths, grow names moderately with zoom, and fit them to available screen space. Keep large ocean names straightforward, let fitting sea names appear without imported minimum zoom cutoffs, and keep preferred reading directions stable when zooming.
- Refine guides and placement for Chesapeake Bay, Yucatán Channel, Strait of Magellan, Drake Passage, Foxe Basin, Seram Sea, Dampier Strait, White Sea, and Red Sea.
- Hide all water names in both quiz modes to avoid revealing country answers. Explore restores the saved Water names preference; Quiz settings explain why the switch is disabled.
- Give water names a separate SVG overlay and hide it with opacity on mouse-down and during movement, preserving label layout outside the interactive map. Restore names after release when the map is idle, including releases outside the map.
- Extend opt-in mouse-pan diagnostics with startup timings from pointer-down through the first move, drag threshold, camera change, and RAF callback, including handler durations and event timestamp ages.

## 0.16.0 — Southern Reach — 2026-10-11

### Improvements

- Restored Antarctica as non-interactive background land in both map detail levels and renderers, without adding country selection, quiz answers, or region membership.
- Allow panning south to Antarctica’s projected bottom edge while preventing a gap below it when zooming out; preserve the world overview framing.
- Keep the map position within its pan limits when reaching minimum zoom instead of resetting the view.
- Limit downward panning to the map’s projected northern edge to avoid a large empty area above it.
- Hide artificial date-line borders on wrapped Mercator and Miller maps, including Russia and Antarctica, while keeping real coastlines and country outlines.
- Keep hover colouring consistent across wrapped map copies by leaving Canvas hit areas unpainted.
- Fill wrapped ocean and bathymetry copies together to remove the thin antialiasing seam between them.

## 0.15.0 — Quiet Compass — 2026-10-11

### Improvements

- Added optional contextual quiz tips for touch and keyboard shortcuts and automatic answer reveal, triggered by repeated actions on separate questions. Tips stay nonmodal, remember explicit dismissals, and offer a global opt-out in Quiz settings. Clear per-hint rules count three successive relevant actions, reset on shortcut use, prioritize recent actions, and space hints by at least 20 seconds and three completed questions.
- Switch proportional-region views under a blurred map with a centered loader shown for at least two seconds, without animated panning or zooming. Crossfade the previous blurred map over the new view to soften the change.

## 0.14.0 — Fox Trot — 2026-10-10

### Improvements

- Improved desktop Firefox pan, wheel zoom, and automatic camera framing with wider cached movement previews, earlier refreshes, and smoother transitions between gestures. Country borders and quiz highlights remain visible during movement; full-density detail returns at rest. Chrome and mobile retain their existing rendering policies.
- Apply any remaining Firefox wheel movement before ending a wheel burst, avoiding delayed camera changes after the interaction has finished.
- Extended the opt-in gesture-debug copy button and movement recording to desktop mouse pans, wheel zooms, and automatic camera animations, alongside existing touch gestures. Reports identify input source and movement kind and retain the existing bounded, local-only timing and renderer diagnostics.

## 0.13.0 — Island Signals — 2026-10-08

### Improvements

- Start a fresh round in the selected region whenever entering a quiz. Leaving a quiz ends its round, with confirmation once a question has been answered or skipped, instead of preserving paused rounds and restoring older regions.

- Kept wheel zoom anchored to the pointer near regional minimum zoom, avoiding unintended recentering away from countries such as Federated States of Micronesia.

- Kept regional quiz countries reachable when zooming by expanding navigation limits around their focus points and resolving wrapped positions before clamping, fixing Oceania framing for Marshall Islands and Samoa.

- Merged overlapping Name the country location rings and added a temporary Ring grouping slider with a live ring count in the debug panel for visual tuning.

- Added hollow Name the country location rings around scattered tiny landmasses, such as Kiribati, without revealing country names or creating new quiz identities. Question cues remain available at fitted zoom levels.

- Added a remembered Country markers switch at the top of Quiz settings. Markers stay hidden in the world overview and appear from 2× zoom in global projections or in fitted Regional Equal Area region views, while country shapes remain clickable.

- Matched “Always show” to the font size of the other inline quiz reveal controls.

- Added a desktop and mobile transition that separates numbered groups into small country dots with a clockwise stagger before zooming, with the dots following their countries during the zoom and reduced-motion preferences respected.

- Kept country markers and their tooltips above water-name labels in both map renderers.

- Clarified Find the country markers with numbered zoom groups with faint area circles around their country targets, distinct filled selection dots for individual countries, compact action labels on hover or keyboard focus, and lighter temporary dots that briefly mark newly enlarged countries, then fade away within three seconds.

## 0.12.0 — Guided Horizons — 2026-10-07

### Improvements

- Added an optional four-step map and quiz guide with a permanent Help button, a dismissible first-visit invitation, English/Norwegian text, and touch-specific navigation guidance. Animated transitions respect reduced-motion preferences, and the guide preserves ongoing quiz progress.
- Added an optional “Proportional regions” setting that selects Regional Equal Area when choosing a region and restores the selected global projection for World or when disabled. The preference is off by default and remembered between visits.
- Tuned desktop Regional Equal Area framing for Western Europe, Africa, Central & South Asia, East & Southeast Asia, North America, and Oceania using the user’s preferred centers and zoom levels.
- Grouped High detail, Bathymetry, Relief, and Water names with one shared performance note for mobile and less powerful devices.

## 0.11.0 — Smooth Sailing — 2026-10-07

### Improvements

- Applied the mobile pinch raster-preview policy to animated zooms, including Reset view, with full-quality restoration after the animation.
- Kept world-overview magnification capped during previews and gave mobile zoom animations wider detail coverage to avoid enlarged overview pixels.
- Swapped usable canvas detail frames immediately after installation to avoid waiting in SVG fallback for another animation callback.
- Requested full-density replacement frames directly after touch gestures end, avoiding an intermediate preview-density request during restoration.
- Kept gesture diagnostics available through `?gesture-debug`, with recording and the status button disabled by default. The mobile zoom-status badge copies a local report of the last completed pinch or touch pan, including frame gaps, timestamped preview/renderer/frame-density transitions, worker timing, and map settings, with copied/failed feedback.
- Reused country-path rendering nodes during camera-only movement, while refreshing them for geometry, region, language, hover, and quiz-state changes.
- Added a fast touch-zoom preview on coarse-pointer devices: lower-density canvas frames during rapid pinches and touch pans, cached raster coverage while awaiting replacements, restored full-density frames after movement, and unchanged desktop zoom behavior.
- Removed duplicate viewport measurements during touch pinch updates, sharing one fresh rectangle between both fingers while preserving zoom and pan behavior.
- Consolidated Asia into Middle East & Western Asia (20 quiz countries), Central & South Asia (13), and East & Southeast Asia (17), with broader map framing and Norwegian labels. Iran joins the western group, Egypt retains its Middle East membership, and all 49 Asia quiz countries remain covered exactly once.

### Fixes

- Kept Find the country hover highlighting at country level after an answer, retaining correct/wrong feedback colors across all parts instead of highlighting individual components. Explore retains component hover behavior.

## 0.10.0 — Pocket Atlas — 2026-10-06

### Improvements

- Refreshed the interface with warm pocket-atlas paper surfaces, shared colors, consistent controls and menus, retained individual shadows, clearer text contrast, and keyboard focus. Bricolage Grotesque headings and Geist UI text are locally hosted with their original licenses.
- Aligned Explore and both quiz cards with shared headings, captions, compact flags, and responsive spacing. Added flags to country-name suggestions; Name the country shows a header flag after a correct guess and a smaller flag beside a revealed answer after a wrong guess or skip.
- Made “Always show” reversible in both quizzes: turning it off hides the revealed answer and restores “What did I click” or “Show answer,” with keyboard focus returning to the restored control.
- Allowed immediate region switching on the first quiz question, including after an answer or skip; unfinished rounds beyond the first question still ask for confirmation.
- Replaced Nordics and Baltics with mutually exclusive Western Europe / Vest-Europa (24 quiz countries) and Eastern Europe / Øst-Europa (22). Western Europe includes Nordic and Mediterranean countries, including Greece; Eastern Europe includes Turkey. Greenland and the Faroes remain in Explore, and Balkan remains a smaller overlapping practice group.
- Used Turkey as the English country label, retaining Norwegian Tyrkia and matching Türkiye/Turkiye in country-name suggestions.
- Prevented header overlap at intermediate widths and matched the initial loading shell and browser theme color to the interface.

## 0.9.0 — Name That Country — 2026-10-06

### Features

- Added “Name the country” / “Navngi landet”: identify a highlighted country from the active region using translated, filtered suggestions with keyboard and touch selection, shared quiz scoring, and both map detail levels and renderers. After a wrong answer, “My guess” lets you locate the country you selected. A remembered “Selected region / All countries” answer-suggestion setting broadens the list without changing regional questions. Added Skip feedback with Cmd/Ctrl+Enter, close-on-clear suggestions, and one shared automatic reveal preference for wrong guesses and skipped questions, off by default. Inline “Always show” controls update the saved preferences without hiding answers already seen.

### Improvements

- Preserved separate quiz rounds when switching to Explore or the other quiz mode, restoring each round's region, answers, score, reveal state, and typed draft. Added a resume notice and an explicit restart action, with confirmation before replacing unfinished rounds through restart or region changes.
- Kept Restart quiz available before mobile guesses, made restarting on the first question immediate and returning to an untouched first question start fresh, hid desktop typing hints on mobile, and let map taps focus the Name the country input while preserving pan and pinch gestures.
- Centered automatic country framing in the space below mobile quiz and country cards, using the card's actual height for both positioning and zoom fitting.
- Organized settings into Map appearance, Quiz, and Navigation & scale, with High detail first, persistent quiz preferences available in every mode, a two-column desktop layout, and language at the top of mobile settings. Panels scroll only when needed to fit the screen.
- Improved contrast between selected geographic components and the rest of their country; Name the country uses a violet question highlight distinct from ocean colors.
- Stabilized inline reveal controls, hid keyboard shortcut hints on touch devices, and added password-manager autofill exclusions to country-answer fields.
- Removed the temporary restored-land review controls from the debug panel while retaining restored map coverage.

## 0.8.1 — 2026-10-05

### Improvements

- Removed an extra animation-frame wait at the start of mouse dragging, matching touch behavior while retaining drag thresholds and batching subsequent movements.
- Reduced canvas zoom and pinch layout work by removing unnecessary fixed-width stroke calculations from invisible country hit paths, retaining full click geometry and keyboard focus outlines.
- Reduced map initialization and first high-detail loading time by calculating each landmass area once when choosing country focus, preserving existing geometry and click targets.

## 0.8.0 — Every Island Counts — 2026-10-05

### Fixes

- Audited all 238 country and territory names in English and Norwegian; corrected spelling, capitalization, short names and grouped-territory labels, with documented naming sources and deliberate language variants.
- Supplied explicit English and Norwegian names for every country identity, making names such as Elfenbenskysten consistent across browsers and checking translation coverage during builds.
- Matched canvas hover and click targets to the active map detail, restoring interaction with detailed islands and coastlines omitted from the low-detail map.
- Aligned neighboring low-detail country borders and coastlines with detailed supplemental areas, removing coastal gaps, triangular border spurs around UNDOF, and coarse coastline wedges at both Korean DMZ ends while retaining existing quiz policies.
- Removed malformed high-detail geometry that produced stray diagonal outlines near the Egypt–Sudan border.
- Excluded restored buffer zones, bases and other supplemental areas from overlapping low-detail country shapes, keeping country highlighting and interaction consistent with high detail and preserving existing quiz associations.

### Improvements

- Added Big and Little Diomede as named Explore islands at both detail levels, including the Diomede / Inalik community context, while retaining Russia and USA quiz answers.
- Added a dashed Hala’ib disputed-boundary line in Explore mode, shared by canvas/SVG and both map detail levels.
- Included Bir Tawil in Sudan’s quiz shape and hid the Hala’ib claim line during the quiz, while retaining the unclaimed-area presentation in Explore.
- Added an English and Norwegian Explore label for Bir Tawil explaining that neither Egypt nor Sudan claims it, without adding a quiz country.

## 0.7.1 — 2026-10-02

### Fixes

- Prevented the whole-world canvas overview from being enlarged into a heavily pixelated close-up during map gestures; reuse recent detail frames or the SVG fallback while a replacement bitmap is prepared, and recheck coverage at frame swap time.
- Reduced the one-finger touch-pan dead zone and applied its first confirmed movement immediately, retaining frame-batched dragging and existing pinch safeguards.
- Made the browser's active touch list authoritative for mobile gestures, allowing a second finger to take over a one-finger pan without depending on individual pointer events; preserved country and area taps, mouse/pen controls, and uneven pinch-release safeguards.
- Kept the reset-view button on one line in Norwegian on mobile and lowered the scale bar slightly while retaining space above the button.

## 0.7.0 — Borders & Bearings — 2026-10-02

### Improvements

- Sharpened country outlines on large displays by rendering a viewport-sized canvas frame after map movement settles.
- Reduced accidental mobile panning during pinch zoom and when lifting fingers after a pinch.
- Restored omitted buffer zones, leases, territories, and islands as neutral, non-quiz land, with debug highlights and a location selector for review.
- Added English and Norwegian click labels for the Korean DMZ and UNDOF buffer zone, using the same subtle internal-boundary style as Baikonur without assigning country affiliations.
- Unified the Korean DMZ into one Explore hover, click, and keyboard-focus area, retaining its central dividing line as separate subtle dashed linework.
- Added bilingual Explore area cards for Akrotiri, Dhekelia, and the Guantánamo Bay Naval Base, with distinct labels and subtle shared boundaries.
- Simplified military base and lease areas in Find the country: Akrotiri and Dhekelia form part of the Cyprus quiz shape, Guantánamo of Cuba, and Baikonur of Kazakhstan, without changing their detailed Explore presentation.
- Included the restored UNDOF buffer strip in Syria's quiz shape, while retaining its separate Explore label and boundary and leaving the wider Golan boundary unchanged.
- Included each Korean DMZ half in its respective Korea quiz shape, hiding the outer buffer boundaries while retaining the North/South dividing line and the shared Explore area label.
- Displayed Baikonur as land with a subtle internal boundary and a clickable Russian lease identification, without adding a separate quiz country.

### Fixes

- Avoided a full map reprojection when entering Find the country; unchanged country and canvas drawing paths are reused, and compatible canvas updates keep the front frame visible.
- Restored missing detailed land around Brčko District and Iraqi Kurdistan by retaining finer-scale source parts within their existing countries.
- Kept the chosen manual zoom when limited country focus temporarily pulls back for a larger country.
- Prepared Europe's regional geometry during browser idle time and reused its context paths to reduce the selection delay.

## 0.6.0 — Depths & Distances — 2026-09-29

### Improvements

- Enabled the automatic country zoom limit by default to avoid overly close country views.
- Remembered projection, country zoom, visual layers, and map detail settings between browser visits.
- Added a debug-panel control for immediately resetting all saved settings to their defaults.
- Used the established Norwegian cartographic term “Relieff” for the relief layer.
- Preserved finer Natural Earth bathymetry contours around islands, shelves, and ocean basins.
- Added a simplified darkest bathymetry band for ocean trenches from 7,000 to 10,000 metres.
- Added 3,000 m, 4,000 m, and 5,000 m ocean contours to reveal ridges and basin structure in the Philippine Sea and elsewhere.
- Added an optional scale bar with persistent metric, imperial, and nautical unit settings; metric is the default.
- Refreshed map hover and selection colors with apricot and warm orange, keeping red for incorrect quiz answers.

### Fixes

- Corrected shallow-water coloring so bathymetry darkens consistently with increasing depth around islands and coasts.
- Kept antimeridian region transitions centered after moving between North America and Oceania.
- Restored country hover highlighting when zooming or automatic map movement finishes beneath a stationary cursor.

## 0.5.0 — 2026-09-29

### Improvements

- Renamed the optional country-focus limit so its switch describes the reduced automatic zoom behavior instead of implying a fit-to-country mode.
- Reordered the primary controls to establish the region before choosing Explore or Find the country.
- Reviewed all 279 marine labels and supplied an explicit Norwegian Bokmål value for each, using established Norwegian exonyms where available and conservative Western European conventions for disputed names.

### Fixes

- Corrected outdated English marine names, Norwegian spellings, and clearly incorrect water-body classifications.
- Split several long marine labels over two lines so they interfere less with nearby land.

### Internals

- Added curated marine-name source data, a documented audit trail, and build-time validation that prevents unreviewed names or missing translations from entering the generated label file.

## 0.4.1 — 2026-09-28

### Improvements

- Reworked land relief into six progressively lighter elevation bands, including a new 4,000-metre band with near-white mountain peaks.
- Disabled relief by default on all devices so its additional map data is loaded only when enabled in settings.

## 0.4.0 — 2026-09-27

### Improvements

- Tuned the starting position and zoom for each region, and combined Central America and the Caribbean into one focused region.
- Added an optional adaptive country focus that avoids zooming too close to ordinary countries, preserves a closer manual zoom, and also applies to “Show on map” in the quiz.
- Added a copyable map diagnostics panel behind `?debug`, including center, zoom, viewport-relative region fit, rendering, layer, gesture, and path-cache details.
- Added Miller Cylindrical as a horizontally wrapping projection and removed the similar Equal Earth option.
- Unified map-card spacing, aligned selector arrows, replaced the settings emoji with an icon, and refined compact quiz feedback on phones.

### Fixes

- Reused projected world geometry when entering Europe so its regional Russia split no longer delays the first transition.
- Extended horizontal map tiling to the North America and Oceania region views so land near the antimeridian is not cut off.

## 0.3.0 — 2026-09-27

### Improvements

- Reworked the phone layout around a compact game toolbar and map HUD, placing Region beside the game mode and moving language and visual map options into settings.
- Slimmed down the mobile selectors and retained their map, region, and settings icons.
- Disabled bathymetry and relief by default on touch-first mobile devices to improve initial map performance; both remain available in settings.
- Framed the initial mobile world view more closely around Europe and Africa, centered near northeastern Libya.
- Added an immediate loading screen and deferred the geography-heavy game bundle until after its first paint.
- Moved optional bathymetry and relief data off the mobile startup path and load each layer only when needed.
- Reused the loading spinner for detailed maps, projection changes, and deferred visual-layer toggles.

### Fixes

- Kept the mobile app shell and map controls inside Safari's changing safe area, prevented page zoom and viewport drift beneath browser chrome, and kept the fully zoomed-out world vertically centered.
- Prevented long presses on the map and app controls from starting text selection or an iOS callout.
- Removed Safari's rectangular tap flash from country shapes.
- Prevented the country under a finger from flashing as hovered when starting a map pan.
- Blocked iOS text-selection, copy callouts, and the tap-then-hold loupe across the map surface while leaving card text selectable.
- Prevented either finger release after pinch-zooming from being interpreted as a country tap.

## 0.2.0 — 2026-09-27

### Improvements

- Made tiny quiz countries easier to find and select with neutral map targets, including a zoom step for overlapping targets.
- Unified quiz highlights across nearby parts of the same country while keeping distant components visually distinct.
- Kept regional navigation focused on the chosen area and added subdued, non-interactive surrounding land; Asian Russia remains visible as context in the Europe view.
- Improved wrong-answer feedback with an optional clicked-country reveal, a saved “Always show” preference, and a “Show on map” action for locating the correct answer.
- Identified clicked geographic components in quiz feedback and named Bonaire, Sint Eustatius, and Saba individually without making them separate quiz countries.

### Fixes

- Limited regional quiz questions to countries whose principal map unit belongs to the region, so overseas islands do not prompt for France or the Netherlands in the North America quiz.
- Restored the full South Georgia and the South Sandwich Islands name.

## 0.1.0 — 2026-09-26

First local release milestone.

### Improvements

- Reworked the game layout and map controls around a larger, more prominent map.
- Made map movement smoother with an off-main-thread canvas renderer, while retaining SVG hit targets, crisp highlights, and an SVG fallback.
- Extended Mercator's horizontal world wrapping to every zoom level and allowed deeper zoom for very small countries.
- Added more named island components. Åland now appears as part of Finland, with its own secondary flag and component details.
- Refined selection and click-to-zoom for country components.
- Refreshed the map palette and softened relief.

### Fixes

- Unified country hover behavior between Explore and Find the country.
- Improved rendering stability and highlight sharpness in Firefox.

### Internals

- Separated interaction and focus rules from map drawing, shared map colors between canvas and SVG, and documented the main architectural boundaries.
