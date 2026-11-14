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

## The rendered flacons

`render/scene.py` builds the house flacons in 3D and path traces them with Blender's Cycles through the `bpy`
Python module (`pip install bpy`). One design per collection, all with the logo printed in gold on the glass:

| `--design` | Collection | Flacon |
| --- | --- | --- |
| `arabisant` (default) | Arabisant, and the hero of the home page | the sign turned into a bottle: amphora glass, gold crown stopper |
| `femmes` | Femmes | slender hourglass, rose-gold sphere stopper |
| `hommes` | Hommes | square block, heavy base, dark cylinder cap |
| `unisexe` | Unisexe | plain cylinder, low pale-gold cap |

The pictures the shop uses are in `apps/store/public/media/flacon`: the hero in light and dark, wide, portrait and
right-to-left (`hero-*`), one plate per collection and per theme (`bottle-<collection>.webp`, `bottle-<collection>-dark.webp`),
and the frames of the turning flacon (`turn-light.webp`, `turn-dark.webp`, `turn-mask.png`).

```bash
cd brand/render
# a plate: render the master once, then compose it (seconds)
python3 scene.py --design femmes --liquid femmes --bg light --comp layer --samples 48 --noise 0.03 --save-layer layers/femmes-light.png
python3 scene.py --use-layer layers/femmes-light.png --bg light --comp packshot --out bottle-femmes.jpg
# dark plate: --bg dark for the master, then --bg dark --bgcolor "#10153A" when composing
```

These pictures are brand imagery: they show the house's flacons, not photographs of the products.

### The staged flacon of the home page

The flacon of the hero arrives like a short film (the camera pulls back, the focus comes in, the flacon swings round,
mist leaves the stopper, light passes over the glass), then follows the mouse, sprays when it is clicked or tapped,
and turns away as the page scrolls. It is not a live 3D model: fifteen frames of the same scene, the flacon turned
2.8125 degrees more on each, are packed in one picture per theme and played by `apps/store/src/home/HeroFlacon.tsx`
on a canvas laid exactly over the still picture; the mist is drawn live (`apps/store/src/home/plume.ts`).

```bash
cd brand/render
python3 scene.py --liquid arabisant --bg light --comp layer --scale 0.5 --samples 40 --noise 0.03 \
  --turn-seq="0,2.8125,-2.8125,5.625,-5.625,8.4375,-8.4375,11.25,-11.25,14.0625,-14.0625,16.875,-16.875,19.6875,-19.6875" \
  --save-layer "seq/light/f%02d.png"            # about one minute per frame on two cores; --bg dark into seq/dark for the dark theme
python3 sheet.py seq/light ../../apps/store/public/media/flacon/turn-light.webp ../../apps/store/public/media/flacon/turn-mask.png
python3 sheet.py seq/dark  ../../apps/store/public/media/flacon/turn-dark.webp
```

A larger `--scale` gives sharper frames (the shop shows the sharp still whenever the flacon is at rest).
