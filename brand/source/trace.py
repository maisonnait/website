"""Vector version of the house logo, traced from the 69x155 PNG the client supplied.

The PNG's alpha channel is enlarged, smoothed and thresholded; parts that are meant to be symmetric (crown, bands, flacon,
drop, foot) are averaged with their mirror image; every outline is then fitted with Bezier curves (potrace)."""
import numpy as np, cv2, potrace, json, os, sys
from PIL import Image

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logo-source.png")
S = 24                      # enlargement before tracing
A = np.asarray(Image.open(SRC).convert("RGBA")).astype(np.float32)[..., 3] / 255.0
h, w = A.shape

def field(a, sigma=0.42):
    """Smooth coverage field at S times the size."""
    big = cv2.resize(a, (w * S, h * S), interpolation=cv2.INTER_CUBIC)
    return cv2.GaussianBlur(big, (0, 0), S * sigma)

F = field(A)
mask = (F > 0.5).astype(np.uint8)
n, lab, stats, cent = cv2.connectedComponentsWithStats(mask, connectivity=8)
comps = []
for i in range(1, n):
    x, y, bw, bh, area = stats[i]
    if area < (S * S) * 1.2:      # specks smaller than about one source pixel
        continue
    comps.append({"id": i, "x0": x / S, "y0": y / S, "x1": (x + bw) / S, "y1": (y + bh) / S, "area": area / S / S,
                  "cx": cent[i][0] / S, "cy": cent[i][1] / S})
comps.sort(key=lambda c: c["y0"])
if __name__ == "__main__" and len(sys.argv) > 1 and sys.argv[1] == "parts":
    for c in comps:
        print({k: (round(v, 2) if isinstance(v, float) else int(v)) for k, v in c.items()})

SYM = {2, 3, 4, 6, 7}          # crown, band, flacon, drop, foot bar; 1 = vapour and 5 = highlight stay as drawn

def region(i, grow=1.6):
    k = int(S * grow) | 1
    return cv2.dilate((lab == i).astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))).astype(bool)

def mirror(f, ax):
    """Mirror a field about the vertical line x = ax (enlarged pixel units)."""
    M = np.float32([[-1, 0, 2 * ax], [0, 1, 0]])
    return cv2.warpAffine(f, M, (f.shape[1], f.shape[0]), flags=cv2.INTER_LINEAR)

def best_axis(f, guess):
    best, bx = -1, guess
    for ax in np.arange(guess - S * 0.6, guess + S * 0.6, 0.5):
        m = mirror(f, ax)
        score = float((f * m).sum())
        if score > best: best, bx = score, ax
    return bx

def shift(f, dx):
    M = np.float32([[1, 0, dx], [0, 1, 0]])
    return cv2.warpAffine(f, M, (f.shape[1], f.shape[0]), flags=cv2.INTER_LINEAR)

def build():
    axes, parts = {}, {}
    for c in comps:
        i = c["id"]
        f = F * region(i)
        if i in SYM:
            ax = best_axis(f, c["cx"] * S)
            axes[i] = ax
            parts[i] = (f + mirror(f, ax)) / 2
        else:
            parts[i] = f
    # one common axis for the symmetric parts, weighted by their size
    wsum = sum(c["area"] for c in comps if c["id"] in SYM)
    AX = sum(axes[c["id"]] * c["area"] for c in comps if c["id"] in SYM) / wsum
    AX = round(AX * 2) / 2
    for i in axes:
        parts[i] = shift(parts[i], AX - axes[i])
    return parts, AX, axes

def path_of(mask_bool):
    """Bezier outline of a mask, in source-pixel units."""
    bm = potrace.Bitmap(~mask_bool)          # this library treats False as ink
    plist = bm.trace(turdsize=int(S * S * 0.5), turnpolicy=potrace.POTRACE_TURNPOLICY_MINORITY, alphamax=1.0, opticurve=True, opttolerance=0.25)
    f = lambda p: f"{p.x / S:.2f} {p.y / S:.2f}"
    d = []
    for curve in plist:
        d.append("M" + f(curve.start_point))
        for s in curve.segments:
            if s.is_corner: d.append("L" + f(s.c) + "L" + f(s.end_point))
            else: d.append("C" + f(s.c1) + " " + f(s.c2) + " " + f(s.end_point))
        d.append("Z")
    return "".join(d)

NAMES = {1: "vapour", 2: "crown", 3: "band", 4: "flacon", 5: "highlight", 6: "drop", 7: "foot"}

if __name__ == "__main__" and (len(sys.argv) == 1 or sys.argv[1] == "svg"):
    parts, AX, axes = build()
    print("axis (source px):", AX / S, {NAMES[i]: round(a / S, 3) for i, a in axes.items()})
    paths = {NAMES[c["id"]]: path_of(parts[c["id"]] > 0.5) for c in comps}
    json.dump({"viewBox": [0, 0, w, h], "axis": AX / S, "paths": paths}, open("logo-paths.json", "w"))
    body = "".join(f'<path id="{k}" d="{d}"/>' for k, d in paths.items())
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" fill="#B59449" fill-rule="evenodd">{body}</svg>'
    open("logo-mark.svg", "w").write(svg)
    print("svg bytes", len(svg), {k: len(d) for k, d in paths.items()})
