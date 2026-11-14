/** Catalogue: collections, products, scents and the product editor of the back office. */
import { and, asc, eq, like, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { getDb } from '../client';
import type { Db } from '../client';
import { DomainError } from '../errors';
import { collections, products, scents, stockMovements, variants } from '../schema';
import { skuFor } from '../seed';
import { DEFAULT_PRICE_MAD, SCENT_TAGS, SIZES_ML } from '../types';
import type {
  Collection,
  GetProductOptions,
  ListProductsOptions,
  Product,
  ProductCard,
  ProductDetail,
  ScentTag,
  UpsertProductInput,
  UpsertScentInput,
} from '../types';
import {
  MAX_PRICE_MAD,
  UNIQUE_VIOLATION,
  escapeLike,
  optionalUuid,
  requireInt,
  requireText,
  requireUuid,
  sqlState,
} from '../util';

type CollectionRow = typeof collections.$inferSelect;

function toCollection(row: CollectionRow, productCount: number): Collection {
  return {
    ...row,
    name: { fr: row.nameFr, en: row.nameEn, ar: row.nameAr, ary: row.nameAry, zgh: row.nameZgh },
    description: {
      fr: row.descriptionFr,
      en: row.descriptionEn,
      ar: row.descriptionAr,
      ary: row.descriptionAry,
      zgh: row.descriptionZgh,
    },
    productCount,
  };
}

/** Number of active products per collection id. */
async function activeProductCounts(db: Db): Promise<Map<string, number>> {
  const rows = await db
    .select({ collectionId: products.collectionId, count: sql<number>`count(*)::int` })
    .from(products)
    .where(eq(products.active, true))
    .groupBy(products.collectionId);
  return new Map(rows.map((row) => [row.collectionId, Number(row.count)]));
}

/** The four collections in display order, with their texts in the five languages. */
export async function listCollections(): Promise<Collection[]> {
  const db = await getDb();
  const rows = await db.select().from(collections).orderBy(asc(collections.position), asc(collections.slug));
  const counts = await activeProductCounts(db);
  return rows.map((row) => toCollection(row, counts.get(row.id) ?? 0));
}

interface Stats {
  scentCount: number;
  variantCount: number;
  minPrice: number;
  inStock: boolean;
  totalStock: number;
}

const NO_STATS: Stats = { scentCount: 0, variantCount: 0, minPrice: 0, inStock: false, totalStock: 0 };

function statsOf(list: { scentId: string; priceMad: number; stock: number; active: boolean }[]): Stats {
  const active = list.filter((variant) => variant.active);
  if (active.length === 0) return NO_STATS;
  const totalStock = active.reduce((sum, variant) => sum + variant.stock, 0);
  return {
    scentCount: new Set(active.map((variant) => variant.scentId)).size,
    variantCount: active.length,
    minPrice: Math.min(...active.map((variant) => variant.priceMad)),
    inStock: totalStock > 0,
    totalStock,
  };
}

/**
 * Products in display order (collection, then position).
 * `activeOnly` defaults to false: the shop must pass `{ activeOnly: true }`.
 */
export async function listProducts(opts: ListProductsOptions = {}): Promise<ProductCard[]> {
  const db = await getDb();
  const filters: SQL[] = [];
  if (opts.activeOnly === true) filters.push(eq(products.active, true));
  if (typeof opts.collectionSlug === 'string' && opts.collectionSlug.trim() !== '') {
    filters.push(eq(collections.slug, opts.collectionSlug.trim().toLowerCase()));
  }
  const rows = await db
    .select({ product: products, collectionSlug: collections.slug })
    .from(products)
    .innerJoin(collections, eq(products.collectionId, collections.id))
    .where(and(...filters))
    .orderBy(asc(collections.position), asc(products.position), asc(products.name), asc(products.slug));
  if (rows.length === 0) return [];

  const statRows = await db
    .select({
      productId: variants.productId,
      scentCount: sql<number>`count(distinct ${variants.scentId})::int`,
      variantCount: sql<number>`count(*)::int`,
      minPrice: sql<number>`coalesce(min(${variants.priceMad}), 0)::int`,
      totalStock: sql<number>`coalesce(sum(${variants.stock}), 0)::int`,
    })
    .from(variants)
    .where(eq(variants.active, true))
    .groupBy(variants.productId);
  const stats = new Map<string, Stats>(
    statRows.map((row) => [
      row.productId,
      {
        scentCount: Number(row.scentCount),
        variantCount: Number(row.variantCount),
        minPrice: Number(row.minPrice),
        totalStock: Number(row.totalStock),
        inStock: Number(row.totalStock) > 0,
      },
    ]),
  );

  return rows.map((row) => ({
    ...row.product,
    collectionSlug: row.collectionSlug,
    ...(stats.get(row.product.id) ?? NO_STATS),
  }));
}

async function loadProductDetail(db: Db, where: SQL, activeOnly: boolean): Promise<ProductDetail | null> {
  const [row] = await db
    .select({ product: products, collection: collections })
    .from(products)
    .innerJoin(collections, eq(products.collectionId, collections.id))
    .where(where)
    .limit(1);
  if (!row) return null;
  if (activeOnly && !row.product.active) return null;

  const variantRows = await db
    .select({ variant: variants })
    .from(variants)
    .innerJoin(scents, eq(variants.scentId, scents.id))
    .where(and(eq(variants.productId, row.product.id), activeOnly ? eq(variants.active, true) : undefined))
    .orderBy(asc(scents.position), asc(scents.nameLatin), asc(variants.sizeMl), asc(variants.sku));
  const variantList = variantRows.map((r) => r.variant);

  let scentList = await db
    .select()
    .from(scents)
    .where(eq(scents.productId, row.product.id))
    .orderBy(asc(scents.position), asc(scents.nameLatin), asc(scents.id));
  if (activeOnly) {
    const sold = new Set(variantList.map((variant) => variant.scentId));
    scentList = scentList.filter((scent) => sold.has(scent.id));
  }

  const counts = await activeProductCounts(db);
  return {
    ...row.product,
    collectionSlug: row.collection.slug,
    ...statsOf(variantList),
    collection: toCollection(row.collection, counts.get(row.collection.id) ?? 0),
    scents: scentList,
    variants: variantList,
  };
}

/**
 * One product with its collection, scents and variants (each variant carries its stock).
 * `activeOnly` defaults to false: the shop should pass `{ activeOnly: true }`.
 */
export async function getProduct(slug: string, opts: GetProductOptions = {}): Promise<ProductDetail | null> {
  if (typeof slug !== 'string' || slug.trim() === '') return null;
  const db = await getDb();
  return loadProductDetail(db, eq(products.slug, slug.trim().toLowerCase()), opts.activeOnly === true);
}

// ---------------------------------------------------------------------------
// Back office
// ---------------------------------------------------------------------------

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

function requireSlug(value: unknown): string {
  const slug = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (slug.length === 0 || slug.length > 80 || !SLUG.test(slug)) {
    throw new DomainError('INVALID_INPUT', 'slug must be made of lowercase letters, digits and dashes', {
      field: 'slug',
    });
  }
  return slug;
}

function imageUrlOf(value: unknown): string | null {
  if (value === null) return null;
  const url = typeof value === 'string' ? value.trim() : '';
  if (url === '') return null;
  const isData = /^data:image\/[a-z0-9.+-]+;base64,/i.test(url);
  const isLink = /^https?:\/\/\S+$/i.test(url) || /^\/\S*$/.test(url);
  if ((!isData && !isLink) || url.length > (isData ? 500_000 : 2_048)) {
    throw new DomainError('INVALID_INPUT', 'imageUrl must be an http(s) URL or a path starting with /', {
      field: 'imageUrl',
    });
  }
  return url;
}

interface CleanScent {
  id: string | null;
  nameLatin: string;
  nameAr: string | null | undefined;
  tag: ScentTag | null | undefined;
  position: number | undefined;
}

function cleanScent(input: UpsertScentInput, index: number): CleanScent {
  const field = `scents[${index}]`;
  if (!input || typeof input !== 'object') throw new DomainError('INVALID_INPUT', `${field} is invalid`, { field });
  let tag: ScentTag | null | undefined;
  if (input.tag === undefined) tag = undefined;
  else if (input.tag === null || (input.tag as string) === '') tag = null;
  else if ((SCENT_TAGS as readonly string[]).includes(input.tag)) tag = input.tag;
  else throw new DomainError('INVALID_INPUT', `${field}.tag must be EXTRA, SUPER or empty`, { field: `${field}.tag` });
  let nameAr: string | null | undefined;
  if (input.nameAr === undefined) nameAr = undefined;
  else if (input.nameAr === null || input.nameAr.trim() === '') nameAr = null;
  else nameAr = requireText(input.nameAr, `${field}.nameAr`, 120);
  return {
    id: input.id === undefined || input.id === null || input.id === '' ? null : requireUuid(input.id, `${field}.id`),
    nameLatin: requireText(input.nameLatin, `${field}.nameLatin`, 120),
    nameAr,
    tag,
    position: input.position === undefined ? undefined : requireInt(input.position, `${field}.position`, 0, 100_000),
  };
}

async function resolveCollectionId(tx: Db, input: UpsertProductInput): Promise<string | null> {
  if (input.collectionId !== undefined && input.collectionId !== null && input.collectionId !== '') {
    const id = requireUuid(input.collectionId, 'collectionId');
    const [found] = await tx.select({ id: collections.id }).from(collections).where(eq(collections.id, id));
    if (!found) throw new DomainError('NOT_FOUND', 'collection not found', { field: 'collectionId' });
    return found.id;
  }
  if (typeof input.collectionSlug === 'string' && input.collectionSlug.trim() !== '') {
    const slug = input.collectionSlug.trim().toLowerCase();
    const [found] = await tx.select({ id: collections.id }).from(collections).where(eq(collections.slug, slug));
    if (!found) throw new DomainError('NOT_FOUND', 'collection not found', { field: 'collectionSlug' });
    return found.id;
  }
  return null;
}

/**
 * Creates a product (no `id`) or updates one (`id`). See `UpsertProductInput` for the rules:
 * listed scents are created or updated, nothing is ever deleted, new scents get their variants
 * (50/75/100 ml or a single one) at `priceMad` with `initialStock`.
 */
export async function upsertProduct(input: UpsertProductInput, userId?: string | null): Promise<ProductDetail> {
  if (!input || typeof input !== 'object') {
    throw new DomainError('INVALID_INPUT', 'product data is required', { field: 'input' });
  }
  const actor = optionalUuid(userId, 'userId');
  const name = requireText(input.name, 'name', 120);
  const priceMad =
    input.priceMad === undefined ? DEFAULT_PRICE_MAD : requireInt(input.priceMad, 'priceMad', 0, MAX_PRICE_MAD);
  const initialStock =
    input.initialStock === undefined ? 0 : requireInt(input.initialStock, 'initialStock', 0, 1_000_000);
  const position = input.position === undefined ? undefined : requireInt(input.position, 'position', 0, 100_000);
  const imageUrl = input.imageUrl === undefined ? undefined : imageUrlOf(input.imageUrl);
  if (input.active !== undefined && typeof input.active !== 'boolean') {
    throw new DomainError('INVALID_INPUT', 'active must be true or false', { field: 'active' });
  }
  if (input.hasSizes !== undefined && typeof input.hasSizes !== 'boolean') {
    throw new DomainError('INVALID_INPUT', 'hasSizes must be true or false', { field: 'hasSizes' });
  }
  if (input.scents !== undefined && !Array.isArray(input.scents)) {
    throw new DomainError('INVALID_INPUT', 'scents must be a list', { field: 'scents' });
  }
  const scentInputs = input.scents?.map(cleanScent);
  const existingId = input.id === undefined || input.id === null || input.id === '' ? null : requireUuid(input.id, 'id');

  const db = await getDb();
  let productId: string;
  try {
    productId = await db.transaction(async (tx) => {
      let product: { id: string; slug: string; hasSizes: boolean };
      const collectionId = await resolveCollectionId(tx, input);

      if (existingId) {
        const [current] = await tx.select().from(products).where(eq(products.id, existingId)).for('update');
        if (!current) throw new DomainError('NOT_FOUND', 'product not found', { field: 'id' });
        if (input.hasSizes !== undefined && input.hasSizes !== current.hasSizes) {
          throw new DomainError('INVALID_INPUT', 'hasSizes cannot be changed once the product exists', {
            field: 'hasSizes',
          });
        }
        const slug = input.slug === undefined ? current.slug : requireSlug(input.slug);
        await tx
          .update(products)
          .set({
            name,
            slug,
            ...(collectionId ? { collectionId } : {}),
            ...(input.active !== undefined ? { active: input.active } : {}),
            ...(position !== undefined ? { position } : {}),
            ...(imageUrl !== undefined ? { imageUrl } : {}),
          })
          .where(eq(products.id, current.id));
        product = { id: current.id, slug, hasSizes: current.hasSizes };
      } else {
        if (!collectionId) {
          throw new DomainError('INVALID_INPUT', 'collectionId or collectionSlug is required', {
            field: 'collectionSlug',
          });
        }
        const slug = requireSlug(input.slug === undefined || input.slug.trim() === '' ? slugify(name) : input.slug);
        let nextPosition = position;
        if (nextPosition === undefined) {
          const [last] = await tx.select({ max: sql<number>`coalesce(max(${products.position}), 0)::int` }).from(products);
          nextPosition = Number(last?.max ?? 0) + 1;
        }
        const [created] = await tx
          .insert(products)
          .values({
            slug,
            name,
            collectionId,
            hasSizes: input.hasSizes ?? true,
            active: input.active ?? true,
            position: nextPosition,
            imageUrl: imageUrl ?? null,
          })
          .returning({ id: products.id, slug: products.slug, hasSizes: products.hasSizes });
        if (!created) throw new Error('@nait/db: the product was not created');
        product = created;
      }

      // Scents: update the listed ones, create the new ones with their variants.
      const existingScents = await tx.select().from(scents).where(eq(scents.productId, product.id));
      const scentById = new Map(existingScents.map((scent) => [scent.id, scent]));
      let lastPosition = existingScents.reduce((max, scent) => Math.max(max, scent.position), 0);
      const list: CleanScent[] =
        scentInputs && scentInputs.length > 0
          ? scentInputs
          : existingId || existingScents.length > 0
            ? []
            : [{ id: null, nameLatin: name, nameAr: undefined, tag: undefined, position: undefined }];

      const usedSkus = new Set(
        (
          await tx
            .select({ sku: variants.sku })
            .from(variants)
            .where(like(variants.sku, `${escapeLike(`NA-${product.slug}-`)}%`))
        ).map((row) => row.sku),
      );
      const sizes: readonly number[] = product.hasSizes ? SIZES_ML : [0];

      for (const scent of list) {
        if (scent.id) {
          if (!scentById.has(scent.id)) {
            throw new DomainError('NOT_FOUND', 'scent not found in this product', { field: 'scents' });
          }
          await tx
            .update(scents)
            .set({
              nameLatin: scent.nameLatin,
              ...(scent.nameAr !== undefined ? { nameAr: scent.nameAr } : {}),
              ...(scent.tag !== undefined ? { tag: scent.tag } : {}),
              ...(scent.position !== undefined ? { position: scent.position } : {}),
            })
            .where(eq(scents.id, scent.id));
          continue;
        }
        const scentPosition = scent.position ?? lastPosition + 1;
        lastPosition = Math.max(lastPosition, scentPosition);
        const [createdScent] = await tx
          .insert(scents)
          .values({
            productId: product.id,
            nameLatin: scent.nameLatin,
            nameAr: scent.nameAr ?? null,
            tag: scent.tag ?? null,
            position: scentPosition,
          })
          .returning({ id: scents.id });
        if (!createdScent) throw new Error('@nait/db: the scent was not created');

        // The sku number is the position of the scent, or the next free number.
        let number = Math.max(1, scentPosition);
        while (sizes.some((sizeMl) => usedSkus.has(skuFor(product.slug, number, sizeMl)))) number += 1;
        const createdVariants = await tx
          .insert(variants)
          .values(
            sizes.map((sizeMl) => ({
              productId: product.id,
              scentId: createdScent.id,
              sizeMl,
              sku: skuFor(product.slug, number, sizeMl),
              priceMad,
              stock: initialStock,
            })),
          )
          .returning({ id: variants.id, sku: variants.sku });
        for (const variant of createdVariants) usedSkus.add(variant.sku);
        if (initialStock > 0) {
          await tx.insert(stockMovements).values(
            createdVariants.map((variant) => ({
              variantId: variant.id,
              delta: initialStock,
              reason: 'initial' as const,
              userId: actor,
              stockAfter: initialStock,
            })),
          );
        }
      }
      return product.id;
    });
  } catch (error) {
    if (sqlState(error) === UNIQUE_VIOLATION) {
      throw new DomainError('CONFLICT', 'this slug is already used by another product', { field: 'slug' });
    }
    throw error;
  }

  const detail = await loadProductDetail(db, eq(products.id, productId), false);
  if (!detail) throw new DomainError('NOT_FOUND', 'product not found');
  return detail;
}

/** Shows or hides a product in the shop. Hidden products cannot be ordered. */
export async function setProductActive(id: string, active: boolean): Promise<Product> {
  const productId = requireUuid(id, 'id');
  if (typeof active !== 'boolean') {
    throw new DomainError('INVALID_INPUT', 'active must be true or false', { field: 'active' });
  }
  const db = await getDb();
  const [updated] = await db.update(products).set({ active }).where(eq(products.id, productId)).returning();
  if (!updated) throw new DomainError('NOT_FOUND', 'product not found', { field: 'id' });
  return updated;
}
