#!/usr/bin/env python3
"""Extract small, projection-independent marine labels from Natural Earth.

Usage: pip install pyshp shapely
       python scripts/import-marine-labels.py <ne_10m_geography_marine_polys.shp> <output.json>

The source is Natural Earth's 1:10m Geography Marine Polygons. Reviewed display
names live in marine-label-names.json; only label anchors and metadata are
shipped to the browser, not the polygons.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import shapefile
from shapely.geometry import shape


KINDS = {"sea", "gulf", "bay", "strait", "sound", "channel", "fjord", "inlet"}

# Natural Earth splits several oceans into north/south polygons, and its
# antimeridian-spanning centroids are poor label positions. One readable label
# per ocean is a deliberate cartographic choice for this small world map. Their
# display names are reviewed in the same curated file as the imported labels.
OCEANS = (
    ("arctic", (0, 78)),
    ("pacific", (-148, -5)),
    ("atlantic", (-42, 25)),
    ("indian", (79, -22)),
    ("southern", (0, -55)),
)


def load_name_reviews() -> dict[str, dict[str, str]]:
    path = Path(__file__).with_name("marine-label-names.json")
    reviews = json.loads(path.read_text(encoding="utf-8"))["labels"]
    for label_id, review in reviews.items():
        if not review.get("name") or not review.get("nameNb"):
            raise ValueError(f"{label_id} lacks an explicit reviewed display name")
    return reviews


def point_for(geometry: object) -> list[float]:
    area = shape(geometry)
    centroid = area.centroid
    point = centroid if area.covers(centroid) else area.representative_point()
    return [round(point.x, 4), round(point.y, 4)]


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("Usage: import-marine-labels.py <source.shp> <output.json>")

    source, output = map(Path, sys.argv[1:])
    reviews = load_name_reviews()
    used_review_ids: set[str] = set()
    labels = []
    for key, point in OCEANS:
        label_id = f"ocean:{key}"
        review = reviews[label_id]
        used_review_ids.add(label_id)
        labels.append(
            {
                "id": label_id,
                "name": review["name"],
                "nameNb": review["nameNb"],
                "kind": review.get("kind", "ocean"),
                "point": point,
                "rank": 0,
                "minLabel": 1,
                "maxLabel": 6.5,
            }
        )

    reader = shapefile.Reader(str(source), encoding="utf-8")
    for feature in reader.iterShapeRecords():
        properties = feature.record
        if properties.featurecla not in KINDS:
            continue
        source_name = (properties.name_en or properties.name).strip()
        if not source_name:
            continue

        label_id = f"ne:{properties.ne_id}"
        review = reviews.get(label_id)
        if review is None:
            raise ValueError(f"{label_id} ({source_name}) has not been reviewed")
        if review.get("sourceName") != source_name:
            raise ValueError(
                f"{label_id} source name changed from {review.get('sourceName')!r} "
                f"to {source_name!r}; review the upstream change before importing"
            )
        used_review_ids.add(label_id)
        label = {
            "id": label_id,
            "name": review["name"],
            "nameNb": review["nameNb"],
            "kind": review.get("kind", properties.featurecla),
            "point": point_for(feature.shape.__geo_interface__),
            "rank": properties.scalerank,
            "minLabel": properties.min_label,
            "maxLabel": properties.max_label,
        }
        labels.append(label)

    unused_review_ids = set(reviews) - used_review_ids
    if unused_review_ids:
        raise ValueError(
            "Reviewed labels were not found in the source: "
            + ", ".join(sorted(unused_review_ids))
        )

    labels.sort(key=lambda label: (label["rank"], label["name"], label["id"]))
    output.write_text(json.dumps(labels, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"Wrote {len(labels)} marine labels to {output}")


if __name__ == "__main__":
    main()
