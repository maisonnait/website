/**
 * Tests of @nait/db against a fresh database.
 *
 * By default the database is a temporary PGlite folder, created for this run and deleted afterwards.
 * To run the same tests against a real Postgres server, point NAIT_TEST_DATABASE_URL at an EMPTY
 * database (the tests create the tables and write test orders into it).
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import catalogJson from '../seed/catalog.json';
import {
  DomainError,
  adjustStock,
  closeDb,
  countOrders,
  createUser,
  dashboard,
  getDb,
  getDbInfo,
  getOrder,
  getOrderForCustomer,
  getProduct,
  getSettings,
  getUser,
  isDomainError,
  listCollections,
  listMovements,
  listOrders,
  listProducts,
  listUsers,
  listVariants,
  placeOrder,
  setOrderStatus,
  setProductActive,
  setSetting,
  setUserActive,
  setVariant,
  shopDay,
  updateOrderNote,
  upsertProduct,
  verifyLogin,
} from '../src/index';
import type { DomainErrorCode, PlaceOrderInput, VariantRow } from '../src/index';

const catalog = catalogJson as unknown as {
  products: { c: string; slug: string; name: string; sizes: boolean; scents: string[][]; img: string }[];
};

const ADMIN_EMAIL = 'owner@test.local';
const ADMIN_PASSWORD = 'correct-horse-battery';

// What the seed must produce, computed from the catalogue file itself.
const expectedScents = catalog.products.reduce((n, p) => n + Math.max(1, p.scents.length), 0);
const expectedVariants = catalog.products.reduce((n, p) => n + Math.max(1, p.scents.length) * (p.sizes ? 3 : 1), 0);

let tempDir: string | undefined;
let ownerId = '';

/** Every call returns a variant that no earlier test has touched (stock 20, price 199). */
let untouched: VariantRow[] = [];
function freshVariant(): VariantRow {
  const variant = untouched.shift();
  if (!variant) throw new Error('test setup: no untouched variant left');
  return variant;
}

const customer = {
  customerName: 'Salma Bennani',
  phone: '0612345678',
  city: 'Casablanca',
  address: '12 rue des Orangers, Maârif',
  lang: 'fr',
} as const;

function order(items: PlaceOrderInput['items'], extra: Partial<PlaceOrderInput> = {}): PlaceOrderInput {
  return { ...customer, items, ...extra };
}

async function stockOf(variantId: string): Promise<number> {
  const all = await listVariants();
  const variant = all.find((v) => v.id === variantId);
  if (!variant) throw new Error(`variant ${variantId} not found`);
  return variant.stock;
}

async function expectDomainError(promise: Promise<unknown>, code: DomainErrorCode): Promise<DomainError> {
  try {
    await promise;
  } catch (error) {
    expect(isDomainError(error), `expected a DomainError, got: ${String(error)}`).toBe(true);
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe(code);
    return error as DomainError;
  }
  throw new Error(`expected DomainError ${code}, but the call succeeded`);
}

beforeAll(async () => {
  const realPostgres = process.env.NAIT_TEST_DATABASE_URL?.trim();
  if (realPostgres) {
    process.env.DATABASE_URL = realPostgres;
  } else {
    delete process.env.DATABASE_URL;
    tempDir = mkdtempSync(join(tmpdir(), 'nait-db-test-'));
    process.env.NAIT_PGLITE_DIR = join(tempDir, 'pglite');
  }
  process.env.ADMIN_EMAIL = ADMIN_EMAIL;
  process.env.ADMIN_PASSWORD = ADMIN_PASSWORD;
  await getDb(); // creates the tables and seeds
  untouched = (await listVariants()).filter((v) => v.stock === 20);
});

afterAll(async () => {
  await closeDb();
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
});

