/**
 * The house flacon, drawn. It stands in for a product photo that is missing or cannot load:
 * every family wears the same bottle, and the engraving and the fill level are derived from
 * its slug, so a product always gets the same drawing. Lines use currentColor (theme-aware);
 * the liquid gradients and the clip path come from <SvgDefs />.
 */
const LIQUID: Record<string, string> = {
  arabisant: 'liq-amber',
  femmes: 'liq-rose',
  hommes: 'liq-indigo',
  unisexe: 'liq-silver',
};

const WAVE = `M-160 0q20-6 40 0${'t40 0'.repeat(14)}V240H-160Z`;

type Shape = { d: string; filled?: boolean } | { circle: [number, number, number] };

const MOTIFS: Shape[][] = [
  [{ d: 'M100 140 134 190 100 240 66 190Z' }, { circle: [100, 190, 8] }],
  [
    { d: 'M100 132 140 190 100 248 60 190Z' },
    { d: 'M100 152 126 190 100 228 74 190Z' },
    { d: 'M100 172 112 190 100 208 88 190Z' },
  ],
  [0, 1, 2, 3, 4].map((i) => ({ d: `M62 ${150 + i * 22} 100 ${128 + i * 22} 138 ${150 + i * 22}` })),
  [{ d: 'M72 162h56v56H72z' }, { d: 'M100 150.4 139.6 190 100 229.6 60.4 190Z' }, { circle: [100, 190, 12] }],
  [
    ...[-60, -40, -20, 0, 20, 40, 60].map((angle) => {
      const r = (angle * Math.PI) / 180;
      return { d: `M100 266 ${(100 + Math.sin(r) * 150).toFixed(1)} ${(266 - Math.cos(r) * 150).toFixed(1)}` };
    }),
    { d: 'M60 266h80' },
  ],
  [...[24, 44, 64, 84].map((r) => ({ d: `M${100 - r} 258a${r} ${r} 0 0 1 ${2 * r} 0` })), { d: 'M50 258h100' }],
  [150, 190, 230].map((y) => ({
    d: `M52 ${y + 10} 68 ${y - 10} 84 ${y + 10} 100 ${y - 10} 116 ${y + 10} 132 ${y - 10} 148 ${y + 10}`,
  })),
  [
    ...[58, 72, 86, 100, 114, 128, 142].map((x) => ({ d: `M${x} 118V262` })),
    { d: 'M100 170 114 190 100 210 86 190Z', filled: true },
  ],
];

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function Flacon({ slug, collection, className }: { slug: string; collection: string; className?: string }) {
  const random = rng(hash(slug));
  const motif = MOTIFS[Math.floor(random() * MOTIFS.length)] ?? MOTIFS[0]!;
  const level = Math.round(112 + random() * 66);
  const phase = Math.round(random() * 80);
  const liquid = LIQUID[collection] ?? 'liq-amber';

  return (
    <svg className={className} viewBox="0 0 200 320" aria-hidden="true" focusable="false">
      <ellipse cx="100" cy="313" rx="72" ry="5" fill="currentColor" opacity=".1" />
      <g clipPath="url(#clip-body)">
        <g transform={`translate(${phase} ${level})`}>
          <path d={WAVE} fill={`url(#${liquid})`} />
        </g>
      </g>
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
        <polygon points="56,70 144,70 170,96 170,284 144,310 56,310 30,284 30,96" fill="currentColor" fillOpacity=".03" />
        <rect x="88" y="52" width="24" height="18" />
        <rect x="70" y="14" width="60" height="38" fill="currentColor" fillOpacity=".07" />
        <rect x="82" y="2" width="36" height="12" fill="currentColor" fillOpacity=".07" />
        <g clipPath="url(#clip-body)" strokeOpacity=".7" strokeWidth="1.4">
          {motif.map((shape, index) =>
            'circle' in shape ? (
              <circle key={index} cx={shape.circle[0]} cy={shape.circle[1]} r={shape.circle[2]} />
            ) : (
              <path key={index} d={shape.d} {...(shape.filled ? { fill: 'currentColor', stroke: 'none' } : {})} />
            ),
          )}
        </g>
      </g>
    </svg>
  );
}
