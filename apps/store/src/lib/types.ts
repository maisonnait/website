/**
 * View models passed from the server to the browser. They carry only what the page shows:
 * no SKU, no exact stock above the "low stock" threshold, no internal ids beyond the variant.
 */
export type ScentTag = 'EXTRA' | 'SUPER';
export type StockState = 'in' | 'low' | 'out';

export interface PickerScent {
  id: string;
  name: string;
  nameAr: string | null;
  tag: ScentTag | null;
}

export interface PickerVariant {
  id: string;
  scentId: string;
  /** 50, 75 or 100; 0 when the product has a single size. */
  sizeMl: number;
  price: number;
  state: StockState;
  /** Units left, only meaningful when state is 'low'. */
  left: number;
  /** Largest quantity that can be put in the cart (0 when sold out). */
  max: number;
}

export interface PickerProduct {
  slug: string;
  name: string;
  imageUrl: string | null;
  collectionSlug: string;
  hasSizes: boolean;
  scents: PickerScent[];
  variants: PickerVariant[];
}

/** One line of the cart, as kept in localStorage. Names and price are a snapshot. */
export interface CartLine {
  variantId: string;
  slug: string;
  name: string;
  scent: string;
  scentAr: string | null;
  tag: ScentTag | null;
  sizeMl: number;
  price: number;
  imageUrl: string | null;
  collectionSlug: string;
  quantity: number;
  /** Largest quantity known to be available when the line was last checked. */
  max: number;
}

/** Fresh price and availability of a cart line, as returned by the server. */
export interface LineCheck {
  variantId: string;
  /** false when the variant no longer exists or is no longer sold. */
  found: boolean;
  /** Current unit price in MAD; null when it could not be read (the cart keeps its own). */
  price: number | null;
  /** Units that can be ordered right now, capped at MAX_PER_LINE. */
  available: number;
}

/** Largest quantity of one variant in an order. */
export const MAX_PER_LINE = 10;
