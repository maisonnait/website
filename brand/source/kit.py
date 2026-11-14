"""Brand kit built on the client's logo (logo-geometry.json, written by rebuild.py).
Run from this folder after `pnpm install` (the fonts come from node_modules): python3 kit.py
Needs: python3 with numpy, pillow, fonttools, and the rsvg-convert command (librsvg).

Writes into /brand:
SVG marks and lockups, favicon set, touch and app icons, web manifest, social image, preview sheet."""
import json, os, re, subprocess, sys, io
import numpy as np
from PIL import Image
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(REPO, "brand")                       # the kit is written next to this folder
G = json.load(open(os.path.join(HERE, "logo-geometry.json")))
AX, PARTS = G["axis"], G["paths"]
GOLD, GOLD_HI, INK, IVORY, WHITE = "#B59449", "#D9C08A", "#0B0B0C", "#F7F2E6", "#FFFFFF"
FONTS = os.path.join(REPO, "node_modules/.pnpm/@fontsource+{0}@5.3.0/node_modules/@fontsource/{0}/files/{0}-latin-{1}-normal.woff")   # after pnpm install
f2 = lambda v: f"{v:.2f}".rstrip("0").rstrip(".")

FULL = ["vapour", "crown", "band", "lip", "wall", "highlight", "drop", "base", "foot"]
SMALL = ["crown", "band", "lip", "wall", "drop", "base", "foot"]           # what survives at 16 to 48 px


def inner(parts=FULL, wall=None):
    s = "".join(PARTS[p] for p in parts)
    if wall: s = re.sub(r'stroke-width="[\d.]+"', f'stroke-width="{f2(wall)}"', s)
    return s


def render(svg, w, h=None):
    p = subprocess.run(["rsvg-convert", "-w", str(w)] + (["-h", str(h)] if h else []), input=svg.encode(), capture_output=True, check=True)
    return Image.open(io.BytesIO(p.stdout)).convert("RGBA")


def bounds(parts, wall=None):
    """Tight box of the drawing, kept symmetric about the axis. Returns x, y, w, h in logo units."""
    im = render(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 69 155" color="#000" fill="currentColor">{inner(parts, wall)}</svg>', 69 * 16)
    a = np.asarray(im)[..., 3] > 8
    ys, xs = np.where(a)
    x0, x1, y0, y1 = xs.min() / 16, (xs.max() + 1) / 16, ys.min() / 16, (ys.max() + 1) / 16
    hw = max(AX - x0, x1 - AX)
    return AX - hw, y0, 2 * hw, y1 - y0


BF, BS = bounds(FULL), bounds(SMALL, 5.2)


def mark_svg(color=GOLD, parts=FULL, wall=None, pad=1.5, title=True):
    x, y, w, h = bounds(parts, wall) if (parts, wall) != (FULL, None) else BF
    vb = f"{f2(x - pad)} {f2(y - pad)} {f2(w + 2 * pad)} {f2(h + 2 * pad)}"
    t = "<title>Maison N’Ait</title>" if title else ""
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" fill="currentColor" color="{color}">{t}{inner(parts, wall)}</svg>'


def placed(parts, box, wall=None, color=GOLD):
    """The mark scaled to fit box = (x, y, w, h), centred. Returns an SVG group."""
    x, y, w, h = bounds(parts, wall) if (parts, wall) not in ((FULL, None), (SMALL, 5.2)) else (BF if parts is FULL else BS)
    s = min(box[2] / w, box[3] / h)
    tx, ty = box[0] + (box[2] - w * s) / 2 - x * s, box[1] + (box[3] - h * s) / 2 - y * s
    return f'<g transform="translate({f2(tx)} {f2(ty)}) scale({s:.4f})" fill="currentColor" color="{color}">{inner(parts, wall)}</g>'


_fonts = {}
def text(s, family="josefin-sans", weight=300, size=20, tracking=0.0, x=0.0, y=0.0, anchor="start"):
    """Text as outlines (no font needed to display it). y is the baseline. Returns (path d, width)."""
    key = (family, weight)
    if key not in _fonts: _fonts[key] = TTFont(FONTS.format(family, weight))
    font = _fonts[key]; gs = font.getGlyphSet(); cmap = font.getBestCmap(); upm = font["head"].unitsPerEm
    k = size / upm; adv = []; names = []
    for ch in s:
        name = cmap.get(ord(ch)) or cmap.get(ord("'")) if ch in "’'" else cmap.get(ord(ch))
        names.append(name); adv.append((gs[name].width if name else upm * 0.3) * k + tracking * size)
        if ch in "’'" and len(adv) > 1:                     # the apostrophe sits close to its two letters
            adv[-2] -= tracking * size * 0.62; adv[-1] -= tracking * size * 0.58
    width = sum(adv) - tracking * size
    cx = x - (width / 2 if anchor == "middle" else width if anchor == "end" else 0)
    d = []
    for name, a in zip(names, adv):
        if name:
            pen = SVGPathPen(gs, ntos=lambda v: f2(v))
            gs[name].draw(TransformPen(pen, (k, 0, 0, -k, cx, y)))
            d.append(pen.getCommands())
        cx += a
    return "".join(d), width


def save(name, svg):
    open(os.path.join(OUT, name), "w").write(svg); return svg


def png(name, svg, w, h=None, flatten=None, quality=None):
    im = render(svg, w, h)
    if flatten:
        bg = Image.new("RGBA", im.size, flatten); bg.alpha_composite(im); im = bg.convert("RGB")
    p = os.path.join(OUT, name)
    im.save(p, quality=quality, optimize=True, progressive=True) if quality else im.save(p, optimize=True)
    return im


# ---------------------------------------------------------------- marks
save("logo-mark.svg", mark_svg(GOLD))
save("logo-mark-black.svg", mark_svg(INK))
save("logo-mark-white.svg", mark_svg(WHITE))
save("logo-mark-small.svg", mark_svg(GOLD, SMALL, 5.2))

# ---------------------------------------------------------------- lockups
def vertical(ink, gold=GOLD, tag=None):
    W, mh = 300, 190
    name, nw = text("MAISON N’AIT", weight=300, size=30, tracking=0.34, x=W / 2, y=mh + 62, anchor="middle")
    extra, H = "", mh + 84
    if tag:
        td, _ = text(tag, family="spectral", weight=300, size=14.5, tracking=0.06, x=W / 2, y=mh + 96, anchor="middle")
        extra = f'<path d="{td}" fill="{ink}" opacity=".72"/>'; H = mh + 116
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}"><title>Maison N’Ait</title>'
            f'{placed(FULL, (0, 8, W, mh), color=gold)}<path d="{name}" fill="{ink}"/>{extra}</svg>')


