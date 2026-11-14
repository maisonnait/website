'use server';

import { isDomainError, isValidPhone, placeOrder } from '@nait/db';
import type { MessageKey } from '@/i18n';
import { isLocale } from '@/i18n/config';
import { checkLines } from '@/lib/data';
import type { OrderField, OrderState } from '@/lib/order-types';
import { MAX_PER_LINE, type LineCheck } from '@/lib/types';

const MAX_LINES = 40;
const ID = /^[0-9a-zA-Z-]{1,64}$/;
const SLUG = /^[a-z0-9-]{1,120}$/;

function text(value: FormDataEntryValue | null, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

interface CartEntry {
  variantId: string;
  slug: string;
  quantity: number;
}

function parseCart(raw: FormDataEntryValue | null): CartEntry[] {
  if (typeof raw !== 'string' || raw.length > 20_000) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const entries: CartEntry[] = [];
    for (const item of parsed.slice(0, MAX_LINES)) {
      if (typeof item !== 'object' || item === null) continue;
      const { variantId, slug, quantity } = item as Record<string, unknown>;
      if (typeof variantId !== 'string' || !ID.test(variantId)) continue;
      if (typeof slug !== 'string' || !SLUG.test(slug)) continue;
      if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_PER_LINE) continue;
      entries.push({ variantId, slug, quantity });
    }
    return entries;
  } catch {
    return [];
  }
}

/** Field names of @nait/db mapped to the fields of the form. */
const DB_FIELDS: Record<string, OrderField> = {
  customerName: 'name',
  name: 'name',
  phone: 'phone',
  city: 'city',
  address: 'address',
  note: 'note',
};

/**
 * Checkout, cash on delivery. Validates the form, then lets placeOrder() do the rest in one
 * transaction (stock check included). Never trusts the prices of the browser: only variant
 * ids and quantities are sent to the database.
 */
export async function submitOrder(_previous: OrderState, formData: FormData): Promise<OrderState> {
  // Honeypot: a field people never see. A robot that fills it gets a plain failure.
  if (text(formData.get('website'), 200) !== '') return { status: 'error', error: 'server' };

  const name = text(formData.get('name'), 120);
  const phone = text(formData.get('phone'), 40);
  const city = text(formData.get('city'), 80);
  const address = text(formData.get('address'), 300);
  const rawNote = typeof formData.get('note') === 'string' ? (formData.get('note') as string).trim() : '';
  const lang = text(formData.get('lang'), 8);

  const fields: Partial<Record<OrderField, MessageKey>> = {};
  if (name.length < 3) fields.name = 'co.err.name';
  if (!isValidPhone(phone)) fields.phone = 'co.err.phone';
  if (city.length < 2) fields.city = 'co.err.city';
  if (address.length < 5) fields.address = 'co.err.address';
  if (rawNote.length > 500) fields.note = 'co.err.note';
  if (Object.keys(fields).length > 0) return { status: 'error', error: 'fields', fields };

  const cart = parseCart(formData.get('cart'));
  if (cart.length === 0) return { status: 'error', error: 'empty' };

  try {
    const order = await placeOrder({
      customerName: name,
      phone,
      city,
      address,
      note: rawNote || null,
      lang: isLocale(lang) ? lang : 'fr',
      items: cart.map(({ variantId, quantity }) => ({ variantId, quantity })),
    });
    return { status: 'ok', number: order.number, total: order.total };
  } catch (error) {
    if (isDomainError(error)) {
      if (error.code === 'OUT_OF_STOCK') {
        // Tell the page what is left of every line, so it can offer the exact fix.
        const checks: LineCheck[] = (await checkLines(cart).catch(() => null)) ?? [];
        const refused = error.details.variantId;
        if (typeof refused === 'string') {
          // The line placeOrder() refused must come back flagged, even if the fresh read failed.
          const asked = cart.find((entry) => entry.variantId === refused)?.quantity ?? 1;
          const reported = typeof error.details.available === 'number' ? error.details.available : 0;
          const left = Math.max(0, Math.min(reported, asked - 1, MAX_PER_LINE));
          const known = checks.find((check) => check.variantId === refused);
          if (!known) checks.push({ variantId: refused, found: true, price: null, available: left });
          else if (known.available >= asked) known.available = left;
        }
        return { status: 'error', error: 'stock', checks };
      }
      if (error.code === 'INVALID_PHONE') return { status: 'error', error: 'fields', fields: { phone: 'co.err.phone' } };
      if (error.code === 'EMPTY_CART') return { status: 'error', error: 'empty' };
      if (error.code === 'INVALID_INPUT') {
        const field = DB_FIELDS[String(error.details.field ?? '')];
        if (field) {
          const fields: Partial<Record<OrderField, MessageKey>> = {};
          fields[field] = `co.err.${field}`;
          return { status: 'error', error: 'fields', fields };
        }
      }
    }
    console.error('[store] placeOrder failed', error);
    return { status: 'error', error: 'server' };
  }
}

/** Fresh prices and availability for the lines of a cart (cart page and checkout). */
export async function checkCart(lines: { variantId: string; slug: string }[]): Promise<LineCheck[]> {
  if (!Array.isArray(lines)) return [];
  const valid = lines
    .slice(0, MAX_LINES)
    .filter(
      (line) =>
        typeof line?.variantId === 'string' && ID.test(line.variantId) && typeof line?.slug === 'string' && SLUG.test(line.slug),
    )
    .map(({ variantId, slug }) => ({ variantId, slug }));
  if (valid.length === 0) return [];
  return checkLines(valid);
}
