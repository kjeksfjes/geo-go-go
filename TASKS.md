# Tasks

Lightweight backlog for deferred work. Keep stable task IDs and update each task's status as work progresses; recording a task does not authorize starting it automatically. No task-management dependency is required for now.

## TASK-012 — Add capital quiz modes

Status: Backlog — deferred until requested. Added: 2026-10-18.

Explore capital quizzes using the existing country identities, regional question pools, scoring, answer suggestions, and English/Norwegian interface. The repository currently has no capital catalog or city coordinates. [Natural Earth Populated Places](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-populated-places/) is a candidate source for a small checked-in catalog; review its coverage and currency rather than importing one capital per country blindly. No database or live API is proposed.

### Proposed scope and decisions

- [ ] Start with **Name the capital**: highlight a country and ask for its capital using searchable answer suggestions. Consider **Find the capital** separately, with selectable markers or a forgiving geographic click radius suitable for touch.
- [ ] Import and review capital names, coordinates, country associations, English/Bokmål display names, accepted spelling alternatives, source provenance, and licensing.
- [ ] Define explicit answer policies for multiple capitals, constitutional capitals versus seats of government, disputed arrangements, and recent changes; support exceptions without changing country or quiz identities.
- [ ] Reuse existing quiz behavior where practical, keep the catalog lightweight, and run proportionate data/build checks. Leave desktop/mobile visual acceptance to the user.

## TASK-013 — Add USA state and Norway county map sets and quizzes

Status: Norway counties implemented; awaiting the user's visual/device acceptance. USA states deferred until requested. Added: 2026-10-18. Updated: 2026-10-22.

The Norway county map is available from the header selector with Explore, Find the county, and Name the county. It uses all 15 official county identities independently of country identities, shared quiz progression/cards/suggestions, and only county land geometry; foreign countries and unrelated layers are absent. Kartverket's 2026 boundaries are clipped to the existing Natural Earth 10m Norway coastline and simplified into overview/high-detail assets with shared borders preserved. Geometry is lazy-loaded, and Canvas and SVG share the same paths. Provenance, attribution, and regeneration are documented in [README.md](README.md#norway-counties) and [the source record](docs/norway-counties-source.json). County data and quiz progression have automated checks; no browser or device visual acceptance is claimed.

### Remaining work

