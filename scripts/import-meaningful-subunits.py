"""Build curated Admin-0 Map Subunit assets at both map resolutions.

Usage: pip install pyshp shapely; python scripts/import-meaningful-subunits.py <50m shapefile> <10m shapefile>

Both shapefiles should be Natural Earth 5.1.1 Admin-0 Map Subunits, with
their matching .dbf/.shx files beside them. Only IDs explicitly listed in
meaningful-map-units.json become named components. All other subunits of each
selected map unit are dissolved into one unnamed, interactive remainder.
None of these features creates a new quiz identity.
"""

import json
import sys
from pathlib import Path

import shapefile
from shapely import difference, intersection, make_valid, orient_polygons
from shapely.geometry import MultiLineString, mapping, shape
from shapely.ops import unary_union


DATA = Path(__file__).resolve().parents[1] / "src" / "data"
CONFIG = json.loads((DATA / "meaningful-map-units.json").read_text(encoding="utf-8"))
SELECTION = CONFIG["independentMapSubunitIdsByMapUnit"]
MERGE_UNLISTED_INTO = CONFIG.get("mergeUnlistedSubunitsInto", {})
MAP_UNIT_BY_SUBUNIT = {
    subunit_id: unit_id
    for unit_id, subunit_ids in SELECTION.items()
    for subunit_id in subunit_ids
}


def rounded(value):
    if isinstance(value, (list, tuple)):
        if value and isinstance(value[0], (int, float)):
            return [round(number, 5) for number in value]
        return [rounded(item) for item in value]
    return value


def polygon_geometry(value):
    result = mapping(orient_polygons(make_valid(value), exterior_cw=True))
    if result["type"] not in ("Polygon", "MultiPolygon"):
        raise ValueError(f"Expected polygon geometry, got {result['type']}")
    result["coordinates"] = rounded(result["coordinates"])
    return result


def line_geometry(value):
    def lines(part):
        if part.geom_type == "LineString":
            return [part]
        return [line for child in getattr(part, "geoms", ()) for line in lines(child)]

    pieces = lines(value)
    result = mapping(MultiLineString(pieces))
    result["coordinates"] = rounded(result["coordinates"])
    return result


def remainder_regional_geometry(resolution, map_unit_id, selected_geometries):
    index = json.loads((DATA / f"regional-display-{resolution}.json").read_text(encoding="utf-8"))
    result = {}
    selected = unary_union(selected_geometries)
    for region_id, entries in index.items():
        original = entries.get(map_unit_id)
        if not original:
            continue
        # A named component has its own path. Exclude it from the parent
        # regional display geometry as well, so it cannot be drawn twice.
        remaining = difference(shape(original["geometry"]), selected)
        if remaining.is_empty:
            continue
        # The selected component's normal path draws its own border. Keep
        # real and geographic-division edges distinct on the remainder.
        outside_selected = difference(
            shape(original["outline"]), selected.buffer(0.0001)
        )
        division = difference(
            shape(original["division"]), selected.buffer(0.0001)
        )
        result[region_id] = {
            "geometry": polygon_geometry(remaining),
            "outline": line_geometry(outside_selected),
            "division": line_geometry(division),
        }
    return result


def selected_features(path, resolution, include_metadata):
    source_by_map_unit = {map_unit_id: {} for map_unit_id in SELECTION}
    for record in shapefile.Reader(str(path)).iterShapeRecords():
        data = record.record.as_dict()
        subunit_id = data["SU_A3"]
        map_unit_id = data["GU_A3"]
        if map_unit_id not in source_by_map_unit:
            continue
        source_by_map_unit[map_unit_id][subunit_id] = (data, shape(record.shape.__geo_interface__))

    features = []
    for map_unit_id, selected_ids in SELECTION.items():
        source = source_by_map_unit[map_unit_id]
        missing = set(selected_ids) - source.keys()
        if missing:
            raise ValueError(f"Selected subunits missing from {path}: {sorted(missing)}")
        other_parts = [geometry for subunit_id, (_, geometry) in source.items()
                       if subunit_id not in selected_ids]
        merge_target = MERGE_UNLISTED_INTO.get(map_unit_id)
        if merge_target and merge_target not in selected_ids:
            raise ValueError(f"Remainder target {merge_target} is not selected for {map_unit_id}")
        selected_geometries = []
        for subunit_id in selected_ids:
            data, geometry = source[subunit_id]
            if data["GU_A3"] != MAP_UNIT_BY_SUBUNIT[subunit_id]:
                raise ValueError(f"{subunit_id} does not belong to {map_unit_id}")
            if subunit_id == merge_target and other_parts:
                # Some source resolutions add tiny subunits absent at 50m.
                # Keep the same semantic component set at both resolutions.
                geometry = unary_union([geometry, *other_parts])
            selected_geometries.append(geometry)
            feature = {"type": "Feature", "id": subunit_id,
                       "geometry": polygon_geometry(geometry)}
            if include_metadata:
                feature["properties"] = {
                    "name": data["SUBUNIT"],
                    "mapUnitId": map_unit_id,
                    "entityId": data["ADM0_A3"],
                    "featureType": data["TYPE"],
                }
            features.append(feature)

        if not other_parts or merge_target:
            continue
        remainder = {
            "type": "Feature",
            "id": f"remainder:{map_unit_id}",
            "geometry": polygon_geometry(unary_union(other_parts)),
        }
        if include_metadata:
            remainder["properties"] = {
                "name": map_unit_id,
                "mapUnitId": map_unit_id,
                "entityId": next(iter(source.values()))[0]["ADM0_A3"],
                "featureType": "Geo subunit",
            }
        regional = remainder_regional_geometry(
            resolution, map_unit_id, selected_geometries
        )
        if regional:
            remainder["regionalDisplayGeometry"] = regional
        features.append(remainder)
    return features


def main():
    source_50m, source_10m = map(Path, sys.argv[1:3])
    for resolution, path, metadata in (
        ("50m", source_50m, True),
        ("10m", source_10m, False),
    ):
        features = selected_features(path, resolution, metadata)
        destination = DATA / f"meaningful-subunits-{resolution}.json"
        destination.write_text(
            json.dumps({"type": "FeatureCollection", "features": features},
                       ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )


if __name__ == "__main__":
    main()
