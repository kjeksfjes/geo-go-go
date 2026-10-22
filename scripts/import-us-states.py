"""Build the 50-state atlas from Census 2025 1:500,000 cartographic boundaries.

Usage: python scripts/import-us-states.py <cb_2025_us_state_500k.zip>
Requires pyshp >= 2.3 and Shapely >= 2.1 in an import-only Python environment.
No DC or territories are quiz identities. Preserve shared boundaries and holes;
keep geographic coordinates unchanged for the runtime's Alaska/Hawaii insets.
"""
import hashlib
import json
import sys
import zipfile
from datetime import date
from pathlib import Path
import shapefile
from shapely import coverage_simplify, coverage_is_valid, orient_polygons
from shapely.geometry import shape, mapping

ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'https://www2.census.gov/geo/tiger/GENZ2025/shp/cb_2025_us_state_500k.zip'
TOLERANCE = 0.001


def rounded(value):
    if isinstance(value, (list, tuple)):
        return [rounded(v) for v in value]
    return round(value, 6) if isinstance(value, float) else value


def main():
    archive = Path(sys.argv[1])
    catalog = json.loads((ROOT / 'src/data/us-state-catalog.json').read_text())
    expected = {s['fips']: s for s in catalog}
    assert len(expected) == 50
    with zipfile.ZipFile(archive) as z:
        extension = lambda ext: z.open(next(n for n in z.namelist() if n.endswith(ext)))
        reader = shapefile.Reader(shp=extension('.shp'), shx=extension('.shx'), dbf=extension('.dbf'))
        records = {r.record['STATEFP']: r for r in reader.iterShapeRecords() if r.record['STATEFP'] in expected}
    assert set(records) == set(expected)
    originals = []
    for fips, state in expected.items():
        record = records[fips]
        assert record.record['NAME'] == state['name']['en'] and record.record['STUSPS'] == state['code']
        geometry = shape(record.shape.__geo_interface__)
        assert geometry.is_valid and not geometry.is_empty
        originals.append(geometry)
    assert coverage_is_valid(originals), 'Source state polygons overlap'
    simplified = coverage_simplify(originals, TOLERANCE)
    features = []
    for state, original, geometry in zip(catalog, originals, simplified):
        assert geometry.is_valid and not geometry.is_empty
        assert abs(geometry.area / original.area - 1) < 0.015, state['code']
        geo = mapping(orient_polygons(geometry, exterior_cw=True))
        features.append({'type': 'Feature', 'id': state['id'], 'properties': {'code': state['code'], 'fips': state['fips']},
                         'geometry': {'type': geo['type'], 'coordinates': rounded(geo['coordinates'])}})
    output = ROOT / 'src/data/us-states.json'
    output.write_text(json.dumps({'type': 'FeatureCollection', 'features': features}, separators=(',', ':')) + '\n')
    source = {'source': SOURCE, 'vintage': '2025', 'retrieved': date.today().isoformat(),
              'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
              'license': 'U.S. government work; public domain in the United States.',
              'licenseSource': 'https://www2.census.gov/foia/ds_policies/ds027.pdf',
              'attribution': 'State boundaries: U.S. Census Bureau, 2025 cartographic boundaries (1:500,000).',
              'processing': f'Keep exactly the 50 reviewed state FIPS identities; exclude DC and territories. Topology-preserving coverage simplification at {TOLERANCE} degrees; retain islands and lake holes, clockwise exteriors for D3; round coordinates to six decimals. Alaska/Hawaii remain in their geographic positions in the asset; inset layout is a runtime projection.',
              'names': 'English Census names; Norwegian directional forms following NRK language guidance; all other names retain the English form.',
              'nameSource': 'https://sprak.nrk.no/2016/delstatar-usa/'}
    (ROOT / 'docs/us-states-source.json').write_text(json.dumps(source, ensure_ascii=False, indent=2) + '\n')
    print(f'{output.name}: {len(features)} states, {output.stat().st_size:,} bytes')


if __name__ == '__main__':
    main()