describe('seed', () => {
  it('uses the expected driver on an empty database', async () => {
    const info = await getDbInfo();
    expect(info.driver).toBe(process.env.NAIT_TEST_DATABASE_URL ? 'postgres' : 'pglite');
  });

  it('creates the 4 collections with their texts in 5 languages', async () => {
    const collections = await listCollections();
    expect(collections.map((c) => c.slug)).toEqual(['arabisant', 'femmes', 'hommes', 'unisexe']);
    const femmes = collections[1]!;
    expect(femmes.name).toEqual({ fr: 'Femmes', en: 'Women', ar: 'نسائي', ary: 'العيالات', zgh: 'ⵜⵉⵎⵖⴰⵔⵉⵏ' });
    expect(femmes.nameEn).toBe('Women');
    expect(femmes.description.fr).toBe('Onze familles de senteurs pour elle.');
    for (const collection of collections) {
      for (const lang of ['fr', 'en', 'ar', 'ary', 'zgh'] as const) {
        expect(collection.name[lang].length).toBeGreaterThan(0);
        expect(collection.description[lang].length).toBeGreaterThan(0);
      }
    }
    expect(collections.map((c) => c.productCount)).toEqual([5, 11, 9, 0]);
  });

  it('creates the 25 products of the catalogue with their photo', async () => {
    const products = await listProducts();
    expect(catalog.products).toHaveLength(25);
    expect(products).toHaveLength(25);
    expect(products.map((p) => p.slug)).toEqual(catalog.products.map((p) => p.slug));
    for (const source of catalog.products) {
      const product = products.find((p) => p.slug === source.slug)!;
      expect(product.name).toBe(source.name);
      expect(product.collectionSlug).toBe(source.c);
      expect(product.hasSizes).toBe(source.sizes);
      expect(product.imageUrl).toBe(source.img);
      expect(product.active).toBe(true);
      expect(product.scentCount).toBe(Math.max(1, source.scents.length));
      expect(product.variantCount).toBe(Math.max(1, source.scents.length) * (source.sizes ? 3 : 1));
      expect(product.minPrice).toBe(199);
      expect(product.inStock).toBe(true);
      expect(product.totalStock).toBe(product.variantCount * 20);
    }
    expect(await listProducts({ collectionSlug: 'hommes' })).toHaveLength(9);
    expect(await listProducts({ collectionSlug: 'unisexe' })).toHaveLength(0);
  });

  it(`creates ${expectedVariants} variants: each scent in 50/75/100 ml, or one variant without size`, async () => {
    const variants = await listVariants();
    expect(expectedVariants).toBe(383);
    expect(variants).toHaveLength(expectedVariants);
    expect(new Set(variants.map((v) => v.sku)).size).toBe(expectedVariants);
    for (const variant of variants) {
      expect(variant.priceMad).toBe(199);
      expect(variant.stock).toBe(20);
      expect(variant.lowStockThreshold).toBe(5);
      expect(variant.active).toBe(true);
      expect(variant.low).toBe(false);
      expect(variant.sku).toMatch(new RegExp(`^NA-${variant.productSlug}-\\d+-${variant.sizeMl}$`));
    }

    const qurashi = await getProduct('al-qurashi');
    expect(qurashi).not.toBeNull();
    expect(qurashi!.collection.slug).toBe('arabisant');
    expect(qurashi!.scents).toHaveLength(10);
    expect(qurashi!.variants).toHaveLength(30);
    expect(qurashi!.scents[0]).toMatchObject({ nameLatin: 'Black Incense', nameAr: 'البخور الأسود', tag: null, position: 1 });
    expect(qurashi!.scents[2]).toMatchObject({ nameLatin: 'Khashah Al Oud', tag: 'EXTRA' });
    expect(qurashi!.scents[9]).toMatchObject({ nameLatin: 'Safari Blue', tag: 'SUPER' });
    expect(qurashi!.variants.slice(0, 3).map((v) => [v.sku, v.sizeMl])).toEqual([
      ['NA-al-qurashi-1-50', 50],
      ['NA-al-qurashi-1-75', 75],
      ['NA-al-qurashi-1-100', 100],
    ]);

    // No sizes: one variant per scent, size 0.
    const axe = await getProduct('axe');
    expect(axe!.hasSizes).toBe(false);
    expect(axe!.variants.map((v) => [v.sku, v.sizeMl])).toEqual([
      ['NA-axe-1-0', 0],
      ['NA-axe-2-0', 0],
    ]);

    // A product without scent gets one scent named like the product.
    const azzaro = await getProduct('azzaro-femme');
    expect(azzaro!.scents.map((s) => s.nameLatin)).toEqual(['AZZARO']);
    expect(azzaro!.variants.map((v) => v.sizeMl)).toEqual([50, 75, 100]);

    expect(await getProduct('does-not-exist')).toBeNull();
  });

  it('writes one initial movement of +20 per variant', async () => {
    const movements = await listMovements({ limit: 1000 });
    expect(movements).toHaveLength(expectedVariants);
    expect(movements.every((m) => m.reason === 'initial' && m.delta === 20 && m.stockAfter === 20)).toBe(true);
    expect(expectedScents).toBe(167);
  });

  it('creates one owner from ADMIN_EMAIL / ADMIN_PASSWORD and the default settings', async () => {
    const users = await listUsers();
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ email: ADMIN_EMAIL, role: 'owner', active: true });
    expect(Object.keys(users[0]!)).not.toContain('passwordHash');
    ownerId = users[0]!.id;

    expect(await getSettings()).toEqual({
      shippingMad: 0,
      deliveryDelay: '1 à 3 jours ouvrés',
      shopPhone: '',
      whatsapp: '',
      announcement: '',
    });
  });

  it('does not seed twice when the database is opened again', async () => {
    await closeDb();
    await getDb();
    expect(await listProducts()).toHaveLength(25);
    expect(await listVariants()).toHaveLength(expectedVariants);
    expect(await listUsers()).toHaveLength(1);
    expect(await listMovements({ limit: 1000 })).toHaveLength(expectedVariants);
  });
});

