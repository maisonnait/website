/**
 * The cart lives in the browser only (localStorage). A tiny external store keeps every
 * component, and every tab, in step.
 */
import { MAX_PER_LINE, type CartLine, type LineCheck } from '@/lib/types';

const KEY = 'nait-cart';
const VERSION = 1;
const EMPTY: readonly CartLine[] = Object.freeze([]);

let lines: readonly CartLine[] = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function isLine(value: unknown): value is CartLine {
  if (typeof value !== 'object' || value === null) return false;
  const line = value as Record<string, unknown>;
  return (
    typeof line.variantId === 'string' &&
    typeof line.slug === 'string' &&
    typeof line.name === 'string' &&
    typeof line.scent === 'string' &&
    typeof line.sizeMl === 'number' &&
    typeof line.price === 'number' &&
    typeof line.quantity === 'number' &&
    line.quantity >= 1
  );
}

function read(): readonly CartLine[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as { v?: number; lines?: unknown };
    if (parsed.v !== VERSION || !Array.isArray(parsed.lines)) return EMPTY;
    const valid = parsed.lines.filter(isLine).map((line) => ({
      ...line,
      scentAr: line.scentAr ?? null,
      tag: line.tag ?? null,
      imageUrl: line.imageUrl ?? null,
      collectionSlug: line.collectionSlug ?? '',
      max: typeof line.max === 'number' ? line.max : MAX_PER_LINE,
      quantity: Math.max(1, Math.min(Math.trunc(line.quantity), MAX_PER_LINE)),
    }));
    return valid.length ? valid : EMPTY;
  } catch {
    return EMPTY; // storage unavailable or damaged: start with an empty cart
  }
}

function write(next: readonly CartLine[]) {
  lines = next.length ? next : EMPTY;
  try {
    if (lines.length) window.localStorage.setItem(KEY, JSON.stringify({ v: VERSION, lines }));
    else window.localStorage.removeItem(KEY);
  } catch {
    // private mode: the cart still works for this page view
  }
  listeners.forEach((listener) => listener());
}

function ensureLoaded() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  lines = read();
  window.addEventListener('storage', (event) => {
    if (event.key !== null && event.key !== KEY) return;
    lines = read();
    listeners.forEach((listener) => listener());
  });
}

export function subscribe(listener: () => void): () => void {
  ensureLoaded();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): readonly CartLine[] {
  ensureLoaded();
  return lines;
}

export function getServerSnapshot(): readonly CartLine[] {
  return EMPTY;
}

function clampQuantity(quantity: number, max: number): number {
  const limit = Math.max(1, Math.min(max || MAX_PER_LINE, MAX_PER_LINE));
  return Math.max(1, Math.min(Math.trunc(quantity) || 1, limit));
}

/** Adds a line, or raises the quantity of the same variant. Returns the quantity now in the cart. */
export function addLine(line: Omit<CartLine, 'quantity'>, quantity: number): number {
  ensureLoaded();
  const existing = lines.find((candidate) => candidate.variantId === line.variantId);
  const total = clampQuantity((existing?.quantity ?? 0) + quantity, line.max);
  const updated: CartLine = { ...line, quantity: total };
  write(existing ? lines.map((candidate) => (candidate.variantId === line.variantId ? updated : candidate)) : [...lines, updated]);
  return total;
}

export function setQuantity(variantId: string, quantity: number) {
  ensureLoaded();
  write(
    lines.map((line) => (line.variantId === variantId ? { ...line, quantity: clampQuantity(quantity, line.max) } : line)),
  );
}

export function removeLine(variantId: string) {
  ensureLoaded();
  write(lines.filter((line) => line.variantId !== variantId));
}

export function clearCart() {
  ensureLoaded();
  write(EMPTY);
}

/** Brings prices and limits up to date with what the server just said. Quantities are left alone. */
export function applyChecks(checks: readonly LineCheck[]) {
  ensureLoaded();
  const byId = new Map(checks.map((check) => [check.variantId, check]));
  let changed = false;
  const next = lines.map((line) => {
    const check = byId.get(line.variantId);
    if (!check) return line;
    const price = check.found && check.price !== null ? check.price : line.price;
    const max = check.found ? check.available : 0;
    if (price === line.price && max === line.max) return line;
    changed = true;
    return { ...line, price, max };
  });
  if (changed) write(next);
}

export function countOf(cart: readonly CartLine[]): number {
  return cart.reduce((sum, line) => sum + line.quantity, 0);
}

export function subtotalOf(cart: readonly CartLine[]): number {
  return cart.reduce((sum, line) => sum + line.quantity * line.price, 0);
}
