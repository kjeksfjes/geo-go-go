"""Bundle reviewed Wikimedia Commons state flags (front side) and source metadata.

Usage: python scripts/import-us-state-flags.py <Commons imageinfo metadata.json>
Fetch imageinfo=url|extmetadata for File:Flag of <English state name>.svg, with
redirects=1. Review the returned designs and licenses before running this tool.
Only public-domain or explicitly freely reusable artwork is accepted here.
"""
import hashlib
import html
import json
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
AGENT = 'GeoGoGo/0.22 educational geography project (https://github.com/kjeksfjes/geo-go-go)'


def main():
    catalog = json.loads((ROOT / 'src/data/us-state-catalog.json').read_text())
    titles = {'File:Flag of ' + s['name']['en'] + '.svg': s['code'] for s in catalog}
    metadata = json.loads(Path(sys.argv[1]).read_text())['query']
    for redirect in metadata.get('redirects', []):
        titles[redirect['to']] = titles[redirect['from']]
    output = ROOT / 'src/assets/state-flags'
    output.mkdir(parents=True, exist_ok=True)
    previous = {r['code']: r for r in json.loads((output / 'sources.json').read_text())['files']} if (output / 'sources.json').exists() else {}
    records = []
    for page in metadata['pages'].values():
        info = page['imageinfo'][0]
        meta = info['extmetadata']
        license_name = meta['LicenseShortName']['value']
        assert license_name in ['Public domain', 'Copyrighted free use'], (page['title'], license_name)
        code = titles[page['title']]
        target = output / f'{code}.svg'
        if target.exists():
            data = target.read_bytes()
        else:
            request = urllib.request.Request(info['url'], headers={'User-Agent': AGENT})
            for attempt in range(4):
                try:
                    with urllib.request.urlopen(request, timeout=45) as response:
                        data = response.read()
                    break
                except urllib.error.HTTPError as error:
                    if error.code != 429 or attempt == 3:
                        raise
                    time.sleep(min(30, int(error.headers.get('Retry-After', '20'))))
            time.sleep(1)
        tree = ET.fromstring(data)
        assert tree.tag.rsplit('}', 1)[-1] == 'svg'
        for el in tree.iter():
            assert el.tag.rsplit('}', 1)[-1] not in ['script', 'foreignObject', 'image']
            for key, value in el.attrib.items():
                assert not key.lower().startswith('on')
                if key.rsplit('}', 1)[-1] == 'href':
                    assert value.startswith('#')
                assert not re.search(r'url\(\s*["\']?https?:', value)
        source_hash = (previous.get(code, {}).get('sourceSha256') if target.exists() else None) or hashlib.sha256(data).hexdigest()
        data = ('\n'.join(line.rstrip() for line in data.decode('utf-8-sig').splitlines()) + '\n').encode('utf-8')
        target.write_bytes(data)
        plain = lambda key: html.unescape(re.sub('<[^>]+>', '', meta.get(key, {}).get('value', '')).strip())
        records.append({'code': code, 'file': f'{code}.svg', 'title': page['title'], 'page': info['descriptionurl'],
                        'url': info['url'], 'sourceSha256': source_hash, 'sha256': hashlib.sha256(data).hexdigest(),
                        'license': license_name, 'licenseUrl': plain('LicenseUrl'), 'usageTerms': plain('UsageTerms'),
                        'artist': plain('Artist'), 'usageNotes': plain('Restrictions')})
        print(code, license_name, len(data), flush=True)
    assert {r['code'] for r in records} == {s['code'] for s in catalog}
    (output / 'sources.json').write_text(json.dumps({'retrieved': date.today().isoformat(), 'purpose': 'Educational state identification; no official affiliation. Oregon is shown from its front side.', 'processing': 'Normalize line endings and remove trailing whitespace; artwork is unchanged.', 'files': sorted(records, key=lambda r: r['code'])}, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    main()
