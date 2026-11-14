"""Clean vector logo rebuilt from the client's 69x155 PNG (logo-source.png).
Run from this folder: python3 rebuild.py   (needs numpy, scipy, opencv-python, pillow, potracer, rsvg-convert)
Writes logo-geometry.json, which kit.py turns into every file of the kit.

trace.py gives each part of the logo as a symmetrised, enlarged mask. A raw trace of those masks keeps the lumps of a
tiny raster, so every part is re-described here by the simplest geometry that fits it:
  bars            -> rounded rectangles
  flacon wall     -> one smooth centre line, mirrored, drawn with a constant stroke
  drop            -> a teardrop (point, two flanks, a circle)
  crown, vapour, highlight -> their outline passed through a smoothing spline
Units are the PNG's pixels (viewBox 0 0 69 155)."""
import json, sys
import numpy as np, cv2
from scipy.interpolate import splprep, splev, UnivariateSpline
import trace as T

S, w, h = T.S, T.w, T.h
parts, AXH, _ = T.build()
AX = AXH / S                                   # symmetry axis in source pixels
M = {T.NAMES[i]: (f > 0.5) for i, f in parts.items()}
f2 = lambda v: f"{v:.2f}".rstrip("0").rstrip(".")


def runs(row):
    """Intervals of ink in one enlarged row, in source pixels."""
    d = np.diff(np.concatenate([[0], row.astype(np.int8), [0]]))
    return [(a / S, b / S) for a, b in zip(np.where(d == 1)[0], np.where(d == -1)[0])]


def bbox(mask):
    ys, xs = np.where(mask)
    return xs.min() / S, (xs.max() + 1) / S, ys.min() / S, (ys.max() + 1) / S


def pill(x0, x1, y0, y1, r=None):
    """Rounded bar centred on the axis."""
    half = ((x1 - x0) / 2)
    r = (y1 - y0) / 2 if r is None else r
    return f'<rect x="{f2(AX - half)}" y="{f2(y0)}" width="{f2(2 * half)}" height="{f2(y1 - y0)}" rx="{f2(r)}"/>'


def catmull(pts, closed=True):
    """Smooth cubic Bezier path through points (Catmull-Rom)."""
    P = np.asarray(pts, float); n = len(P)
    idx = lambda i: P[i % n] if closed else P[min(max(i, 0), n - 1)]
    d = [f"M{f2(P[0][0])} {f2(P[0][1])}"]
    for i in range(n if closed else n - 1):
        p0, p1, p2, p3 = idx(i - 1), idx(i), idx(i + 1), idx(i + 2)
        c1, c2 = p1 + (p2 - p0) / 6, p2 - (p3 - p1) / 6
        d.append(f"C{f2(c1[0])} {f2(c1[1])} {f2(c2[0])} {f2(c2[1])} {f2(p2[0])} {f2(p2[1])}")
    return "".join(d) + ("Z" if closed else "")


