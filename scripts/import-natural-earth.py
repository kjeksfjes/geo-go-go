"""Build the checked-in browser assets from Natural Earth Admin-0 Map Units.

Usage: pip install pyshp; python scripts/import-natural-earth.py <50m shapefile> <10m shapefile>
The matching .dbf/.shx files must be beside each .shp file. Both source
archives are Natural Earth 5.1.1. The 50m table is the canonical unit list;
10m contributes higher-detail geometry for those same units only.
"""

import json
import sys
from pathlib import Path

import shapefile


def coordinates_rounded(value):
    if isinstance(value, (list, tuple)):
        if value and isinstance(value[0], (int, float)):
            return [round(number, 5) for number in value]
        return [coordinates_rounded(item) for item in value]
    return value


def rows(path):
    reader = shapefile.Reader(str(path))
    for shape_record in reader.iterShapeRecords():
        data = shape_record.record.as_dict()
        if data["REGION_UN"] == "Antarctica":
            continue
        geometry = shape_record.shape.__geo_interface__
        geometry["coordinates"] = coordinates_rounded(geometry["coordinates"])
        yield data, geometry


def write_json(path, features):
    path.write_text(
        json.dumps({"type": "FeatureCollection", "features": features},
                   ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )


def main():
    source_50m, source_10m = map(Path, sys.argv[1:3])
    destination = Path(__file__).resolve().parents[1] / "src" / "data"
    base_features = []
    ids_by_key = {}
    source_records = []
    for data, geometry in rows(source_50m):
        source_records.append(data)
        key = (data["ADM0_A3"], data["GEOUNIT"])
        unit_id = data["GU_A3"]
        ids_by_key[key] = unit_id
        base_features.append({
            "type": "Feature", "id": unit_id,
            "properties": {
                "name": data["GEOUNIT"],
                "entityId": data["ADM0_A3"],
                "adminName": data["ADMIN"],
                "sovereignId": data["SOV_A3"],
                "sovereignName": data["SOVEREIGNT"],
                "featureType": data["TYPE"],
                "isoA2": data["ISO_A2_EH"],
                "regionUn": data["REGION_UN"],
                "subregion": data["SUBREGION"],
                "continent": data["CONTINENT"],
            },
            "geometry": geometry,
        })

    taxonomy = json.loads((destination / "country-taxonomy.json").read_text(encoding="utf-8"))
    independent = set(taxonomy["independentDisputedEntityIds"])
    known_entity_ids = {feature["properties"]["entityId"] for feature in base_features}
    if independent - known_entity_ids:
        raise ValueError(f"Unknown independent quiz entities: {sorted(independent - known_entity_ids)}")
    quiz_identity_by_unit = {}
    for data in source_records:
        source_id = data["ADM0_A3"]
        canonical_id = data["ADM0_ISO"]
        # TYPE alone calls some breakaway units sovereign countries. Combine
        # Natural Earth's ISO-aligned identity and recognition fields instead.
        if (data["ADM0_DIFF"] == "1"
                and data["FCLASS_ISO"] == "Unrecognized"
                and data["TYPE"] in ("Sovereign country", "Disputed")
                and canonical_id != source_id
                and source_id not in independent):
            if canonical_id not in known_entity_ids:
                raise ValueError(f"No canonical entity for {data['GU_A3']}: {canonical_id}")
            quiz_identity_by_unit[data["GU_A3"]] = canonical_id

    detailed = {}
    canonical_fill_geometries = {}
    for data, geometry in rows(source_10m):
        unit_id = ids_by_key.get((data["ADM0_A3"], data["GEOUNIT"]))
        if unit_id:
            detailed[unit_id] = {"type": "Feature", "id": unit_id, "geometry": geometry}
        elif (data["TYPE"] == "Indeterminate"
              and data["FCLASS_ISO"] == "Unrecognized"
              and data["ADM0_ISO"] in known_entity_ids
              and data["ADM0_ISO"] != data["ADM0_A3"]):
            # A finer-scale buffer/no-man's-area unit can belong to a
            # canonical country's displayed geometry without becoming a new
            # quiz or interaction identity.
            canonical_fill_geometries.setdefault(data["ADM0_ISO"], []).append(geometry)

    write_json(destination / "ne-map-units-50m.json", base_features)
    write_json(destination / "ne-map-units-10m.json",
               [detailed[feature["id"]] for feature in base_features if feature["id"] in detailed])
    (destination / "ne-quiz-identity-by-map-unit.json").write_text(
        json.dumps(quiz_identity_by_unit, sort_keys=True, separators=(",", ":")),
        encoding="utf-8",
    )
    (destination / "ne-10m-canonical-fill-geometries.json").write_text(
        json.dumps(canonical_fill_geometries, separators=(",", ":")),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
