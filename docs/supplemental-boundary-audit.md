# Supplemental boundary audit — 2026-10-04

The supplemental land pass used detailed polygons at both resolutions, but the surrounding low-detail countries still covered many of those polygons. Overlay fills blocked pointer clicks, yet country highlighting, outlines and geometry-based interaction retained the overlap. Keeping a detailed small area is useful; its surrounding coarse country geometry must also exclude it.

## Findings

A geometric intersection audit of every supplemental source piece found positive-area country overlap for these nine pieces at 50m. No supplemental piece overlaps the checked-in 10m country geometry.

| Source | Area | Overlapping 50m source units |
| --- | --- | --- |
| ESB | Dhekelia | Cyprus and Northern Cyprus |
| WSB | Akrotiri | Cyprus |
| SYU | UNDOF | Syria, Israel and a small part of Lebanon |
| KNX | Southern Korean DMZ half | Both Koreas |
| KNZ | Northern Korean DMZ half | Both Koreas |
| USG | Guantánamo Bay Naval Base | Cuba |
| BRI | Brazilian Island | Argentina, Brazil and Uruguay |
| SPI | Southern Patagonian Ice Field source piece | Argentina and Chile |
| BRT | Bir Tawil | Sudan |

These are geometric overlaps, not decisions about claims, administration or quiz identity. Brazilian Island and the Patagonian source piece keep their deferred public presentation and affiliations. The other supplemental areas need no country-geometry change. Baikonur already has a shared detailed hole cut into both resolutions through the separate lease pipeline.

Egypt’s original Natural Earth 5.1.1 10m shapefile and the rounded browser asset both contain two extremely thin interior holes and a self-intersecting coastal loop near Hala’ib. The holes produce roughly 44 km and 113 km of doubled outlines; the loop produces the third diagonal fragment. Removing precisely those rings and the returning loop yields valid Egypt geometry without changing the actual coast or Egypt–Sudan boundary. The repair is configured by exact coordinate sequences, rather than a broad small-hole filter that might erase real lakes or islands.

Natural Earth’s [upstream sliver cleanup proposal](https://github.com/nvkelso/natural-earth-vector/pull/805) identifies misaligned disputed-boundary linework in the Bir Tawil/Hala’ib area. Its [country-data policy](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/) uses de facto boundaries. The [UK geographic factfile for Egypt](https://assets.publishing.service.gov.uk/media/6672f1dac087fbe40855ce75/Egypt_Toponymic_Factfile.pdf), boundary section, distinguishes the 1899 international boundary and 1902 administrative boundary, identifies Hala’ib as administered by Egypt, and describes Bir Tawil as claimed by neither country. Hala’ib’s existing country treatment is retained. Bir Tawil is separately labelled in English and Norwegian and stays separate in Explore. In quiz mode only, it merges into Sudan to keep a simple country-selection border near the 22nd parallel. This is an explicit game policy, not a claim or administration decision.

## Implementation and verification

The existing geographic-unit generator applies reviewed source repairs and subtracts supplemental polygons from country/component geometry. Sparse generated overrides use runtime geographic-unit IDs, including mainland South Korea’s subunit; the raw source assets remain unchanged. The runtime consumes these corrected geometries for fill, outlines, hit-testing and focus through the existing common projection paths used by canvas and SVG. Quiz merges start from the same corrected geometry and then apply only their explicit inclusion/exclusion policies. No runtime geometry library, additional projected-path cache or renderer-specific country branch is introduced.

Regenerate with `python scripts/build-geographic-units.py` in an environment with Shapely 2.1 or later. Source-coordinate assertions require review if the source atlas changes. The standalone override JSON adds approximately 55 kB gzip at 50m and 13 kB gzip for the lazily loaded Egypt repair at 10m.

`npm run build` passed. Focused checks exercised the actual runtime’s 282 Explore units and 281 quiz units at both resolutions, verified finite paths across all five projections, confirmed Bir Tawil is excluded from Egypt/Sudan in Explore and belongs only to Sudan’s quiz shape and the Egypt artifact locations remain land, checked all supplemental intersections and explicit quiz-area coverage, and verified that low-detail country plus supplemental coverage is preserved. The largest remaining intersection after coordinate rounding was about 1.35 × 10⁻⁷ square degrees; 10m had none. Regeneration was checked for deterministic output. These are focused checks, not a permanent test suite. Browser/device visual acceptance remains with Joakim, including canvas and SVG presentation, area selection, highlighting and detail switching around the affected locations.

## Hala’ib claim line

Following Joakim’s request, the disputed administrative boundary is shown as a continuous dashed line, separately from the repaired country polygon. `scripts/import-disputed-boundaries.py` extracts Natural Earth source feature `ne_id=1746705785`, classified as `Claim boundary`, named `Sudanese claim`, with the note “Admin. by Egypt, Claimed by Sudan”. The downloaded disputed-boundary layer reports version 5.1.0. The generated line has twelve vertices running from Bir Tawil’s northeast corner to the Red Sea coast. Both detail levels use the same line; the generalized 50m coast differs from its detailed endpoint by approximately 0.0024 degrees.

The shared SVG overlay renders above canvas and SVG country highlights, uses a fixed screen-width dash pattern, follows horizontal map copies, and is filtered by the visibility of Egypt/Sudan. It has no fill or pointer interaction and is hidden in quiz mode. The malformed polygon fragments were incomplete traces of this source boundary; replacing them with explicit continuous linework preserves the intended cartographic information. Focused checks verify source classification, line continuity, deterministic generation, finite paths in all five projections, region filtering unchanged paths across detail switches, and hiding/restoration across quiz switches. Browser/device visual acceptance remains with Joakim.