describe('placeOrder', () => {
  it('writes the order, reduces the stock and records the sale', async () => {
    const a = freshVariant();
    const b = freshVariant();
    const placed = await placeOrder(
      order(
        [
          { variantId: a.id, quantity: 2 },
          { variantId: b.id, quantity: 1 },
        ],
        { note: 'Appeler avant de livrer', lang: 'ar' },
      ),
    );
    expect(placed.number).toBe('NA-000001');
    expect(placed).toMatchObject({ subtotal: 597, shipping: 0, total: 597 });

    expect(await stockOf(a.id)).toBe(18);
    expect(await stockOf(b.id)).toBe(19);

    const saved = await getOrder(placed.id);
    expect(saved).toMatchObject({
      number: 'NA-000001',
      status: 'new',
      customerName: 'Salma Bennani',
      phone: '+212612345678',
      city: 'Casablanca',
      note: 'Appeler avant de livrer',
      lang: 'ar',
      subtotalMad: 597,
      shippingMad: 0,
      totalMad: 597,
      paymentMethod: 'cod',
      internalNote: null,
      confirmedAt: null,
      cancelledAt: null,
    });
    expect(saved!.createdAt).toBeInstanceOf(Date);
    expect(saved!.items).toHaveLength(2);
    const lineA = saved!.items.find((i) => i.variantId === a.id)!;
    expect(lineA).toMatchObject({ productName: a.productName, sizeMl: a.sizeMl, unitPriceMad: 199, quantity: 2 });
    expect(lineA.scentName).toContain(a.scentName);
    // The order can also be read by its number.
    expect((await getOrder('NA-000001'))!.id).toBe(placed.id);

    const sales = await listMovements({ orderId: placed.id });
    expect(sales).toHaveLength(2);
    expect(sales.find((m) => m.variantId === a.id)).toMatchObject({
      delta: -2,
      reason: 'sale',
      stockAfter: 18,
      orderNumber: 'NA-000001',
    });
    expect(sales.find((m) => m.variantId === b.id)).toMatchObject({ delta: -1, reason: 'sale', stockAfter: 19 });

    const listed = await listOrders();
    expect(listed[0]).toMatchObject({ number: 'NA-000001', lineCount: 2, itemCount: 3 });
  });

  it('adds up lines of the same variant and numbers orders in sequence', async () => {
    const a = freshVariant();
    const placed = await placeOrder(
      order([
        { variantId: a.id, quantity: 1 },
        { variantId: a.id, quantity: 3 },
      ]),
    );
    expect(placed.number).toBe('NA-000002');
    expect(placed.total).toBe(4 * 199);
    expect(await stockOf(a.id)).toBe(16);
    expect((await getOrder(placed.id))!.items).toHaveLength(1);
  });

  it('refuses with OUT_OF_STOCK and changes nothing, even for the other items of the cart', async () => {
    const available = freshVariant();
    const short = freshVariant();
    const before = await countOrders();
    const error = await expectDomainError(
      placeOrder(
        order([
          { variantId: available.id, quantity: 1 },
          { variantId: short.id, quantity: 21 },
        ]),
      ),
      'OUT_OF_STOCK',
    );
    expect(error.details).toMatchObject({ variantId: short.id, requested: 21, available: 20 });
    expect(await stockOf(available.id)).toBe(20); // rolled back with the rest
    expect(await stockOf(short.id)).toBe(20);
    expect(await countOrders()).toBe(before);
    expect(await listMovements({ variantId: available.id })).toHaveLength(1); // only the initial one

    // The refused order did not use up a number.
    const next = await placeOrder(order([{ variantId: available.id, quantity: 20 }]));
    expect(next.number).toBe('NA-000003');
    expect(await stockOf(available.id)).toBe(0);
    await expectDomainError(placeOrder(order([{ variantId: available.id, quantity: 1 }])), 'OUT_OF_STOCK');
  });

  it('refuses a phone that is not Moroccan with INVALID_PHONE', async () => {
    const a = freshVariant();
    const items = [{ variantId: a.id, quantity: 1 }];
    for (const phone of ['', '12345', '0812345678', '061234567', '06123456789', '+33612345678', '+2120612345678']) {
      const error = await expectDomainError(placeOrder(order(items, { phone })), 'INVALID_PHONE');
      expect(error.details.field).toBe('phone');
    }
    expect(await stockOf(a.id)).toBe(20);

    // Accepted spellings, all stored as +212XXXXXXXXX.
    for (const phone of ['0712345678', '+212512345678', '06 12 34 56 78', '+212 6-12-34-56-78', '00212612345678']) {
      const placed = await placeOrder(order(items, { phone }));
      expect((await getOrder(placed.id))!.phone).toMatch(/^\+212[5-7]\d{8}$/);
    }
    expect(await stockOf(a.id)).toBe(15);
  });

  it('refuses an empty cart with EMPTY_CART and incomplete data with INVALID_INPUT', async () => {
    await expectDomainError(placeOrder(order([])), 'EMPTY_CART');
    const a = freshVariant();
    const items = [{ variantId: a.id, quantity: 1 }];
    expect((await expectDomainError(placeOrder(order(items, { customerName: '  ' })), 'INVALID_INPUT')).details.field).toBe(
      'customerName',
    );
    expect((await expectDomainError(placeOrder(order(items, { address: '' })), 'INVALID_INPUT')).details.field).toBe(
      'address',
    );
    await expectDomainError(placeOrder(order([{ variantId: a.id, quantity: 0 }])), 'INVALID_INPUT');
    await expectDomainError(placeOrder(order([{ variantId: a.id, quantity: 1.5 }])), 'INVALID_INPUT');
    await expectDomainError(placeOrder(order([{ variantId: 'not-an-id', quantity: 1 }])), 'INVALID_INPUT');
    // A well-formed id that does not exist is "not available".
    await expectDomainError(
      placeOrder(order([{ variantId: '00000000-0000-4000-8000-000000000000', quantity: 1 }])),
      'OUT_OF_STOCK',
    );
    expect(await stockOf(a.id)).toBe(20);
  });

  it('never oversells: two orders compete for the last unit, exactly one wins', async () => {
    const last = freshVariant();
    await adjustStock(last.id, -19, 'adjust', ownerId, 'test: one unit left');
    expect(await stockOf(last.id)).toBe(1);

    const results = await Promise.allSettled([
      placeOrder(order([{ variantId: last.id, quantity: 1 }], { customerName: 'Client A' })),
      placeOrder(order([{ variantId: last.id, quantity: 1 }], { customerName: 'Client B' })),
    ]);
    const won = results.filter((r) => r.status === 'fulfilled');
    const lost = results.filter((r) => r.status === 'rejected');
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(1);
    const reason = (lost[0] as PromiseRejectedResult).reason as DomainError;
    expect(isDomainError(reason)).toBe(true);
    expect(reason.code).toBe('OUT_OF_STOCK');
    expect(reason.details).toMatchObject({ variantId: last.id, requested: 1, available: 0 });
    expect(await stockOf(last.id)).toBe(0);
    expect((await listMovements({ variantId: last.id })).filter((m) => m.reason === 'sale')).toHaveLength(1);
  });

  it('never oversells: 12 simultaneous orders of 2 units for a stock of 7 give exactly 3 sales', async () => {
    const variant = freshVariant();
    await adjustStock(variant.id, -13, 'adjust', ownerId);
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, (_, i) =>
        placeOrder(order([{ variantId: variant.id, quantity: 2 }], { customerName: `Client ${i + 1}` })),
      ),
    );
    const won = results.filter((r) => r.status === 'fulfilled') as PromiseFulfilledResult<{ number: string }>[];
    expect(won).toHaveLength(3);
    expect(new Set(won.map((r) => r.value.number)).size).toBe(3);
    for (const result of results) {
      if (result.status === 'rejected') expect((result.reason as DomainError).code).toBe('OUT_OF_STOCK');
    }
    expect(await stockOf(variant.id)).toBe(1);
  });
});

