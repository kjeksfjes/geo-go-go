# Changelog

Concise, user-facing notes for local releases. Add an **Unreleased** section when there are upcoming changes, then replace its heading with the versioned release heading before publishing.

## Unreleased

### Improvements

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
