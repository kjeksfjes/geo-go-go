#!/usr/bin/env python3
"""Build compact vector elevation bands from a global ETOPO NetCDF grid.

Usage: pip install contourpy numpy scipy shapely
       python scripts/import-relief.py <etopo.nc> <output.json>

The input is expected to contain latitude, longitude and z variables. A
five-arc-minute ETOPO 2022 grid is sufficient for the deliberately restrained
map treatment used by the browser POC.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

import numpy as np
from contourpy import FillType, contour_generator
from scipy.ndimage import gaussian_filter
from scipy.io import netcdf_file
from shapely import get_parts, make_valid, orient_polygons
from shapely.geometry import MultiPolygon, Polygon, mapping


BANDS = (
    (500, 0.065, 0.02),
    (1000, 0.060, 0.014),
    (1500, 0.055, 0.01),
    (2250, 0.050, 0.006),
    (3000, 0.045, 0.004),
)


def round_coordinates(value: Any) -> Any:
    if isinstance(value, (int, float)):
        return round(value, 4)
    return [round_coordinates(item) for item in value]


def read_grid(path: Path) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    with netcdf_file(path, "r", mmap=False) as source:
        latitudes = source.variables["latitude"][:].copy()
        longitudes = source.variables["longitude"][:].copy()
        elevations = source.variables["z"][:].copy()

    if elevations.shape != (len(latitudes), len(longitudes)):
        raise ValueError("ETOPO z dimensions do not match latitude/longitude")

    # Move ETOPO's 0..360 seam to the antimeridian. Keep the sampled elevation
    # values continuous and let marching squares interpolate between them;
    # tracing a binary mask instead produces visibly stair-stepped paths.
    elevations = np.roll(elevations, len(longitudes) // 2, axis=1)
    longitudes = np.roll(longitudes, len(longitudes) // 2)
    longitudes = np.where(longitudes >= 180, longitudes - 360, longitudes)
    elevations = gaussian_filter(elevations, sigma=(0.65, 0.65), mode=("nearest", "wrap"))
    return longitudes, latitudes, elevations


def build_band(
    longitudes: np.ndarray,
    latitudes: np.ndarray,
    elevations: np.ndarray,
    threshold: int,
    tolerance: float,
    minimum_area: float,
) -> dict[str, Any]:
    generator = contour_generator(
        x=longitudes,
        y=latitudes,
        z=elevations,
        fill_type=FillType.OuterOffset,
        corner_mask=True,
    )
    point_groups, offset_groups = generator.filled(threshold, float(elevations.max()) + 1)
    polygons = []
    for points, offsets in zip(point_groups, offset_groups, strict=True):
        rings = [points[start:end] for start, end in zip(offsets[:-1], offsets[1:], strict=True)]
        geometry = Polygon(rings[0], rings[1:])
        if not geometry.is_valid:
            geometry = make_valid(geometry)
        for polygon in get_parts(geometry):
            if polygon.geom_type != "Polygon" or polygon.area < minimum_area:
                continue
            polygon = polygon.simplify(tolerance, preserve_topology=True)
            if not polygon.is_empty:
                polygons.append(polygon)

    combined = orient_polygons(MultiPolygon(polygons), exterior_cw=True)
    serialized = mapping(combined)
    serialized["coordinates"] = round_coordinates(serialized["coordinates"])
    return {"elevation": threshold, "geometry": serialized}


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("Usage: import-relief.py <etopo.nc> <output.json>")

    longitudes, latitudes, elevations = read_grid(Path(sys.argv[1]))
    bands = [
        build_band(
            longitudes,
            latitudes,
            elevations,
            threshold,
            tolerance,
            minimum_area,
        )
        for threshold, tolerance, minimum_area in BANDS
    ]
    Path(sys.argv[2]).write_text(json.dumps(bands, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    main()
