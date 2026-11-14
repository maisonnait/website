/**
 * Orders. The two rules that matter here:
 *
 * 1. Stock can never be oversold. Stock only leaves through
 *      UPDATE variants SET stock = stock - q WHERE id = ... AND stock >= q
 *    and the number of updated rows is checked. Postgres serialises concurrent updates of a row,
 *    so two customers competing for the last bottle cannot both succeed. (The table also has a
 *    CHECK (stock >= 0) as a second barrier.)
 *
 * 2. Stock is "held" by an order while its status is new, confirmed, shipped or delivered, and
 *    released while it is cancelled or returned. `setOrderStatus` moves stock only when a change
 *    of status crosses that line, under a row lock on the order: asking twice for a cancellation
 *    puts the stock back once.
 */
import { and, asc, desc, eq, gte, ilike, inArray, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { getDb } from '../client';
import type { Db } from '../client';
import { DomainError } from '../errors';
import { normalizePhone } from '../phone';
import { orderItems, orders, products, scents, stockMovements, variants } from '../schema';
import { DEFAULT_LANG, LANGS, ORDER_STATUSES } from '../types';
import type {
  Lang,
  ListOrdersOptions,
  Order,
  OrderDetail,
  OrderListItem,
  OrderStatus,
  OrderSummary,
  PlaceOrderInput,
  PlacedOrder,
} from '../types';
import {
  escapeLike,
  isUuid,
  optionalText,
  optionalUuid,
  requireInt,
  requireText,
  rowsOf,
} from '../util';
import { readSettings } from './settings';

const MAX_LINES = 50;
const MAX_QUANTITY = 99;

/** true while an order in this status keeps its bottles out of the stock. */
const HOLDS_STOCK: Record<OrderStatus, boolean> = {
  new: true,
  confirmed: true,
  shipped: true,
  delivered: true,
  cancelled: false,
  returned: false,
};

interface Shortage {
  variantId: string;
  requested: number;
  available: number;
}

function outOfStock(shortages: Shortage[]): DomainError {
  const first = shortages[0] ?? { variantId: '', requested: 0, available: 0 };
  return new DomainError('OUT_OF_STOCK', 'not enough stock for this order', { ...first, items: shortages });
}

/**
 * Takes `quantity` units out of the stock of each variant, or reports what is missing.
 * Variants are processed in id order so that concurrent orders lock rows in the same order.
 */
async function takeStock(
  tx: Db,
  quantities: Map<string, number>,
  onlyActive: boolean,
): Promise<{ after: Map<string, number>; shortages: Shortage[] }> {
  const after = new Map<string, number>();
  const shortages: Shortage[] = [];
  for (const variantId of [...quantities.keys()].sort()) {
    const quantity = quantities.get(variantId) ?? 0;
    const [updated] = await tx
      .update(variants)
      .set({ stock: sql`${variants.stock} - ${quantity}` })
      .where(
        and(
          eq(variants.id, variantId),
          gte(variants.stock, quantity),
          onlyActive ? eq(variants.active, true) : undefined,
        ),
      )
      .returning({ stock: variants.stock });
    if (updated) {
      after.set(variantId, updated.stock);
      continue;
    }
    const [current] = await tx
      .select({ stock: variants.stock, active: variants.active })
      .from(variants)
      .where(eq(variants.id, variantId));
    const available = current && (current.active || !onlyActive) ? current.stock : 0;
    shortages.push({ variantId, requested: quantity, available });
  }
  return { after, shortages };
}

function toLang(value: unknown): Lang {
  return (LANGS as readonly string[]).includes(value as string) ? (value as Lang) : DEFAULT_LANG;
}

function mergeItems(items: PlaceOrderInput['items']): Map<string, number> {
  const quantities = new Map<string, number>();
  for (const item of items) {
    if (!item || typeof item !== 'object' || !isUuid(item.variantId)) {
      throw new DomainError('INVALID_INPUT', 'an item of the cart has no valid variantId', { field: 'items' });
    }
    if (typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new DomainError('INVALID_INPUT', 'the quantity of an item must be a whole number of at least 1', {
        field: 'items',
        variantId: item.variantId,
      });
    }
    const variantId = item.variantId.toLowerCase();
    const quantity = (quantities.get(variantId) ?? 0) + item.quantity;
    if (quantity > MAX_QUANTITY) {
      throw new DomainError('INVALID_INPUT', `the quantity of an item cannot exceed ${MAX_QUANTITY}`, {
        field: 'items',
        variantId,
      });
    }
    quantities.set(variantId, quantity);
  }
  if (quantities.size > MAX_LINES) {
    throw new DomainError('INVALID_INPUT', `an order cannot have more than ${MAX_LINES} different items`, {
      field: 'items',
    });
  }
  return quantities;
}

/**
 * Places a cash-on-delivery order. Everything happens in one transaction: either the order,
 * its items and the 'sale' movements are all written and the stock is reduced, or nothing changes.
 *
 * Throws DomainError: EMPTY_CART, INVALID_PHONE, INVALID_INPUT (details.field), OUT_OF_STOCK
 * (details.variantId / requested / available for the first missing item, details.items for all).
 */
export async function placeOrder(input: PlaceOrderInput): Promise<PlacedOrder> {
  if (!input || typeof input !== 'object') {
    throw new DomainError('INVALID_INPUT', 'order data is required', { field: 'input' });
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new DomainError('EMPTY_CART', 'the cart is empty', { field: 'items' });
  }
  const phone = normalizePhone(input.phone);
  if (!phone) {
    throw new DomainError('INVALID_PHONE', 'the phone number must be Moroccan: 0[5-7]XXXXXXXX or +212[5-7]XXXXXXXX', {
      field: 'phone',
    });
  }
  const customerName = requireText(input.customerName, 'customerName', 120);
  const city = requireText(input.city, 'city', 80);
  const address = requireText(input.address, 'address', 300);
  const note = optionalText(input.note, 'note', 1000);
  const lang = toLang(input.lang);
  const quantities = mergeItems(input.items);

  const db = await getDb();
  const { shippingMad } = await readSettings(db);

  return db.transaction(async (tx) => {
    const variantIds = [...quantities.keys()];
    const infoRows = await tx
      .select({
        id: variants.id,
        active: variants.active,
        productActive: products.active,
        priceMad: variants.priceMad,
        sizeMl: variants.sizeMl,
        stock: variants.stock,
        productName: products.name,
        scentName: scents.nameLatin,
        scentTag: scents.tag,
      })
      .from(variants)
      .innerJoin(scents, eq(variants.scentId, scents.id))
      .innerJoin(products, eq(variants.productId, products.id))
      .where(inArray(variants.id, variantIds));
    const info = new Map(infoRows.map((row) => [row.id, row]));

    // Unknown or hidden items cannot be bought: reported like an empty shelf.
    const unavailable: Shortage[] = [];
    for (const [variantId, requested] of quantities) {
      const variant = info.get(variantId);
      if (!variant || !variant.active || !variant.productActive) {
        unavailable.push({ variantId, requested, available: 0 });
      }
    }
    if (unavailable.length > 0) throw outOfStock(unavailable);

    const { after, shortages } = await takeStock(tx, quantities, true);
    if (shortages.length > 0) throw outOfStock(shortages); // rolls everything back

    const lines = variantIds.map((variantId) => {
      const variant = info.get(variantId);
      if (!variant) throw new Error('@nait/db: variant vanished during the order');
      return {
        variantId,
        quantity: quantities.get(variantId) ?? 0,
        productName: variant.productName,
        scentName: variant.scentTag ? `${variant.scentName} ${variant.scentTag}` : variant.scentName,
        sizeMl: variant.sizeMl,
        unitPriceMad: variant.priceMad,
      };
    });
    lines.sort(
      (a, b) =>
        a.productName.localeCompare(b.productName) || a.scentName.localeCompare(b.scentName) || a.sizeMl - b.sizeMl,
    );
    const subtotal = lines.reduce((sum, line) => sum + line.unitPriceMad * line.quantity, 0);
    const total = subtotal + shippingMad;

    // The number is taken last, once the stock is secured, so that refused orders leave no gap.
    const [sequence] = rowsOf<{ n: string }>(await tx.execute(sql`select nextval('order_number_seq')::text as n`));
    if (!sequence) throw new Error('@nait/db: could not get an order number');
    const number = `NA-${String(sequence.n).padStart(6, '0')}`;

    const [order] = await tx
      .insert(orders)
      .values({
        number,
        status: 'new',
        customerName,
        phone,
        city,
        address,
        note,
        lang,
        subtotalMad: subtotal,
        shippingMad,
        totalMad: total,
        paymentMethod: 'cod',
      })
      .returning({ id: orders.id });
    if (!order) throw new Error('@nait/db: the order was not created');

    await tx.insert(orderItems).values(lines.map((line) => ({ orderId: order.id, ...line })));
    await tx.insert(stockMovements).values(
      lines.map((line) => ({
        variantId: line.variantId,
        delta: -line.quantity,
        reason: 'sale' as const,
        orderId: order.id,
        stockAfter: after.get(line.variantId) ?? null,
      })),
    );

    return { id: order.id, number, subtotal, shipping: shippingMad, total };
  });
}

/** 'na-123', 'NA 000123', '123' -> 'NA-000123'. null when it cannot be an order number. */
function normalizeOrderNumber(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^(?:NA)?[\s-]*(\d{1,12})$/i.exec(value.trim());
  if (!match?.[1]) return null;
  const digits = match[1].replace(/^0+(?=\d)/, '');
  return `NA-${digits.padStart(6, '0')}`;
}

/** Accepts the uuid of an order or its number. */
function orderFilter(idOrNumber: unknown): SQL | null {
  if (isUuid(idOrNumber)) return eq(orders.id, idOrNumber.toLowerCase());
  const number = normalizeOrderNumber(idOrNumber);
  return number ? eq(orders.number, number) : null;
}

async function loadItems(db: Db, orderId: string) {
  return db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))
    .orderBy(asc(orderItems.productName), asc(orderItems.scentName), asc(orderItems.sizeMl), asc(orderItems.id));
}

