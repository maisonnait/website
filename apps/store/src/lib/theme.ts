'use client';

import { useSyncExternalStore } from 'react';
import { MODE_KEY, THEME_COLOR } from './theme-script';

/** Light is the default; the dark theme is a choice the visitor makes (kept in localStorage). */
export type Mode = 'light' | 'dark';

const EVENT = 'nait:mode';

function current(): Mode {
  return document.documentElement.getAttribute('data-mode') === 'dark' ? 'dark' : 'light';
}

function subscribe(listener: () => void): () => void {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

export function setMode(mode: Mode) {
  document.documentElement.setAttribute('data-mode', mode);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[mode]);
  try {
    window.localStorage.setItem(MODE_KEY, mode);
  } catch {
    // the choice simply lasts for this page view
  }
  window.dispatchEvent(new Event(EVENT));
}

/**
 * Brings the page in line with the saved choice. The inline script in <head> normally did it
 * before the first paint; this covers the pages React builds entirely in the browser
 * (the "not found" page), where that script cannot run.
 */
export function syncMode() {
  try {
    const saved = window.localStorage.getItem(MODE_KEY) === 'dark' ? 'dark' : 'light';
    if (saved !== current()) setMode(saved);
  } catch {
    // no storage: the light theme stays
  }
}

/** Current theme. The server always renders the light theme; the browser corrects it at once. */
export function useMode(): Mode {
  return useSyncExternalStore(subscribe, current, () => 'light');
}

function subscribeMotion(listener: () => void): () => void {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false,
  );
}
