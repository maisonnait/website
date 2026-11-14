/**
 * The shop's only door to the database. Everything comes from @nait/db (see CONTRACT.md);
 * this file adapts its rows to what the pages show and keeps private columns on the server.
 */
import 'server-only';

import { cache } from 'react';
import {
  getProduct as dbGetProduct,
  getSettings as dbGetSettings,
  listCollections as dbListCollections,
  listProducts as dbListProducts,
  type Collection,
  type ProductCard,
  type ProductDetail,
  type Settings,
  type Variant,
} from '@nait/db';
import type { Locale } from '@/i18n/config';
import type { Translate } from '@/i18n';
import { isKnownCollection } from './collections';
import { MAX_PER_LINE, type LineCheck, type PickerProduct, type PickerVariant, type StockState } from './types';

export type { Collection, ProductCard, ProductDetail, Settings };

/*
 * React's cache() keeps one answer per request: generateMetadata() and the page can both ask
 * for the same product without reading the database twice. Nothing is kept between requests.
 */
export const listCollections = cache((): Promise<Collection[]> => dbListCollections());

/** Active products only: what is hidden in the back office stays hidden here. */
export const listProducts = cache(
  (collectionSlug?: string): Promise<ProductCard[]> =>
    dbListProducts({ activeOnly: true, ...(collectionSlug ? { collectionSlug } : {}) }),
);

export const getProduct = cache((slug: string): Promise<ProductDetail | null> => dbGetProduct(slug, { activeOnly: true }));

export const getSettings = cache((): Promise<Settings> => dbGetSettings());

/** Name of a collection in the page's language (database first, dictionary as a fallback). */
export function collectionName(collection: Pick<Collection, 'slug' | 'name'>, lang: Locale, t: Translate): string {
  const fromDb = collection.name?.[lang]?.trim();
  if (fromDb) return fromDb;
  return isKnownCollection(collection.slug) ? t(`tab.${collection.slug}`) : collection.slug;
}

export function collectionDescription(
  collection: Pick<Collection, 'slug' | 'description'>,
  lang: Locale,
  t: Translate,
): string {
  const fromDb = collection.description?.[lang]?.trim();
  if (fromDb) return fromDb;
  return isKnownCollection(collection.slug) ? t(`desc.${collection.slug}`) : '';
}

export function stockOf(variant: Pick<Variant, 'stock' | 'lowStockThreshold'>): { state: StockState; left: number; max: number } {
  const stock = Math.max(0, Math.trunc(variant.stock));
  if (stock <= 0) return { state: 'out', left: 0, max: 0 };
  const max = Math.min(stock, MAX_PER_LINE);
  if (stock <= variant.lowStockThreshold) return { state: 'low', left: stock, max };
  return { state: 'in', left: 0, max };
}

/** What the product picker needs, and nothing else. */
export function toPickerProduct(product: ProductDetail): PickerProduct {
  const variants: PickerVariant[] = product.variants
    .filter((variant) => variant.active)
    .map((variant) => ({
      id: variant.id,
      scentId: variant.scentId,
      sizeMl: variant.sizeMl,
      price: variant.priceMad,
      ...stockOf(variant),
    }));
  const sold = new Set(variants.map((variant) => variant.scentId));
  return {
    slug: product.slug,
    name: product.name,
    imageUrl: product.imageUrl,
    collectionSlug: product.collectionSlug,
    hasSizes: product.hasSizes,
    scents: product.scents
      .filter((scent) => sold.has(scent.id))
      .map((scent) => ({ id: scent.id, name: scent.nameLatin, nameAr: scent.nameAr, tag: scent.tag })),
    variants,
  };
}

/**
 * Current price and availability of cart lines. A line whose product or variant is gone
 * comes back with `found: false`.
 */
export async function checkLines(lines: { variantId: string; slug: string }[]): Promise<LineCheck[]> {
  const slugs = [...new Set(lines.map((line) => line.slug))];
  const products = await Promise.all(slugs.map((slug) => getProduct(slug)));
  const bySlug = new Map(slugs.map((slug, index) => [slug, products[index] ?? null]));
  return lines.map(({ variantId, slug }) => {
    const variant = bySlug.get(slug)?.variants.find((candidate) => candidate.id === variantId && candidate.active);
    if (!variant) return { variantId, found: false, price: null, available: 0 };
    return { variantId, found: true, price: variant.priceMad, available: stockOf(variant).max };
  });
}