describe('getOrderForCustomer', () => {
  it('returns the order only with the right number and phone, without private fields', async () => {
    const a = freshVariant();
    const placed = await placeOrder(order([{ variantId: a.id, quantity: 1 }], { phone: '0661122334' }));
    const summary = await getOrderForCustomer(placed.number, '+212 661 122 334');
    expect(summary).toMatchObject({ number: placed.number, status: 'new', totalMad: 199, city: 'Casablanca' });
    expect(summary!.items).toEqual([
      expect.objectContaining({ productName: a.productName, sizeMl: a.sizeMl, quantity: 1, unitPriceMad: 199 }),
    ]);
    expect(Object.keys(summary!)).not.toContain('address');
    expect(Object.keys(summary!)).not.toContain('phone');
    expect(Object.keys(summary!)).not.toContain('internalNote');

    expect(await getOrderForCustomer(placed.number.toLowerCase(), '0661122334')).not.toBeNull();
    expect(await getOrderForCustomer(placed.number, '0661122335')).toBeNull();
    expect(await getOrderForCustomer('NA-999999', '0661122334')).toBeNull();
    expect(await getOrderForCustomer(placed.number, 'not a phone')).toBeNull();
  });
});

describe('setOrderStatus', () => {
  it('cancelling puts the stock back exactly once', async () => {
    const a = freshVariant();
    const placed = await placeOrder(order([{ variantId: a.id, quantity: 2 }]));
    expect(await stockOf(a.id)).toBe(18);

    const cancelled = await setOrderStatus(placed.id, 'cancelled', ownerId);
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.cancelledAt).toBeInstanceOf(Date);
    expect(await stockOf(a.id)).toBe(20);

    // Asking again, one after the other or at the same time, moves nothing.
    await setOrderStatus(placed.id, 'cancelled', ownerId);
    await Promise.all([
      setOrderStatus(placed.id, 'cancelled', ownerId),
      setOrderStatus(placed.number, 'cancelled', ownerId),
    ]);
    expect(await stockOf(a.id)).toBe(20);
    // A cancelled order that is then marked as returned does not get its stock back a second time.
    await setOrderStatus(placed.id, 'returned', ownerId);
    expect(await stockOf(a.id)).toBe(20);

    const movements = await listMovements({ variantId: a.id });
    expect(movements.map((m) => [m.reason, m.delta]).sort()).toEqual(
      [
        ['initial', 20],
        ['sale', -2],
        ['cancel', 2],
      ].sort(),
    );
    const cancel = movements.find((m) => m.reason === 'cancel')!;
    expect(cancel).toMatchObject({ orderId: placed.id, userId: ownerId, stockAfter: 20, userName: 'Administrateur' });
  });

  it('two simultaneous cancellations of the same order restore the stock once', async () => {
    const a = freshVariant();
    const placed = await placeOrder(order([{ variantId: a.id, quantity: 5 }]));
    expect(await stockOf(a.id)).toBe(15);
    await Promise.all([
      setOrderStatus(placed.id, 'cancelled', ownerId),
      setOrderStatus(placed.id, 'cancelled', ownerId),
      setOrderStatus(placed.id, 'cancelled', ownerId),
    ]);
    expect(await stockOf(a.id)).toBe(20);
    expect((await listMovements({ orderId: placed.id })).filter((m) => m.reason === 'cancel')).toHaveLength(1);
  });

  it('a return puts the stock back with a "return" movement', async () => {
    const a = freshVariant();
    const placed = await placeOrder(order([{ variantId: a.id, quantity: 3 }]));
    const confirmed = await setOrderStatus(placed.id, 'confirmed', ownerId);
    expect(confirmed.confirmedAt).toBeInstanceOf(Date);
    const delivered = await setOrderStatus(placed.id, 'delivered', ownerId);
    expect(delivered.shippedAt).toBeInstanceOf(Date);
    expect(delivered.deliveredAt).toBeInstanceOf(Date);
    expect(await stockOf(a.id)).toBe(17); // moving along the pipeline does not touch the stock

    const returned = await setOrderStatus(placed.id, 'returned', ownerId);
    expect(returned.status).toBe('returned');
    expect(returned.returnedAt).toBeInstanceOf(Date);
    expect(await stockOf(a.id)).toBe(20);
    await setOrderStatus(placed.id, 'returned', ownerId);
    expect(await stockOf(a.id)).toBe(20);
    const reasons = (await listMovements({ orderId: placed.id })).map((m) => m.reason).sort();
    expect(reasons).toEqual(['return', 'sale']);
  });

  it('reopening a cancelled order takes the stock again, or refuses when it is gone', async () => {
    const a = freshVariant();
    const placed = await placeOrder(order([{ variantId: a.id, quantity: 4 }]));
    await setOrderStatus(placed.id, 'cancelled', ownerId);
    expect(await stockOf(a.id)).toBe(20);

    const reopened = await setOrderStatus(placed.id, 'confirmed', ownerId);
    expect(reopened.status).toBe('confirmed');
    expect(reopened.cancelledAt).toBeNull();
    expect(await stockOf(a.id)).toBe(16);

    await setOrderStatus(placed.id, 'cancelled', ownerId);
    expect(await stockOf(a.id)).toBe(20);
    await adjustStock(a.id, -18, 'adjust', ownerId);
    await expectDomainError(setOrderStatus(placed.id, 'new', ownerId), 'OUT_OF_STOCK');
    expect(await stockOf(a.id)).toBe(2);
    expect((await getOrder(placed.id))!.status).toBe('cancelled');
  });

  it('refuses unknown orders and unknown statuses', async () => {
    await expectDomainError(setOrderStatus('NA-999999', 'confirmed', ownerId), 'NOT_FOUND');
    await expectDomainError(setOrderStatus('00000000-0000-4000-8000-000000000000', 'confirmed', ownerId), 'NOT_FOUND');
    const a = freshVariant();
    const placed = await placeOrder(order([{ variantId: a.id, quantity: 1 }]));
    await expectDomainError(setOrderStatus(placed.id, 'lost' as never, ownerId), 'INVALID_INPUT');
  });
});

