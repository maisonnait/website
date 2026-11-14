'use client';

import { useEffect, useRef } from 'react';
import { checkCart } from '@/app/[lang]/commande/actions';
import { applyChecks, getSnapshot } from '@/cart/store';

/**
 * Asks the server once, when the page opens, for the current price and availability of the
 * lines in the cart, so an old cart cannot promise what the shelves no longer hold.
 */
export function useCartRefresh(enabled: boolean) {
  const done = useRef(false);
  useEffect(() => {
    if (!enabled || done.current) return;
    const lines = getSnapshot();
    if (lines.length === 0) return;
    done.current = true;
    checkCart(lines.map(({ variantId, slug }) => ({ variantId, slug })))
      .then(applyChecks)
      .catch(() => {
        // the order itself is checked again by the server
      });
  }, [enabled]);
}
