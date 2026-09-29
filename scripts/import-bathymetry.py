#!/usr/bin/env python3
"""Build a compact set of nested Natural Earth bathymetry bands."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

from shapely import make_valid, orient_polygons, set_precision, union_all
from shapely.geometry import mapping, shape


# Preserve the shape of shelves and basins at close map zoom while still
# keeping the lazily loaded browser asset substantially smaller than source.
BANDS = (
    (200, 0.015),
    (2000, 0.02),
    (3000, 0.06),
    (4000, 0.06),
    (5000, 0.06),
    (6000, 0.03),
    (7000, 0.10),
)


def round_coordinates(value: Any) -> Any:
    if isinstance(value, (int, float)):
        return round(value, 4)
    return [round_coordinates(item) for item in value]


def polygon_parts(geometry: Any) -> list[Any]:
    if geometry.geom_type == "Polygon":
        return [geometry]
    if hasattr(geometry, "geoms"):
        return [polygon for part in geometry.geoms for polygon in polygon_parts(part)]
    return []


def build_band(source: Path, expected_depth: int, tolerance: float) -> dict[str, Any]:
    collection = json.loads(source.read_text())
    features = collection.get("features", [])
    source_depths = {feature.get("properties", {}).get("depth") for feature in features}
    if source_depths != {expected_depth}:
        raise ValueError(
            f"{source} contains depths {sorted(source_depths)}, expected only {expected_depth}"
        )

    geometry = union_all([shape(feature["geometry"]) for feature in features])
    geometry = geometry.simplify(tolerance, preserve_topology=True)
    geometry = set_precision(geometry, grid_size=0.0001)
    if not geometry.is_valid:
        geometry = union_all(polygon_parts(make_valid(geometry)))
    # D3 treats clockwise exterior rings as the polygon interior.
    geometry = orient_polygons(geometry, exterior_cw=True)
    serialized = mapping(geometry)
    serialized["coordinates"] = round_coordinates(serialized["coordinates"])
    return {"depth": expected_depth, "geometry": serialized}


def main() -> None:
    if len(sys.argv) != len(BANDS) + 2:
        raise SystemExit(
            "Usage: import-bathymetry.py <200m.geojson> <2000m.geojson> "
            "<3000m.geojson> <4000m.geojson> <5000m.geojson> "
            "<6000m.geojson> <7000m.geojson> <output.json>"
        )

    sources = [Path(argument) for argument in sys.argv[1:-1]]
    output = Path(sys.argv[-1])
    bands = [
        build_band(source, depth, tolerance)
        for source, (depth, tolerance) in zip(sources, BANDS, strict=True)
    ]
    output.write_text(json.dumps(bands, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    main()
