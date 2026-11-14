/** Collections that have their own rendered flacon in /media/flacon (light and dark picture). */
const RENDERED = new Set(['arabisant', 'femmes', 'hommes', 'unisexe']);

/**
 * The rendered flacon of a collection: a 3D rendering of the house's bottle for that collection,
 * not a photograph of a product. Two pictures, one lit for each theme; the style sheet shows the
 * one of the current theme (.on-light / .on-dark in base.css) and the other is never fetched,
 * as long as it is lazy.
 */
export function FlaconPlate({ collection, className = '', eager = false }: { collection: string; className?: string; eager?: boolean }) {
  const name = RENDERED.has(collection) ? collection : 'arabisant';
  return (
    <>
      <img
        className={`${className} on-light`}
        src={`/media/flacon/bottle-${name}.webp`}
        alt=""
        width={1200}
        height={1500}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
      />
      <img className={`${className} on-dark`} src={`/media/flacon/bottle-${name}-dark.webp`} alt="" width={1200} height={1500} loading="lazy" decoding="async" />
    </>
  );
}