describe('back-office orders', () => {
  it('filters, searches and annotates orders', async () => {
    const a = freshVariant();
    const placed = await placeOrder(
      order([{ variantId: a.id, quantity: 1 }], { customerName: 'Youssef El Idrissi', city: 'Tétouan', phone: '0700112233' }),
    );
    await setOrderStatus(placed.id, 'shipped', ownerId);

    expect((await listOrders({ status: 'shipped' })).map((o) => o.number)).toEqual([placed.number]);
    expect(await countOrders({ status: 'shipped' })).toBe(1);
    expect((await listOrders({ q: 'idrissi' })).map((o) => o.number)).toEqual([placed.number]);
    expect((await listOrders({ q: 'tétouan' })).map((o) => o.number)).toEqual([placed.number]);
    expect((await listOrders({ q: '0700112233' })).map((o) => o.number)).toEqual([placed.number]);
    expect((await listOrders({ q: placed.number })).map((o) => o.number)).toEqual([placed.number]);
    expect(await listOrders({ q: '100%_nothing' })).toEqual([]);

    const all = await listOrders({ limit: 500 });
    expect(await countOrders()).toBe(all.length);
    const numbers = all.map((o) => o.number);
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(numbers.every((n) => /^NA-\d{6}$/.test(n))).toBe(true);
    expect(await listOrders({ limit: 2, offset: 1 })).toHaveLength(2);
    expect((await listOrders({ status: ['cancelled', 'returned'] })).every((o) => o.status !== 'new')).toBe(true);

    const noted = await updateOrderNote(placed.id, '  Client absent, rappeler demain  ');
    expect(noted.internalNote).toBe('Client absent, rappeler demain');
    expect((await updateOrderNote(placed.number, '')).internalNote).toBeNull();
    await expectDomainError(updateOrderNote('NA-999999', 'x'), 'NOT_FOUND');
  });
});

