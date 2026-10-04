"""Build curated geographic-component assets at both map resolutions.

Usage: pip install pyshp shapely; python scripts/import-meaningful-subunits.py <50m subunits shapefile> <10m subunits shapefile> <10m admin-1 shapefile>

The first two shapefiles are Natural Earth 5.1.1 Admin-0 Map Subunits. The
third supplies named Admin-1 regions when an island is not an Admin-0 subunit.
Its boundary identifies whole coastline polygons from each resolution's
Admin-0 source, keeping the displayed country and component edges identical.
All unselected geometry becomes one interactive remainder. None of these
features creates a new quiz identity.

Curated coastline components use seed points to select whole island polygons
from the checked-in 10m map-unit atlas. Their detailed polygon is also retained
at 50m when the coarser source omits it.
"""

import json
import sys
from pathlib import Path

import shapefile
from shapely import difference, intersection, make_valid, orient_polygons
from shapely.geometry import MultiLineString, Point, mapping, shape
from shapely.ops import unary_union


DATA = Path(__file__).resolve().parents[1] / "src" / "data"
CONFIG = json.loads((DATA / "meaningful-map-units.json").read_text(encoding="utf-8"))
SELECTION = CONFIG["independentMapSubunitIdsByMapUnit"]
ADMIN1_SELECTION = CONFIG.get("independentAdmin1RegionsByMapUnit", {})
SOURCE_IDS_AT_10M = CONFIG.get("sourceSubunitIdsAt10m", {})
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


def admin1_regions(path):
    requested = {code for codes in ADMIN1_SELECTION.values() for code in codes}
    regions = {}
    for record in shapefile.Reader(str(path)).iterShapeRecords():
        data = record.record.as_dict()
        code = data["iso_3166_2"]
        if code not in requested:
            continue
        regions[code] = (data["name_en"], data["type_en"], data["adm0_a3"],
                         shape(record.shape.__geo_interface__))
    if set(regions) != set(requested):
        raise ValueError(f"Missing Admin-1 regions: {sorted(set(requested) - set(regions))}")
    return regions


def polygons(geometry):
    if geometry.geom_type == "Polygon":
        return [geometry]
    return list(geometry.geoms)


def include_coastline_components(features, include_metadata):
    """Split explicitly named whole islands; retain detailed coverage at 50m."""
    detailed = {
        feature["id"]: shape(feature["geometry"])
        for feature in json.loads((DATA / "ne-map-units-10m.json").read_text())["features"]
    }
    parents_by_id = {
        feature["id"]: feature["properties"]
        for feature in json.loads((DATA / "ne-map-units-50m.json").read_text())["features"]
    }
    for component in CONFIG.get("independentCoastlineComponents", []):
        map_unit_id = component["mapUnitId"]
        point = Point(component["point"])
        matched = [part for part in polygons(detailed[map_unit_id]) if part.covers(point)]
        if len(matched) != 1:
            raise ValueError(f"Expected one coastline polygon for {component['id']}")
        island = matched[0]
        parents = []
        regional = {}
        for feature in features:
            # Only split the parent unit's selected source parts or remainder.
            source_id = feature["id"]
            belongs = (source_id in SELECTION.get(map_unit_id, [])
                       or source_id in ADMIN1_SELECTION.get(map_unit_id, [])
                       or source_id == f"remainder:{map_unit_id}")
            if not belongs:
                continue
            original = shape(feature["geometry"])
            if original.intersection(island).area <= 1e-10:
                continue
            parents.append(source_id)
            remaining = original.difference(island)
            if remaining.is_empty:
                raise ValueError(f"Coastline component replaces entire parent {source_id}")
            feature["geometry"] = polygon_geometry(remaining)
            # Preserve regional clipping while removing the named island from
            # any regional variant that contains it.
            for display in feature.get("regionalDisplayGeometry", {}).values():
                if shape(display["geometry"]).intersection(island).area <= 1e-10:
                    continue
                display["geometry"] = polygon_geometry(shape(display["geometry"]).difference(island))
                for field in ("outline", "division"):
                    display[field] = line_geometry(shape(display[field]).difference(island))
        resolution = "50m" if include_metadata else "10m"
        regional_index = json.loads((DATA / f"regional-display-{resolution}.json").read_text())
        for region_id, entries in regional_index.items():
            if map_unit_id not in entries:
                continue
            visible = island.intersection(shape(entries[map_unit_id]["geometry"]))
            # Empty regional variants keep remote islands out of regional
            # fitting and interaction without changing country membership.
            empty = {"type": "GeometryCollection", "geometries": []}
            regional[region_id] = {
                "geometry": polygon_geometry(visible) if not visible.is_empty else empty,
                "outline": line_geometry(visible.boundary) if not visible.is_empty else empty,
                "division": empty,
            }
        if len(parents) > 1 or (not include_metadata and len(parents) != 1):
            raise ValueError(f"Unexpected coastline component parents: {component['id']}: {parents}")
        feature = {"type": "Feature", "id": component["id"],
                   "geometry": polygon_geometry(island)}
        if regional:
            feature["regionalDisplayGeometry"] = regional
        if include_metadata:
            feature["properties"] = {
                "name": component["name"], "mapUnitId": map_unit_id,
                "entityId": parents_by_id[map_unit_id]["entityId"], "featureType": "Island",
                "sourceKind": "coastline",
            }
        features.append(feature)
    return features