def outline(mask, smooth, n, symmetric=False):
    """Outer contour of a mask through a periodic smoothing spline, as n points (source pixels)."""
    cs, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cs, key=cv2.contourArea)[:, 0, :].astype(float) / S + 0.5 / S
    c = c[:: max(1, len(c) // 1500)]
    tck, _ = splprep([c[:, 0], c[:, 1]], s=smooth * len(c), per=True)
    x, y = splev(np.linspace(0, 1, 4000, endpoint=False), tck)
    pts = np.stack([x, y], 1)
    if symmetric:
        # keep the right half, starting and ending on the axis, and mirror it
        right = pts[:, 0] >= AX
        k = int(np.argmax(~right))                      # rotate so the array starts where the left half starts
        pts = np.roll(pts, -k, axis=0); right = np.roll(right, -k)
        half = pts[right]
        if half[0, 1] > half[-1, 1]: half = half[::-1]  # top to bottom along the right side
        half[0, 0] = AX; half[-1, 0] = AX
        seg = np.linspace(0, len(half) - 1, n // 2).round().astype(int)
        half = half[seg]
        left = half[::-1][1:-1].copy(); left[:, 0] = 2 * AX - left[:, 0]
        return np.concatenate([half, left])
    return pts[np.linspace(0, len(pts) - 1, n, endpoint=False).round().astype(int)]


# ---------- bars ----------
band = bbox(M["band"]); foot = bbox(M["foot"])
fl = M["flacon"]
rows = [(y / S, runs(fl[y])) for y in range(fl.shape[0])]
rows = [(y, r) for y, r in rows if r]
spans_axis = lambda r: any(a < AX - 2 and b > AX + 2 for a, b in r)
lip_rows = [(y, r) for y, r in rows if spans_axis(r) and y < 90]
base_rows = [(y, r) for y, r in rows if spans_axis(r) and y > 120]
lip = (min(a for _, r in lip_rows for a, _ in r), max(b for _, r in lip_rows for _, b in r), lip_rows[0][0], lip_rows[-1][0] + 1 / S)
base = (min(a for _, r in base_rows for a, _ in r), max(b for _, r in base_rows for _, b in r), base_rows[0][0], base_rows[-1][0] + 1 / S)

# ---------- flacon wall: centre line of the left wall, as x(y) ----------
wall = [(y, r[0]) for y, r in rows if not spans_axis(r) and lip[3] <= y <= base[2] and len(r) >= 2]
ys = np.array([y for y, _ in wall]); xo = np.array([r[0] for _, r in wall]); xi = np.array([r[1] for _, r in wall])
th = xi - xo
keep = th < np.median(th) * 1.9                         # drop the rows where the wall runs into a bar
ys, xc, th = ys[keep], ((xo + xi) / 2)[keep], th[keep]
spl = UnivariateSpline(ys, xc, s=len(ys) * 0.004)
slope = spl.derivative()(ys)
stroke = float(np.median(th * np.cos(np.arctan(slope))))
yy = np.linspace(lip[3] - 0.9, base[2] + 0.9, 400)
left = np.stack([spl(np.clip(yy, ys.min(), ys.max())), yy], 1)

# ---------- drop ----------
dx0, dx1, dy0, dy1 = bbox(M["drop"])
def teardrop(r, cy, top, k):
    """Circle of radius r centred (AX, cy), point at (AX, top); k bends the flanks inwards."""
    d = cy - top
    a = np.arccos(r / d)                                # angle of the tangent points, from the upward vertical
    tx, ty = r * np.sin(a), cy - r * np.cos(a)
    q = lambda sx: (AX + sx * tx * (0.5 - k), (top + ty) / 2 + k * d * 0.25)
    return (f"M{f2(AX)} {f2(top)}Q{f2(q(1)[0])} {f2(q(1)[1])} {f2(AX + tx)} {f2(ty)}"
            f"A{f2(r)} {f2(r)} 0 1 1 {f2(AX - tx)} {f2(ty)}Q{f2(q(-1)[0])} {f2(q(-1)[1])} {f2(AX)} {f2(top)}Z")
def raster(svg_inner, size=(w * 8, h * 8)):
    import subprocess, tempfile, os
    from PIL import Image
    p = tempfile.mktemp(suffix=".svg")
    open(p, "w").write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}">{svg_inner}</svg>')
    subprocess.run(["rsvg-convert", "-w", str(size[0]), "-h", str(size[1]), p, "-o", p + ".png"], check=True)
    a = np.asarray(Image.open(p + ".png").convert("RGBA"))[..., 3] > 127
    os.remove(p); os.remove(p + ".png")
    return a
target = cv2.resize(M["drop"].astype(np.uint8), (w * 8, h * 8), interpolation=cv2.INTER_AREA) > 0
best = None
r0 = (dx1 - dx0) / 2
for r in (r0 - 0.15, r0, r0 + 0.15):
    for k in (0.0, 0.08, 0.16, 0.24):
        for top in (dy0 - 0.3, dy0, dy0 + 0.3):
            cy = dy1 - r
            a = raster(f'<path d="{teardrop(r, cy, top, k)}"/>')
            iou = (a & target).sum() / (a | target).sum()
            if best is None or iou > best[0]: best = (iou, r, cy, top, k)
drop_d = teardrop(*best[1:])

# ---------- curve fitting (Schneider, "An algorithm for automatically fitting digitized curves") ----------
def _bez(b, u):
    u = np.asarray(u)[:, None]
    return (1 - u) ** 3 * b[0] + 3 * (1 - u) ** 2 * u * b[1] + 3 * (1 - u) * u ** 2 * b[2] + u ** 3 * b[3]


def _gen(pts, u, t1, t2):
    p0, p3 = pts[0], pts[-1]
    b0, b1, b2, b3 = (1 - u) ** 3, 3 * u * (1 - u) ** 2, 3 * u ** 2 * (1 - u), u ** 3
    a1, a2 = t1[None] * b1[:, None], t2[None] * b2[:, None]
    c00, c01, c11 = (a1 * a1).sum(), (a1 * a2).sum(), (a2 * a2).sum()
    tmp = pts - (p0[None] * (b0 + b1)[:, None] + p3[None] * (b2 + b3)[:, None])
    x0, x1 = (a1 * tmp).sum(), (a2 * tmp).sum()
    det = c00 * c11 - c01 * c01
    al, ar = ((x0 * c11 - x1 * c01) / det, (c00 * x1 - c01 * x0) / det) if abs(det) > 1e-12 else (0, 0)
    seg = np.linalg.norm(p3 - p0)
    if al < 1e-6 * seg or ar < 1e-6 * seg: al = ar = seg / 3
    return np.array([p0, p0 + t1 * al, p3 + t2 * ar, p3])


def _reparam(b, pts, u):
    uu = u[:, None]
    d = _bez(b, u) - pts
    d1 = 3 * (1 - uu) ** 2 * (b[1] - b[0]) + 6 * (1 - uu) * uu * (b[2] - b[1]) + 3 * uu ** 2 * (b[3] - b[2])
    d2 = 6 * (1 - uu) * (b[2] - 2 * b[1] + b[0]) + 6 * uu * (b[3] - 2 * b[2] + b[1])
    num, den = (d * d1).sum(1), (d1 * d1).sum(1) + (d * d2).sum(1)
    return np.clip(u - np.where(np.abs(den) > 1e-12, num / np.where(den == 0, 1, den), 0), 0, 1)


def _fit(pts, t1, t2, tol, k):
    if len(pts) == 2:
        dist = np.linalg.norm(pts[1] - pts[0]) / 3
        return [np.array([pts[0], pts[0] + t1 * dist, pts[1] + t2 * dist, pts[1]])]
    ch = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(pts, axis=0), axis=1))]); u = ch / ch[-1]
    for it in range(24):
        b = _gen(pts, u, t1, t2)
        err = ((_bez(b, u) - pts) ** 2).sum(1)
        if err.max() < tol * tol: return [b]
        if err.max() > (4 * tol) ** 2 and it == 0: break
        u = _reparam(b, pts, u)
    sp = int(np.clip(np.argmax(err), 1, len(pts) - 2))
    tc = pts[max(sp - k, 0)] - pts[min(sp + k, len(pts) - 1)]; tc = tc / np.linalg.norm(tc)
    return _fit(pts[: sp + 1], t1, tc, tol, k) + _fit(pts[sp:], -tc, t2, tol, k)