describe('adjustStock', () => {
  it('adds and removes stock with a movement, and refuses to go below zero', async () => {
    const a = freshVariant();
    const restocked = await adjustStock(a.id, 5, 'restock', ownerId, 'Livraison fournisseur');
    expect(restocked.stock).toBe(25);
    expect(restocked.productName).toBe(a.productName);

    const reduced = await adjustStock(a.id, -24, 'adjust', ownerId, 'Inventaire');
    expect(reduced.stock).toBe(1);
    expect(reduced.low).toBe(true);

    const error = await expectDomainError(adjustStock(a.id, -2, 'adjust', ownerId), 'NEGATIVE_STOCK');
    expect(error.details).toMatchObject({ variantId: a.id, available: 1 });
    expect(await stockOf(a.id)).toBe(1);

    expect((await adjustStock(a.id, -1, 'adjust', ownerId)).stock).toBe(0);
    await expectDomainError(adjustStock(a.id, -1, 'adjust', ownerId), 'NEGATIVE_STOCK');

    const movements = await listMovements({ variantId: a.id });
    expect(movements.map((m) => [m.reason, m.delta, m.stockAfter]).sort()).toEqual(
      [
        ['initial', 20, 20],
        ['restock', 5, 25],
        ['adjust', -24, 1],
        ['adjust', -1, 0],
      ].sort(),
    );
    expect(movements.find((m) => m.reason === 'restock')).toMatchObject({
      note: 'Livraison fournisseur',
      userId: ownerId,
      sku: a.sku,
    });
  });

  it('refuses invalid adjustments', async () => {
    const a = freshVariant();
    await expectDomainError(adjustStock(a.id, 0, 'adjust', ownerId), 'INVALID_INPUT');
    await expectDomainError(adjustStock(a.id, 1.5, 'adjust', ownerId), 'INVALID_INPUT');
    await expectDomainError(adjustStock(a.id, -3, 'restock', ownerId), 'INVALID_INPUT');
    await expectDomainError(adjustStock(a.id, 3, 'sale' as never, ownerId), 'INVALID_INPUT');
    await expectDomainError(adjustStock('00000000-0000-4000-8000-000000000000', 1, 'adjust', ownerId), 'NOT_FOUND');
    expect(await stockOf(a.id)).toBe(20);
  });

  it('lists low stock and searches variants', async () => {
    const a = freshVariant();
    await adjustStock(a.id, -16, 'adjust', ownerId);
    const low = await listVariants({ lowOnly: true });
    expect(low.length).toBeGreaterThan(0);
    expect(low.every((v) => v.stock <= v.lowStockThreshold && v.low)).toBe(true);
    expect(low.some((v) => v.id === a.id)).toBe(true);

    expect((await listVariants({ q: a.sku })).map((v) => v.id)).toEqual([a.id]);
    const ofProduct = await listVariants({ productId: a.productId });
    expect(ofProduct.length).toBeGreaterThan(0);
    expect(ofProduct.every((v) => v.productId === a.productId)).toBe(true);
    expect((await listVariants({ q: 'khashah' })).length).toBe(6);
  });
});