def horizontal(ink, gold=GOLD):
    H, mw = 96, 44
    name, nw = text("MAISON N’AIT", weight=300, size=27, tracking=0.32, x=mw + 22, y=H / 2 + 9.6)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {f2(mw + 22 + nw + 2)} {H}"><title>Maison N’Ait</title>'
            f'{placed(FULL, (0, 2, mw, H - 4), color=gold)}<path d="{name}" fill="{ink}"/></svg>')


save("logo-vertical.svg", vertical(INK))
save("logo-vertical-on-dark.svg", vertical(IVORY))
save("logo-vertical-tagline.svg", vertical(INK, tag="Maison de parfum marocaine"))
save("logo-horizontal.svg", horizontal(INK))
save("logo-horizontal-on-dark.svg", horizontal(IVORY))
save("logo-horizontal-black.svg", horizontal(INK, INK))
save("logo-horizontal-white.svg", horizontal(WHITE, WHITE))

# ---------------------------------------------------------------- icons
def tile(size, parts, wall=None, radius=0.0, fill=0.80, bg=INK, gold=GOLD):
    m = size * (1 - fill) / 2
    r = f' rx="{f2(size * radius)}"' if radius else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}">'
            f'<rect width="{size}" height="{size}"{r} fill="{bg}"/>{placed(parts, (m, m, size - 2 * m, size - 2 * m), wall, gold)}</svg>')


