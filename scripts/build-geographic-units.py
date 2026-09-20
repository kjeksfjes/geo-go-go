"""Dissolve non-semantic Natural Earth map-unit boundaries for interaction.

Usage: pip install shapely; python scripts/build-geographic-units.py

Map units in meaningful-map-units.json remain individually interactive. All
other units sharing a quiz identity form one geographic interaction unit.
"""

import json
from collections import defaultdict
from pathlib import Path

from shapely import orient_polygons, union_all
from shapely.geometry import mapping, shape


DATA = Path(__file__).resolve().parents[1] / "src" / "data"
INDEPENDENT_BY_ENTITY = json.loads(
    (DATA / "meaningful-map-units.json").read_text(encoding="utf-8")
)["independentMapUnitIdsByEntity"]
MEANINGFUL = {unit_id for unit_ids in INDEPENDENT_BY_ENTITY.values() for unit_id in unit_ids}


def rounded(value):
    if isinstance(value, (list, tuple)):
        if value and isinstance(value[0], (int, float)):
            return [round(number, 5) for number in value]
        return [rounded(item) for item in value]
    return value


def build(resolution):
    source = json.loads((DATA / f"ne-map-units-{resolution}.json").read_text(encoding="utf-8"))
    grouped = defaultdict(list)
    for feature in source["features"]:
        if feature["id"] in MEANINGFUL:
            continue
        entity_id = feature.get("properties", {}).get("entityId")
        # The 10m asset contains only geometry; the 50m table supplies IDs.
        if entity_id is None:
            entity_id = ENTITY_BY_UNIT[feature["id"]]
        grouped[entity_id].append(feature)

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

    (DATA / f"combined-geographic-units-{resolution}.json").write_text(
        json.dumps(dissolved, separators=(",", ":")), encoding="utf-8",
    )


base = json.loads((DATA / "ne-map-units-50m.json").read_text(encoding="utf-8"))
ENTITY_BY_UNIT = {feature["id"]: feature["properties"]["entityId"] for feature in base["features"]}
for entity_id, unit_ids in INDEPENDENT_BY_ENTITY.items():
    for unit_id in unit_ids:
        if ENTITY_BY_UNIT.get(unit_id) != entity_id:
            raise ValueError(f"{unit_id} is not a map unit of {entity_id}")

for detail in ("50m", "10m"):
    build(detail)