def selected_features(path, resolution, include_metadata, admin1):
    source_by_map_unit = {map_unit_id: {} for map_unit_id in SELECTION.keys() | ADMIN1_SELECTION.keys()}
    for record in shapefile.Reader(str(path)).iterShapeRecords():
        data = record.record.as_dict()
        subunit_id = data["SU_A3"]
        map_unit_id = data["GU_A3"]
        if map_unit_id not in source_by_map_unit:
            continue
        source_by_map_unit[map_unit_id][subunit_id] = (data, shape(record.shape.__geo_interface__))

    features = []
    for map_unit_id in source_by_map_unit:
        selected_ids = SELECTION.get(map_unit_id, [])
        source = source_by_map_unit[map_unit_id]
        selected_source_ids = {
            source_id
            for selected_id in selected_ids
            for source_id in (SOURCE_IDS_AT_10M.get(selected_id, [selected_id])
                              if resolution == "10m" else [selected_id])
        }
        missing = selected_source_ids - source.keys()
        if missing:
            raise ValueError(f"Selected subunits missing from {path}: {sorted(missing)}")
        other_parts = [geometry for subunit_id, (_, geometry) in source.items()
                       if subunit_id not in selected_source_ids]
        merge_target = MERGE_UNLISTED_INTO.get(map_unit_id)
        if merge_target and merge_target not in selected_ids:
            raise ValueError(f"Remainder target {merge_target} is not selected for {map_unit_id}")
        selected_geometries = []
        for subunit_id in selected_ids:
            source_ids = (SOURCE_IDS_AT_10M.get(subunit_id, [subunit_id])
                          if resolution == "10m" else [subunit_id])
            data = source[source_ids[0]][0]
            geometry = unary_union([source[source_id][1] for source_id in source_ids])
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

        for code in ADMIN1_SELECTION.get(map_unit_id, []):
            name, feature_type, entity_id, region = admin1[code]
            if entity_id != next(iter(source.values()))[0]["ADM0_A3"]:
                raise ValueError(f"Admin-1 region {code} belongs to {entity_id}, not {map_unit_id}")
            # Select complete source coastline polygons belonging to the named
            # region. Intersecting the Admin-1 outline directly would create
            # slivers where its coastline differs from the Admin-0 source.
            source_polygons = [part for _, geometry in source.values()
                               for part in polygons(geometry)]
            matched = [part for part in source_polygons
                       if part.intersection(region).area > part.area * 0.5]
            if not matched:
                raise ValueError(f"No {resolution} coastline polygons for {code}")
            geometry = unary_union(matched)
            selected_geometries.append(geometry)
            feature = {"type": "Feature", "id": code,
                       "geometry": polygon_geometry(geometry)}
            if include_metadata:
                feature["properties"] = {
                    "name": name,
                    "mapUnitId": map_unit_id,
                    "entityId": entity_id,
                    "featureType": feature_type or "Admin-1 region",
                    "sourceKind": "admin-1",
                }
            features.append(feature)

        if not other_parts or merge_target:
            continue
        remaining = difference(unary_union(other_parts), unary_union(selected_geometries))
        if remaining.is_empty:
            continue
        remainder = {
            "type": "Feature",
            "id": f"remainder:{map_unit_id}",
            "geometry": polygon_geometry(remaining),
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
    if len(sys.argv) != 4:
        raise SystemExit(__doc__)
    source_50m, source_10m, source_admin1 = map(Path, sys.argv[1:4])
    admin1 = admin1_regions(source_admin1)
    for resolution, path, metadata in (
        ("50m", source_50m, True),
        ("10m", source_10m, False),
    ):
        features = include_coastline_components(
            selected_features(path, resolution, metadata, admin1), metadata
        )
        destination = DATA / f"meaningful-subunits-{resolution}.json"
        destination.write_text(
            json.dumps({"type": "FeatureCollection", "features": features},
                       ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )


if __name__ == "__main__":
    main()
