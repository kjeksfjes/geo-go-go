"""Dissolve non-semantic Natural Earth map-unit boundaries for interaction.

Usage: pip install shapely; python scripts/build-geographic-units.py

Map units in meaningful-map-units.json remain individually interactive. All
other units sharing a quiz identity form one geographic interaction unit.
"""

import json
from collections import defaultdict
from pathlib import Path

from shapely import line_merge, orient_polygons, union_all
from shapely.geometry import mapping, shape


DATA = Path(__file__).resolve().parents[1] / "src" / "data"
INDEPENDENT_BY_ENTITY = json.loads(
    (DATA / "meaningful-map-units.json").read_text(encoding="utf-8")
)["independentMapUnitIdsByEntity"]
MEANINGFUL = {unit_id for unit_ids in INDEPENDENT_BY_ENTITY.values() for unit_id in unit_ids}
QUIZ_IDENTITY_BY_UNIT = json.loads(
    (DATA / "ne-quiz-identity-by-map-unit.json").read_text(encoding="utf-8")
)
DETAIL_FILL_GEOMETRIES = json.loads(
    (DATA / "ne-10m-canonical-fill-geometries.json").read_text(encoding="utf-8")
)
QUIZ_MERGES = json.loads((DATA / "quiz-map-merges.json").read_text(encoding="utf-8"))
SUPPLEMENTAL_BY_ID = {
    feature["id"]: feature["geometry"]
    for feature in json.loads((DATA / "supplemental-land.json").read_text(encoding="utf-8"))["features"]
}
LEASE_GEOMETRIES = json.loads((DATA / "leased-area-geometries.json").read_text(encoding="utf-8"))
SUBUNIT_ENTITY_BY_ID = {
    feature["id"]: feature["properties"]["entityId"]
    for feature in json.loads((DATA / "meaningful-subunits-50m.json").read_text(encoding="utf-8"))["features"]
}


def rounded(value):
    if isinstance(value, (list, tuple)):
        if value and isinstance(value[0], (int, float)):
            return [round(number, 5) for number in value]
        return [rounded(item) for item in value]
    return value


def build_supplemental_areas():
    """One Explore interaction shape per explicitly grouped public area."""
    labels = json.loads((DATA / "supplemental-area-labels.json").read_text(encoding="utf-8"))
    grouped = {}
    for area in labels:
        if len(area["sourceIds"]) < 2:
            continue
        parts = [shape(SUPPLEMENTAL_BY_ID[source_id]) for source_id in area["sourceIds"]]
        merged = union_all(parts)
        if not merged.is_valid or merged.geom_type not in ("Polygon", "MultiPolygon"):
            raise ValueError(f"Invalid supplemental area union: {area['id']}")
        geometry = mapping(orient_polygons(merged, exterior_cw=True))
        geometry["coordinates"] = rounded(geometry["coordinates"])
        entry = {"geometry": geometry}
        shared = line_merge(union_all([
            left.boundary.intersection(right.boundary)
            for index, left in enumerate(parts) for right in parts[index + 1:]
        ]))
        if not shared.is_empty and shared.geom_type in ("LineString", "MultiLineString"):
            division = mapping(shared)
            division["coordinates"] = rounded(division["coordinates"])
            entry["divisionGeometry"] = division
        grouped[area["id"]] = entry
    (DATA / "supplemental-area-geometries.json").write_text(
        json.dumps(grouped, separators=(",", ":")), encoding="utf-8",
    )