describe('products and variants in the back office', () => {
  it('a hidden product leaves the shop and cannot be ordered', async () => {
    const product = (await getProduct('bentley'))!;
    await setProductActive(product.id, false);
    expect((await listProducts({ activeOnly: true })).some((p) => p.slug === 'bentley')).toBe(false);
    expect((await listProducts()).some((p) => p.slug === 'bentley')).toBe(true);
    expect(await getProduct('bentley', { activeOnly: true })).toBeNull();
    expect((await getProduct('bentley'))!.active).toBe(false);
    await expectDomainError(
      placeOrder(order([{ variantId: product.variants[0]!.id, quantity: 1 }])),
      'OUT_OF_STOCK',
    );
    expect((await listCollections()).find((c) => c.slug === 'hommes')!.productCount).toBe(8);
    await setProductActive(product.id, true);
    expect((await listProducts({ activeOnly: true })).some((p) => p.slug === 'bentley')).toBe(true);
    untouched = untouched.filter((v) => v.productId !== product.id);
  });

  it('setVariant changes price, threshold and availability', async () => {
    const a = freshVariant();
    const updated = await setVariant(a.id, { priceMad: 249, lowStockThreshold: 25 });
    expect(updated).toMatchObject({ priceMad: 249, lowStockThreshold: 25, low: true });
    expect(updated.updatedAt.getTime()).toBeGreaterThan(a.updatedAt.getTime());
    expect(updated.createdAt.getTime()).toBe(a.createdAt.getTime());
    const placed = await placeOrder(order([{ variantId: a.id, quantity: 2 }]));
    expect(placed.total).toBe(498);

    await setVariant(a.id, { active: false });
    await expectDomainError(placeOrder(order([{ variantId: a.id, quantity: 1 }])), 'OUT_OF_STOCK');
    const shown = await getProduct(a.productSlug, { activeOnly: true });
    expect(shown!.variants.some((v) => v.id === a.id)).toBe(false);
    expect((await getProduct(a.productSlug))!.variants.some((v) => v.id === a.id)).toBe(true);

    await expectDomainError(setVariant(a.id, { priceMad: -1 }), 'INVALID_INPUT');
    await expectDomainError(setVariant('00000000-0000-4000-8000-000000000000', { priceMad: 10 }), 'NOT_FOUND');
    untouched = untouched.filter((v) => v.productId !== a.productId);
  });

  it('upsertProduct creates a product with its scents and variants, then updates it', async () => {
    const created = await upsertProduct(
      {
        name: 'Musc Tahara',
        collectionSlug: 'unisexe',
        scents: [{ nameLatin: 'Blanc', nameAr: 'أبيض' }, { nameLatin: 'Rose', tag: 'EXTRA' }],
        initialStock: 4,
      },
      ownerId,
    );
    expect(created).toMatchObject({ slug: 'musc-tahara', hasSizes: true, active: true, collectionSlug: 'unisexe' });
    expect(created.scents.map((s) => [s.nameLatin, s.nameAr, s.tag])).toEqual([
      ['Blanc', 'أبيض', null],
      ['Rose', null, 'EXTRA'],
    ]);
    expect(created.variants.map((v) => v.sku)).toEqual([
      'NA-musc-tahara-1-50',
      'NA-musc-tahara-1-75',
      'NA-musc-tahara-1-100',
      'NA-musc-tahara-2-50',
      'NA-musc-tahara-2-75',
      'NA-musc-tahara-2-100',
    ]);
    expect(created.variants.every((v) => v.priceMad === 199 && v.stock === 4)).toBe(true);
    expect(created.totalStock).toBe(24);
    expect((await listMovements({ variantId: created.variants[0]!.id }))[0]).toMatchObject({ reason: 'initial', delta: 4 });

    const updated = await upsertProduct({
      id: created.id,
      name: 'Musc Tahara Royal',
      imageUrl: 'https://example.com/musc.png',
      scents: [{ id: created.scents[0]!.id, nameLatin: 'Blanc pur' }, { nameLatin: 'Ambre' }],
      priceMad: 220,
    });
    expect(updated.name).toBe('Musc Tahara Royal');
    expect(updated.slug).toBe('musc-tahara');
    expect(updated.imageUrl).toBe('https://example.com/musc.png');
    expect(updated.scents.map((s) => s.nameLatin)).toEqual(['Blanc pur', 'Rose', 'Ambre']);
    expect(updated.scents[0]!.nameAr).toBe('أبيض'); // untouched when not given
    expect(updated.variants).toHaveLength(9);
    expect(updated.variants.filter((v) => v.priceMad === 220).map((v) => v.sku)).toEqual([
      'NA-musc-tahara-3-50',
      'NA-musc-tahara-3-75',
      'NA-musc-tahara-3-100',
    ]);

    const single = await upsertProduct({ name: 'Coffret Découverte', collectionSlug: 'unisexe', hasSizes: false });
    expect(single.slug).toBe('coffret-decouverte');
    expect(single.scents.map((s) => s.nameLatin)).toEqual(['Coffret Découverte']);
    expect(single.variants.map((v) => [v.sku, v.sizeMl, v.stock])).toEqual([['NA-coffret-decouverte-1-0', 0, 0]]);
    expect(single.inStock).toBe(false);

    await expectDomainError(upsertProduct({ name: 'Autre', slug: 'musc-tahara', collectionSlug: 'unisexe' }), 'CONFLICT');
    await expectDomainError(upsertProduct({ name: 'Sans collection' }), 'INVALID_INPUT');
    await expectDomainError(upsertProduct({ name: 'X', collectionSlug: 'inconnue' }), 'NOT_FOUND');
    await expectDomainError(upsertProduct({ id: created.id, name: 'X', hasSizes: false }), 'INVALID_INPUT');
    expect((await listCollections()).find((c) => c.slug === 'unisexe')!.productCount).toBe(2);
  });
});

