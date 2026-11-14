/**
 * Brings a database up to date: applies the pending SQL migrations (src/migrations.generated.ts)
 * and seeds what is missing. Called once per process by getDb().
 *
 * Safe when several processes or serverless instances start at the same time: everything happens
 * in one transaction that first takes a Postgres advisory lock, so the others wait, then find the
 * work done. When the database is already up to date the check costs a single query.
 */
import { sql } from 'drizzle-orm';
import type { Db, Driver } from './client';
import { migrations } from './migrations.generated';
import { DEFAULT_SETTINGS, seed } from './seed';
import { rowsOf } from './util';

/** Arbitrary constant identifying "the @nait/db bootstrap" among advisory locks. */
const ADVISORY_LOCK_KEY = 6_249_202_611;

interface Status {
  migrations: string;
  has_catalogue: boolean;
  has_users: boolean;
  settings_count: number;
}

async function isUpToDate(db: Db): Promise<boolean> {
  let status: Status | undefined;
  try {
    const result = await db.execute(sql`
      select
        (select coalesce(string_agg(id, ','), '') from nait_migrations) as migrations,
        (exists (select 1 from collections) or exists (select 1 from products)) as has_catalogue,
        exists (select 1 from users) as has_users,
        (select count(*)::int from settings) as settings_count
    `);
    status = rowsOf<Status>(result)[0];
  } catch {
    return false; // brand-new database: the tables do not exist yet
  }
  if (!status) return false;
  const applied = new Set(status.migrations.split(','));
  return (
    migrations.every((migration) => applied.has(migration.id)) &&
    status.has_catalogue === true &&
    status.has_users === true &&
    Number(status.settings_count) >= Object.keys(DEFAULT_SETTINGS).length
  );
}

export async function bootstrap(db: Db, context: { driver: Driver }): Promise<void> {
  if (await isUpToDate(db)) return;

  await db.transaction(async (tx) => {
    await tx.execute(sql.raw(`select pg_advisory_xact_lock(${ADVISORY_LOCK_KEY})`));
    await tx.execute(
      sql.raw(
        'create table if not exists nait_migrations (id text primary key, applied_at timestamptz not null default now())',
      ),
    );
    const applied = new Set(
      rowsOf<{ id: string }>(await tx.execute(sql.raw('select id from nait_migrations'))).map((row) => row.id),
    );
    for (const migration of migrations) {
      if (applied.has(migration.id)) continue;
      for (const statement of migration.statements) await tx.execute(sql.raw(statement));
      await tx.execute(sql`insert into nait_migrations (id) values (${migration.id})`);
    }
    await seed(tx, context);
  });
}