def resample(P, step):
    """Points at even distance along a polyline."""
    P = np.asarray(P, float)
    d = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(P, axis=0), axis=1))])
    n = max(int(round(d[-1] / step)), 2)
    t = np.linspace(0, d[-1], n + 1)
    return np.stack([np.interp(t, d, P[:, 0]), np.interp(t, d, P[:, 1])], 1)


def fit(P, tol, t_start=None, t_end=None, step=0.08, span=0.5):
    """Few, smooth cubic Bezier pieces within tol of the points P. Returns a list of 4x2 arrays."""
    P = resample(P, step); k = max(int(round(span / step / 2)), 1)
    unit = lambda v: np.asarray(v, float) / np.linalg.norm(v)
    t1 = unit(t_start) if t_start is not None else unit(P[min(k, len(P) - 1)] - P[0])
    t2 = unit(t_end) if t_end is not None else unit(P[max(len(P) - 1 - k, 0)] - P[-1])
    return _fit(P, t1, t2, tol, k)


pt = lambda p: f"{f2(p[0])} {f2(p[1])}"
seg_d = lambda segs: "".join(f"C{pt(b[1])} {pt(b[2])} {pt(b[3])}" for b in segs)
mirror_pt = lambda p: np.array([2 * AX - p[0], p[1]])
back_mirrored = lambda segs: [np.array([mirror_pt(b[3]), mirror_pt(b[2]), mirror_pt(b[1]), mirror_pt(b[0])]) for b in segs[::-1]]
back = lambda segs: [b[::-1] for b in segs[::-1]]


