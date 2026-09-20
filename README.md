# Geo Go Go

A small interactive world-map proof of concept built with Vue 3, TypeScript, Vite, `world-atlas`, `topojson-client`, `d3-geo`, and `flag-icons`.

The map starts with the 1:50m atlas dataset. A **High detail** toggle lazily loads
the more detailed 1:10m dataset when requested. This keeps the initial download
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
Scroll over the map to zoom around the pointer; selecting a country smoothly
zooms the map to its bounds. Drag a zoomed map to pan, or switch between
Mercator, Winkel Tripel, Equal Earth, and Natural Earth projections with the
map control. The hierarchical region selector can isolate and focus a continent
or a smaller subregion without recalculating map paths. Parent regions include
their child regions and can also be selected directly. Its dropdown uses
`@zanmato/vue3-treeselect` for tree navigation and single selection.

Selection framing uses the main landmass for countries with widely detached
territories, while every territory remains rendered in the selected color.

## Structure

- `src/components/WorldMap.vue` renders and interacts with the SVG map.
- `src/composables/useMapProjection.ts` owns projection and path generation.
- `src/composables/useElementSize.ts` observes the responsive map container.
- `src/composables/useMapZoom.ts` owns wheel and animated country zoom state.
- `src/data/countries.ts` converts atlas topology and resolves display/flag metadata.
- `src/data/regions.ts` defines the region hierarchy and country membership.
- `src/App.vue` owns the selected-country UI state.

Atlas ISO numeric IDs are used as stable path keys. Territories or disputed
regions without numeric IDs receive deterministic, name-based fallback codes in
the country-data module. The detailed layer is filtered to those same IDs, so
switching resolution cannot change the selectable country set. Detailed
geometries also pass a spherical-area sanity check; malformed features fall
back to their safe 1:50m version rather than breaking the rendered globe.
