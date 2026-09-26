# Changelog

Concise, user-facing notes for local releases. Add upcoming changes under **Unreleased**, then move them into a versioned entry when preparing a release.

## Unreleased

- In Find the country, nearby parts of a country now share the primary answer highlight; distant components retain a separate related highlight.
- Added neutral map targets for tiny quiz countries; overlapping targets zoom in before accepting an answer.

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
