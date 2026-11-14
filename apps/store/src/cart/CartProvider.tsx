'use client';

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { CartLine } from '@/lib/types';
import {
  addLine,
  clearCart,
  countOf,
  getServerSnapshot,
  getSnapshot,
  removeLine,
  setQuantity,
  subscribe,
  subtotalOf,
} from './store';

interface CartValue {
  lines: readonly CartLine[];
  /** Number of bottles. */
  count: number;
  /** Sum of the lines, in MAD. */
  subtotal: number;
  add: (line: Omit<CartLine, 'quantity'>, quantity: number) => number;
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
}

const CartContext = createContext<CartValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const lines = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const value = useMemo<CartValue>(
    () => ({
      lines,
      count: countOf(lines),
      subtotal: subtotalOf(lines),
      add: addLine,
      setQuantity,
      remove: removeLine,
      clear: clearCart,
      drawerOpen,
      openDrawer,
      closeDrawer,
    }),
    [lines, drawerOpen, openDrawer, closeDrawer],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartValue {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCart must be used inside <CartProvider>');
  return value;
}
