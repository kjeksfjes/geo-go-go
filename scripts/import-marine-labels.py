#!/usr/bin/env python3
"""Extract small, projection-independent marine labels from Natural Earth.

Usage: pip install pyshp shapely
       python scripts/import-marine-labels.py <ne_10m_geography_marine_polys.shp> <output.json>

The source is Natural Earth's 1:10m Geography Marine Polygons (v5.1.0).
Only label anchors and metadata are shipped to the browser, not the polygons.
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
# per ocean is a deliberate cartographic choice for this small world map.
OCEANS = (
    ("arctic", "Arctic Ocean", "Nordishavet", (0, 78)),
    ("pacific", "Pacific Ocean", "Stillehavet", (-148, -5)),
    ("atlantic", "Atlantic Ocean", "Atlanterhavet", (-42, 25)),
    ("indian", "Indian Ocean", "Indiahavet", (79, -22)),
    ("southern", "Southern Ocean", "Sørishavet", (0, -55)),
)

# Natural Earth has English names but no Norwegian Bokmål field. Keep this
# deliberately small; less common names retain the source's English spelling.
NORWEGIAN_NAMES = {
    "Arabian Sea": "Arabiahavet",
    "Baffin Bay": "Baffinbukta",
    "Baltic Sea": "Østersjøen",
    "Barents Sea": "Barentshavet",
    "Bay of Bengal": "Bengalbukta",
    "Bering Sea": "Beringhavet",
    "Black Sea": "Svartehavet",
    "Caribbean Sea": "Det karibiske hav",
    "Caspian Sea": "Kaspihavet",
    "East China Sea": "Øst-Kinahavet",
    "Greenland Sea": "Grønlandshavet",
    "Gulf of Mexico": "Mexicogolfen",
    "Hudson Bay": "Hudsonbukta",
    "Labrador Sea": "Labradorhavet",
    "Mediterranean Sea": "Middelhavet",
    "North Sea": "Nordsjøen",
    "Norwegian Sea": "Norskehavet",
    "Persian Gulf": "Persiabukta",
    "Red Sea": "Rødehavet",
    "Sea of Japan": "Japanhavet",
    "South China Sea": "Sør-Kinahavet",
}


def point_for(geometry: object) -> list[float]:
    area = shape(geometry)
    centroid = area.centroid
    point = centroid if area.covers(centroid) else area.representative_point()
    return [round(point.x, 4), round(point.y, 4)]


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("Usage: import-marine-labels.py <source.shp> <output.json>")

    source, output = map(Path, sys.argv[1:])
    labels = [
        {
            "id": f"ocean:{key}",
            "name": english,
            "nameNb": norwegian,
            "kind": "ocean",
            "point": point,
            "rank": 0,
            "minLabel": 1,
            "maxLabel": 6.5,
        }
        for key, english, norwegian, point in OCEANS
    ]

    reader = shapefile.Reader(str(source), encoding="utf-8")
    for feature in reader.iterShapeRecords():
        properties = feature.record
        if properties.featurecla not in KINDS:
            continue
        name = (properties.name_en or properties.name).strip()
        if not name:
            continue

        label = {
            "id": f"ne:{properties.ne_id}",
            "name": name,
            "kind": properties.featurecla,
            "point": point_for(feature.shape.__geo_interface__),
            "rank": properties.scalerank,
            "minLabel": properties.min_label,
            "maxLabel": properties.max_label,
        }
        if name in NORWEGIAN_NAMES:
            label["nameNb"] = NORWEGIAN_NAMES[name]
        labels.append(label)

    labels.sort(key=lambda label: (label["rank"], label["name"], label["id"]))
    output.write_text(json.dumps(labels, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"Wrote {len(labels)} marine labels to {output}")


if __name__ == "__main__":
    main()