- [ ] Obtain the user's desktop/mobile acceptance of county framing, Oslo's small target, coastal coverage, answer interactions, and both renderers/detail levels.
- [ ] When separately authorized, import and review the 50 US states, using [US Census cartographic boundary files](https://www.census.gov/geographies/mapping-files/2025/geo/carto-boundary-file.html) as a candidate source. Exclude DC and territories from the default state quiz unless explicitly agreed otherwise. Assess Alaska/Hawaii inset maps so all states remain accessible without shrinking the mainland excessively.
- [ ] Add USA Explore/Find/Name behavior using separate state identities and reviewed names, hiding foreign land and unrelated layers. Reuse shared quiz/navigation/rendering code where appropriate, retain lazy data loading, and record source versions, licensing, reproducible imports, and proportionate data/build checks.

## TASK-011 — Consider optional repository and deployment security hardening

Status: Deferred by the user. Added: 2026-10-17.

The security audit found no exposed credentials or identified visitor-facing exploit path. The user authorized updating the vulnerable `source-map-js` dependency and deferred the remaining recommendations. These are optional safeguards rather than urgent fixes; assess maintenance cost and solo-development friction before implementation. Recording this task does not authorize changing repository settings or workflows.

### Deferred recommendations

- [ ] Separate build and deployment jobs so dependency installation and build scripts do not receive `pages: write` or `id-token: write`; reserve those permissions for deployment.
- [ ] Pin GitHub Actions to verified commit SHAs, or assess workflow dependency locking, while keeping versions readable and updates maintainable.
- [ ] Consider Dependabot security updates and modest npm/GitHub Actions update PRs, with manual dependency checks as an alternative and no automatic merging.
- [ ] Consider protecting `main` with pull requests and a successful build, without requiring another person's approval for solo development.
- [ ] Assess a Content Security Policy compatible with the app's styles, assets, and map worker; verify any subsequently authorized policy before publication.

## TASK-005 — Profile and optimize high-detail map initialization

Status: First optimization implemented and measured; awaiting device acceptance. Priority: High. Added: 2026-10-02. Updated: 2026-10-05.

Prioritize the existing cost of initializing the high-detail world map, especially on phones, before adding more geometry or caching machinery. A focused local Node benchmark at a 1200 × 800 viewport with Natural Earth projection measured cold 10m projection at roughly 3.1 seconds before the land-coverage changes and 3.2 seconds afterward. This is a diagnostic baseline, not a browser or iPhone performance measurement. The same comparison found about 27 kB compressed growth in the main game bundle and 103 kB in high-detail data; the added supplemental projection and cached quiz switching were much smaller processing costs.

The 0.8.0 baseline and approved first optimization are documented in [the performance audit](docs/performance-audit.md), with reproducible scripts and per-run comparisons. Calculating each polygon area once cuts Node high-detail Mercator preparation by 65% with identical output checksums; 5,710 additional focus combinations match exactly. First high-detail activation improves by 52–65% across desktop/mobile-proxy canvas/SVG profiles. Main-page retained heap and geometry payloads remain essentially unchanged. Primary warm mobile canvas switching was slower, while seven controlled repeated switches matched baseline performance; the initial-switch difference remains unexplained and needs device acceptance. Actual iPhone/Safari measurements and visual acceptance remain with the user. Additional optimization proposals are deferred until separately authorized.

The user reports a clearly noticeable desktop improvement, but little noticeable gain on their iPhone. Treat the mobile Chromium proxy gains as diagnostic evidence only; they have not translated into a confirmed phone improvement. Pan/zoom performance is the next separately authorized audit.

### Completion criteria

- [x] Measure browser interaction costs of the SVG hit layer at both detail levels, including pan/zoom and pointer detection. Hit targets now reuse the active drawing paths so visible country land remains clickable; any future simplification must preserve island coverage and coastline accuracy.
- [ ] Profile cold startup and first high-detail activation in a browser, including a representative phone where available; separate download, module parsing/evaluation, country/path projection, focus calculations, worker preparation, and first visible frame.
- [x] Record reproducible baseline timings and identify the dominant main-thread work before choosing an optimization; agree practical responsiveness targets from those measurements.
- [x] Apply the smallest justified improvement using existing tools, preserving land coverage, source/component/quiz distinctions, projection fitting, and sharp settled rendering; avoid speculative dependencies, abstractions, or additional caches.
- [x] Compare before/after cold and warm timings, compressed bundle sizes, and memory behavior; ensure Explore/quiz switching, region changes, and both 50m/10m detail levels remain consistent across canvas and SVG.
- [x] Run the build and proportionate focused checks, then ask the user to verify responsiveness and visual quality on their devices.
- [ ] Complete real-device and visual acceptance, including first warm detail return and region switching. The browser proxy does not establish actual iPhone latency or first visible paint.

## TASK-007 — Reduce pan and zoom rendering cost

Status: Completed; the user accepts the small perceived gain. Added: 2026-10-05. Completed: 2026-10-05.

The [pan/zoom audit](docs/pan-zoom-performance-audit.md) records desktop and mobile Chromium proxy measurements at both detail levels and with both renderers. The implemented canvas hit-path styling removes unnecessary non-scaling stroke calculations while retaining full click geometry and keyboard focus outlines. Mouse dragging now updates immediately after crossing its existing threshold, matching touch behavior; subsequent movements remain RAF-batched. The build and focused automated checks pass. The user notices a slight gain in production preview and considers the current behavior acceptable. No further performance investigation is pending for this task.

- [x] Record reproducible movement baselines and compare causal experiments without reducing land coverage.
- [x] Apply the measured styling and immediate first-drag update, preserving both renderers and detail levels.
- [x] Run the build and focused automated checks; complete the user's acceptance of the small improvement.

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
- [ ] Keep the change local to these areas and preserve projected-path reuse; run the build and proportionate geometry/runtime checks, then ask the user to review the visual result.

If no suitable source justifies the added complexity, document that assessment and retain the current geometry after agreement with the user. Labels and country affiliations are tracked separately in TASK-002 and are also deferred.

## TASK-002 — Review remaining tiny-island labels, affiliations, and interaction

Status: Deferred. Added: 2026-10-01.

The user has deferred all remaining tiny-island, atoll, reef, and bank work from the land-coverage audit, including public names, English/Bokmål labels, Explore country associations, quiz behavior, regional handling, visibility/hit targets, and geometry improvements. Keep their already restored neutral land coverage in place; do not remove it or assign countries automatically. Existing completed features are not being reverted.

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

- [ ] Review names, geographic components, administration/sovereignty, and any competing claims against reliable sources; guide the user through ambiguous affiliation choices before implementing them.
- [ ] Agree Explore labels/associations and quiz behavior separately, preserving the distinction between source pieces, country identities, and regional question membership.
- [ ] Check geometry adequacy and small-feature interaction before adding detail or markers; use TASK-001 for Coral Sea Islands/Clipperton geometry research rather than duplicating it.
- [ ] Implement only the agreed policies through shared data/configuration, keeping canvas/SVG and both detail levels consistent; run proportionate build/runtime checks and leave visual acceptance to the user.

## TASK-003 — Review remaining non-island audit areas

Status: Deferred. Added: 2026-10-01.

The user has deferred the rest of the land-coverage audit while the Korean DMZ's quiz treatment is settled. Bir Tawil’s geometry and label were resolved with TASK-004 on 2026-10-04; Gibraltar and the Southern Patagonian Ice Field remain deferred. Their existing source land and affiliations are retained; the shared geometry correction removes low-detail country overlaps without deciding their public names or status.

| Source ID | Current source name |
| --- | --- |
| GIB | Gibraltar |
| SPI | Southern Patagonian Ice Field |
| BRT | Bir Tawil — resolved with TASK-004; unclaimed Explore area; Sudan geometry in quiz only |

### Completion criteria

- [ ] Check what each source polygon represents, especially the extent and meaning of `SPI`, before adopting its source name as a public label.
- [ ] Review English/Bokmål names, territory/status descriptions, and competing claims against reliable sources; guide the user through country-affiliation choices.
- [ ] Agree Explore presentation and quiz behavior separately, without automatically adding countries, answers, or regional membership from source-data splits.
- [ ] Implement agreed policies through shared configuration, verify both renderers and detail levels with proportionate automated checks, and ask the user for visual acceptance.

## TASK-004 — Review Egypt–Sudan border geometry and presentation

Status: Implemented; awaiting the user’s visual acceptance. Added: 2026-10-02. Updated: 2026-10-04.

The user's screenshot shows disconnected diagonal border segments near the Red Sea and a small outlined area south of the straight Egypt–Sudan boundary. Investigate the source geometry and rendered outlines before deciding whether these are data defects, intended disputed-area boundaries, or presentation issues. TASK-003 already covers the restored Bir Tawil (`BRT`) source piece's labels and affiliations; this task separately tracks the wider border's geometry and visual treatment. Do not assume that every outlined area is neutral or assign country affiliations from its appearance.

### Completion criteria

- [x] Identify the polygons and linework responsible for the screenshot, comparing the 50m/10m source geometry with the generated assets and rendered paths.
- [x] Verify boundary/status distinctions against Natural Earth and the UK geographic factfile; the user authorized the recommended presentation. Bir Tawil has a bilingual unclaimed-area label in Explore and merges into Sudan only for quiz interaction; Hala’ib retains the source’s Egypt treatment, with its Sudanese claim boundary rendered separately as a continuous dashed line in Explore, hidden in quiz mode.
- [x] Fix confirmed geometry defects through exact source-repair configuration and shared supplemental exclusions for countries/components at both resolutions, preserving land coverage and existing quiz policies. Aligned adjoining low-detail borders and coastlines using a common source-derived repair footprint; generation checks shared-edge coverage and rejects newly overlapping countries.
- [x] Run the build and focused runtime/geometry checks at both detail levels and all five projections; both renderers consume the shared corrected paths.
- [ ] the user to visually verify both detail levels and renderer presentation.

## TASK-006 — Audit coastline quality at close Explore zoom

Status: Deferred. Added: 2026-10-04.

The user raised a map-wide coastline-quality concern after comparing St Lawrence Island with Google Maps. The original Natural Earth 10m map-unit source contains the island's main polygon plus six thin coastal polygons, some with only three distinct vertices; these produce angular slivers at close zoom. Geometry checks confirmed that the pending Diomede component and click-target changes leave St Lawrence unchanged at both resolutions. Real coastal lagoons do not establish that these particular source polygons represent them accurately. No coastline correction has been made; the user explicitly deferred further investigation.

Natural Earth's 10m and 50m labels mean 1:10 million and 1:50 million map scales, not metre resolution. Generalization and geometric validity must be distinguished from geographic accuracy. See [Natural Earth's coastline documentation](https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-coastline/) for source limitations. This task assesses the general map and appropriate Explore zoom range; TASK-001 remains the separate Coral Sea Islands/Clipperton investigation, and TASK-002 retains deferred naming and affiliation decisions.