# ---------- organic parts ----------
def spline_segments(P, before, after):
    """Cubic Bezier segments through P (centripetal Catmull-Rom, which stays calm when points are unevenly spaced);
    before/after are the neighbours that set the end tangents."""
    Q = np.vstack([before, P, after]); d = []
    for i in range(1, len(Q) - 2):
        p0, p1, p2, p3 = Q[i - 1], Q[i], Q[i + 1], Q[i + 2]
        d1, d2, d3 = (max(np.linalg.norm(q), 1e-6) ** 0.5 for q in (p1 - p0, p2 - p1, p3 - p2))
        c1 = (d1 * d1 * p2 - d2 * d2 * p0 + (2 * d1 * d1 + 3 * d1 * d2 + d2 * d2) * p1) / (3 * d1 * (d1 + d2))
        c2 = (d3 * d3 * p1 - d2 * d2 * p3 + (2 * d3 * d3 + 3 * d3 * d2 + d2 * d2) * p2) / (3 * d3 * (d3 + d2))
        d.append(f"C{f2(c1[0])} {f2(c1[1])} {f2(c2[0])} {f2(c2[1])} {f2(p2[0])} {f2(p2[1])}")
    return "".join(d)


RAW = np.clip(cv2.resize(T.A, (w * S, h * S), interpolation=cv2.INTER_CUBIC), 0, 1)        # ink, enlarged, not blurred
_d, NEAR = cv2.distanceTransformWithLabels((T.mask == 0).astype(np.uint8), cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_CCOMP)
_lab_of = {}                                             # distance-transform label -> component id
for _c in T.comps:
    _ys, _xs = np.where(T.lab == _c["id"]); _lab_of[int(NEAR[_ys[0], _xs[0]])] = _c["id"]
OWNER = np.vectorize(lambda v: _lab_of.get(int(v), 0))(NEAR)      # every pixel belongs to the nearest part


def tapered(name, tol=0.045, floor=0.05, smooth=0.006):
    """A brush stroke that thins to a point at both ends: centre line x(y) and width w(y) read from the ink itself.
    Width comes from the amount of ink across the stroke, so the hair-thin ends of the PNG are kept."""
    i = {v: k for k, v in T.NAMES.items()}[name]
    f = RAW * ((OWNER == i) & (_d < S * 5))
    xs = (np.arange(f.shape[1]) + 0.5) / S
    cov = f.sum(1) / S                                   # ink per row, source px
    rows = np.where(cov > floor)[0]
    rows = np.arange(rows.min(), rows.max() + 1)
    y = (rows + 0.5) / S; c = cov[rows]
    xc = (f[rows] * xs).sum(1) / np.maximum(f[rows].sum(1), 1e-6)
    sx = UnivariateSpline(y, xc, w=np.sqrt(np.maximum(c, 1e-3)), s=len(y) * smooth)
    dx = sx.derivative()
    wd = UnivariateSpline(y, c / np.sqrt(1 + dx(y) ** 2), s=len(y) * smooth)
    yy = np.linspace(y[0], y[-1], 160)
    ctr = np.stack([sx(yy), yy], 1)
    nrm = np.stack([np.ones(len(yy)), -dx(yy)], 1); nrm /= np.linalg.norm(nrm, axis=1)[:, None]
    ends = np.minimum(np.linspace(0, 1, len(yy)), np.linspace(1, 0, len(yy))) / 0.04
    half = np.clip(wd(yy), 0, None) / 2 * np.clip(ends, 0, 1) ** 0.7      # both ends close to a point
    R, L = ctr + nrm * half[:, None], ctr - nrm * half[:, None]
    down0, down1 = ctr[4] - ctr[0], ctr[-1] - ctr[-5]                     # direction of the stroke at its two points
    right, left = fit(R, tol, span=1.2), fit(L, tol, span=1.2)
    d = f"M{pt(R[0])}" + seg_d(right) + seg_d(back(left)) + "Z"
    return d, dict(top=ctr[0].round(2).tolist(), bottom=ctr[-1].round(2).tolist(), widest=round(float(half.max() * 2), 2), pieces=len(right) + len(left))


