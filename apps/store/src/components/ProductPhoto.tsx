'use client';

import { useEffect, useRef, useState } from 'react';
import { FlaconPlate } from './FlaconPlate';

/**
 * A product picture on its plate. The house flacon (a rendering) is always there; the photo is a plain
 * <img> laid over it that only shows once it has really loaded. A missing or broken photo
 * therefore leaves the flacon, never a broken-image icon.
 */
export function ProductPhoto({
  src,
  alt,
  collection,
  eager = false,
  className = '',
}: {
  src: string | null;
  alt: string;
  collection: string;
  /** true for the main picture of a product page. */
  eager?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLImageElement>(null);
  const [state, setState] = useState<'loading' | 'cover' | 'fit' | 'failed'>('loading');

  function settle(image: HTMLImageElement) {
    if (image.naturalWidth < 2) {
      setState('failed');
      return;
    }
    const ratio = image.naturalWidth / image.naturalHeight;
    setState(ratio < 0.7 || ratio > 1.1 ? 'fit' : 'cover'); // odd formats are shown whole
  }

  // The photo may have loaded, or failed, before React attached its handlers.
  useEffect(() => {
    setState('loading');
    const image = ref.current;
    if (image?.complete) settle(image);
  }, [src]);

  const shown = state === 'cover' || state === 'fit';

  return (
    <span className={`plate plate--${collection} ${shown ? 'has-photo' : ''} ${className}`}>
      {/* the flacon of this collection (a 3D rendering, not a photo of the product) */}
      <FlaconPlate collection={collection} className="plate__render" eager={eager} />
      {src && state !== 'failed' ? (
        // A plain <img>: the photos live on the catalogue's own CDN and are shown as they are.
        <img
          ref={ref}
          className={`plate__photo ${state === 'fit' ? 'is-fit' : ''}`}
          src={src}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={(event) => settle(event.currentTarget)}
          onError={() => setState('failed')}
        />
      ) : alt ? (
        <span className="vh">{alt}</span>
      ) : null}
    </span>
  );
}
