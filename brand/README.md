# Brand kit of Maison N'Ait

Everything here is built from the logo supplied by the house (`source/logo-source.png`, 69 x 155 px),
redrawn as a clean vector. Gold `#B59449`, light gold `#D9C08A`, black `#0B0B0C`, ivory `#F7F2E6`.
`brand-sheet.png` shows the whole kit on one page.

| File | Use |
| --- | --- |
| `logo-mark.svg`, `-black`, `-white` | The sign alone (crown, flacon, drop, wisp). |
| `logo-mark-small.svg` | The sign without wisp and highlight, with a heavier line, for 16 to 48 px. |
| `logo-horizontal*.svg`, `logo-vertical*.svg`, `logo-header.svg` | Sign and name. The name is outlined (Josefin Sans Light), no font is needed. |
| `favicon.svg`, `favicon.ico`, `favicon-16.png`, `favicon-32.png` | Browser tab. |
| `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `site.webmanifest` | Phone home screens. |
| `og.jpg` (and `og.svg`) | Picture shown when a link to the shop is shared, 1200 x 630. |

The shop serves its copies from `apps/store/public`; its header and footer use the component
`apps/store/src/brand/Logo.tsx`. The stock manager uses `apps/admin/src/components/sign.tsx`,
`apps/admin/src/app/icon.svg` and `apple-icon.png`.

## Rebuilding the kit

```bash
cd brand/source
python3 rebuild.py   # logo-source.png -> logo-geometry.json (numpy, scipy, opencv-python, pillow, potracer, rsvg-convert)
python3 kit.py       # logo-geometry.json -> every file above and the shop's Logo.tsx (fonttools; run pnpm install first)
```

After `kit.py`, copy the icons you changed into `apps/store/public` (and `favicon.svg` to
`apps/admin/src/app/icon.svg`).

## The rendered flacon

`render/scene.py` builds the house flacon in 3D (the sign turned into a bottle: amphora glass, crown
stopper, the logo printed in gold) and path traces it with Blender's Cycles through the `bpy` Python
module (`pip install bpy`). The pictures the shop uses are in `apps/store/public/media/flacon`:
the hero in light and dark, wide and portrait, and one plate per collection.

```bash
cd brand/render
python3 scene.py --liquid femmes --bg light --comp layer --samples 48 --noise 0.03 --save-layer layers/femmes.png
python3 scene.py --use-layer layers/femmes.png --bg light --comp packshot --out bottle-femmes.jpg
```

### The turning flacon of the home page

The flacon of the hero turns towards the mouse, turns away as the page scrolls, and looks left and
right once on arrival. It is not a live 3D model: fifteen frames of the same scene, the flacon turned
2.8125 degrees more on each, are packed in one picture (`apps/store/public/media/flacon/turn-light.webp`)
and played by `apps/store/src/home/FlaconTurn.tsx` on a canvas laid exactly over the still picture.

```bash
cd brand/render
python3 scene.py --liquid arabisant --bg light --comp layer --scale 0.5 --samples 40 --noise 0.03 \
  --turn-seq="0,2.8125,-2.8125,5.625,-5.625,8.4375,-8.4375,11.25,-11.25,14.0625,-14.0625,16.875,-16.875,19.6875,-19.6875" \
  --save-layer "seq/light/f%02d.png"            # about one minute per frame on two cores
python3 sheet.py seq/light ../../apps/store/public/media/flacon/turn-light.webp
```

The dark theme has no frames yet: render the same sequence with `--bg dark` into `seq/dark`, pack it as
`turn-dark.webp` and add `dark: '/media/flacon/turn-dark.webp'` to `SHEETS` in `FlaconTurn.tsx`.
A larger `--scale` gives sharper frames (the shop shows the sharp still whenever the flacon is at rest).

These pictures are brand imagery: they show the house flacon, not a photograph of a product.
