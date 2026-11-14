/**
 * The local PGlite database is shared by several processes (the shop, the stock manager, the
 * build workers of Next.js): only one of them may have the folder open at a time, and they hand
 * it to each other on demand (src/pglite-shared.ts). These tests run real child processes.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adjustStock, closeDb, getDb, listMovements, listOrders, listVariants } from '../src/index';

const here = dirname(fileURLToPath(import.meta.url));
const worker = join(here, 'fixtures', 'worker.ts');

let tempDir = '';
let dataDir = '';

interface Exit {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}

function runWorker(args: string[]): Promise<Exit> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', worker, ...args], {
      cwd: join(here, '..'),
      env: { ...process.env, NAIT_PGLITE_DIR: dataDir, DATABASE_URL: '' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += String(chunk)));
    child.stderr.on('data', (chunk) => (stderr += String(chunk)));
    child.on('error', reject);
    child.on('close', (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}

async function variantBySku(sku: string) {
  const [variant] = await listVariants({ q: sku });
  if (!variant || variant.sku !== sku) throw new Error(`variant ${sku} not found`);
  return variant;
}

beforeAll(async () => {
  delete process.env.DATABASE_URL;
  tempDir = mkdtempSync(join(tmpdir(), 'nait-db-shared-'));
  dataDir = join(tempDir, 'pglite');
  process.env.NAIT_PGLITE_DIR = dataDir;
  await getDb();
});

afterAll(async () => {
  await closeDb();
  rmSync(tempDir, { recursive: true, force: true });
});

describe('local database shared between processes', () => {
  it('four processes work on the same data at once without losing or overselling anything', async () => {
    const restocked = await variantBySku('NA-axe-1-0');
    const sold = await variantBySku('NA-axe-2-0');
    await adjustStock(sold.id, -10, 'adjust', null, 'test: 10 left'); // 10 units for 18 buyers
    const rounds = 6;

    // Three child processes, and this one, all busy at the same time.
    const children = [1, 2, 3].map(() => runWorker(['work', restocked.id, sold.id, String(rounds)]));
    let ownRestocks = 0;
    for (let i = 0; i < 8; i += 1) {
      await adjustStock(restocked.id, 1, 'restock', null, 'parent');
      ownRestocks += 1;
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
    const exits = await Promise.all(children);
    for (const exit of exits) expect(exit.code, exit.stderr).toBe(0);
    const reports = exits.map(
      (exit) => JSON.parse(exit.stdout.trim().split('\n').pop() ?? '{}') as { restocked: number; sold: string[]; refused: number },
    );

    // Every restock of every process is there.
    expect(reports.map((r) => r.restocked)).toEqual([rounds, rounds, rounds]);
    expect((await variantBySku('NA-axe-1-0')).stock).toBe(20 + 3 * rounds + ownRestocks);
    expect((await listMovements({ variantId: restocked.id, limit: 1000 })).filter((m) => m.reason === 'restock')).toHaveLength(
      3 * rounds + ownRestocks,
    );

    // 18 attempts for 10 units: exactly 10 sales, 8 refusals, stock 0, distinct order numbers.
    const numbers = reports.flatMap((r) => r.sold);
    expect(numbers).toHaveLength(10);
    expect(new Set(numbers).size).toBe(10);
    expect(reports.reduce((n, r) => n + r.refused, 0)).toBe(3 * rounds - 10);
    expect((await variantBySku('NA-axe-2-0')).stock).toBe(0);
    const orders = await listOrders({ limit: 500 });
    expect(orders.map((o) => o.number).sort()).toEqual([...numbers].sort());
    expect(orders.map((o) => o.number).sort()).toEqual(
      Array.from({ length: 10 }, (_, i) => `NA-${String(i + 1).padStart(6, '0')}`),
    );
  }, 120_000);

  it('takes over the database of a process that died while holding it', async () => {
    await closeDb(); // this process lets go of the database
    expect(existsSync(`${dataDir}.lock`)).toBe(false);

    const exit = await runWorker(['crash']);
    expect(exit.stdout).toContain('opened');
    expect(exit.signal).toBe('SIGKILL');
    // The dead process left its lock behind.
    const stale = JSON.parse(readFileSync(`${dataDir}.lock`, 'utf8')) as { pid: number };
    expect(stale.pid).not.toBe(process.pid);

    await getDb();
    expect(await listVariants({ q: 'NA-axe-1-0' })).toHaveLength(1);
    const current = JSON.parse(readFileSync(`${dataDir}.lock`, 'utf8')) as { pid: number };
    expect(current.pid).toBe(process.pid);
  }, 60_000);
});
