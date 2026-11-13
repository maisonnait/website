"""Assemble ../index.html from the files in this folder (one self-contained page; media/ sits beside it).
Usage: python3 source/build.py"""
import json, os, re, sys
from urllib.parse import quote

SRC = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(SRC), "index.html")

read = lambda n: open(f"{SRC}/{n}", encoding="utf-8").read()
page, css, js = read("page.html"), read("styles.css"), read("app.js")
i18n = json.loads(read("i18n.json"))
catalog = json.loads(read("catalog.json"))
glyphs = json.loads(read("glyphs.json"))
sketches = read("sketches.js") if os.path.exists(f"{SRC}/sketches.js") else "window.NAIT_SKETCHES = {};"

# A photo saved as media/products/<slug>.(webp|jpg|jpeg|png) replaces the picture hot-linked from the shop.
PHOTOS = os.path.join(os.path.dirname(OUT), "media", "products")
local = 0
for p in catalog["products"]:
    for ext in ("webp", "jpg", "jpeg", "png"):
        if os.path.exists(os.path.join(PHOTOS, f'{p["slug"]}.{ext}')):
            p["img"] = f'media/products/{p["slug"]}.{ext}'
            local += 1
            break

# ---------- checks ----------
problems = []
keys = set(i18n["fr"])
for lang, d in i18n.items():
    if set(d) != keys:
        problems.append(f"i18n {lang}: missing {sorted(keys - set(d))} extra {sorted(set(d) - keys)}")
    for k, v in d.items():
        if not v.strip():
            problems.append(f"i18n {lang}.{k} is empty")
used = set(re.findall(r'data-i18n(?:-html|-aria)?="([^"]+)"', page))
used |= set(re.findall(r"\bt\('([a-zA-Z0-9_.]+)'", js))
used |= {m for m in re.findall(r"'((?:film\.c|tag\.|desc\.|tab\.)[A-Za-z0-9]*)'", js) if m in keys}
for k in sorted(used):
    if k not in keys and not k.endswith("."):
        problems.append(f"key used but not defined: {k}")
dyn = [k for k in keys if k.startswith(("tab.", "desc.", "tag.", "film.c", "film.sound", "theme."))]
unused = sorted(keys - used - set(dyn))
if unused:
    print("note: keys defined but not referenced:", unused)

# ---------- svg pieces ----------
tf = {g["ch"]: g for g in glyphs["tfng"]["glyphs"]}
H = glyphs["tfng"]["h"]
ids = {"ⵏ": "g-n", "ⴰ": "g-a", "ⵢ": "g-y", "ⵜ": "g-t"}
symbols = []
for ch, gid in ids.items():
    g = tf[ch]
    symbols.append(f'    <symbol id="{gid}" viewBox="0 0 {g["w"]:g} {H:g}"><path d="{g["d"]}"/></symbol>')
# the whole name: wider gap after the first letter (n | ayt)
x, parts = 0.0, []
for ch, gap in (("ⵏ", 260), ("ⴰ", 120), ("ⵢ", 120), ("ⵜ", 0)):
    parts.append(f'<path transform="translate({x:g} 0)" d="{tf[ch]["d"]}"/>')
    x += tf[ch]["w"] + gap
assert abs(x - 1883) < 1, x
symbols.append(f'    <symbol id="g-nayt" viewBox="0 0 1883 {H:g}">{"".join(parts)}</symbol>')

m = glyphs["maison400"]
wm_maison = (f'      <svg class="wm__maison foil" viewBox="0 0 {m["w"]:g} {m["h"]:g}" aria-hidden="true"><path d="'
             + "".join(l["d"] for l in m["letters"]) + '"/></svg>')
n = glyphs["nait300"]
wm_nait = (f'      <svg class="wm__nait" viewBox="0 0 {n["w"]:g} {n["h"]:g}" aria-hidden="true">'
           + "".join(f'<path class="wm__l" pathLength="1" style="--i:{i}" d="{l["d"]}"/>' for i, l in enumerate(n["letters"]))
           + "</svg>")
mask_svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{n["w"]:g}" height="{n["h"]:g}" viewBox="0 0 {n["w"]:g} {n["h"]:g}"><path d="'
            + "".join(l["d"] for l in n["letters"]) + '"/></svg>')
css += '\n.foot__mark{--mark-shape:url("data:image/svg+xml,' + quote(mask_svg, safe="/:=,.- ") + '")}\n'

glyph = '<svg class="foil" viewBox="0 0 1883 735"><use href="#g-nayt"/></svg>'
phrases = [('fr', 'Parfumeur au Maroc'), ('ar', 'عطور من المغرب'), ('zgh', 'ⵜⵓⵊⵊⵓⵜ ⵏ ⵍⵎⵖⵔⵉⴱ'), ('en', 'Perfumer in Morocco'), ('ary', 'ريحة بلادنا')]
one = "".join(f'{glyph if i == 0 else "<i></i>"}<span lang="{l}">{txt}</span>' for i, (l, txt) in enumerate(phrases))
ribbon = "\n".join(f'  <div class="ribbon__set">{one * 2}</div>' for _ in range(2))

data = ("const I18N = " + json.dumps(i18n, ensure_ascii=False, separators=(",", ":")) + ";\n"
        "const CATALOG = " + json.dumps(catalog, ensure_ascii=False, separators=(",", ":")) + ";")

subs = {
    "/*CSS*/": css, "<!--SYMBOLS-->": "\n".join(symbols), "<!--WM_MAISON-->": wm_maison, "<!--WM_NAIT-->": wm_nait,
    "<!--RIBBON-->": ribbon, "/*DATA*/": data, "/*SKETCHES*/": sketches, "/*JS*/": js,
}
for k, v in subs.items():
    if page.count(k) != 1:
        problems.append(f"placeholder {k} appears {page.count(k)} times")
    page = page.replace(k, v)
if "</script" in (data + sketches + js).lower():
    problems.append("inline script contains a closing script tag")

os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, "w", encoding="utf-8").write(page)
print(f"built {OUT}: {len(page.encode('utf-8')) / 1024:.1f} KiB; sketches {'inlined' if 'NAIT_SKETCHES' in sketches and len(sketches) > 60 else 'STUB'}; "
      f"product photos: {local} local, {sum(1 for p in catalog['products'] if p.get('img', '').startswith('http'))} from the shop")
if problems:
    print("PROBLEMS:")
    for p in problems:
        print(" -", p)
    sys.exit(1)
