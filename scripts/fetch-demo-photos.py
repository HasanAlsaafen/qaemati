#!/usr/bin/env python3
"""
One-off: downloads freely licensed demo photos from Wikimedia Commons (public
API) into public/demo-photos, so the demo restaurants have real pictures that
are served from this app, never hot linked. Writes CREDITS.md (author and
license of every photo) and src/prisma-seed/demo-photos.json (dish -> file).

    python3 scripts/fetch-demo-photos.py            # fetch what is missing
    python3 scripts/fetch-demo-photos.py "Shakshuka" # refetch one dish

Only CC0, public domain, CC BY and CC BY-SA files are kept. Review the result
by eye: a search can return a wrong picture. Override a query in QUERIES.
"""
import io, json, os, re, sys, time, urllib.parse, urllib.request
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'public', 'demo-photos')
MANIFEST = os.path.join(ROOT, 'src', 'prisma-seed', 'demo-photos.json')
API = 'https://commons.wikimedia.org/w/api.php'
UA = 'QaematiDemoPhotos/1.0 (demo seed; contact hasansaafen1234@gmail.com)'
OK_LICENSE = re.compile(r'^(cc0|public domain|pd|cc[ -]by(?!-nc)(?!-nd))', re.I)
BAD_TITLE = re.compile(r'map|logo|diagram|menu|icon|flag|stamp|poster|painting|drawing|svg|people|woman|man |girl|boy|child', re.I)

# dish (English name in seed-data.ts) -> Commons search text. Default is the name.
QUERIES = {
  'Arabic Coffee': 'Arabic coffee',
  'Turkish Coffee': 'Turkish coffee cup cezve',
  'Berry Smoothie': 'berry smoothie glass',
  'Cheese Sambousek': 'fried cheese pastry',
  'Fresh Orange Juice': 'glass of orange juice',
  'Freekeh with Chicken': 'freekeh chicken dish',
  'Grilled Fish Fillet': 'grilled fish',
  'Grilled Vegetable Sandwich': 'grilled vegetable sandwich',
  'Mint Lemonade': 'lemonade mint glass',
  'Olive & Cheese Plate': 'olives cheese platter',
  'Spanish Latte': 'latte glass coffee',
  'Tabbouleh': 'tabbouleh salad',
  'Um Ali': 'Umm Ali dessert',
  'Mixed Grill': 'mixed grill',
  'Rice Pudding': 'rice pudding bowl',
  'Baklava Assortment': 'baklava',
  'Chicken Shish Tawook': 'shish taouk chicken skewers',
  'Knafeh Nabulsieh': 'kanafeh',
  'Labneh & Zaatar Plate': 'labneh',
  'Maamoul': 'maamoul cookies',
  'Manakeesh Cheese': 'manakish cheese',
  'Manakeesh Halloumi & Zaatar': 'manakish zaatar',
  'Manakeesh Zaatar': 'manakish zaatar',
  'Warak Enab': 'stuffed grape leaves',
}
# dish -> exact Commons file, when the search keeps returning the wrong picture.
FILES = {
  'Arabic Coffee': 'File:Arabic coffee with dates.jpg',
  'Cheese Sambousek': 'File:Sambousek (4009290205).jpg',
  'Manakeesh Zaatar': "File:Manakish Za'atar.jpg",
  'Manakeesh Halloumi & Zaatar': 'File:Zaatar Mankousheh.jpg',
  'Freekeh with Chicken': 'File:Freekeh with roasted vegetables.jpg',
}
EXTRA = {  # not dishes: key -> query
  'cover-cafe': 'coffee shop interior cafe',
  'cover-grill': 'kebab grill charcoal',
}

def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()

def by_title(title):
    q = urllib.parse.urlencode({
        'action': 'query', 'titles': title, 'prop': 'imageinfo',
        'iiprop': 'url|size|mime|extmetadata', 'iiurlwidth': 800, 'format': 'json'})
    data = json.loads(get(API + '?' + q))
    return [dict(p, index=1) for p in data['query']['pages'].values() if 'imageinfo' in p]

def search(text):
    q = urllib.parse.urlencode({
        'action': 'query', 'generator': 'search', 'gsrsearch': text + ' filetype:bitmap',
        'gsrnamespace': 6, 'gsrlimit': 15, 'prop': 'imageinfo',
        'iiprop': 'url|size|mime|extmetadata', 'iiurlwidth': 800, 'format': 'json'})
    data = json.loads(get(API + '?' + q))
    pages = sorted(data.get('query', {}).get('pages', {}).values(), key=lambda p: p['index'])
    return pages

def pick(pages):
    for p in pages:
        info = p['imageinfo'][0]
        meta = info.get('extmetadata', {})
        lic = meta.get('LicenseShortName', {}).get('value', '')
        if info['mime'] != 'image/jpeg' or info['width'] < 700 or info['height'] < 480: continue
        if BAD_TITLE.search(p['title']) or not OK_LICENSE.match(lic): continue
        strip = lambda s: re.sub(r'<[^>]+>', '', s or '').strip()
        return {
            'title': p['title'], 'thumb': info['thumburl'], 'page': info['descriptionurl'],
            'license': lic, 'author': strip(meta.get('Artist', {}).get('value')) or 'Unknown'}
    return None

def fit(raw, w, h):
    im = Image.open(io.BytesIO(raw)).convert('RGB')
    ratio = w / h
    iw, ih = im.size
    if iw / ih > ratio:
        nw = int(ih * ratio); im = im.crop(((iw - nw) // 2, 0, (iw - nw) // 2 + nw, ih))
    else:
        nh = int(iw / ratio); im = im.crop((0, (ih - nh) // 2, iw, (ih - nh) // 2 + nh))
    return im.resize((w, h), Image.LANCZOS)

def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')

def dishes():
    src = open(os.path.join(ROOT, 'src', 'prisma-seed', 'seed-data.ts'), encoding='utf8').read()
    names = re.findall(r"^\s{12}nameEn: '([^']+)'", src, re.M)  # items are nested deepest
    return sorted(set(names))

def main():
    only = sys.argv[1:]
    os.makedirs(OUT, exist_ok=True)
    manifest = json.load(open(MANIFEST)) if os.path.exists(MANIFEST) else {}
    credits = manifest.get('_credits', {})
    jobs = [(n, QUERIES.get(n, n + ' food'), 640, 480) for n in dishes()]
    jobs += [(k, q, 1200, 600) for k, q in EXTRA.items()]
    for name, query, w, h in jobs:
        key = slug(name)
        path = os.path.join(OUT, key + '.jpg')
        if only and name not in only: continue
        if not only and os.path.exists(path): continue
        try:
            found = pick(by_title(FILES[name]) if name in FILES else search(query))
            if not found: print('NONE ', name); continue
            fit(get(found['thumb']), w, h).save(path, 'JPEG', quality=78, optimize=True)
            manifest[name] = key + '.jpg'
            credits[key + '.jpg'] = found
            print('OK   ', name, '<-', found['title'])
        except Exception as e:
            print('FAIL ', name, e)
        time.sleep(1.0)
    manifest['_credits'] = credits
    json.dump(manifest, open(MANIFEST, 'w'), ensure_ascii=False, indent=2, sort_keys=True)
    with open(os.path.join(OUT, 'CREDITS.md'), 'w', encoding='utf8') as f:
        f.write('# Demo photo credits\n\nPhotos from Wikimedia Commons, resized and cropped. Each keeps its own license.\n\n')
        for file, c in sorted(credits.items()):
            f.write(f"- `{file}`: [{c['title']}]({c['page']}) by {c['author']}, {c['license']}\n")

main()
