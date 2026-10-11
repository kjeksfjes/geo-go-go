"""Extract non-interactive land from Natural Earth 5.1.1 map-unit GeoJSON.

Usage: python scripts/import-background-land.py <50m GeoJSON> <10m GeoJSON>
Sources: https://github.com/nvkelso/natural-earth-vector/tree/v5.1.1/geojson
Country imports intentionally exclude Antarctica; this separate output never
creates country identities, quiz answers, components, or region membership.
"""

import json
import sys
from pathlib import Path


def rounded(value):
    if isinstance(value, list):
        return [rounded(item) for item in value]
    return round(value, 5) if isinstance(value, (int, float)) else value


destination = Path(__file__).resolve().parents[1] / "src" / "data"
for resolution, filename in zip(("50m", "10m"), sys.argv[1:3], strict=True):
    source = json.loads(Path(filename).read_text(encoding="utf-8"))
    features = []
    for feature in source["features"]:
        properties = feature["properties"]
        if properties["ADM0_A3"] != "ATA":
            continue
        geometry = feature["geometry"]
        geometry["coordinates"] = rounded(geometry["coordinates"])
        features.append({
            "type": "Feature", "id": properties["GU_A3"],
            "properties": {"sourceName": properties["GEOUNIT"], "sourceType": properties["TYPE"]},
            "geometry": geometry,
        })
    if len(features) != 1 or features[0]["id"] != "ATA":
        raise ValueError(f"Expected one Antarctica map unit at {resolution}")
    output = destination / f"background-land-{resolution}.json"
    output.write_text(json.dumps({"type": "FeatureCollection", "features": features},
                                 ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{resolution}: {output.stat().st_size:,} bytes of background geometry")
