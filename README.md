# Geo Go Go

A small interactive world-map proof of concept built with Vue 3, TypeScript,
Vite, Natural Earth Admin-0 Map Units, `d3-geo`, and `flag-icons`.

The map starts with Natural Earth's 1:50m Admin-0 Map Units. A **High detail**
toggle lazily loads the corresponding 1:10m units when requested. This keeps the initial download
and render light, avoids changing geometry in the middle of a gesture, and makes
coastlines and small countries clearer at close range when desired.
After each resolution has rendered once, its projected SVG paths are cached so
later switches are immediate at the current map size and projection.

It defaults to a conventional Mercator projection. Mercator preserves local
shapes and angles well, while enlarging areas toward the poles in the familiar
way.

## Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite, then hover, focus, or click a country.
Use the EN/NO control to switch between English and Norwegian Bokmål. The app
starts in the browser's language when supported and remembers a manual choice.
Scroll over the map to zoom around the pointer; selecting a country smoothly
zooms the map to its bounds. Drag a zoomed map to pan, or switch between
Mercator, Winkel Tripel, Equal Earth, and Natural Earth projections with the
map control. Regional Equal Area uses an azimuthal equal-area projection;
Europe uses a 10°E, 52°N origin and a geographic *fitting* frame. That frame
does not clip Russia's full geometry; its Europe/Asia geographic split remains
to be addressed. The Nordics also have an explicit fit frame.
The hierarchical region selector can isolate and focus a continent
or a smaller subregion without recalculating map paths. Its tree is navigation,
not a source of geographic inheritance: Europe uses Natural Earth's UN-style
region classification, whereas Nordics is a separate playable grouping that
includes Greenland. Its dropdown uses
`@zanmato/vue3-treeselect` for tree navigation and single selection.

The **Find the country** mode shows a flag and country name from the active
region. Click its map location to answer. Each correct first attempt earns one
point; after every answer, use **Next country** to continue. A session asks each
eligible state once, and changing regions starts a new session. Territories
remain visible on the map but are not used as quiz questions.
After an answer, clicking the map or pressing Space also advances, so the
player can continue without moving back to the button.

Map units have their own SVG paths and geographic classifications. Several
units can share one quiz identity and selected color: mainland France and
French Guiana, for example, are separate units tied to France. Selecting a
unit zooms to that unit and highlights it strongly; other rendered units of
the same answer highlight more softly. Answer checking and the country card
use the shared country ID.

## Geographic data

The checked-in map assets come from Natural Earth 5.1.1 **Admin-0 Map Units**
at [1:50m](https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-0-details/)
and [1:10m](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-details/).
`scripts/import-natural-earth.py` converts their shapefiles
to compact GeoJSON. The 50m table defines the unit IDs and metadata; the 10m
file supplies geometry for the same units, keeping detail switches stable.
`GU_A3` identifies a rendered unit, `ADM0_A3` groups units into a country/quiz
identity, and `SOV_A3` records the separate sovereign relationship. Dependency
parent links are optional. Natural Earth's `REGION_UN` and `SUBREGION` fields
provide the canonical, broadly UN M49-style geography. Custom game groupings
(Nordics, Baltics, Balkans, Middle East) are overlays, never inherited into a
parent continent. State eligibility is a separate game rule.

Natural Earth does not split Russia's European and Asian territory into map
units. Russia is one quiz answer and one rendered unit, so a future geographic
geometry split is still needed for an accurate Europe-focused projection.

## Structure

- `src/components/WorldMap.vue` renders and interacts with the SVG map.
- `src/composables/useMapProjection.ts` owns projection and path generation.
- `src/composables/useElementSize.ts` observes the responsive map container.
- `src/composables/useMapZoom.ts` owns wheel and animated country zoom state.
- `src/data/countries.ts` indexes map units, quiz identities, and sovereigns.
- `src/data/regions.ts` defines selector hierarchy and geographic unit membership.
- `src/data/quizCountries.ts` defines which identities can be quiz questions.
- `src/composables/useCountryQuiz.ts` owns question order, answers, and score.
- `src/App.vue` owns the selected-country UI state.

The detailed layer is matched back to 50m map-unit IDs, so switching resolution
cannot change the selectable unit set. Detailed geometries pass a spherical-area
sanity check; malformed features fall back to the safe 1:50m unit.