### Completion criteria

- [ ] Compare a representative selection of coastlines, including St Lawrence, narrow coastal barriers/lagoons, fjords, and small islands, with reliable reference data at the app's close zoom levels; distinguish source limitations, import defects, and rendering defects without assuming the entire map is accurate or broken.
- [ ] Compare the current administrative geometry with Natural Earth's physical land/coastline layers; determine whether confirmed discrepancies justify local corrections, a finer licensed source, or a change to the supported zoom range.
- [ ] Present findings and tradeoffs to the user before implementing replacements, including download size, processing cost, licensing, and maintenance. Preserve real coastal land and water rather than deleting thin polygons solely because they look unusual.
- [ ] For any subsequently authorized changes, preserve country/component/quiz identities and regional membership; keep drawing, highlighting, and hit targets consistent across canvas/SVG and 50m/10m, and coordinate performance checks with TASK-005.
- [ ] Run proportionate build and geometry checks for authorized implementation; leave visual acceptance to the user unless the user requests otherwise.

## TASK-008 — Recover quiz progress after reload

Status: Deferred. Added: 2026-10-06.

Recover the active quiz after a browser reload or closing and reopening the app mid-round. Explicitly leaving a quiz or changing its region ends that round; recovery must not restore it later. The user requested browser reload recovery as follow-up work; recording this task does not authorize implementation.

