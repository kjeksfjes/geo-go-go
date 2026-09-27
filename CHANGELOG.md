# Changelog

Concise, user-facing notes for local releases. Add upcoming changes under **Unreleased**, then move them into a versioned entry when preparing a release.

## Unreleased

## 0.2.0 — 2026-09-27

- Made tiny quiz countries easier to find and select with neutral map targets, including a zoom step for overlapping targets.
- Unified quiz highlights across nearby parts of the same country while keeping distant components visually distinct.
- Kept regional navigation focused on the chosen area and added subdued, non-interactive surrounding land; Asian Russia remains visible as context in the Europe view.
- Limited regional quiz questions to countries whose principal map unit belongs to the region, so overseas islands do not prompt for France or the Netherlands in the North America quiz.
- Improved wrong-answer feedback with an optional clicked-country reveal, a saved “Always show” preference, and a “Show on map” action for locating the correct answer.
- Identified clicked geographic components in quiz feedback and named Bonaire, Sint Eustatius, and Saba individually without making them separate quiz countries.
- Restored the full South Georgia and the South Sandwich Islands name.

## 0.1.0 — 2026-09-26

First local release milestone.

### Highlights

- Reworked the game layout and map controls around a larger, more prominent map.
- Made map movement smoother with an off-main-thread canvas renderer, while retaining SVG hit targets, crisp highlights, and an SVG fallback.
- Extended Mercator's horizontal world wrapping to every zoom level and allowed deeper zoom for very small countries.
- Added more named island components. Åland now appears as part of Finland, with its own secondary flag and component details.
- Unified country hover behavior between Explore and Find the country; refined selection and click-to-zoom for country components.
- Refreshed the map palette, softened relief, and improved rendering stability and highlight sharpness in Firefox.

### Internals

- Separated interaction and focus rules from map drawing, shared map colors between canvas and SVG, and documented the main architectural boundaries.