async function loadOrderDetail(db: Db, where: SQL): Promise<OrderDetail | null> {
  const [order] = await db.select().from(orders).where(where).limit(1);
  if (!order) return null;
  return { ...order, items: await loadItems(db, order.id) };
}

/**
 * Tracking page: the order is returned only when the number AND the phone match.
 * The result has no address, phone or internal note.
 */
export async function getOrderForCustomer(number: string, phone: string): Promise<OrderSummary | null> {
  const orderNumber = normalizeOrderNumber(number);
  const normalizedPhone = normalizePhone(phone);
  if (!orderNumber || !normalizedPhone) return null;
  const db = await getDb();
  const order = await loadOrderDetail(db, and(eq(orders.number, orderNumber), eq(orders.phone, normalizedPhone)) as SQL);
  if (!order) return null;
  return {
    number: order.number,
    status: order.status,
    customerName: order.customerName,
    city: order.city,
    lang: order.lang,
    subtotalMad: order.subtotalMad,
    shippingMad: order.shippingMad,
    totalMad: order.totalMad,
    paymentMethod: order.paymentMethod,
    createdAt: order.createdAt,
    confirmedAt: order.confirmedAt,
    shippedAt: order.shippedAt,
    deliveredAt: order.deliveredAt,
    cancelledAt: order.cancelledAt,
    returnedAt: order.returnedAt,
    items: order.items.map((item) => ({
      productName: item.productName,
      scentName: item.scentName,
      sizeMl: item.sizeMl,
      unitPriceMad: item.unitPriceMad,
      quantity: item.quantity,
    })),
  };
}

