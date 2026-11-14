/**
 * Deletes the LOCAL PGlite database (<repo>/.data/pglite) so that the next start recreates and
 * reseeds it. Stop the apps first. Never touches a Postgres server: with DATABASE_URL set the
 * script refuses to run.
 *
 *   pnpm db:reset
 */
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { pgliteDir } from '../src/index';

if (process.env.DATABASE_URL?.trim()) {
  console.error('DATABASE_URL is set: this script only resets the local PGlite database. Nothing was deleted.');
  process.exit(1);
}

const dir = pgliteDir();
const lock = `${dir}.lock`;
if (existsSync(lock)) {
  let pid = 0;
  try {
    pid = Number((JSON.parse(readFileSync(lock, 'utf8')) as { pid?: number }).pid);
  } catch {
    // unreadable lock: treated as left over
  }
  let alive = false;
  try {
    if (pid > 0) {
      process.kill(pid, 0);
      alive = true;
    }
  } catch (error) {
    alive = (error as { code?: string }).code === 'EPERM';
  }
  if (alive) {
    console.error(`The local database is in use by process ${pid}. Stop the apps, then run this again. Nothing was deleted.`);
    process.exit(1);
  }
}

for (const target of [dir, lock, `${lock}.recover`, `${dir}.waiters`]) rmSync(target, { recursive: true, force: true });
console.log(`Deleted ${dir}. It will be recreated and seeded on the next start.`);
