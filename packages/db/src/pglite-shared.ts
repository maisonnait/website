/**
 * Local database for development: PGlite (Postgres compiled to WebAssembly) stored in a folder.
 *
 * A PGlite folder can be opened by ONE process at a time, but the shop (apps/store), the stock
 * manager (apps/admin) and the build workers of Next.js are separate processes that all need the
 * same data. `SharedPGlite` makes that safe without any server:
 *
 *   - a lock file next to the data folder (`<dir>.lock`) says which process has the folder open;
 *   - a process that needs the database drops a ticket in `<dir>.waiters/` and waits its turn
 *     (oldest ticket first);
 *   - the owner notices the ticket, finishes what it is doing, closes PGlite and removes the lock;
 *   - the waiting process takes the lock and opens the folder (about 0.2 s).
 *
 * So the database moves from process to process on demand, and only one of them ever has it open.
 * A process that dies while holding the lock is detected (its pid no longer exists) and the lock
 * is taken over; Postgres then replays its write-ahead log like after any crash.
 *
 * The object has the two methods Drizzle's PGlite driver uses (`query`, `transaction`), so it is
 * passed to Drizzle in place of a PGlite instance.
 */
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { PGlite, QueryOptions, Results, Transaction } from '@electric-sql/pglite';

/** How long the owner stays idle before giving the database to a waiting process. */
const LINGER_MS = 25;
/** Once another process has waited this long, a busy owner stops accepting new work until it has handed over. */
const MAX_HOLD_MS = 750;
/** How often a waiting process retries to take the lock. */
const RETRY_MS = 20;
/** Fallback check for waiting processes, in case the file watcher misses an event. */
const WATCH_FALLBACK_MS = 250;
/** How long a process waits for the database before giving up. */
const ACQUIRE_TIMEOUT_MS = 60_000;
/** A lock file that cannot be read (being written, or damaged) is only considered dead after this long. */
const UNREADABLE_LOCK_GRACE_MS = 2_000;
/** A leftover recovery mutex older than this is removed. */
const RECOVERY_MUTEX_MAX_AGE_MS = 5_000;

interface LockInfo {
  pid: number;
  token: string;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function errorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null ? (error as { code?: string }).code : undefined;
}

function isAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM: the process exists but belongs to someone else.
    return errorCode(error) === 'EPERM';
  }
}

function removeQuietly(file: string): void {
  try {
    fs.unlinkSync(file);
  } catch {
    // already gone
  }
}

export class SharedPGlite {
  readonly dataDir: string;
  private readonly lockPath: string;
  private readonly waitersDir: string;
  /** Identity of this object. Starts with the pid, so a ticket named after it tells who is waiting. */
  private readonly token = `${process.pid}-${randomBytes(6).toString('hex')}`;
  private readonly ticketPath: string;

  /** The open database; set only while this process holds the lock. */
  private db: PGlite | null = null;
  private acquiring: Promise<PGlite> | null = null;
  private releasing: Promise<void> | null = null;
  /** Calls to `use` that are running or waiting for the database. */
  private active = 0;
  private idleSince = 0;
  /** When this owner first saw another process waiting (0 = nobody waits). */
  private waiterSeenAt = 0;
  private checkTimer: NodeJS.Timeout | null = null;
  private fallbackTimer: NodeJS.Timeout | null = null;
  private watcher: fs.FSWatcher | null = null;
  private closed = false;
  private lastLockError: unknown = null;
  private readonly onExit = () => this.abandon();

  constructor(dataDir: string) {
    this.dataDir = path.resolve(dataDir);
    this.lockPath = `${this.dataDir}.lock`;
    this.waitersDir = `${this.dataDir}.waiters`;
    this.ticketPath = path.join(this.waitersDir, this.token);
    process.on('exit', this.onExit);
  }

  // ---- the part of the PGlite interface that Drizzle uses ---------------------------------

  query<T>(query: string, params?: unknown[], options?: QueryOptions): Promise<Results<T>> {
    return this.use((db) => db.query<T>(query, params as never[] | undefined, options));
  }

  exec(query: string, options?: QueryOptions): Promise<Results[]> {
    return this.use((db) => db.exec(query, options));
  }

  transaction<T>(callback: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.use((db) => db.transaction(callback));
  }

  /** Closes the database and gives up the lock. The object cannot be used afterwards. */
  async close(): Promise<void> {
    this.closed = true;
    process.off('exit', this.onExit);
    if (this.acquiring) await this.acquiring.catch(() => undefined);
    if (this.releasing) await this.releasing;
    if (this.db) await this.release();
  }

  // ---- running work -------------------------------------------------------------------------

