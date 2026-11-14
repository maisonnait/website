/**
 * Drizzle schema (Postgres). The same schema is used with postgres.js and with PGlite.
 * Columns are snake_case in SQL and camelCase in TypeScript.
 *
 * After changing this file: `pnpm --filter @nait/db db:generate` (writes a new SQL migration in
 * ./drizzle and refreshes src/migrations.generated.ts). Migrations are applied by `getDb()`.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  customType,
  index,
  integer,
  pgSequence,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { Lang, MovementReason, OrderStatus, PaymentMethod, ScentTag, UserRole } from './types';

const id = () => uuid('id').primaryKey().defaultRandom();

const timestamps = () => ({
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

const instant = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

/**
 * jsonb column that hands the value to the driver as JSON text and takes what the driver returns
 * as is. (Drizzle's own `jsonb()` parses string results a second time, which turns the JSON
 * string "123" into the number 123.)
 */
const jsonValue = customType<{ data: unknown; driverData: unknown }>({
  dataType: () => 'jsonb',
  toDriver: (value) => JSON.stringify(value),
  fromDriver: (value) => value,
});

/** Source of the order numbers: NA-000001, NA-000002, ... */
export const orderNumberSeq = pgSequence('order_number_seq', { startWith: 1, increment: 1, minValue: 1 });

export const collections = pgTable(
  'collections',
  {
    id: id(),
    slug: text('slug').notNull(),
    position: integer('position').notNull().default(0),
    nameFr: text('name_fr').notNull(),
    nameEn: text('name_en').notNull(),
    nameAr: text('name_ar').notNull(),
    nameAry: text('name_ary').notNull(),
    nameZgh: text('name_zgh').notNull(),
    descriptionFr: text('description_fr').notNull().default(''),
    descriptionEn: text('description_en').notNull().default(''),
    descriptionAr: text('description_ar').notNull().default(''),
    descriptionAry: text('description_ary').notNull().default(''),
    descriptionZgh: text('description_zgh').notNull().default(''),
    ...timestamps(),
  },
  (t) => [uniqueIndex('collections_slug_key').on(t.slug)],
);

export const products = pgTable(
  'products',
  {
    id: id(),
    slug: text('slug').notNull(),
    collectionId: uuid('collection_id')
      .notNull()
      .references(() => collections.id),
    name: text('name').notNull(),
    hasSizes: boolean('has_sizes').notNull().default(true),
    active: boolean('active').notNull().default(true),
    position: integer('position').notNull().default(0),
    imageUrl: text('image_url'),
    ...timestamps(),
  },
  (t) => [uniqueIndex('products_slug_key').on(t.slug), index('products_collection_idx').on(t.collectionId, t.position)],
);

export const scents = pgTable(
  'scents',
  {
    id: id(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    nameLatin: text('name_latin').notNull(),
    nameAr: text('name_ar'),
    tag: text('tag').$type<ScentTag>(),
    position: integer('position').notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    index('scents_product_idx').on(t.productId, t.position),
    check('scents_tag_check', sql`${t.tag} is null or ${t.tag} in ('EXTRA', 'SUPER')`),
  ],
);

export const variants = pgTable(
  'variants',
  {
    id: id(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    scentId: uuid('scent_id')
      .notNull()
      .references(() => scents.id),
    sizeMl: integer('size_ml').notNull(),
    sku: text('sku').notNull(),
    priceMad: integer('price_mad').notNull(),
    stock: integer('stock').notNull().default(0),
    lowStockThreshold: integer('low_stock_threshold').notNull().default(5),
    active: boolean('active').notNull().default(true),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('variants_sku_key').on(t.sku),
    uniqueIndex('variants_scent_size_key').on(t.scentId, t.sizeMl),
    index('variants_product_idx').on(t.productId),
    check('variants_size_check', sql`${t.sizeMl} in (0, 50, 75, 100)`),
    check('variants_price_check', sql`${t.priceMad} >= 0`),
    // Last line of defence against overselling: the database itself refuses a negative stock.
    check('variants_stock_check', sql`${t.stock} >= 0`),
    check('variants_threshold_check', sql`${t.lowStockThreshold} >= 0`),
  ],
);

export const users = pgTable(
  'users',
  {
    id: id(),
    /** Always stored trimmed and lowercase. */
    email: text('email').notNull(),
    name: text('name').notNull(),
    role: text('role').$type<UserRole>().notNull().default('staff'),
    /** scrypt, see src/password.ts */
    passwordHash: text('password_hash').notNull(),
    active: boolean('active').notNull().default(true),
    ...timestamps(),
  },
  (t) => [uniqueIndex('users_email_key').on(t.email), check('users_role_check', sql`${t.role} in ('owner', 'staff')`)],
);

export const orders = pgTable(
  'orders',
  {
    id: id(),
    number: text('number').notNull(),
    status: text('status').$type<OrderStatus>().notNull().default('new'),
    customerName: text('customer_name').notNull(),
    phone: text('phone').notNull(),
    city: text('city').notNull(),
    address: text('address').notNull(),
    note: text('note'),
    lang: text('lang').$type<Lang>().notNull().default('fr'),
    subtotalMad: integer('subtotal_mad').notNull(),
    shippingMad: integer('shipping_mad').notNull().default(0),
    totalMad: integer('total_mad').notNull(),
    paymentMethod: text('payment_method').$type<PaymentMethod>().notNull().default('cod'),
    internalNote: text('internal_note'),
    confirmedAt: instant('confirmed_at'),
    shippedAt: instant('shipped_at'),
    deliveredAt: instant('delivered_at'),
    cancelledAt: instant('cancelled_at'),
    returnedAt: instant('returned_at'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('orders_number_key').on(t.number),
    index('orders_status_idx').on(t.status, t.createdAt),
    index('orders_created_idx').on(t.createdAt),
    index('orders_phone_idx').on(t.phone),
    check(
      'orders_status_check',
      sql`${t.status} in ('new', 'confirmed', 'shipped', 'delivered', 'cancelled', 'returned')`,
    ),
    check('orders_total_check', sql`${t.totalMad} = ${t.subtotalMad} + ${t.shippingMad}`),
  ],
);

export const orderItems = pgTable(
  'order_items',
  {
    id: id(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => variants.id),
    productName: text('product_name').notNull(),
    scentName: text('scent_name').notNull(),
    sizeMl: integer('size_ml').notNull(),
    unitPriceMad: integer('unit_price_mad').notNull(),
    quantity: integer('quantity').notNull(),
    ...timestamps(),
  },
  (t) => [
    index('order_items_order_idx').on(t.orderId),
    index('order_items_variant_idx').on(t.variantId),
    check('order_items_quantity_check', sql`${t.quantity} > 0`),
  ],
);

export const stockMovements = pgTable(
  'stock_movements',
  {
    id: id(),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => variants.id),
    delta: integer('delta').notNull(),
    reason: text('reason').$type<MovementReason>().notNull(),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    note: text('note'),
    /** Stock of the variant right after the movement. */
    stockAfter: integer('stock_after'),
    ...timestamps(),
  },
  (t) => [
    index('stock_movements_variant_idx').on(t.variantId, t.createdAt),
    index('stock_movements_order_idx').on(t.orderId),
    index('stock_movements_created_idx').on(t.createdAt),
    check(
      'stock_movements_reason_check',
      sql`${t.reason} in ('sale', 'cancel', 'return', 'restock', 'adjust', 'initial')`,
    ),
  ],
);

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonValue('value').notNull(),
  ...timestamps(),
});
