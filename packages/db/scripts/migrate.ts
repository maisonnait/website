/**
 * Opens the configured database - DATABASE_URL, or the local PGlite folder when it is empty -
 * which applies the pending migrations and seeds an empty database, then prints what is there.
 *
 *   pnpm db:migrate                                  local PGlite (<repo>/.data/pglite)
 *   DATABASE_URL=postgres://... pnpm db:migrate      a Postgres server
 *
 * The apps do the same on their first query; this script is only a way to do it ahead of time.
 */
import { closeDb, getDbInfo, getSettings, listCollections, listProducts, listUsers, listVariants } from '../src/index';

try {
  const info = await getDbInfo();
  const [collections, products, variants, users, settings] = [
    await listCollections(),
    await listProducts(),
    await listVariants(),
    await listUsers(),
    await getSettings(),
  ];
  console.log(`database : ${info.driver} (${info.location})`);
  console.log(`catalogue: ${collections.length} collections, ${products.length} products, ${variants.length} variants`);
  console.log(`stock    : ${variants.reduce((sum, variant) => sum + variant.stock, 0)} units`);
  console.log(`users    : ${users.map((user) => `${user.email} (${user.role}${user.active ? '' : ', disabled'})`).join(', ') || 'none'}`);
  console.log(`settings : ${JSON.stringify(settings)}`);
} finally {
  await closeDb();
}