def build(resolution):
    source = json.loads((DATA / f"ne-map-units-{resolution}.json").read_text(encoding="utf-8"))
    grouped = defaultdict(list)
    for feature in source["features"]:
        if feature["id"] in MEANINGFUL:
            continue
        entity_id = QUIZ_IDENTITY_BY_UNIT.get(feature["id"])
        if entity_id is None:
            entity_id = feature.get("properties", {}).get("entityId")
        # The 10m asset contains only geometry; the 50m table supplies IDs.
        if entity_id is None:
            entity_id = ENTITY_BY_UNIT[feature["id"]]
        grouped[entity_id].append(feature)
    if resolution == "10m":
        for entity_id, geometries in DETAIL_FILL_GEOMETRIES.items():
            if entity_id not in grouped:
                raise ValueError(f"No detailed quiz geometry for {entity_id}")
            grouped[entity_id].extend({"geometry": geometry} for geometry in geometries)

    dissolved = {}
    for entity_id, parts in grouped.items():
        if len(parts) < 2:
            continue
        merged = union_all([shape(part["geometry"]) for part in parts])
        if merged.geom_type not in ("Polygon", "MultiPolygon"):
            raise ValueError(f"Unexpected geometry for {entity_id} at {resolution}")
        geometry = mapping(orient_polygons(merged, exterior_cw=True))
        geometry["coordinates"] = rounded(geometry["coordinates"])
        dissolved[entity_id] = geometry

    if resolution == "10m":
        base = json.loads((DATA / "combined-geographic-units-50m.json").read_text(encoding="utf-8"))
        for entity_id, geometry in dissolved.items():
            base_geometry = base.get(entity_id)
            if base_geometry and shape(geometry).area < shape(base_geometry).area * 0.9:
                # Some 10m source units split further than the canonical 50m
                # unit list. Do not silently omit a substantial source part.
                dissolved[entity_id] = base_geometry

    (DATA / f"combined-geographic-units-{resolution}.json").write_text(
        json.dumps(dissolved, separators=(",", ":")), encoding="utf-8",
    )

    quiz_geometries = {}
    subunits = {
        feature["id"]: feature["geometry"]
        for feature in json.loads((DATA / f"meaningful-subunits-{resolution}.json").read_text(encoding="utf-8"))["features"]
    }
    for policy in QUIZ_MERGES:
        entity_id = policy["entityId"]
        unit_id = policy["geographicUnitId"]
        if unit_id in quiz_geometries:
            raise ValueError(f"Duplicate quiz merge target: {unit_id}")
        if unit_id.startswith("subunit:"):
            subunit_id = unit_id.removeprefix("subunit:")
            if SUBUNIT_ENTITY_BY_ID.get(subunit_id) != entity_id:
                raise ValueError(f"Quiz subunit does not belong to {entity_id}: {unit_id}")
            parts = [shape(subunits[subunit_id])]
        elif unit_id == f"entity:{entity_id}" and entity_id in grouped and entity_id not in INDEPENDENT_BY_ENTITY:
            country = dissolved.get(entity_id)
            parts = [shape(country)] if country else [shape(part["geometry"]) for part in grouped[entity_id]]
        else:
            raise ValueError(f"Unsupported quiz merge target: {unit_id}")
        parts.extend(shape(SUPPLEMENTAL_BY_ID[source_id]) for source_id in policy["sourceIds"])
        parts.extend(shape(LEASE_GEOMETRIES[lease_id]) for lease_id in policy["leasedAreaIds"])
        if not all(part.is_valid for part in parts):
            raise ValueError(f"Invalid quiz merge input: {entity_id} at {resolution}")
        merged = union_all(parts)
        # Coarse country boundaries may cross a detailed buffer's dividing
        # line. Explicit exclusions prevent both quiz answers covering a half.
        exclusions = [shape(SUPPLEMENTAL_BY_ID[source_id]) for source_id in policy.get("excludeSourceIds", [])]
        if exclusions:
            if not all(part.is_valid for part in exclusions):
                raise ValueError(f"Invalid quiz exclusion: {unit_id}")
            merged = merged.difference(union_all(exclusions))
        if not merged.is_valid or merged.geom_type not in ("Polygon", "MultiPolygon"):
            raise ValueError(f"Invalid quiz merge: {entity_id} at {resolution}")
        geometry = mapping(orient_polygons(merged, exterior_cw=True))
        geometry["coordinates"] = rounded(geometry["coordinates"])
        quiz_geometries[unit_id] = geometry
    (DATA / f"quiz-merged-geometries-{resolution}.json").write_text(
        json.dumps(quiz_geometries, separators=(",", ":")), encoding="utf-8",
    )


base = json.loads((DATA / "ne-map-units-50m.json").read_text(encoding="utf-8"))
ENTITY_BY_UNIT = {
    feature["id"]: QUIZ_IDENTITY_BY_UNIT.get(feature["id"], feature["properties"]["entityId"])
    for feature in base["features"]
}
for entity_id, unit_ids in INDEPENDENT_BY_ENTITY.items():
    for unit_id in unit_ids:
        if ENTITY_BY_UNIT.get(unit_id) != entity_id:
            raise ValueError(f"{unit_id} is not a map unit of {entity_id}")

build_supplemental_areas()
for detail in ("50m", "10m"):
    build(detail)
