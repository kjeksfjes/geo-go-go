# Changelog

Concise, user-facing notes for local releases. Add upcoming changes under **Unreleased**, then move them into a versioned entry when preparing a release.

## Unreleased

## 0.3.0 — 2026-09-27

### Fixes

- Kept the mobile app shell and map controls inside Safari's changing safe area, prevented page zoom and viewport drift beneath browser chrome, and kept the fully zoomed-out world vertically centered.
- Prevented long presses on the map and app controls from starting text selection or an iOS callout.
- Removed Safari's rectangular tap flash from country shapes.
- Prevented the country under a finger from flashing as hovered when starting a map pan.
- Blocked iOS text-selection, copy callouts, and the tap-then-hold loupe across the map surface while leaving card text selectable.
- Prevented either finger release after pinch-zooming from being interpreted as a country tap.

### Improvements

- Reworked the phone layout around a compact game toolbar and map HUD, placing Region beside the game mode and moving language and visual map options into settings.
- Slimmed down the mobile selectors and retained their map, region, and settings icons.
- Disabled bathymetry and relief by default on touch-first mobile devices to improve initial map performance; both remain available in settings.
- Framed the initial mobile world view more closely around Europe and Africa, centered near northeastern Libya.
- Added an immediate loading screen and deferred the geography-heavy game bundle until after its first paint.
- Moved optional bathymetry and relief data off the mobile startup path and load each layer only when needed.
- Reused the loading spinner for detailed maps, projection changes, and deferred visual-layer toggles.

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
