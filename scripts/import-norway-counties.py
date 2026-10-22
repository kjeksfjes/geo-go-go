"""Import Kartverket county GeoJSON (2026) clipped to the existing 10m atlas coast.

Usage: python scripts/import-norway-counties.py <official GeoJSON zip>
Requires shapely >= 2.1 and pyproj, only for regeneration, not the app.
Download: https://nedlasting.geonorge.no/geonorge/Basisdata/Fylker/GeoJSON/Basisdata_0000_Norge_4258_Fylker_GeoJSON.zip
"""
import hashlib
import json
import sys
import zipfile
from pathlib import Path

from pyproj import Transformer
from shapely import coverage_is_valid, coverage_simplify, make_valid, orient_polygons
from shapely.geometry import mapping, shape
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
EXPECTED = {'03': 'Oslo', '11': 'Rogaland', '15': 'Møre og Romsdal', '18': 'Nordland', '31': 'Østfold', '32': 'Akershus', '33': 'Buskerud', '34': 'Innlandet', '39': 'Vestfold', '40': 'Telemark', '42': 'Agder', '46': 'Vestland', '50': 'Trøndelag', '55': 'Troms', '56': 'Finnmark'}
SOURCE = 'https://nedlasting.geonorge.no/geonorge/Basisdata/Fylker/GeoJSON/Basisdata_0000_Norge_4258_Fylker_GeoJSON.zip'


def rounded(value):
    if isinstance(value, (list, tuple)):
        return [rounded(x) for x in value]
    return round(value, 6) if isinstance(value, float) else value


def main():
    archive = Path(sys.argv[1])
    with zipfile.ZipFile(archive) as z:
        source = json.loads(z.read(next(n for n in z.namelist() if n.endswith('.geojson'))))
    counties = {f['properties']['fylkesnummer']: f for f in source['features'] if f['properties'].get('objtype') == 'Fylke'}
    if set(counties) != set(EXPECTED):
        raise ValueError('County identity coverage differs from the reviewed 15-county catalog')
    coast_file = ROOT / 'src/data/ne-map-units-10m.json'
    coast = shape(next(f['geometry'] for f in json.loads(coast_file.read_text())['features'] if f['id'] == 'NOR'))
    project = Transformer.from_crs('EPSG:4258', 'EPSG:25833', always_xy=True).transform
    unproject = Transformer.from_crs('EPSG:25833', 'EPSG:4326', always_xy=True).transform
    shapes = []
    for code, name in sorted(EXPECTED.items()):
        f = counties[code]
        names = f['properties']['administrativenhetnavn']
        if not any(n['navn'] == name and n['sprak'] == 'nor' for n in names):
            raise ValueError(f'County name changed: {code}')
        clipped = make_valid(shape(f['geometry'])).intersection(coast)
        polygons = [clipped] if clipped.geom_type == 'Polygon' else [g for g in clipped.geoms if g.geom_type == 'Polygon']
        geometry = transform(project, unary_union(polygons))
        if geometry.is_empty or not geometry.is_valid:
            raise ValueError(f'Invalid land geometry: {code}')
        shapes.append(geometry)
    if not coverage_is_valid(shapes):
        raise ValueError('County polygons overlap; inspect the source before simplifying')
    for level, tolerance in [('overview', 350), ('detail', 80)]:
        simplified = coverage_simplify(shapes, tolerance)
        features = []
        for (code, name), original, geometry in zip(sorted(EXPECTED.items()), shapes, simplified):
            if not geometry.is_valid or abs(geometry.area / original.area - 1) > 0.025:
                raise ValueError(f'Simplification changed county area too much: {code}')
            # D3 expects clockwise exterior rings for small spherical polygons.
            geo = dict(mapping(orient_polygons(transform(unproject, geometry), exterior_cw=True)))
            geo['coordinates'] = rounded(geo['coordinates'])
            features.append({'type': 'Feature', 'id': f'no:county:{code}', 'properties': {'code': code, 'name': name}, 'geometry': geo})
        output = ROOT / f'src/data/norway-counties-{level}.json'
        output.write_text(json.dumps({'type': 'FeatureCollection', 'features': features}, ensure_ascii=False, separators=(',', ':')) + '\n')
        print(f'{output.name}: {len(features)} counties, {output.stat().st_size:,} bytes')
    provenance = {'source': SOURCE, 'referenceDate': '2026-01-01', 'retrieved': '2026-10-22', 'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'license': 'CC BY 4.0', 'attribution': 'County boundaries © Kartverket, CC BY 4.0; coastline © Natural Earth, public domain.', 'coastline': {'file': 'src/data/ne-map-units-10m.json', 'sha256': hashlib.sha256(coast_file.read_bytes()).hexdigest(), 'source': 'Natural Earth 5.1.1 Admin-0 Map Units, 1:10m'}, 'processing': 'Intersect county polygons with the atlas Norway land, project to ETRS89 / UTM 33N, topology-preserving coverage simplification at 350m/80m, transform to WGS84 and round to six decimals.'}
    (ROOT / 'docs/norway-counties-source.json').write_text(json.dumps(provenance, indent=2, ensure_ascii=False) + '\n')


if __name__ == '__main__':
    main()
