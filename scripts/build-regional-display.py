"""Build optional regional map-unit geometries from geographic boundaries.

Usage:
    pip install shapely
    python scripts/build-regional-display.py asia_europe_border.geojson

The boundary source is Alexandr Trubetskoy's Europe–Asia Boundary Shapefile:
https://sashamaps.net/resources/europe-asia-boundary/
https://github.com/sashatrubetskoy/asia_europe_border

The input is its GeoJSON export. Natural Earth's checked-in Admin-0 Map Unit
assets remain untouched; output files are separate region/unit overrides.
"""

import json
import sys
from pathlib import Path

from shapely import intersection, make_valid, orient_polygons
from shapely.geometry import MultiLineString, Polygon, mapping, shape
from shapely.ops import linemerge


DATA = Path(__file__).resolve().parents[1] / "src" / "data"


def europe_side(boundary_path):
    source = json.loads(boundary_path.read_text(encoding="utf-8"))
    lines = linemerge([shape(feature["geometry"]) for feature in source["features"]])

    # The boundary has several disconnected maritime sections. The long
    # Caucasus–Caspian–Ural–Kara Sea section is the one that crosses Russia.
    ural_line = max(lines.geoms, key=lambda line: line.bounds[3])
    coordinates = list(ural_line.coords)
    if coordinates[0][1] > coordinates[-1][1]:
        coordinates.reverse()

    # Close the western side *outside* Russian territory. Only the boundary
    # itself can cut Russia: the other edges are beyond its south, west, and
    # north extent. This is a geographic polygon operation, not a rectangular
    # crop or a screen-space mask.
    south_lon, _ = coordinates[0]
    north_lon, _ = coordinates[-1]
    region_shape = Polygon([
        *coordinates,
        (north_lon, 90),
        (0, 90),
        (0, -10),
        (south_lon, -10),
    ])
    # The published line has a tiny self-crossing near the Caucasus. Resolve
    # that source topology before intersecting it with Natural Earth.
    return make_valid(region_shape)


def rounded(value):
    if isinstance(value, (list, tuple)):
        if value and isinstance(value[0], (int, float)):
            return [round(number, 5) for number in value]
        return [rounded(item) for item in value]
    return value


def linework(value):
    """Discard isolated point intersections; only visible boundary lines remain."""
    if value.geom_type == "LineString":
        return [value]
    if hasattr(value, "geoms"):
        return [line for part in value.geoms for line in linework(part)]
    return []


def geographic_lines(value):
    lines = linework(value)
    if not lines:
        raise ValueError("Regional display boundary did not produce linework")
    result = mapping(lines[0] if len(lines) == 1 else MultiLineString(lines))
    result["coordinates"] = rounded(result["coordinates"])
    return result


def build_override(resolution, region, unit_id, region_shape):
    atlas = json.loads((DATA / f"ne-map-units-{resolution}.json").read_text(encoding="utf-8"))
    feature = next(feature for feature in atlas["features"] if feature["id"] == unit_id)
    original = shape(feature["geometry"])
    regional_part = intersection(original, region_shape)
    if regional_part.is_empty or regional_part.geom_type not in ("Polygon", "MultiPolygon"):
        raise ValueError(f"No polygonal {region} geometry for {unit_id} at {resolution}")

    # d3-geo expects clockwise exterior rings for areas smaller than a
    # hemisphere, matching Natural Earth's original GeoJSON ring winding.
    geometry = mapping(orient_polygons(regional_part, exterior_cw=True))
    geometry["coordinates"] = rounded(geometry["coordinates"])
    # Keep actual Natural Earth edges separate from the geographic cut. The
    # rendered fill has no stroke; these two line sets receive distinct styles.
    outline = geographic_lines(intersection(original.boundary, region_shape))
    division = geographic_lines(intersection(original, region_shape.boundary))
    destination = DATA / f"regional-display-{resolution}.json"
    destination.write_text(
        json.dumps({region: {unit_id: {
            "geometry": geometry,
            "outline": outline,
            "division": division,
        }}}, separators=(",", ":")),
        encoding="utf-8",
    )


def main():
    region_shape = europe_side(Path(sys.argv[1]))
    # Add another region/unit pair here only when a single Natural Earth map
    # unit genuinely crosses that region's geographic boundary.
    for resolution in ("50m", "10m"):
        build_override(resolution, "europe", "RUS", region_shape)


if __name__ == "__main__":
    main()
