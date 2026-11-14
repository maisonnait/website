import type { MessageKey } from '@/i18n';
import type { LineCheck } from './types';

export type OrderField = 'name' | 'phone' | 'city' | 'address' | 'note';

/** Result of the checkout Server Action. Messages are dictionary keys, translated by the page. */
export type OrderState =
  | { status: 'idle' }
  | { status: 'ok'; number: string; total: number }
  | {
      status: 'error';
      /** fields: see `fields`; stock: a line is no longer available; empty: no line; server: technical failure. */
      error: 'fields' | 'stock' | 'empty' | 'server';
      fields?: Partial<Record<OrderField, MessageKey>>;
      /** Fresh availability of every line, sent with a stock error. */
      checks?: LineCheck[];
    };

export interface TrackedOrder {
  number: string;
  status: 'new' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' | 'returned';
  /** Dates are formatted on the server (dd/mm/yyyy, Moroccan time). */
  placedOn: string;
  confirmedOn: string | null;
  shippedOn: string | null;
  deliveredOn: string | null;
  items: { productName: string; scentName: string; sizeMl: number; unitPrice: number; quantity: number }[];
  subtotal: number;
  shipping: number;
  total: number;
}

export type TrackState =
  | { status: 'idle' }
  | { status: 'found'; order: TrackedOrder }
  | { status: 'notfound' }
  | { status: 'error'; fields?: Partial<Record<'number' | 'phone', MessageKey>>; failed?: boolean };
