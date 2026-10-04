# Tasks

Lightweight backlog for deferred work. Keep stable task IDs and update each task's status as work progresses; recording a task does not authorize starting it automatically. No task-management dependency is required for now.

## TASK-005 — Profile and optimize high-detail map initialization

Status: Backlog. Priority: High. Added: 2026-10-02.

Prioritize the existing cost of initializing the high-detail world map, especially on phones, before adding more geometry or caching machinery. A focused local Node benchmark at a 1200 × 800 viewport with Natural Earth projection measured cold 10m projection at roughly 3.1 seconds before the land-coverage changes and 3.2 seconds afterward. This is a diagnostic baseline, not a browser or iPhone performance measurement. The same comparison found about 27 kB compressed growth in the main game bundle and 103 kB in high-detail data; the added supplemental projection and cached quiz switching were much smaller processing costs.

### Completion criteria

- [ ] Measure browser interaction costs of the SVG hit layer at both detail levels, including pan/zoom and pointer detection. Hit targets now reuse the active drawing paths so visible country land remains clickable; any future simplification must preserve island coverage and coastline accuracy.
- [ ] Profile cold startup and first high-detail activation in a browser, including a representative phone where available; separate download, module parsing/evaluation, country/path projection, focus calculations, worker preparation, and first visible frame.
- [ ] Record reproducible baseline timings and identify the dominant main-thread work before choosing an optimization; agree practical responsiveness targets from those measurements.
- [ ] Apply the smallest justified improvement using existing tools, preserving land coverage, source/component/quiz distinctions, projection fitting, and sharp settled rendering; avoid speculative dependencies, abstractions, or additional caches.
- [ ] Compare before/after cold and warm timings, compressed bundle sizes, and memory behavior; ensure Explore/quiz switching, region changes, and both 50m/10m detail levels remain consistent across canvas and SVG.
- [ ] Run the build and proportionate focused checks, then ask Joakim to verify responsiveness and visual quality on his devices.

## TASK-001 — Improve Coral Sea Islands and Clipperton geometry

Status: Deferred. Added: 2026-10-01.

### Findings

The current Natural Earth 1:10m Admin-0 source represents Coral Sea Islands (`CSI`) as one triangle with three distinct vertices, and Clipperton (`CLP`) as one polygon with six distinct vertices and no lagoon. The generated `src/data/supplemental-land.json` preserves those source shapes; this is not caused by the app's rendering optimizations. Clipperton is one atoll, whereas the Coral Sea Islands territory contains scattered islands and reefs. Before treating any islands as missing, check whether other country geometry already includes them.

### Proposed investigation

Start with Natural Earth's [Minor Islands](https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-minor-islands/) layer, which provides additional small-island geometry and more relative detail than the main coastline. Its coverage and suitability for these two areas have not yet been checked. If insufficient, assess an appropriately licensed higher-detail source before adding an import dependency or new data pipeline.