### Completion criteria

- [ ] Decide persistence lifetime and resume behavior after reload or reopening the app, including whether to offer resume or start fresh.
- [ ] Persist and restore the active quiz with a versioned storage format, including its mode, region, question order and position, score, submitted answer or skip state, selected component, revealed answers, typed draft, and guess preview. Validate country and region identities and saved state against the current data before resuming.
- [ ] Handle unavailable storage, malformed or outdated saved rounds, and changes in quiz eligibility without interrupting play; clear the saved round when leaving the quiz, switching quiz modes, changing region, or restarting, and respect settings reset behavior.
- [ ] Verify both quiz modes, region restoration, wrong answers, skips, completed rounds, bilingual feedback, and keyboard/touch interactions with proportionate automated checks. Leave visual acceptance to the user.

## TASK-009 — Add contextual tips for quiz shortcuts

Status: Completed — accepted by the user for release 0.15.0 — Quiet Compass. Added: 2026-10-06. Completed: 2026-10-11.

Six hint families use the existing Reka UI popover with shared pocket-atlas styling, English/Norwegian text, explicit close controls, and no automatic focus changes or outside-click dismissal. Trigger rules live together in `src/logic/quizTips.ts`; input, quiz phase, and visible-control checks live in `src/composables/useQuizTips.ts`. There is one continuation family with map/keyboard wording chosen from the current question’s input. Suggestion selection has independent desktop-arrow and touch-Go/Enter variants, sharing presentation and priority while retaining separate sequences and dismissals. Recording a task does not authorize additional work beyond the accepted scope.

### Trigger rules

All hints require three successive relevant actions on distinct questions in the current round. “Successive” means successive eligible opportunities, not necessarily consecutive questions. Repeated clicks in one question count once. Shortcut use resets the corresponding sequence and pending hint; it does not permanently hide guidance. Explicit “Got it” dismissals and the global “No more tips” preference remain remembered. The two automatic-reveal hints have independent state.

| Hint | Counted action | Sequence reset | Display opportunity |
| --- | --- | --- | --- |
| Map-tap typing | Direct touch focus of the Name answer field | Successful map-tap focus | A subsequent unanswered Name question, with keyboard closed |
| Suggestion keyboard selection | Hardware typing followed by pointer selection of a country suggestion | Keyboard selection, or pointer selection without hardware typing | Feedback after that pointer selection |
| Suggestion Go/Enter selection | Touch selection of a suggestion after typing | Successful Go/Enter selection on touch | Feedback after that touch selection, with the keyboard closed; wording explains that Go/Enter selects the highlighted country |
| Continuation | Pointer activation of Next | Map or keyboard continuation | Feedback with Next country visible; wording follows keyboard/mouse/touch use |
| Skip shortcut | Desktop Skip button activation | Keyboard skip | Feedback after a button skip; ordinary answers between skips are irrelevant |
| Correct-answer reveal | Manual Show answer on a wrong/skipped Name question | Advancing past a relevant answer without revealing it, or changing its automatic-reveal setting | Revealed correct answer with Always show visible; correct guesses between wrong/skipped questions are irrelevant |
| Clicked-name reveal | Manual What did I click? on a wrong Find answer | Advancing past a relevant wrong answer without revealing it, or changing its automatic-reveal setting | Revealed clicked name with Always show visible; correct guesses are irrelevant |