fav = save("favicon.svg", tile(64, SMALL, 5.2, radius=0.2, fill=0.84, gold=GOLD_HI))
ico = [render(fav, s) for s in (16, 32, 48)]
ico[2].save(os.path.join(OUT, "favicon.ico"), format="ICO", sizes=[(16, 16), (32, 32), (48, 48)], append_images=ico[:2])
png("favicon-32.png", fav, 32); png("favicon-16.png", fav, 16)
app = tile(512, FULL, fill=0.78)
png("apple-touch-icon.png", app, 180, flatten=INK)
png("icon-192.png", app, 192); png("icon-512.png", app, 512)
png("icon-maskable-512.png", tile(512, FULL, fill=0.60), 512)
json.dump({
    "name": "Maison N’Ait", "short_name": "N’Ait", "description": "Maison de parfum marocaine",
    "start_url": "/", "display": "standalone", "background_color": "#FFFFFF", "theme_color": INK,
    "icons": [{"src": "/icon-192.png", "sizes": "192x192", "type": "image/png"},
              {"src": "/icon-512.png", "sizes": "512x512", "type": "image/png"},
              {"src": "/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}],
}, open(os.path.join(OUT, "site.webmanifest"), "w"), ensure_ascii=False, indent=2)

# ---------------------------------------------------------------- social image (1200 x 630)
def og(bottle=None):
    name, _ = text("MAISON N’AIT", weight=300, size=58, tracking=0.34, x=600, y=452, anchor="middle")
    tag, _ = text("Maison de parfum marocaine", family="spectral", weight=300, size=27, tracking=0.04, x=600, y=512, anchor="middle")
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">'
            f'<defs><radialGradient id="g" cx="50%" cy="38%" r="62%"><stop offset="0" stop-color="#1c1810"/><stop offset=".55" stop-color="#0f0e0c"/><stop offset="1" stop-color="{INK}"/></radialGradient></defs>'
            f'<rect width="1200" height="630" fill="url(#g)"/>'
            f'<rect x="26" y="26" width="1148" height="578" fill="none" stroke="{GOLD}" stroke-opacity=".38" stroke-width="1.2"/>'
            f'{placed(FULL, (0, 66, 1200, 300), color=GOLD_HI)}'
            f'<path d="{name}" fill="{IVORY}"/><path d="{tag}" fill="{GOLD_HI}" opacity=".9"/></svg>')


save("og.svg", og())
png("og.jpg", og(), 1200, 630, flatten=INK, quality=90)

# ---------------------------------------------------------------- preview sheet
def sheet():
    W, H = 1400, 1560
    S = [f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 {W} {H}"><rect width="{W}" height="{H}" fill="#FFFFFF"/>']
    lab = lambda s, x, y, c="#6b6b6b": f'<path d="{text(s, weight=400, size=15, tracking=0.06, x=x, y=y)[0]}" fill="{c}"/>'
    # row 1: mark on white, ivory, black
    for i, (bg, col) in enumerate(((WHITE, GOLD), ("#F7F2E6", INK), (INK, GOLD_HI))):
        x = 40 + i * 448
        S.append(f'<rect x="{x}" y="40" width="424" height="520" fill="{bg}" stroke="#e4e1d8"/>{placed(FULL, (x + 40, 80, 344, 440), color=col)}')
    S.append(lab("Le signe : or, noir, or clair sur noir", 40, 592))
    # row 2: lockups
    def embed(svg, x, y, w, h, bg):
        vb = re.search(r'viewBox="([^"]+)"', svg).group(1).split(); vw, vh = float(vb[2]), float(vb[3])
        s = min(w * 0.8 / vw, h * 0.72 / vh)
        body = svg[svg.index(">") + 1: svg.rindex("</svg>")]
        return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{bg}" stroke="#e4e1d8"/>'
                f'<g transform="translate({f2(x + (w - vw * s) / 2)} {f2(y + (h - vh * s) / 2)}) scale({s:.4f})">{body}</g>')
    S.append(embed(vertical(INK, tag="Maison de parfum marocaine"), 40, 630, 424, 430, WHITE))
    S.append(embed(vertical(IVORY), 488, 630, 424, 430, INK))
    S.append(embed(horizontal(INK), 936, 630, 424, 205, WHITE))
    S.append(embed(horizontal(IVORY), 936, 855, 424, 205, INK))
    S.append(lab("Le signe et le nom : vertical, horizontal", 40, 1092))
    # row 3: icons at real size and enlarged
    x = 40
    for size, src, zoom in ((16, fav, 5), (32, fav, 3), (48, fav, 2)):
        b = svg_b64(render(src, size).resize((size * zoom, size * zoom), Image.NEAREST))
        S.append(f'<image x="{x}" y="1130" width="{size * zoom}" height="{size * zoom}" xlink:href="{b}"/>'
                 f'<image x="{x}" y="{1130 + size * zoom + 14}" width="{size}" height="{size}" xlink:href="{svg_b64(render(src, size))}"/>')
        S.append(lab(f"{size} px", x + size + 10, 1130 + size * zoom + 14 + size * 0.75))
        x += size * zoom + 36
    S.append(f'<image x="{x + 10}" y="1130" width="180" height="180" xlink:href="{svg_b64(render(app, 360))}"/>')
    S.append(f'<image x="{x + 214}" y="1130" width="180" height="180" xlink:href="{svg_b64(render(tile(512, FULL, fill=0.60, radius=0.5), 360))}"/>')
    S.append(lab("téléphone", x + 10, 1336) + lab("Android (rond)", x + 214, 1336))
    S.append(f'<image x="936" y="1130" width="424" height="222.6" xlink:href="{svg_b64(render(og(), 848))}"/>')
    S.append(lab("image de partage 1200 × 630", 936, 1378))
    S.append(lab("Icônes : onglet du navigateur, écran d’accueil", 40, 1410))
    # colours
    for i, (c, n) in enumerate(((GOLD, "Or  #B59449"), (GOLD_HI, "Or clair  #D9C08A"), (INK, "Noir  #0B0B0C"), (IVORY, "Ivoire  #F7F2E6"), (WHITE, "Blanc  #FFFFFF"))):
        S.append(f'<rect x="{40 + i * 268}" y="1440" width="248" height="56" fill="{c}" stroke="#e4e1d8"/>' + lab(n, 40 + i * 268, 1524, "#333"))
    S.append("</svg>")
    return "".join(S)


def svg_b64(im):
    import base64
    b = io.BytesIO(); im.save(b, "PNG")
    return "data:image/png;base64," + base64.b64encode(b.getvalue()).decode()


render(sheet(), 1400).convert("RGB").save(os.path.join(OUT, "brand-sheet.png"))
print({f: os.path.getsize(os.path.join(OUT, f)) for f in sorted(os.listdir(OUT)) if os.path.isfile(os.path.join(OUT, f))})


# ---------------------------------------------------------------- header lockup and React components for the two apps
def header(ink="currentColor", gold=GOLD):
    H, size = 96, 33
    cap = _fonts[("josefin-sans", 300)]["OS/2"].sCapHeight / _fonts[("josefin-sans", 300)]["head"].unitsPerEm * size
    x, y, w, h = BF; mw = (H - 2) * w / h
    name, nw = text("MAISON N’AIT", weight=300, size=size, tracking=0.30, x=mw + 20, y=H / 2 + cap / 2)
    return mw, nw, name, H


def jsx(s):
    for a, b in (("stroke-width", "strokeWidth"), ("stroke-linecap", "strokeLinecap"), ("fill-rule", "fillRule")):
        s = s.replace(a + "=", b + "=")
    return s


def component():
    mw, nw, name, H = header()
    x, y, w, h = BF; s = (H - 2) / h
    vbm = f"{f2(x - 1.5)} {f2(y - 1.5)} {f2(w + 3)} {f2(h + 3)}"
    return f'''/**
 * The house logo, drawn from the client's own artwork (see /brand in the repository). Generated by brand/kit.py:
 * edit the kit, not this file. The sign is gold (--logo-gold), the name takes the text colour.
 */
type Props = {{ className?: string; title?: string }};

const GOLD = {{ color: 'var(--logo-gold, {GOLD})' }} as const;

/** The parts of the sign, in the artwork's own units. */
function Sign() {{
  return (
    <>
      {jsx(inner(FULL))}
    </>
  );
}}

/** Sign and name on one line: header, footer. */
export function Logo({{ className, title = 'Maison N’Ait' }}: Props) {{
  return (
    <svg className={{className}} viewBox="0 0 {f2(mw + 20 + nw + 1)} {H}" role="img" aria-label={{title}} xmlns="http://www.w3.org/2000/svg" style={{{{ direction: 'ltr' }}}}>
      <g transform="translate({f2(-x * s)} {f2(1 - y * s)}) scale({s:.4f})" fill="currentColor" style={{GOLD}}>
        <Sign />
      </g>
      <path d="{name}" fill="currentColor" />
    </svg>
  );
}}

/** The sign alone. */
export function Mark({{ className, title = 'Maison N’Ait' }}: Props) {{
  return (
    <svg className={{className}} viewBox="{vbm}" role="img" aria-label={{title}} xmlns="http://www.w3.org/2000/svg" fill="currentColor" style={{GOLD}}>
      <Sign />
    </svg>
  );
}}
'''


open(os.path.join(REPO, "apps/store/src/brand/Logo.tsx"), "w").write(component())   # the shop's logo component
mw, nw, name, H = header(INK)
x, y, w, h = BF; s = (H - 2) / h
save("logo-header.svg", f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {f2(mw + 20 + nw + 1)} {H}"><title>Maison N’Ait</title>'
     f'<g transform="translate({f2(-x * s)} {f2(1 - y * s)}) scale({s:.4f})" fill="currentColor" color="{GOLD}">{inner(FULL)}</g><path d="{name}" fill="{INK}"/></svg>')
print("apps/store/src/brand/Logo.tsx written; header viewBox", f2(mw + 20 + nw + 1), H)
