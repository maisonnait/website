/** First start of a database: where the local data lives, and how the owner account is created. */
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { closeDb, findRepoRoot, getDb, listProducts, listUsers, pgliteDir, verifyLogin } from '../src/index';

const here = dirname(fileURLToPath(import.meta.url));
const saved = { ...process.env };
let tempDir = '';

beforeAll(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'nait-db-boot-'));
});

afterEach(async () => {
  await closeDb();
  for (const key of ['DATABASE_URL', 'NAIT_PGLITE_DIR', 'NAIT_REPO_ROOT', 'ADMIN_EMAIL', 'ADMIN_PASSWORD', 'VERCEL']) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  vi.restoreAllMocks();
});

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('location of the local database', () => {
  it('is <repo>/.data/pglite, found from a package folder', () => {
    delete process.env.NAIT_PGLITE_DIR;
    delete process.env.NAIT_REPO_ROOT;
    const root = findRepoRoot();
    expect(root).toBe(resolve(here, '..', '..', '..'));
    expect(existsSync(join(root, 'pnpm-workspace.yaml'))).toBe(true);
    expect(pgliteDir()).toBe(join(root, '.data', 'pglite'));
  });

  it('can be overridden', () => {
    process.env.NAIT_REPO_ROOT = tempDir;
    delete process.env.NAIT_PGLITE_DIR;
    expect(pgliteDir()).toBe(join(tempDir, '.data', 'pglite'));
    process.env.NAIT_PGLITE_DIR = join(tempDir, 'elsewhere');
    expect(pgliteDir()).toBe(join(tempDir, 'elsewhere'));
  });
});

describe('owner account', () => {
  it('is not created from an unusable password, and is created by a later start that has one', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    delete process.env.DATABASE_URL;
    process.env.NAIT_PGLITE_DIR = join(tempDir, 'owner');
    process.env.ADMIN_EMAIL = 'gerante@test.local';
    process.env.ADMIN_PASSWORD = 'court';

    await getDb();
    expect(await listUsers()).toEqual([]);
    expect(await listProducts()).toHaveLength(25); // the catalogue does not depend on the account
    expect(warn.mock.calls.flat().join(' ')).toContain('no owner account yet');

    await closeDb();
    process.env.ADMIN_PASSWORD = 'un-vrai-mot-de-passe';
    await getDb();
    const users = await listUsers();
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ email: 'gerante@test.local', role: 'owner', active: true });
    expect(await verifyLogin('gerante@test.local', 'un-vrai-mot-de-passe')).not.toBeNull();
    expect(await verifyLogin('gerante@test.local', 'court')).toBeNull();
    expect(await listProducts()).toHaveLength(25); // not seeded a second time
  });

  it('uses the documented local account when nothing is configured (PGlite only)', async () => {
    delete process.env.DATABASE_URL;
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_PASSWORD;
    process.env.NAIT_PGLITE_DIR = join(tempDir, 'local');
    await getDb();
    expect(await verifyLogin('admin@maisonnait.ma', 'nait-local-2026')).toMatchObject({ role: 'owner' });
  });
});

describe('on Vercel', () => {
  it('refuses to fall back to a local database when DATABASE_URL is missing', async () => {
    delete process.env.DATABASE_URL;
    process.env.VERCEL = '1';
    process.env.NAIT_PGLITE_DIR = join(tempDir, 'vercel');
    await expect(getDb()).rejects.toThrow(/DATABASE_URL is not set/);
    expect(existsSync(join(tempDir, 'vercel'))).toBe(false);
  });
});