  private async use<T>(work: (db: PGlite) => Promise<T>): Promise<T> {
    if (this.closed) throw new Error('@nait/db: the local database was closed');
    // Fairness: when another process has been waiting for a while and this one is still busy,
    // new work queues behind the hand-over instead of prolonging our turn.
    for (;;) {
      if (this.releasing) await this.releasing;
      else if (this.db && this.active > 0 && this.mustYield()) await sleep(RETRY_MS);
      else break;
    }
    this.active += 1;
    try {
      const db = this.db ?? (await this.acquire());
      return await work(db);
    } finally {
      this.active -= 1;
      if (this.active === 0) {
        this.idleSince = Date.now();
        this.scheduleCheck(LINGER_MS);
      }
    }
  }

  private mustYield(): boolean {
    return this.waiterSeenAt !== 0 && Date.now() - this.waiterSeenAt > MAX_HOLD_MS;
  }

  // ---- taking the database ------------------------------------------------------------------

  private acquire(): Promise<PGlite> {
    this.acquiring ??= this.lockAndOpen().finally(() => {
      this.acquiring = null;
    });
    return this.acquiring;
  }

  private async lockAndOpen(): Promise<PGlite> {
    fs.mkdirSync(this.waitersDir, { recursive: true });
    const deadline = Date.now() + ACQUIRE_TIMEOUT_MS;
    // Take a ticket. Tickets are served oldest first, which is what stops a process that has just
    // handed the database over from grabbing it back before the process it handed it to.
    fs.writeFileSync(this.ticketPath, '');
    this.lastLockError = null;
    try {
      const ticketTime = fs.statSync(this.ticketPath).mtimeMs;
      while (this.olderTicketExists(ticketTime) || !this.tryLock()) {
        if (Date.now() > deadline) {
          const holder = this.readLock();
          if (holder === 'missing' && this.lastLockError) throw this.lastLockError;
          throw new Error(
            `@nait/db: could not open the local database ${this.dataDir}: it is held by ` +
              `${typeof holder === 'object' ? `process ${holder.pid}` : 'another process'}, ` +
              `which did not release it within ${ACQUIRE_TIMEOUT_MS / 1000} s. ` +
              `If no other app is running, delete ${this.lockPath} and retry.`,
          );
        }
        await sleep(RETRY_MS);
      }
    } finally {
      removeQuietly(this.ticketPath);
    }

    try {
      const { PGlite } = await import('@electric-sql/pglite');
      const db = new PGlite(this.dataDir);
      await db.waitReady;
      this.db = db;
      this.idleSince = Date.now();
      this.waiterSeenAt = 0;
      this.watchForWaiters();
      return db;
    } catch (error) {
      this.unlock();
      throw error;
    }
  }

  /** Tickets of other live processes, with their age. Removes tickets left by dead processes. */
  private otherTickets(): { name: string; time: number }[] {
    let names: string[];
    try {
      names = fs.readdirSync(this.waitersDir);
    } catch {
      return [];
    }
    const tickets: { name: string; time: number }[] = [];
    for (const name of names) {
      if (name === this.token) continue;
      const file = path.join(this.waitersDir, name);
      let time: number;
      try {
        time = fs.statSync(file).mtimeMs;
      } catch {
        continue; // removed in the meantime
      }
      const pid = Number(name.split('-')[0]);
      if (!isAlive(pid) || Date.now() - time > 2 * ACQUIRE_TIMEOUT_MS) {
        removeQuietly(file); // its process died, or gave up long ago
        continue;
      }
      tickets.push({ name, time });
    }
    return tickets;
  }

  private olderTicketExists(mine: number): boolean {
    return this.otherTickets().some((t) => t.time < mine || (t.time === mine && t.name < this.token));
  }

  /** Takes the lock if it is free. Removes the lock of a dead process so that the next try can succeed. */
  private tryLock(): boolean {
    try {
      const fd = fs.openSync(this.lockPath, 'wx');
      try {
        fs.writeSync(fd, JSON.stringify({ pid: process.pid, token: this.token, at: new Date().toISOString() }));
      } finally {
        fs.closeSync(fd);
      }
      return true;
    } catch (error) {
      const code = errorCode(error);
      if (code !== 'EEXIST') {
        // On Windows a lock that is being deleted answers "access denied" for an instant: try again.
        // A real permission problem keeps failing and is reported when the waiting time runs out.
        if (code !== 'EPERM' && code !== 'EACCES' && code !== 'EBUSY') throw error;
        this.lastLockError = error;
        return false;
      }
    }
    const holder = this.readLock();
    if (holder === 'missing') return false; // released a moment ago: the next try will get it
    if (holder === 'unreadable') {
      if (this.lockAgeMs() > UNREADABLE_LOCK_GRACE_MS) this.removeDeadLock(null);
      return false;
    }
    if (holder.token === this.token) return true;
    if (!isAlive(holder.pid)) this.removeDeadLock(holder);
    return false;
  }