describe('users', () => {
  it('verifyLogin accepts the right password only', async () => {
    const user = await verifyLogin(ADMIN_EMAIL, ADMIN_PASSWORD);
    expect(user).toMatchObject({ id: ownerId, email: ADMIN_EMAIL, role: 'owner', active: true });
    expect(Object.keys(user!)).not.toContain('passwordHash');
    expect(await verifyLogin(`  ${ADMIN_EMAIL.toUpperCase()} `, ADMIN_PASSWORD)).not.toBeNull();
    expect(await verifyLogin(ADMIN_EMAIL, 'wrong-password')).toBeNull();
    expect(await verifyLogin(ADMIN_EMAIL, '')).toBeNull();
    expect(await verifyLogin('nobody@test.local', ADMIN_PASSWORD)).toBeNull();
    expect(await verifyLogin('not an email', ADMIN_PASSWORD)).toBeNull();
  });

  it('creates, lists and disables users', async () => {
    const staff = await createUser({ email: 'Stock@Test.Local', name: 'Hind', password: 'magasin-2026' });
    expect(staff).toMatchObject({ email: 'stock@test.local', name: 'Hind', role: 'staff', active: true });
    expect(await verifyLogin('stock@test.local', 'magasin-2026')).toMatchObject({ id: staff.id });
    expect((await listUsers()).map((u) => u.email)).toEqual([ADMIN_EMAIL, 'stock@test.local']);
    expect(await getUser(staff.id)).toMatchObject({ email: 'stock@test.local' });
    expect(await getUser('nope')).toBeNull();

    await expectDomainError(createUser({ email: 'stock@test.local', name: 'Bis', password: 'magasin-2026' }), 'CONFLICT');
    await expectDomainError(createUser({ email: 'bad', name: 'Bad', password: 'magasin-2026' }), 'INVALID_INPUT');
    await expectDomainError(createUser({ email: 'a@test.local', name: 'A', password: 'short' }), 'INVALID_INPUT');

    expect((await setUserActive(staff.id, false)).active).toBe(false);
    expect(await verifyLogin('stock@test.local', 'magasin-2026')).toBeNull();
    expect((await setUserActive(staff.id, true)).active).toBe(true);
    expect(await verifyLogin('stock@test.local', 'magasin-2026')).not.toBeNull();

    // The only owner cannot lock everybody out.
    await expectDomainError(setUserActive(ownerId, false), 'CONFLICT');
    expect(await verifyLogin(ADMIN_EMAIL, ADMIN_PASSWORD)).not.toBeNull();
  });
});

describe('settings', () => {
  it('stores settings with their type and applies the shipping fee to new orders', async () => {
    expect((await setSetting('announcement', '123')).announcement).toBe('123');
    expect((await setSetting('announcement', 'true')).announcement).toBe('true');
    expect((await setSetting('announcement', 'Livraison offerte "ce week-end" {à Casablanca}')).announcement).toBe(
      'Livraison offerte "ce week-end" {à Casablanca}',
    );
    expect((await setSetting('shopPhone', '06 61 00 00 00')).shopPhone).toBe('+212661000000');
    expect((await setSetting('whatsapp', '212661000000')).whatsapp).toBe('212661000000');
    await expectDomainError(setSetting('shippingMad', -5), 'INVALID_INPUT');
    await expectDomainError(setSetting('shippingMad', '20' as never), 'INVALID_INPUT');
    await expectDomainError(setSetting('unknown' as never, 1 as never), 'INVALID_INPUT');

    const settings = await setSetting('shippingMad', 25);
    expect(settings).toMatchObject({ shippingMad: 25, deliveryDelay: '1 à 3 jours ouvrés', announcement: expect.any(String) });
    const a = freshVariant();
    const placed = await placeOrder(order([{ variantId: a.id, quantity: 1 }]));
    expect(placed).toMatchObject({ subtotal: 199, shipping: 25, total: 224 });
    expect(await getOrder(placed.id)).toMatchObject({ subtotalMad: 199, shippingMad: 25, totalMad: 224 });
    await setSetting('shippingMad', 0);
    expect((await getSettings()).shippingMad).toBe(0);
  });
});

describe('dashboard', () => {
  it('summarises today, the last 7 days, the statuses and the low stock', async () => {
    const all = await listOrders({ limit: 500 });
    const today = shopDay(new Date());
    const counted = all.filter(
      (o) => o.status !== 'cancelled' && o.status !== 'returned' && shopDay(o.createdAt) === today,
    );
    const board = await dashboard();

    expect(board.ordersToday).toBe(counted.length);
    expect(board.ordersToday).toBeGreaterThan(10);
    expect(board.revenueToday).toBe(counted.reduce((sum, o) => sum + o.totalMad, 0));

    const byStatus = { new: 0, confirmed: 0, shipped: 0, delivered: 0, cancelled: 0, returned: 0 };
    for (const o of all) byStatus[o.status] += 1;
    expect(board.ordersByStatus).toEqual(byStatus);
    expect(board.ordersByStatus.cancelled).toBeGreaterThan(0);
    expect(board.ordersByStatus.returned).toBeGreaterThan(0);

    expect(board.last7Days).toHaveLength(7);
    expect(board.last7Days.map((d) => d.day)).toEqual([...board.last7Days.map((d) => d.day)].sort());
    expect(board.last7Days[6]).toEqual({ day: today, orders: board.ordersToday, revenue: board.revenueToday });
    expect(board.last7Days.slice(0, 6).every((d) => d.orders === 0 && d.revenue === 0)).toBe(true);

    const low = await listVariants({ lowOnly: true });
    expect(board.lowStock.map((v) => v.id).sort()).toEqual(low.map((v) => v.id).sort());
    expect(board.lowStock.length).toBeGreaterThan(0);
    const stocks = board.lowStock.map((v) => v.stock);
    expect(stocks).toEqual([...stocks].sort((x, y) => x - y));
    expect(board.lowStock[0]).toHaveProperty('productName');
  });
});