Useful geographic references: [Coral Sea Islands — Australian government](https://www.infrastructure.gov.au/territories-regions/territories/coral-sea-islands) and [Clipperton — French government](https://www.outre-mer.gouv.fr/territoires/ile-de-la-passion-clipperton).

### Completion criteria

- [ ] Inventory existing coverage and compare candidate sources for both areas, documenting gaps, provenance, and licensing.
- [ ] If suitable data is available, add a small, reproducibly generated subset through shared geometry-override configuration, without duplicating existing islands or painting submerged reefs and lagoons as land.
- [ ] Keep canvas and SVG rendering, hit-testing, and both 50m/10m detail levels consistent; preserve agreed Explore/quiz identities and regional question policy without creating new quiz answers from source polygons.
- [ ] Keep the change local to these areas and preserve projected-path reuse; run the build and proportionate geometry/runtime checks, then ask Joakim to review the visual result.

If no suitable source justifies the added complexity, document that assessment and retain the current geometry after agreement with Joakim. Labels and country affiliations are tracked separately in TASK-002 and are also deferred.

## TASK-002 — Review remaining tiny-island labels, affiliations, and interaction

Status: Deferred. Added: 2026-10-01.

Joakim has deferred all remaining tiny-island, atoll, reef, and bank work from the land-coverage audit, including public names, English/Bokmål labels, Explore country associations, quiz behavior, regional handling, visibility/hit targets, and geometry improvements. Keep their already restored neutral land coverage in place; do not remove it or assign countries automatically. Existing completed features are not being reverted.

### Deferred source pieces

| Source ID | Current source name |
| --- | --- |
| CSI | Coral Sea Islands |
| CLP | Clipperton Island |
| JQI | Johnston Atoll |
| DQI | Jarvis Island |
| FQI | Baker Island |
| HQI | Howland Island |
| WQI | Wake Atoll |
| MQI | Midway Islands |
| BQI | Navassa Island |
| LQI | Palmyra Atoll |
| KQI | Kingman Reef |
| PFA | Paracel Islands |
| PGA | Spratly Islands |
| BJN | Bajo Nuevo Bank (Petrel Is.) |
| SER | Serranilla Bank |
| SCR | Scarborough Reef |
| BRI | Brazilian Island |

These are the 17 remaining island-related source pieces in `src/data/supplemental-land.json` without curated public labels. Source names are provisional review identifiers, not approved display labels or assertions of sovereignty. Brazilian Island is included despite being a river island; its affiliation decision is deferred with the other small islands.

### Completion criteria

- [ ] Review names, geographic components, administration/sovereignty, and any competing claims against reliable sources; guide Joakim through ambiguous affiliation choices before implementing them.
- [ ] Agree Explore labels/associations and quiz behavior separately, preserving the distinction between source pieces, country identities, and regional question membership.
- [ ] Check geometry adequacy and small-feature interaction before adding detail or markers; use TASK-001 for Coral Sea Islands/Clipperton geometry research rather than duplicating it.
- [ ] Implement only the agreed policies through shared data/configuration, keeping canvas/SVG and both detail levels consistent; run proportionate build/runtime checks and leave visual acceptance to Joakim.

## TASK-003 — Review remaining non-island audit areas

Status: Deferred. Added: 2026-10-01.

Joakim has deferred the rest of the land-coverage audit while the Korean DMZ's quiz treatment is settled. Bir Tawil’s geometry and label were resolved with TASK-004 on 2026-10-04; Gibraltar and the Southern Patagonian Ice Field remain deferred. Their existing source land and affiliations are retained; the shared geometry correction removes low-detail country overlaps without deciding their public names or status.

| Source ID | Current source name |
| --- | --- |
| GIB | Gibraltar |
| SPI | Southern Patagonian Ice Field |
| BRT | Bir Tawil — resolved with TASK-004; unclaimed Explore area; Sudan geometry in quiz only |

### Completion criteria

- [ ] Check what each source polygon represents, especially the extent and meaning of `SPI`, before adopting its source name as a public label.
- [ ] Review English/Bokmål names, territory/status descriptions, and competing claims against reliable sources; guide Joakim through country-affiliation choices.
- [ ] Agree Explore presentation and quiz behavior separately, without automatically adding countries, answers, or regional membership from source-data splits.
- [ ] Implement agreed policies through shared configuration, verify both renderers and detail levels with proportionate automated checks, and ask Joakim for visual acceptance.

## TASK-004 — Review Egypt–Sudan border geometry and presentation

Status: Implemented; awaiting Joakim’s visual acceptance. Added: 2026-10-02. Updated: 2026-10-04.

Joakim's screenshot shows disconnected diagonal border segments near the Red Sea and a small outlined area south of the straight Egypt–Sudan boundary. Investigate the source geometry and rendered outlines before deciding whether these are data defects, intended disputed-area boundaries, or presentation issues. TASK-003 already covers the restored Bir Tawil (`BRT`) source piece's labels and affiliations; this task separately tracks the wider border's geometry and visual treatment. Do not assume that every outlined area is neutral or assign country affiliations from its appearance.

### Completion criteria

- [x] Identify the polygons and linework responsible for the screenshot, comparing the 50m/10m source geometry with the generated assets and rendered paths.
- [x] Verify boundary/status distinctions against Natural Earth and the UK geographic factfile; Joakim authorized the recommended presentation. Bir Tawil has a bilingual unclaimed-area label in Explore and merges into Sudan only for quiz interaction; Hala’ib retains the source’s Egypt treatment, with its Sudanese claim boundary rendered separately as a continuous dashed line in Explore, hidden in quiz mode.
- [x] Fix confirmed geometry defects through exact source-repair configuration and shared supplemental exclusions for countries/components at both resolutions, preserving land coverage and existing quiz policies. Aligned adjoining low-detail borders and coastlines using a common source-derived repair footprint; generation checks shared-edge coverage and rejects newly overlapping countries.
- [x] Run the build and focused runtime/geometry checks at both detail levels and all five projections; both renderers consume the shared corrected paths.
- [ ] Joakim to visually verify both detail levels and renderer presentation.

## TASK-006 — Audit coastline quality at close Explore zoom

Status: Deferred. Added: 2026-10-04.

Joakim raised a map-wide coastline-quality concern after comparing St Lawrence Island with Google Maps. The original Natural Earth 10m map-unit source contains the island's main polygon plus six thin coastal polygons, some with only three distinct vertices; these produce angular slivers at close zoom. Geometry checks confirmed that the pending Diomede component and click-target changes leave St Lawrence unchanged at both resolutions. Real coastal lagoons do not establish that these particular source polygons represent them accurately. No coastline correction has been made; Joakim explicitly deferred further investigation.

Natural Earth's 10m and 50m labels mean 1:10 million and 1:50 million map scales, not metre resolution. Generalization and geometric validity must be distinguished from geographic accuracy. See [Natural Earth's coastline documentation](https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-coastline/) for source limitations. This task assesses the general map and appropriate Explore zoom range; TASK-001 remains the separate Coral Sea Islands/Clipperton investigation, and TASK-002 retains deferred naming and affiliation decisions.