### Scheduling and lifecycle

Only one tip is visible. Eligible pending tips are ranked by the most recent triggering action; ties prefer reveal settings, Skip, suggestion selection, continuation, then map-tap typing. Other qualifying tips remain pending for the current round, but must receive another applicable display opportunity before showing after cooldown. Round changes, shortcut use, setting changes, and explicit dismissals clear the corresponding pending state. No popup appears merely because a timer expires.

After closing a tip, both a 20-second global cooldown and three further completed questions must pass before another can appear. Restarting or changing region/mode does not bypass this session cooldown. Each hint appears at most once per round. New tips are evaluated after the UI updates, without an additional inactivity debounce. They wait during typing, suggestion selection, map movement/loading, settings, and Help; an open tip remains readable through outside clicks and question changes until explicitly closed or the round ends. Counts, pending tips, and cooldown stay in memory; only dismissed IDs and global opt-out are saved. Earlier inferred learning is not carried forward as permanent suppression.

Quiz settings provide an enable switch and an inline Reset tips action with a short localized confirmation. Reset tips clears only guidance state; Reset settings also resets guidance. The user tested the desktop and mobile hint flows, iterated on presentation, wording, and trigger timing, then accepted the final behavior and authorized release. No agent browser testing was performed.

### Completion criteria

- [x] Define explicit triggers, relevant opportunities, reset conditions, display context, priority, and shared cooldown before implementing the consolidated policy.
- [x] Integrate action events without changing quiz answers, scoring, keyboard shortcuts, map gestures, or regional membership; retain explicit dismissal, opt-out, reset, and bilingual presentation.
- [x] Run the build/type and whitespace checks, plus one focused policy check for successive actions, resets, arbitration, cooldown gates, freshness, round changes, and stored dismissal migration.
- [x] Obtain the user’s acceptance of the final hint behavior and presentation after desktop/mobile testing and wording iterations; the user authorized release.

## TASK-010 — Investigate Firefox pan and zoom performance

Status: Completed — accepted by the user for release. Added: 2026-10-07. Completed: 2026-10-10.

The user found Firefox movement acceptable in the border-free trial, then clarified that country borders should remain visible during movement. The revised preview restores those borders; after restricting the remaining shared movement changes to Firefox, the user reports improvement and requests a commit. The measurements, profiler findings, hypotheses, and accepted tradeoffs are recorded in [the Firefox investigation](docs/firefox-pan-zoom-performance-audit.md). The revised policy is enabled automatically on desktop Firefox, with wider lower-density cached movement previews, early pan refresh, bounded detail reuse across zoom/animation/pan transitions, retained wrapped hit geometry, visible country and highlight outlines, and full-quality restoration at rest. Both detail levels and Canvas/SVG highlight presentation share the policy; Chrome and touch-first rendering policies are preserved. The experiment flags are removed, while desktop/mobile diagnostics remain available through gesture-debug. The user accepts the final 3× / 0.75-density version and authorizes release. Chrome and mobile policy isolation was rechecked against the released source; no fresh agent browser or iPhone testing is claimed. Further performance tuning is deferred unless requested.

### Completion criteria

- [x] Collect desktop movement reports for Firefox pan, wheel zoom, and automatic framing/Reset view sequences, establishing a focused baseline before choosing changes.
- [x] Identify measured worker stroke, SVG mounting, and rendering-transition costs; distinguish evidence from hypotheses about individual stalls.
- [x] Apply maintainable improvements while preserving geographic identities, quiz highlights, full hit geometry, both detail levels, Canvas/SVG consistency, and accepted mobile policies.
- [x] Run npm run build and whitespace checks after default activation and cleanup.
- [x] Obtain the user's acceptance of the final desktop Firefox version and verify that the new policies remain gated away from Chrome/mobile. Fresh iPhone browser testing was not performed; the user authorized release after source verification.

## Audit status

The Korean DMZ's quiz treatment is implemented: its southern half counts as South Korea and its northern half as North Korea, retaining the dividing line while hiding outer DMZ boundaries. Explore presents one dissolved hover, click, and keyboard-focus area with a shared label, subtle outer boundaries, and a separate noninteractive dashed center line. Automated checks cover both detail levels and all projections; visual acceptance remains with the user. All other outstanding audit decisions are deferred under TASK-001, TASK-002, and TASK-003; restoring land coverage is complete for the audited source data. The Egypt–Sudan correction and shared low-detail supplemental exclusions are implemented under TASK-004, awaiting visual acceptance; Bir Tawil’s label and quiz policy are resolved.