function orderFilters(opts: Pick<ListOrdersOptions, 'status' | 'q'>): SQL | undefined {
  const filters: (SQL | undefined)[] = [];
  if (opts.status !== undefined && opts.status !== null) {
    const statuses = (Array.isArray(opts.status) ? opts.status : [opts.status]).filter((s) => (s as string) !== '');
    for (const status of statuses) {
      if (!ORDER_STATUSES.includes(status)) {
        throw new DomainError('INVALID_INPUT', `unknown status "${String(status)}"`, { field: 'status' });
      }
    }
    if (statuses.length > 0) filters.push(inArray(orders.status, statuses));
  }
  if (typeof opts.q === 'string' && opts.q.trim() !== '') {
    const q = opts.q.trim();
    const pattern = `%${escapeLike(q)}%`;
    const alternatives: (SQL | undefined)[] = [
      ilike(orders.number, pattern),
      ilike(orders.customerName, pattern),
      ilike(orders.city, pattern),
      ilike(orders.phone, pattern),
    ];
    // Phones are stored as +212XXXXXXXXX: let "06 12 34..." find them too.
    const digits = q.replace(/[\s.\-()]/g, '');
    if (/^0\d{1,9}$/.test(digits)) alternatives.push(ilike(orders.phone, `+212${digits.slice(1)}%`));
    // "123" finds NA-000123.
    const number = normalizeOrderNumber(q);
    if (number) alternatives.push(eq(orders.number, number));
    filters.push(or(...alternatives));
  }
  return and(...filters);
}

