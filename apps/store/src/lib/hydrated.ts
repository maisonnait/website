'use client';

import { useSyncExternalStore } from 'react';

const noop = () => () => {};

/** false on the server and during hydration, true afterwards (when localStorage has been read). */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
