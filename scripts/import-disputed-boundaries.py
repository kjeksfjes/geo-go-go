"""Import curated claim linework independently of country/quiz polygons.

Usage: python scripts/import-disputed-boundaries.py <10m disputed boundaries.shp>
Requires pyshp; source: Natural Earth Admin-0 Boundary Lines – Disputed Areas.
"""

import json
import sys
from pathlib import Path

import shapefile


def main():
    reader = shapefile.Reader(sys.argv[1])
    matches = [record for record in reader.iterShapeRecords()
               if record.record.as_dict()["ne_id"] == 1746705785]
    if len(matches) != 1:
        raise ValueError("Expected one Natural Earth Hala’ib claim boundary")
    source = matches[0]
    metadata = source.record.as_dict()
    if metadata["FEATURECLA"] != "Claim boundary" or metadata["BRK_A3_R"] != "B93":
        raise ValueError("Hala’ib boundary source classification changed")
    geometry = source.shape.__geo_interface__
    if geometry["type"] != "LineString":
        raise ValueError("Expected a continuous Hala’ib claim line")
    geometry["coordinates"] = [[round(x, 5), round(y, 5)] for x, y in geometry["coordinates"]]
    feature = {
        "type": "Feature",
        "id": "halaib-claim",
        "properties": {
            "sourceId": metadata["ne_id"],
            "mapUnitIds": ["EGY", "SDN"],
            "name": {"en": "Hala’ib disputed boundary — Sudanese claim",
                     "nb": "Omstridt grense ved Hala’ib – Sudans krav"},
        },
        "geometry": geometry,
    }
    destination = Path(__file__).resolve().parents[1] / "src/data/disputed-boundaries.json"
    destination.write_text(json.dumps({"type": "FeatureCollection", "features": [feature]},
                                     ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
