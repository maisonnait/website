/**
 * Shared SVG definitions, rendered once per page: the four Tifinagh letters of the name
 * (ⵏ ⴰ ⵢ ⵜ), and the gold foil.
 */
const N = 'M0 725V11H89V725Z';
const A =
  'M192 735Q108 735 54 685Q0 635 0 544Q0 453 54 402.5Q108 352 192 352Q276 352 330 402.5Q384 453 384 544Q384 635 330 685Q276 735 192 735ZM192 657Q242 657 268.5 626.5Q295 596 295 544Q295 492 268.5 461Q242 430 192 430Q140 430 114.5 461Q89 492 89 544Q89 596 116 626.5Q143 657 192 657Z';
const Y =
  'M64 735 0 680 207 473Q226 454 241.5 439Q257 424 279 409V403Q255 388 236.5 373Q218 358 201 344L4 175V113L391 0L411 76L235 125Q200 135 172.5 142Q145 149 110 154V161Q141 178 165 198Q189 218 211 238L370 374V427Z';
const T = 'M205 725V387H0V308H205V11H294V308H499V387H294V725Z';

export const GLYPHS = {
  n: { id: 'g-n', viewBox: '0 0 89 735' },
  a: { id: 'g-a', viewBox: '0 0 384 735' },
  y: { id: 'g-y', viewBox: '0 0 411 735' },
  t: { id: 'g-t', viewBox: '0 0 499 735' },
  nayt: { id: 'g-nayt', viewBox: '0 0 1883 735' },
} as const;

export type GlyphName = keyof typeof GLYPHS;

export function Glyph({ name, className }: { name: GlyphName; className?: string }) {
  const glyph = GLYPHS[name];
  return (
    <svg className={className} viewBox={glyph.viewBox} aria-hidden="true" focusable="false">
      <use href={`#${glyph.id}`} />
    </svg>
  );
}

export function SvgDefs() {
  return (
    <svg className="defs" aria-hidden="true" focusable="false">
      <defs>
        <symbol id="g-n" viewBox="0 0 89 735">
          <path d={N} />
        </symbol>
        <symbol id="g-a" viewBox="0 0 384 735">
          <path d={A} />
        </symbol>
        <symbol id="g-y" viewBox="0 0 411 735">
          <path d={Y} />
        </symbol>
        <symbol id="g-t" viewBox="0 0 499 735">
          <path d={T} />
        </symbol>
        <symbol id="g-nayt" viewBox="0 0 1883 735">
          <path d={N} />
          <path transform="translate(349 0)" d={A} />
          <path transform="translate(853 0)" d={Y} />
          <path transform="translate(1384 0)" d={T} />
        </symbol>
        <linearGradient id="foil" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8a6d2f" />
          <stop offset=".28" stopColor="#b59449" />
          <stop offset=".5" stopColor="#F6E7AE" />
          <stop offset=".72" stopColor="#b59449" />
          <stop offset="1" stopColor="#8a6d2f" />
        </linearGradient>
      </defs>
    </svg>
  );
}
