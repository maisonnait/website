'use server';

import { getOrderForCustomer, isValidPhone } from '@nait/db';
import { isLocale } from '@/i18n/config';
import { formatDate } from '@/lib/format';
import type { TrackState } from '@/lib/order-types';

/** 'na 123', 'NA-000123', '123' -> 'NA-000123'; null when it cannot be an order number. */
function normalizeNumber(input: string): string | null {
  const match = /^(?:NA)?[\s-]*(\d{1,9})$/i.exec(input.trim());
  if (!match) return null;
  return `NA-${match[1]!.padStart(6, '0')}`;
}

/**
 * Order tracking. The order is only shown to someone who knows both its number and the
 * phone it was placed with; a wrong pair gets the same answer as an unknown order.
 */
export async function trackOrder(_previous: TrackState, formData: FormData): Promise<TrackState> {
  const rawNumber = typeof formData.get('number') === 'string' ? (formData.get('number') as string).slice(0, 40) : '';
  const phone = typeof formData.get('phone') === 'string' ? (formData.get('phone') as string).slice(0, 40) : '';
  const rawLang = formData.get('lang');
  const lang = isLocale(rawLang) ? rawLang : 'fr';

  const number = normalizeNumber(rawNumber);
  const fields: NonNullable<Extract<TrackState, { status: 'error' }>['fields']> = {};
  if (!number) fields.number = 'tr.err.number';
  if (!isValidPhone(phone)) fields.phone = 'co.err.phone';
  if (!number || fields.phone) return { status: 'error', fields };

  try {
    const order = await getOrderForCustomer(number, phone);
    if (!order) return { status: 'notfound' };
    const on = (date: Date | null) => (date ? formatDate(date, lang) : null);
    return {
      status: 'found',
      order: {
        number: order.number,
        status: order.status,
        placedOn: formatDate(order.createdAt, lang),
        confirmedOn: on(order.confirmedAt),
        shippedOn: on(order.shippedAt),
        deliveredOn: on(order.deliveredAt),
        items: order.items.map((item) => ({
          productName: item.productName,
          scentName: item.scentName,
          sizeMl: item.sizeMl,
          unitPrice: item.unitPriceMad,
          quantity: item.quantity,
        })),
        subtotal: order.subtotalMad,
        shipping: order.shippingMad,
        total: order.totalMad,
      },
    };
  } catch (error) {
    console.error('[store] getOrderForCustomer failed', error);
    return { status: 'error', failed: true };
  }
}
