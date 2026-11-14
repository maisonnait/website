/**
 * Connection: picks the driver, applies the migrations and seeds an empty database.
 *
 *   DATABASE_URL set   -> postgres.js (any Postgres: Neon, Supabase, a local server...)
 *   DATABASE_URL empty -> PGlite stored in <repo>/.data/pglite (no server; see pglite-shared.ts)
 *
 * Node runtime only.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { bootstrap } from './migrate';

/** The Drizzle database returned by `getDb()`. Identical API for both drivers. */
export type Db = PgDatabase<PgQueryResultHKT>;

export type Driver = 'postgres' | 'pglite';

interface Connection {
  db: Db;
  driver: Driver;
  /** Where the data lives, without credentials (for logs and diagnostics). */
  location: string;
  close: () => Promise<void>;
}

interface State {
  connecting?: Promise<Connection>;
}

// Kept on globalThis: Next.js evaluates a module several times in one process (hot reload, one
// copy per bundle layer) and all copies must share the single connection.
const STATE_KEY = Symbol.for('@nait/db:state');

function state(): State {
  const holder = globalThis as { [STATE_KEY]?: State };
  holder[STATE_KEY] ??= {};
  return holder[STATE_KEY];
}

/**
 * Root of the monorepo (the folder that contains pnpm-workspace.yaml). The apps run with
 * apps/store or apps/admin as working directory, so the root is searched upwards from there, then
 * from this file. `NAIT_REPO_ROOT` overrides the search.
 *
 * The `turbopackIgnore` comments tell the Next.js bundler not to follow these paths: they are
 * computed at run time and point at the local database, which is not part of a deployment.
 */
export function findRepoRoot(): string {
  const explicit = process.env.NAIT_REPO_ROOT?.trim();
  if (explicit) return path.resolve(/* turbopackIgnore: true */ explicit);
  const starts = [process.cwd()];
  try {
    starts.push(path.dirname(fileURLToPath(import.meta.url)));
  } catch {
    // import.meta.url is not a file URL in this bundle: the working directory is enough
  }
  for (const start of starts) {
    let dir = path.resolve(/* turbopackIgnore: true */ start);
    for (;;) {
      if (fs.existsSync(path.join(/* turbopackIgnore: true */ dir, 'pnpm-workspace.yaml'))) return dir;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return process.cwd();
}

/** Folder of the local PGlite database: `NAIT_PGLITE_DIR` if set, otherwise <repo>/.data/pglite. */
export function pgliteDir(): string {
  const explicit = process.env.NAIT_PGLITE_DIR?.trim();
  return explicit
    ? path.resolve(/* turbopackIgnore: true */ explicit)
    : path.join(/* turbopackIgnore: true */ findRepoRoot(), '.data', 'pglite');
}

function databaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL?.trim();
  return url ? url : undefined;
}

async function openPostgres(url: string): Promise<Connection> {
  const [{ default: postgres }, { drizzle }] = await Promise.all([import('postgres'), import('drizzle-orm/postgres-js')]);
  const client = postgres(url, {
    // Small pool: on Vercel every function instance has its own.
    max: Number(process.env.DATABASE_POOL_MAX) || 5,
    idle_timeout: 20,
    connect_timeout: 15,
    // Works through connection poolers in transaction mode (Neon "-pooler", Supabase 6543, PgBouncer).
    prepare: false,
    onnotice: () => undefined,
  });
  let location = 'postgres';
  try {
    const parsed = new URL(url);
    location = `postgres://${parsed.host}${parsed.pathname}`;
  } catch {
    // not a URL (key=value connection string): keep the generic label
  }
  return {
    db: drizzle({ client }) as unknown as Db,
    driver: 'postgres',
    location,
    close: () => client.end({ timeout: 5 }),
  };
}

async function openPglite(dir: string): Promise<Connection> {
  const [{ drizzle }, { SharedPGlite }] = await Promise.all([import('drizzle-orm/pglite'), import('./pglite-shared')]);
  const client = new SharedPGlite(dir);
  return {
    db: drizzle({ client: client as never }) as unknown as Db,
    driver: 'pglite',
    location: client.dataDir,
    close: () => client.close(),
  };
}

async function connect(): Promise<Connection> {
  const url = databaseUrl();
  if (!url && process.env.VERCEL) {
    // A deployment has no durable local disk: the PGlite fallback is for a developer's machine only.
    throw new Error(
      '@nait/db: DATABASE_URL is not set. On Vercel the apps need a Postgres database: connect one ' +
        'to this project (Storage tab) or add DATABASE_URL to its environment variables, then redeploy.',
    );
  }
  const connection = url ? await openPostgres(url) : await openPglite(pgliteDir());
  try {
    await bootstrap(connection.db, { driver: connection.driver });
  } catch (error) {
    await connection.close().catch(() => undefined);
    throw error;
  }
  return connection;
}

function connection(): Promise<Connection> {
  const current = state();
  if (!current.connecting) {
    const connecting = connect();
    current.connecting = connecting;
    // A failed start is not remembered: the next call tries again.
    connecting.catch(() => {
      if (current.connecting === connecting) current.connecting = undefined;
    });
  }
  return current.connecting;
}

/**
 * The database, as a Drizzle instance. One per process. The first call applies the pending
 * migrations and seeds the database if it is empty (catalogue, owner account, default settings).
 *
 * For custom queries: `const db = await getDb(); await db.select().from(schema.products)`.
 * Inside `db.transaction(async (tx) => ...)` use only `tx`: the local PGlite database has a single
 * connection, so a query on `db` (or a call to another @nait/db function) from inside the
 * transaction would wait for that same transaction to end.
 */
export async function getDb(): Promise<Db> {
  return (await connection()).db;
}

/** Which driver is in use and where the data is (no credentials). Opens the database if needed. */
export async function getDbInfo(): Promise<{ driver: Driver; location: string }> {
  const { driver, location } = await connection();
  return { driver, location };
}

/** Closes the connection; the next `getDb()` opens a new one. For scripts and tests. */
export async function closeDb(): Promise<void> {
  const current = state();
  const connecting = current.connecting;
  current.connecting = undefined;
  if (!connecting) return;
  const opened = await connecting.catch(() => null);
  if (opened) await opened.close();
}
