/**
 * Public types of @nait/db.
 *
 * Conventions
 * - Property names are camelCase (the SQL columns are snake_case).
 * - Money is an integer number of Moroccan dirhams (MAD).
 * - Timestamps are JavaScript `Date` objects.
 * - Ids are uuid strings.
 *
 * This file has no runtime dependency: it is safe to import from anywhere
 * (`import type { ProductCard } from '@nait/db'`, or `@nait/db/types` in client components).
 */

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

/** Languages of the shop. `fr` is the default; `ar` and `ary` are right-to-left. */
export const LANGS = ['fr', 'en', 'ar', 'ary', 'zgh'] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = 'fr';

export const ORDER_STATUSES = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled', 'returned'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const MOVEMENT_REASONS = ['sale', 'cancel', 'return', 'restock', 'adjust', 'initial'] as const;
export type MovementReason = (typeof MOVEMENT_REASONS)[number];

/** Reasons accepted by `adjustStock` ('sale' and 'cancel' are written by the order functions only). */
export const MANUAL_STOCK_REASONS = ['restock', 'adjust', 'return', 'initial'] as const;
export type ManualStockReason = (typeof MANUAL_STOCK_REASONS)[number];

export const USER_ROLES = ['owner', 'staff'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const SCENT_TAGS = ['EXTRA', 'SUPER'] as const;
export type ScentTag = (typeof SCENT_TAGS)[number];

/** Cash on delivery only for now; the column is free text so that 'card' can be added later. */
export type PaymentMethod = 'cod' | 'card';

/** Bottle sizes in millilitres. A product without sizes has one variant per scent with `sizeMl = 0`. */
export const SIZES_ML = [50, 75, 100] as const;

/** Price of every catalogue item at launch, in MAD. */
export const DEFAULT_PRICE_MAD = 199;

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export interface Collection {
  id: string;
  /** 'arabisant' | 'femmes' | 'hommes' | 'unisexe' */
  slug: string;
  position: number;
  nameFr: string;
  nameEn: string;
  nameAr: string;
  nameAry: string;
  nameZgh: string;
  descriptionFr: string;
  descriptionEn: string;
  descriptionAr: string;
  descriptionAry: string;
  descriptionZgh: string;
  /** The same five names keyed by language: `collection.name[lang]`. */
  name: Record<Lang, string>;
  /** The same five descriptions keyed by language: `collection.description[lang]`. */
  description: Record<Lang, string>;
  /** Number of active products in the collection (0 for 'unisexe' at launch). */
  productCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Product {
  id: string;
  slug: string;
  collectionId: string;
  name: string;
  /** true: every scent is sold in 50, 75 and 100 ml. false: one variant per scent, `sizeMl = 0`. */
  hasSizes: boolean;
  active: boolean;
  position: number;
  imageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** A product as shown in a list. The computed fields look at ACTIVE variants only. */
export interface ProductCard extends Product {
  collectionSlug: string;
  /** Number of scents that have at least one active variant. */
  scentCount: number;
  /** Number of active variants. */
  variantCount: number;
  /** Lowest price among the active variants, in MAD (0 if the product has no active variant). */
  minPrice: number;
  /** true when at least one active variant has stock > 0. */
  inStock: boolean;
  /** Sum of the stock of the active variants. */
  totalStock: number;
}

export interface Scent {
  id: string;
  productId: string;
  nameLatin: string;
  nameAr: string | null;
  tag: ScentTag | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Variant {
  id: string;
  productId: string;
  scentId: string;
  /** 50, 75 or 100; 0 when the product has no sizes. */
  sizeMl: number;
  sku: string;
  priceMad: number;
  stock: number;
  lowStockThreshold: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** A variant with the labels needed to display it on its own (back office lists, dashboard). */
export interface VariantRow extends Variant {
  productName: string;
  productSlug: string;
  productActive: boolean;
  collectionSlug: string;
  imageUrl: string | null;
  /** Latin name of the scent. */
  scentName: string;
  scentNameAr: string | null;
  scentTag: ScentTag | null;
  /** true when `stock <= lowStockThreshold`. */
  low: boolean;
}

/** One product with everything needed by a product page. */
export interface ProductDetail extends ProductCard {
  collection: Collection;
  /** Ordered by position. */
  scents: Scent[];
  /** Ordered by scent position, then size. Each carries its current `stock`. */
  variants: Variant[];
}

export interface ListProductsOptions {
  collectionSlug?: string;
  /**
   * Default false = every product, active or not (what the back office needs).
   * THE SHOP MUST PASS `activeOnly: true` so that hidden products stay hidden.
   */
  activeOnly?: boolean;
}

export interface GetProductOptions {
  /**
   * Default false. With true, an inactive product gives `null` and inactive variants
   * (and scents left without any active variant) are left out. THE SHOP SHOULD PASS true.
   */
  activeOnly?: boolean;
}

export interface UpsertScentInput {
  /** Existing scent to update. Without id a new scent is created, with its variants. */
  id?: string;
  nameLatin: string;
  nameAr?: string | null;
  tag?: ScentTag | null;
  position?: number;
}

export interface UpsertProductInput {
  /** Update this product. Without id a product is created. */
  id?: string;
  /** Required when creating unless it can be derived from the name. Lowercase letters, digits and dashes. */
  slug?: string;
  name: string;
  /** One of collectionId / collectionSlug is required when creating. */
  collectionId?: string;
  collectionSlug?: string;
  /** Creation only (default true). Cannot be changed afterwards. */
  hasSizes?: boolean;
  active?: boolean;
  position?: number;
  imageUrl?: string | null;
  /**
   * Scents to create (no id) or update (id). Scents that are not listed are left untouched;
   * nothing is ever deleted (deactivate variants with `setVariant` instead).
   * A product created without scents gets one scent named like the product.
   */
  scents?: UpsertScentInput[];
  /** Price of the variants created by this call (default 199). */
  priceMad?: number;
  /** Stock of the variants created by this call (default 0; written as an 'initial' movement). */
  initialStock?: number;
}

export interface SetVariantInput {
  priceMad?: number;
  lowStockThreshold?: number;
  active?: boolean;
}

export interface ListVariantsOptions {
  /** Searches the sku, the product name and the scent names (case-insensitive). */
  q?: string;
  /** Only variants with `stock <= lowStockThreshold`. */
  lowOnly?: boolean;
  productId?: string;
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export interface PlaceOrderItemInput {
  variantId: string;
  /** Integer from 1 to 99. Several lines with the same variant are added up. */
  quantity: number;
}

export interface PlaceOrderInput {
  customerName: string;
  /** Moroccan number: 0[5-7]XXXXXXXX or +212[5-7]XXXXXXXX (spaces, dots and dashes are ignored). */
  phone: string;
  city: string;
  address: string;
  note?: string | null;
  /** Language the customer was using; anything unknown is stored as 'fr'. */
  lang: Lang | (string & {});
  items: PlaceOrderItemInput[];
}

export interface PlacedOrder {
  id: string;
  /** 'NA-000123' */
  number: string;
  subtotal: number;
  shipping: number;
  total: number;
}

export interface Order {
  id: string;
  /** 'NA-000123' */
  number: string;
  status: OrderStatus;
  customerName: string;
  /** Stored normalised: '+2126XXXXXXXX'. Use `formatPhoneLocal` to show '06XXXXXXXX'. */
  phone: string;
  city: string;
  address: string;
  note: string | null;
  lang: Lang;
  subtotalMad: number;
  shippingMad: number;
  totalMad: number;
  paymentMethod: PaymentMethod;
  internalNote: string | null;
  confirmedAt: Date | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  returnedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  id: string;
  orderId: string;
  variantId: string;
  /** Names and price are copied at the time of the order and never change afterwards. */
  productName: string;
  scentName: string;
  sizeMl: number;
  unitPriceMad: number;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
}

/** A row of the back-office order list. */
export interface OrderListItem extends Order {
  /** Number of lines. */
  lineCount: number;
  /** Number of bottles (sum of the quantities). */
  itemCount: number;
}

export interface OrderDetail extends Order {
  items: OrderItem[];
}

export interface OrderSummaryItem {
  productName: string;
  scentName: string;
  sizeMl: number;
  unitPriceMad: number;
  quantity: number;
}

/** What a customer sees on the tracking page. No address, no phone, no internal note. */
export interface OrderSummary {
  number: string;
  status: OrderStatus;
  customerName: string;
  city: string;
  lang: Lang;
  subtotalMad: number;
  shippingMad: number;
  totalMad: number;
  paymentMethod: PaymentMethod;
  createdAt: Date;
  confirmedAt: Date | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  returnedAt: Date | null;
  items: OrderSummaryItem[];
}

export interface ListOrdersOptions {
  status?: OrderStatus | OrderStatus[];
  /** Searches the order number, the customer name, the phone and the city. */
  q?: string;
  /** Default 50, maximum 500. */
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// Stock
// ---------------------------------------------------------------------------

export interface StockMovement {
  id: string;
  variantId: string;
  /** Negative when stock leaves, positive when it comes back or is added. */
  delta: number;
  reason: MovementReason;
  orderId: string | null;
  userId: string | null;
  note: string | null;
  /** Stock of the variant right after this movement. */
  stockAfter: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MovementRow extends StockMovement {
  sku: string;
  productName: string;
  scentName: string;
  sizeMl: number;
  orderNumber: string | null;
  userName: string | null;
}

export interface ListMovementsOptions {
  variantId?: string;
  orderId?: string;
  /** Default 100, maximum 1000. */
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface DashboardDay {
  /** 'YYYY-MM-DD' in Morocco time (Africa/Casablanca). */
  day: string;
  orders: number;
  revenue: number;
}

/**
 * Days are Moroccan calendar days. `ordersToday`, `revenueToday` and `last7Days` leave out
 * cancelled and returned orders; `ordersByStatus` counts every order ever placed.
 */
export interface Dashboard {
  ordersToday: number;
  revenueToday: number;
  ordersByStatus: Record<OrderStatus, number>;
  /** Active variants with `stock <= lowStockThreshold`, lowest stock first. */
  lowStock: VariantRow[];
  /** Seven entries, oldest first, the last one is today. */
  last7Days: DashboardDay[];
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

/** A back-office user. The password hash never leaves the package. */
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  email: string;
  name: string;
  /** At least 8 characters. Stored as a scrypt hash. */
  password: string;
  /** Default 'staff'. */
  role?: UserRole;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface Settings {
  /** Shipping fee in MAD added to every order (default 0). */
  shippingMad: number;
  /** Delivery delay shown to customers (default '1 à 3 jours ouvrés'). */
  deliveryDelay: string;
  /** Phone number of the shop (default ''). */
  shopPhone: string;
  /** WhatsApp number of the shop (default ''). */
  whatsapp: string;
  /** Announcement banner text; empty = no banner (default ''). */
  announcement: string;
}

export type SettingKey = keyof Settings;
