#!/usr/bin/env python3
"""
Packs the frames of the turning flacon into the one picture the shop loads (apps/store/src/home/FlaconTurn.tsx).

  1. render the frames, the flacon turned by one lathe segment (360/128 = 2.8125 degrees) more on each:
       python3 scene.py --liquid arabisant --bg light --comp layer --scale 0.5 --samples 40 --noise 0.03 \
         --turn-seq="0,2.8125,-2.8125,5.625,-5.625,8.4375,-8.4375,11.25,-11.25,14.0625,-14.0625,16.875,-16.875,19.6875,-19.6875" \
         --save-layer "seq/light/f%02d.png"
  2. pack them:
       python3 sheet.py seq/light ../../apps/store/public/media/flacon/turn-light.webp

Only the flacon itself is kept in each frame (its shadow and reflection stay those of the still picture underneath).
The script also prints where the canvas must sit over each still picture; those numbers are in home.css (.hero__turn).
"""
import os, sys
import numpy as np
from PIL import Image

ORDER = [0] + [s * k for k in range(1, 8) for s in (1, -1)]     # the order the frames were rendered in
FULL_W, FULL_H = 1400, 1600                                      # a master layer at full size (COMPS['layer'])
LAYER = (0.675, 0.50, 0.19)                                      # flacon height / H, centre x / W, base y / H from the bottom
BOX = (380, 200, 1020, 1340)                                     # the crop around the flacon, in full-size master pixels
COLS, ROWS = 5, 3
STILLS = {                                                       # the still pictures the canvas lies on (scene.py COMPS)
    'hero': (2000, 1300, 0.70, 0.725, 0.135),
    'hero-rtl': (2000, 1300, 0.70, 0.275, 0.135),
    'portrait': (1200, 1600, 0.555, 0.50, 0.375),
}


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def placement():
    """Where the crop lands in each still, as percentages (the same arithmetic as compose() in scene.py)."""
    hL, cxL, bL = LAYER
    for name, (W, H, hfrac, cxfrac, basefrac) in STILLS.items():
        s = (hfrac * H) / (hL * FULL_H)
        nw, nh = int(round(FULL_W * s)), int(round(FULL_H * s))
        x0 = int(round(cxfrac * W - cxL * nw)); y0 = int(round(H - (basefrac * H - bL * nh) - nh))
        left = (x0 + BOX[0] * nw / FULL_W) / W; top = (y0 + BOX[1] * nh / FULL_H) / H
        width = (BOX[2] - BOX[0]) * nw / FULL_W / W; height = (BOX[3] - BOX[1]) * nh / FULL_H / H
        print(f'{name:9s} left {left * 100:.4f}%  top {top * 100:.4f}%  width {width * 100:.4f}%  height {height * 100:.4f}%')


def main(folder, out):
    cells = []
    for k in range(-7, 8):
        path = os.path.join(folder, 'f%02d.png' % ORDER.index(k))
        if not os.path.exists(path):                                  # a run that was cut short: reuse the nearest frame
            near = min((j for j in range(-7, 8) if os.path.exists(os.path.join(folder, 'f%02d.png' % ORDER.index(j)))), key=lambda j: abs(j - k))
            print('missing frame', k, '-> using', near); path = os.path.join(folder, 'f%02d.png' % ORDER.index(near))
        im = Image.open(path).convert('RGBA')
        sc = im.width / FULL_W
        box = tuple(int(round(v * sc)) for v in BOX)
        a = np.asarray(im.crop(box), np.float32) / 255.0
        a[..., 3] = smoothstep(0.90, 0.995, a[..., 3])               # the flacon only: no shadow, no reflection
        cells.append(Image.fromarray((a * 255).round().astype(np.uint8), 'RGBA'))
    cw, ch = cells[0].size
    sheet = Image.new('RGBA', (cw * COLS, ch * ROWS), (0, 0, 0, 0))
    for i, cell in enumerate(cells):
        sheet.paste(cell, ((i % COLS) * cw, (i // COLS) * ch))
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    sheet.save(out, quality=84, method=6, alpha_quality=100)
    print('wrote %s  %dx%d  frame %dx%d  %d kB' % (out, sheet.width, sheet.height, cw, ch, os.path.getsize(out) // 1000))


if __name__ == '__main__':
    placement()
    if len(sys.argv) == 3:
        main(sys.argv[1], sys.argv[2])