  private readLock(): LockInfo | 'missing' | 'unreadable' {
    let text: string;
    try {
      text = fs.readFileSync(this.lockPath, 'utf8');
    } catch (error) {
      return errorCode(error) === 'ENOENT' ? 'missing' : 'unreadable';
    }
    try {
      const parsed = JSON.parse(text) as Partial<LockInfo>;
      if (typeof parsed.pid === 'number' && typeof parsed.token === 'string') {
        return { pid: parsed.pid, token: parsed.token };
      }
    } catch {
      // empty or half-written
    }
    return 'unreadable';
  }

  private lockAgeMs(): number {
    try {
      return Date.now() - fs.statSync(this.lockPath).mtimeMs;
    } catch {
      return 0;
    }
  }

  /**
   * Removes the lock left by a dead process. Two waiting processes may reach this point together,
   * and the second one must not delete the fresh lock of the first: the removal is therefore done
   * under a short-lived mutex file, after reading the lock again.
   */
  private removeDeadLock(expected: LockInfo | null): void {
    const mutex = `${this.lockPath}.recover`;
    let fd: number;
    try {
      fd = fs.openSync(mutex, 'wx');
    } catch (error) {
      if (errorCode(error) !== 'EEXIST') throw error;
      try {
        if (Date.now() - fs.statSync(mutex).mtimeMs > RECOVERY_MUTEX_MAX_AGE_MS) removeQuietly(mutex);
      } catch {
        // gone already
      }
      return;
    }
    try {
      const current = this.readLock();
      const stillDead =
        expected === null
          ? current === 'unreadable' && this.lockAgeMs() > UNREADABLE_LOCK_GRACE_MS
          : typeof current === 'object' && current.token === expected.token && !isAlive(current.pid);
      if (stillDead) removeQuietly(this.lockPath);
    } finally {
      fs.closeSync(fd);
      removeQuietly(mutex);
    }
  }

  private unlock(): void {
    const holder = this.readLock();
    if (typeof holder === 'object' && holder.token === this.token) removeQuietly(this.lockPath);
  }

  // ---- giving the database to another process -----------------------------------------------

  private watchForWaiters(): void {
    try {
      this.watcher = fs.watch(this.waitersDir, () => this.check());
      this.watcher.on('error', () => this.stopWatcher());
      this.watcher.unref();
    } catch {
      this.watcher = null; // no file watching here: the timer below is enough
    }
    this.fallbackTimer = setInterval(() => this.check(), WATCH_FALLBACK_MS);
    this.fallbackTimer.unref();
    this.scheduleCheck(0);
  }

  private stopWatcher(): void {
    try {
      this.watcher?.close();
    } catch {
      // ignore
    }
    this.watcher = null;
  }

  private stopWatching(): void {
    this.stopWatcher();
    if (this.fallbackTimer) clearInterval(this.fallbackTimer);
    if (this.checkTimer) clearTimeout(this.checkTimer);
    this.fallbackTimer = null;
    this.checkTimer = null;
  }

  private scheduleCheck(delayMs: number): void {
    if (!this.db || this.checkTimer) return;
    this.checkTimer = setTimeout(
      () => {
        this.checkTimer = null;
        this.check();
      },
      Math.max(0, delayMs),
    );
    this.checkTimer.unref();
  }

  /** Owner side: hand the database over if another process waits and nothing is running here. */
  private check(): void {
    if (!this.db || this.releasing) return;
    if (this.otherTickets().length === 0) {
      this.waiterSeenAt = 0;
      return;
    }
    if (this.waiterSeenAt === 0) this.waiterSeenAt = Date.now();
    if (this.active > 0) return; // `use` schedules another check when the work is done
    const idleFor = Date.now() - this.idleSince;
    if (idleFor >= LINGER_MS || this.mustYield()) void this.release();
    else this.scheduleCheck(LINGER_MS - idleFor);
  }

  private release(): Promise<void> {
    const db = this.db;
    if (!db) return this.releasing ?? Promise.resolve();
    this.releasing ??= (async () => {
      try {
        await db.close();
      } catch (error) {
        console.warn('[@nait/db] closing the local database failed:', error);
      } finally {
        this.db = null;
        this.stopWatching();
        this.unlock();
        this.waiterSeenAt = 0;
        this.releasing = null;
      }
    })();
    return this.releasing;
  }

  /** Process exit: nothing asynchronous can run any more, so just let go of the lock. */
  private abandon(): void {
    removeQuietly(this.ticketPath);
    if (this.db) this.unlock();
  }
}