/** Orders, newest first. `status` can be one status or a list; `q` searches number, name, phone and city. */
export async function listOrders(opts: ListOrdersOptions = {}): Promise<OrderListItem[]> {
  const where = orderFilters(opts);
  const limit = opts.limit === undefined ? 50 : requireInt(opts.limit, 'limit', 1, 500);
  const offset = opts.offset === undefined ? 0 : requireInt(opts.offset, 'offset', 0, 10_000_000);
  const db = await getDb();
  const rows: Order[] = await db
    .select()
    .from(orders)
    .where(where)
    .orderBy(desc(orders.createdAt), desc(orders.number))
    .limit(limit)
    .offset(offset);
  if (rows.length === 0) return [];
  const counts = await db
    .select({
      orderId: orderItems.orderId,
      lineCount: sql<number>`count(*)::int`,
      itemCount: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int`,
    })
    .from(orderItems)
    .where(
      inArray(
        orderItems.orderId,
        rows.map((row) => row.id),
      ),
    )
    .groupBy(orderItems.orderId);
  const countById = new Map(counts.map((count) => [count.orderId, count]));
  return rows.map((row) => ({
    ...row,
    lineCount: Number(countById.get(row.id)?.lineCount ?? 0),
    itemCount: Number(countById.get(row.id)?.itemCount ?? 0),
  }));
}

/** Number of orders matching the same `status` / `q` filters as `listOrders` (for pagination). */
export async function countOrders(opts: Pick<ListOrdersOptions, 'status' | 'q'> = {}): Promise<number> {
  const where = orderFilters(opts);
  const db = await getDb();
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(orders).where(where);
  return Number(row?.count ?? 0);
}

/** One order with its items. `id` is the uuid of the order or its number ('NA-000123'). */
export async function getOrder(id: string): Promise<OrderDetail | null> {
  const where = orderFilter(id);
  if (!where) return null;
  return loadOrderDetail(await getDb(), where);
}

const PIPELINE_RANK = { new: 0, confirmed: 1, shipped: 2, delivered: 3 } as const;

function statusTimestamps(order: Order, status: OrderStatus, now: Date) {
  if (status === 'cancelled') return { cancelledAt: now, returnedAt: null };
  if (status === 'returned') return { returnedAt: now, cancelledAt: null };
  const rank = PIPELINE_RANK[status];
  return {
    confirmedAt: rank >= 1 ? (order.confirmedAt ?? now) : null,
    shippedAt: rank >= 2 ? (order.shippedAt ?? now) : null,
    deliveredAt: rank >= 3 ? (order.deliveredAt ?? now) : null,
    cancelledAt: null,
    returnedAt: null,
  };
}

/**
 * Changes the status of an order (`id`: uuid or number) and returns the order.
 *
 * - To 'cancelled' or 'returned': the bottles go back into stock, once ('cancel' / 'return'
 *   movements). Asking again, or switching between cancelled and returned, moves nothing.
 * - From 'cancelled' / 'returned' back to an open status: the bottles are taken again ('sale'
 *   movements); throws OUT_OF_STOCK if they are no longer available.
 * - Setting the status an order already has does nothing.
 */
export async function setOrderStatus(id: string, status: OrderStatus, userId?: string | null): Promise<OrderDetail> {
  if (!ORDER_STATUSES.includes(status)) {
    throw new DomainError('INVALID_INPUT', `unknown status "${String(status)}"`, { field: 'status' });
  }
  const actor = optionalUuid(userId, 'userId');
  const where = orderFilter(id);
  if (!where) throw new DomainError('NOT_FOUND', 'order not found', { field: 'id' });

  const db = await getDb();
  const orderId = await db.transaction(async (tx) => {
    // Row lock: two simultaneous changes of the same order run one after the other.
    const [order] = await tx.select().from(orders).where(where).for('update');
    if (!order) throw new DomainError('NOT_FOUND', 'order not found', { field: 'id' });
    if (order.status === status) return order.id;

    const held = HOLDS_STOCK[order.status];
    const willHold = HOLDS_STOCK[status];
    if (held !== willHold) {
      const items = await tx
        .select({ variantId: orderItems.variantId, quantity: orderItems.quantity })
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id));
      const quantities = new Map<string, number>();
      for (const item of items) quantities.set(item.variantId, (quantities.get(item.variantId) ?? 0) + item.quantity);

      if (willHold) {
        // Reopened order: its bottles leave the stock again, if they are still there.
        const { after, shortages } = await takeStock(tx, quantities, false);
        if (shortages.length > 0) throw outOfStock(shortages);
        if (quantities.size > 0) {
          await tx.insert(stockMovements).values(
            [...quantities].map(([variantId, quantity]) => ({
              variantId,
              delta: -quantity,
              reason: 'sale' as const,
              orderId: order.id,
              userId: actor,
              stockAfter: after.get(variantId) ?? null,
            })),
          );
        }
      } else {
        const reason = status === 'returned' ? ('return' as const) : ('cancel' as const);
        const movements: (typeof stockMovements.$inferInsert)[] = [];
        for (const variantId of [...quantities.keys()].sort()) {
          const quantity = quantities.get(variantId) ?? 0;
          const [updated] = await tx
            .update(variants)
            .set({ stock: sql`${variants.stock} + ${quantity}` })
            .where(eq(variants.id, variantId))
            .returning({ stock: variants.stock });
          movements.push({
            variantId,
            delta: quantity,
            reason,
            orderId: order.id,
            userId: actor,
            stockAfter: updated?.stock ?? null,
          });
        }
        if (movements.length > 0) await tx.insert(stockMovements).values(movements);
      }
    }

    await tx
      .update(orders)
      .set({ status, ...statusTimestamps(order, status, new Date()) })
      .where(eq(orders.id, order.id));
    return order.id;
  });

  const detail = await loadOrderDetail(db, eq(orders.id, orderId));
  if (!detail) throw new DomainError('NOT_FOUND', 'order not found', { field: 'id' });
  return detail;
}

/** Sets the internal note of an order (never shown to the customer). Empty text removes it. */
export async function updateOrderNote(id: string, note: string | null): Promise<OrderDetail> {
  const where = orderFilter(id);
  if (!where) throw new DomainError('NOT_FOUND', 'order not found', { field: 'id' });
  const internalNote = optionalText(note, 'note', 2000);
  const db = await getDb();
  const [updated] = await db.update(orders).set({ internalNote }).where(where).returning({ id: orders.id });
  if (!updated) throw new DomainError('NOT_FOUND', 'order not found', { field: 'id' });
  const detail = await loadOrderDetail(db, eq(orders.id, updated.id));
  if (!detail) throw new DomainError('NOT_FOUND', 'order not found', { field: 'id' });
  return detail;
}
