/**
 * Fills an empty database. Each part looks at its own tables and does nothing when they already
 * contain data, so running it again is harmless:
 *
 *   - settings: the default value of every missing key;
 *   - catalogue (when there is no collection and no product): 4 collections, the 25 products of
 *     seed/catalog.json with their scents, one variant per scent and size at 199 MAD with a stock
 *     of 20, and one 'initial' stock movement per variant;
 *   - users (when there is none): one owner from ADMIN_EMAIL / ADMIN_PASSWORD. With the local
 *     PGlite database only, admin@maisonnait.ma / nait-local-2026 is used when they are not set.
 *     With a Postgres server there is no default password: without the two variables no account
 *     is created, and the next start that has them creates it.
 */
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import catalogJson from '../seed/catalog.json';
import collectionsJson from '../seed/collections.json';
import type { Db, Driver } from './client';
import { hashPassword } from './password';
import { collections, products, scents, settings, stockMovements, users, variants } from './schema';
import { DEFAULT_PRICE_MAD, SCENT_TAGS, SIZES_ML } from './types';
import type { Lang, ScentTag, Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
  shippingMad: 0,
  deliveryDelay: '1 à 3 jours ouvrés',
  shopPhone: '',
  whatsapp: '',
  announcement: '',
};

export const SEED_STOCK = 20;

/** Used only with the local PGlite database, never when DATABASE_URL is set. */
const LOCAL_ADMIN = { email: 'admin@maisonnait.ma', password: 'nait-local-2026' } as const;
const MIN_PASSWORD_LENGTH = 8;

interface CatalogProduct {
  /** Collection slug. */
  c: string;
  slug: string;
  name: string;
  /** true: 50 / 75 / 100 ml. false: a single format. */
  sizes: boolean;
  /** [latin name, arabic name, tag?] */
  scents: string[][];
  img?: string | null;
}

interface CollectionSeed {
  slug: string;
  position: number;
  name: Record<Lang, string>;
  description: Record<Lang, string>;
}

const catalog = catalogJson as unknown as { price?: number; products: CatalogProduct[] };
const collectionSeeds = collectionsJson as unknown as CollectionSeed[];

export function skuFor(productSlug: string, scentNumber: number, sizeMl: number): string {
  return `NA-${productSlug}-${scentNumber}-${sizeMl}`;
}

function toTag(value: string | undefined): ScentTag | null {
  return (SCENT_TAGS as readonly string[]).includes(value ?? '') ? (value as ScentTag) : null;
}

async function isEmpty(tx: Db, table: typeof collections | typeof products | typeof users): Promise<boolean> {
  const rows = await tx.select({ one: sql<number>`1` }).from(table).limit(1);
  return rows.length === 0;
}

async function seedSettings(tx: Db): Promise<void> {
  await tx
    .insert(settings)
    .values(Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({ key, value })))
    .onConflictDoNothing({ target: settings.key });
}

async function seedCatalogue(tx: Db): Promise<void> {
  if (!(await isEmpty(tx, collections)) || !(await isEmpty(tx, products))) return;

  const price = Number.isInteger(catalog.price) && (catalog.price ?? 0) > 0 ? (catalog.price as number) : DEFAULT_PRICE_MAD;

  const collectionRows = collectionSeeds.map((c) => ({
    id: randomUUID(),
    slug: c.slug,
    position: c.position,
    nameFr: c.name.fr,
    nameEn: c.name.en,
    nameAr: c.name.ar,
    nameAry: c.name.ary,
    nameZgh: c.name.zgh,
    descriptionFr: c.description.fr,
    descriptionEn: c.description.en,
    descriptionAr: c.description.ar,
    descriptionAry: c.description.ary,
    descriptionZgh: c.description.zgh,
  }));
  const collectionIdBySlug = new Map(collectionRows.map((c) => [c.slug, c.id]));

  const productRows: (typeof products.$inferInsert)[] = [];
  const scentRows: (typeof scents.$inferInsert)[] = [];
  const variantRows: (typeof variants.$inferInsert & { id: string })[] = [];

  catalog.products.forEach((product, productIndex) => {
    const collectionId = collectionIdBySlug.get(product.c);
    if (!collectionId) throw new Error(`seed: product ${product.slug} is in an unknown collection "${product.c}"`);
    const productId = randomUUID();
    productRows.push({
      id: productId,
      slug: product.slug,
      collectionId,
      name: product.name,
      hasSizes: product.sizes === true,
      active: true,
      position: productIndex + 1,
      imageUrl: product.img ?? null,
    });

    // A product without scent gets one scent named like the product.
    const scentList = product.scents.length > 0 ? product.scents : [[product.name]];
    const sizes: readonly number[] = product.sizes === true ? SIZES_ML : [0];
    scentList.forEach((scent, scentIndex) => {
      const scentId = randomUUID();
      const number = scentIndex + 1;
      scentRows.push({
        id: scentId,
        productId,
        nameLatin: scent[0] ?? product.name,
        nameAr: scent[1] ? scent[1] : null,
        tag: toTag(scent[2]),
        position: number,
      });
      for (const sizeMl of sizes) {
        variantRows.push({
          id: randomUUID(),
          productId,
          scentId,
          sizeMl,
          sku: skuFor(product.slug, number, sizeMl),
          priceMad: price,
          stock: SEED_STOCK,
          active: true,
        });
      }
    });
  });

  await tx.insert(collections).values(collectionRows);
  if (productRows.length === 0) return;
  await tx.insert(products).values(productRows);
  await tx.insert(scents).values(scentRows);
  await tx.insert(variants).values(variantRows);
  await tx.insert(stockMovements).values(
    variantRows.map((variant) => ({
      variantId: variant.id,
      delta: SEED_STOCK,
      reason: 'initial' as const,
      stockAfter: SEED_STOCK,
    })),
  );
  console.info(
    `[@nait/db] catalogue seeded: ${collectionRows.length} collections, ${productRows.length} products, ` +
      `${scentRows.length} scents, ${variantRows.length} variants (stock ${SEED_STOCK} each)`,
  );
}

async function seedOwner(tx: Db, context: { driver: Driver }): Promise<void> {
  if (!(await isEmpty(tx, users))) return;

  let email = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? '';
  let password = process.env.ADMIN_PASSWORD ?? '';
  if (context.driver === 'pglite') {
    // Local database: fall back to the documented local account.
    email ||= LOCAL_ADMIN.email;
    password ||= LOCAL_ADMIN.password;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < MIN_PASSWORD_LENGTH) {
    // Not an error for an app that does not carry these variables (the shop, for instance): the
    // account is created by the first app that has them.
    console.warn(
      '[@nait/db] no owner account yet: it is created the first time an app that has ADMIN_EMAIL and ' +
        `ADMIN_PASSWORD (at least ${MIN_PASSWORD_LENGTH} characters) opens this database.`,
    );
    return;
  }
  await tx.insert(users).values({
    email,
    name: 'Administrateur',
    role: 'owner',
    passwordHash: await hashPassword(password),
    active: true,
  });
  console.info(`[@nait/db] owner account created: ${email}`);
}

export async function seed(tx: Db, context: { driver: Driver }): Promise<void> {
  await seedSettings(tx);
  await seedCatalogue(tx);
  await seedOwner(tx, context);
}
