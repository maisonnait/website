/** Stock: variants as seen by the back office, manual adjustments and the movement journal. */
import { and, asc, desc, eq, ilike, lte, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { getDb } from '../client';
import type { Db } from '../client';
import { DomainError } from '../errors';
import { collections, orders, products, scents, stockMovements, users, variants } from '../schema';
import { MANUAL_STOCK_REASONS } from '../types';
import type {
  ListMovementsOptions,
  ListVariantsOptions,
  ManualStockReason,
  MovementRow,
  SetVariantInput,
  VariantRow,
} from '../types';
import { MAX_PRICE_MAD, escapeLike, optionalText, optionalUuid, requireInt, requireUuid } from '../util';

const MAX_ADJUSTMENT = 1_000_000;

const variantRowFields = {
  variant: variants,
  productName: products.name,
  productSlug: products.slug,
  productActive: products.active,
  imageUrl: products.imageUrl,
  collectionSlug: collections.slug,
  scentName: scents.nameLatin,
  scentNameAr: scents.nameAr,
  scentTag: scents.tag,
};

type VariantRowRecord = {
  variant: typeof variants.$inferSelect;
  productName: string;
  productSlug: string;
  productActive: boolean;
  imageUrl: string | null;
  collectionSlug: string;
  scentName: string;
  scentNameAr: string | null;
  scentTag: VariantRow['scentTag'];
};

function toVariantRow(row: VariantRowRecord): VariantRow {
  return {
    ...row.variant,
    productName: row.productName,
    productSlug: row.productSlug,
    productActive: row.productActive,
    collectionSlug: row.collectionSlug,
    imageUrl: row.imageUrl,
    scentName: row.scentName,
    scentNameAr: row.scentNameAr,
    scentTag: row.scentTag,
    low: row.variant.stock <= row.variant.lowStockThreshold,
  };
}

function selectVariantRows(db: Db) {
  return db
    .select(variantRowFields)
    .from(variants)
    .innerJoin(scents, eq(variants.scentId, scents.id))
    .innerJoin(products, eq(variants.productId, products.id))
    .innerJoin(collections, eq(products.collectionId, collections.id));
}

const catalogueOrder = [
  asc(collections.position),
  asc(products.position),
  asc(products.name),
  asc(scents.position),
  asc(variants.sizeMl),
  asc(variants.sku),
];

/** One variant with its labels, by id. */
export async function loadVariantRow(db: Db, variantId: string): Promise<VariantRow | null> {
  const [row] = await selectVariantRows(db).where(eq(variants.id, variantId)).limit(1);
  return row ? toVariantRow(row) : null;
}

/**
 * Variants with their product and scent names, in catalogue order.
 * `lowOnly`: stock <= threshold, among the variants that are on sale (active variant of an active product).
 */
export async function listVariants(opts: ListVariantsOptions = {}): Promise<VariantRow[]> {
  const filters: (SQL | undefined)[] = [];
  if (typeof opts.q === 'string' && opts.q.trim() !== '') {
    const pattern = `%${escapeLike(opts.q.trim())}%`;
    filters.push(
      or(
        ilike(variants.sku, pattern),
        ilike(products.name, pattern),
        ilike(scents.nameLatin, pattern),
        ilike(scents.nameAr, pattern),
      ),
    );
  }
  if (opts.lowOnly === true) {
    filters.push(lte(variants.stock, variants.lowStockThreshold), eq(variants.active, true), eq(products.active, true));
  }
  if (opts.productId !== undefined && opts.productId !== null && opts.productId !== '') {
    filters.push(eq(variants.productId, requireUuid(opts.productId, 'productId')));
  }
  const db = await getDb();
  const rows = await selectVariantRows(db)
    .where(and(...filters))
    .orderBy(...catalogueOrder);
  return rows.map(toVariantRow);
}

/** Variants on sale whose stock is at or under their threshold, emptiest first. */
export async function loadLowStock(db: Db): Promise<VariantRow[]> {
  const rows = await selectVariantRows(db)
    .where(and(lte(variants.stock, variants.lowStockThreshold), eq(variants.active, true), eq(products.active, true)))
    .orderBy(asc(variants.stock), ...catalogueOrder);
  return rows.map(toVariantRow);
}

/**
 * Adds `delta` units to the stock of a variant (negative to remove) and writes the movement.
 * Refuses to bring the stock below zero (NEGATIVE_STOCK): the stock is left untouched.
 * `reason`: 'restock' (delta > 0), 'adjust', 'return' or 'initial'.
 */
export async function adjustStock(
  variantId: string,
  delta: number,
  reason: ManualStockReason,
  userId?: string | null,
  note?: string | null,
): Promise<VariantRow> {
  const id = requireUuid(variantId, 'variantId');
  if (typeof delta !== 'number' || !Number.isInteger(delta) || delta === 0 || Math.abs(delta) > MAX_ADJUSTMENT) {
    throw new DomainError('INVALID_INPUT', 'delta must be a whole number other than 0', { field: 'delta' });
  }
  if (!(MANUAL_STOCK_REASONS as readonly string[]).includes(reason)) {
    throw new DomainError('INVALID_INPUT', `reason must be one of: ${MANUAL_STOCK_REASONS.join(', ')}`, {
      field: 'reason',
    });
  }
  if (reason === 'restock' && delta < 0) {
    throw new DomainError('INVALID_INPUT', "a 'restock' adds stock: delta must be positive", { field: 'delta' });
  }
  const actor = optionalUuid(userId, 'userId');
  const cleanNote = optionalText(note, 'note', 500);

  const db = await getDb();
  await db.transaction(async (tx) => {
    // One statement decides: the row is only changed if the result stays >= 0.
    const [updated] = await tx
      .update(variants)
      .set({ stock: sql`${variants.stock} + ${delta}` })
      .where(and(eq(variants.id, id), sql`${variants.stock} + ${delta} >= 0`))
      .returning({ stock: variants.stock });
    if (!updated) {
      const [current] = await tx.select({ stock: variants.stock }).from(variants).where(eq(variants.id, id));
      if (!current) throw new DomainError('NOT_FOUND', 'variant not found', { field: 'variantId' });
      throw new DomainError(
        'NEGATIVE_STOCK',
        `cannot remove ${-delta} unit(s): only ${current.stock} in stock`,
        { variantId: id, available: current.stock, requested: -delta },
      );
    }
    await tx.insert(stockMovements).values({
      variantId: id,
      delta,
      reason,
      userId: actor,
      note: cleanNote,
      stockAfter: updated.stock,
    });
  });
  const row = await loadVariantRow(db, id);
  if (!row) throw new DomainError('NOT_FOUND', 'variant not found', { field: 'variantId' });
  return row;
}

/** Changes the price, the low-stock threshold or the active flag of a variant. */
export async function setVariant(id: string, input: SetVariantInput): Promise<VariantRow> {
  const variantId = requireUuid(id, 'id');
  if (!input || typeof input !== 'object') {
    throw new DomainError('INVALID_INPUT', 'nothing to change', { field: 'input' });
  }
  const patch: { priceMad?: number; lowStockThreshold?: number; active?: boolean } = {};
  if (input.priceMad !== undefined) patch.priceMad = requireInt(input.priceMad, 'priceMad', 0, MAX_PRICE_MAD);
  if (input.lowStockThreshold !== undefined) {
    patch.lowStockThreshold = requireInt(input.lowStockThreshold, 'lowStockThreshold', 0, 1_000_000);
  }
  if (input.active !== undefined) {
    if (typeof input.active !== 'boolean') {
      throw new DomainError('INVALID_INPUT', 'active must be true or false', { field: 'active' });
    }
    patch.active = input.active;
  }
  const db = await getDb();
  if (Object.keys(patch).length > 0) {
    const updated = await db.update(variants).set(patch).where(eq(variants.id, variantId)).returning({ id: variants.id });
    if (updated.length === 0) throw new DomainError('NOT_FOUND', 'variant not found', { field: 'id' });
  }
  const row = await loadVariantRow(db, variantId);
  if (!row) throw new DomainError('NOT_FOUND', 'variant not found', { field: 'id' });
  return row;
}

/** The stock journal, newest first. */
export async function listMovements(opts: ListMovementsOptions = {}): Promise<MovementRow[]> {
  const filters: (SQL | undefined)[] = [];
  if (opts.variantId !== undefined && opts.variantId !== null && opts.variantId !== '') {
    filters.push(eq(stockMovements.variantId, requireUuid(opts.variantId, 'variantId')));
  }
  if (opts.orderId !== undefined && opts.orderId !== null && opts.orderId !== '') {
    filters.push(eq(stockMovements.orderId, requireUuid(opts.orderId, 'orderId')));
  }
  const limit = opts.limit === undefined ? 100 : requireInt(opts.limit, 'limit', 1, 1000);
  const offset = opts.offset === undefined ? 0 : requireInt(opts.offset, 'offset', 0, 10_000_000);

  const db = await getDb();
  const rows = await db
    .select({
      movement: stockMovements,
      sku: variants.sku,
      sizeMl: variants.sizeMl,
      productName: products.name,
      scentName: scents.nameLatin,
      orderNumber: orders.number,
      userName: users.name,
    })
    .from(stockMovements)
    .innerJoin(variants, eq(stockMovements.variantId, variants.id))
    .innerJoin(scents, eq(variants.scentId, scents.id))
    .innerJoin(products, eq(variants.productId, products.id))
    .leftJoin(orders, eq(stockMovements.orderId, orders.id))
    .leftJoin(users, eq(stockMovements.userId, users.id))
    .where(and(...filters))
    .orderBy(desc(stockMovements.createdAt), desc(stockMovements.id))
    .limit(limit)
    .offset(offset);
  return rows.map((row) => ({
    ...row.movement,
    sku: row.sku,
    productName: row.productName,
    scentName: row.scentName,
    sizeMl: row.sizeMl,
    orderNumber: row.orderNumber,
    userName: row.userName,
  }));
}