### Completion criteria

- [ ] Compare a representative selection of coastlines, including St Lawrence, narrow coastal barriers/lagoons, fjords, and small islands, with reliable reference data at the app's close zoom levels; distinguish source limitations, import defects, and rendering defects without assuming the entire map is accurate or broken.
- [ ] Compare the current administrative geometry with Natural Earth's physical land/coastline layers; determine whether confirmed discrepancies justify local corrections, a finer licensed source, or a change to the supported zoom range.
- [ ] Present findings and tradeoffs to Joakim before implementing replacements, including download size, processing cost, licensing, and maintenance. Preserve real coastal land and water rather than deleting thin polygons solely because they look unusual.
- [ ] For any subsequently authorized changes, preserve country/component/quiz identities and regional membership; keep drawing, highlighting, and hit targets consistent across canvas/SVG and 50m/10m, and coordinate performance checks with TASK-005.
- [ ] Run proportionate build and geometry checks for authorized implementation; leave visual acceptance to Joakim unless he requests otherwise.

## Audit status

The Korean DMZ's quiz treatment is implemented: its southern half counts as South Korea and its northern half as North Korea, retaining the dividing line while hiding outer DMZ boundaries. Explore presents one dissolved hover, click, and keyboard-focus area with a shared label, subtle outer boundaries, and a separate noninteractive dashed center line. Automated checks cover both detail levels and all projections; visual acceptance remains with Joakim. All other outstanding audit decisions are deferred under TASK-001, TASK-002, and TASK-003; restoring land coverage is complete for the audited source data. The Egypt–Sudan correction and shared low-detail supplemental exclusions are implemented under TASK-004, awaiting visual acceptance; Bir Tawil’s label and quiz policy are resolved.
