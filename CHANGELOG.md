# Changelog

Concise, user-facing notes for local releases. Add upcoming changes under **Unreleased**, then move them into a versioned entry when preparing a release.

## Unreleased

### Improvements

- Enabled the automatic country zoom limit by default to avoid overly close country views.
- Remembered projection, country zoom, visual layers, and map detail settings between browser visits.
- Added a debug-panel control for immediately resetting all saved settings to their defaults.
- Used the established Norwegian cartographic term “Relieff” for the relief layer.
- Preserved finer Natural Earth bathymetry contours around islands, shelves, and ocean basins.
- Added a simplified darkest bathymetry band for ocean trenches from 7,000 to 10,000 metres.
- Added 3,000 m, 4,000 m, and 5,000 m ocean contours to reveal ridges and basin structure in the Philippine Sea and elsewhere.
- Added an optional scale bar with persistent metric, imperial, and nautical unit settings; metric is the default.

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