def crown_path(smooth=0.0012, tol=0.055, corner_r=0.45):
    """Crown: right half of the outline through a smoothing spline, base corners kept sharp, then mirrored."""
    cs, _ = cv2.findContours(M["crown"].astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cs, key=cv2.contourArea)[:, 0, :].astype(float) / S + 0.5 / S
    c = c[:: max(1, len(c) // 2400)]
    tck, _ = splprep([c[:, 0], c[:, 1]], s=smooth * len(c), per=True)
    x, y = splev(np.linspace(0, 1, 6000, endpoint=False), tck)
    pts = np.stack([x, y], 1)
    right = pts[:, 0] >= AX
    k = int(np.argmax(~right)); pts = np.roll(pts, -k, axis=0); right = np.roll(right, -k)
    half = pts[right]
    if half[0, 1] > half[-1, 1]: half = half[::-1]
    yb = float(np.median(half[half[:, 1] > half[:, 1].max() - 0.2][:, 1]))        # bottom edge
    kx = int(np.argmax(half[:, 0]))                                              # outermost point of the outer tip
    kb = kx + int(np.argmax(half[kx:, 1] > yb - 0.25))                           # where the side reaches the bottom
    a, b = kx + int((kb - kx) * 0.30), kx + int((kb - kx) * 0.80)
    m, q = np.polyfit(half[a:b, 1], half[a:b, 0], 1)                             # side of the base: x = m*y + q
    corner = np.array([m * yb + q, yb])
    u = np.array([m, 1.0]); u /= np.linalg.norm(u)                               # down along the side
    pre, post = corner - u * corner_r, corner - np.array([corner_r, 0])
    kj = kx + int((kb - kx) * 0.62)                                              # hand over from curve to straight side
    body = half[: kj + 1].copy(); body[0, 0] = AX
    segs = fit(body, tol, t_start=(1, 0), t_end=-u)                               # level at the top, in line with the side below
    mp = mirror_pt
    d = (f"M{pt(body[0])}" + seg_d(segs)
         + f"L{pt(pre)}Q{pt(corner)} {pt(post)}L{pt(mp(post))}Q{pt(mp(corner))} {pt(mp(pre))}L{pt(mp(body[-1]))}"
         + seg_d(back_mirrored(segs)) + "Z")
    return d, dict(pieces=len(segs) * 2, corner=corner.round(2).tolist(), bottom=round(yb, 2))


crown, crown_info = crown_path()
vapour, vap_info = tapered("vapour")
highlight, hi_info = tapered("highlight")

wall_segs = fit(left, 0.03, step=0.1)
wall_mirror = [np.array([mirror_pt(q) for q in b]) for b in wall_segs]
paths = {
    "vapour": f'<path d="{vapour}"/>',
    "crown": f'<path d="{crown}"/>',
    "band": pill(*band),
    "lip": pill(*lip),
    "wall": (f'<path d="M{pt(left[0])}{seg_d(wall_segs)}" fill="none" stroke="currentColor" stroke-width="{f2(stroke)}" stroke-linecap="round"/>'
             f'<path d="M{pt(mirror_pt(left[0]))}{seg_d(wall_mirror)}" fill="none" stroke="currentColor" stroke-width="{f2(stroke)}" stroke-linecap="round"/>'),
    "highlight": f'<path d="{highlight}"/>',
    "drop": f'<path d="{drop_d}"/>',
    "base": pill(*base),
    "foot": pill(*foot),
}
inner = "".join(paths.values())
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" fill="currentColor" color="#B59449">'
       f'<title>Maison N’Ait</title>{inner}</svg>')
open("logo-mark.svg", "w").write(svg)
json.dump({"axis": AX, "stroke": stroke, "band": band, "lip": lip, "base": base, "foot": foot, "drop": best, "paths": paths},
          open("logo-geometry.json", "w"), indent=1, default=float)
print(f"axis {AX:.3f}  wall stroke {stroke:.2f}px  drop fit IoU {best[0]:.3f} (r {best[1]:.2f}, k {best[4]})")
print("bars:", {k: [round(float(v), 2) for v in b] for k, b in (('band', band), ('lip', lip), ('base', base), ('foot', foot))})
print("wall pieces", len(wall_segs))
print("crown", crown_info, "\nvapour", vap_info, "\nhighlight", hi_info)
print("svg bytes", len(svg))
