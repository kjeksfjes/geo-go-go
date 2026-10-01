# Tasks

Lightweight backlog for deferred work. Keep stable task IDs and update each task's status as work progresses; recording a task does not authorize starting it automatically. No task-management dependency is required for now.

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

Joakim has deferred the rest of the land-coverage audit while the Korean DMZ's quiz treatment is settled. Keep the existing restored neutral land for these three source pieces unchanged until the review is resumed.

| Source ID | Current source name |
| --- | --- |
| GIB | Gibraltar |
| SPI | Southern Patagonian Ice Field |
| BRT | Bir Tawil |

### Completion criteria

- [ ] Check what each source polygon represents, especially the extent and meaning of `SPI`, before adopting its source name as a public label.
- [ ] Review English/Bokmål names, territory/status descriptions, and competing claims against reliable sources; guide Joakim through country-affiliation choices.
- [ ] Agree Explore presentation and quiz behavior separately, without automatically adding countries, answers, or regional membership from source-data splits.
- [ ] Implement agreed policies through shared configuration, verify both renderers and detail levels with proportionate automated checks, and ask Joakim for visual acceptance.

## TASK-004 — Review Egypt–Sudan border geometry and presentation

Status: Deferred. Added: 2026-10-02.

Joakim's screenshot shows disconnected diagonal border segments near the Red Sea and a small outlined area south of the straight Egypt–Sudan boundary. Investigate the source geometry and rendered outlines before deciding whether these are data defects, intended disputed-area boundaries, or presentation issues. TASK-003 already covers the restored Bir Tawil (`BRT`) source piece's labels and affiliations; this task separately tracks the wider border's geometry and visual treatment. Do not assume that every outlined area is neutral or assign country affiliations from its appearance.

### Completion criteria

- [ ] Identify the polygons and linework responsible for the screenshot, comparing the 50m/10m source geometry with the generated assets and rendered paths.
- [ ] Verify relevant boundary/status distinctions against reliable sources and agree Explore and quiz presentation with Joakim, coordinating any Bir Tawil affiliation decision with TASK-003.
- [ ] Fix confirmed geometry or drawing defects through shared data/configuration, preserving land coverage and avoiding country-specific rendering branches.
- [ ] Verify canvas/SVG and both detail levels with proportionate build and geometry checks, then ask Joakim for visual acceptance.

## Audit status

The Korean DMZ's quiz treatment is implemented: its southern half counts as South Korea and its northern half as North Korea, retaining the dividing line while hiding outer DMZ boundaries. Explore presents one dissolved hover, click, and keyboard-focus area with a shared label, subtle outer boundaries, and a separate noninteractive dashed center line. Automated checks cover both detail levels and all projections; visual acceptance remains with Joakim. All other outstanding audit decisions are deferred under TASK-001, TASK-002, and TASK-003; restoring land coverage is complete for the audited source data. The Egypt–Sudan border's geometry and presentation are separately deferred under TASK-004.
