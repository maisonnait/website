/**
 * Password hashing with scrypt (node:crypto).
 * Stored format: scrypt$N=32768,r=8,p=3$<salt, base64url>$<hash, base64url>
 * The cost parameters are stored with each hash, so they can be raised later without
 * invalidating existing passwords.
 */
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const COST = { N: 32768, r: 8, p: 3 } as const;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const MAX_PASSWORD_LENGTH = 1024;
/** Upper bounds accepted when reading a stored hash (protects against absurd parameters). */
const MAX_COST = { N: 1 << 20, r: 32, p: 16 } as const;

function derive(password: string, salt: Buffer, cost: { N: number; r: number; p: number }, length: number) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password.normalize('NFKC'),
      salt,
      length,
      { N: cost.N, r: cost.r, p: cost.p, maxmem: 256 * cost.N * cost.r },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  if (typeof password !== 'string' || password.length === 0 || password.length > MAX_PASSWORD_LENGTH) {
    throw new TypeError('password must be a non-empty string');
  }
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(password, salt, COST, KEY_LENGTH);
  return `scrypt$N=${COST.N},r=${COST.r},p=${COST.p}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (typeof password !== 'string' || password.length === 0 || password.length > MAX_PASSWORD_LENGTH) return false;
  const match = /^scrypt\$N=(\d+),r=(\d+),p=(\d+)\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/.exec(stored);
  if (!match) return false;
  const cost = { N: Number(match[1]), r: Number(match[2]), p: Number(match[3]) };
  if (cost.N < 2 || cost.N > MAX_COST.N || (cost.N & (cost.N - 1)) !== 0) return false;
  if (cost.r < 1 || cost.r > MAX_COST.r || cost.p < 1 || cost.p > MAX_COST.p) return false;
  const salt = Buffer.from(match[4] ?? '', 'base64url');
  const expected = Buffer.from(match[5] ?? '', 'base64url');
  if (expected.length < 16) return false;
  const actual = await derive(password, salt, cost, expected.length);
  return timingSafeEqual(actual, expected);
}

/** A valid hash of a random password: lets `verifyLogin` spend the same time on unknown emails. */
let decoy: Promise<string> | undefined;
export function decoyHash(): Promise<string> {
  decoy ??= hashPassword(randomBytes(24).toString('base64url'));
  return decoy;
}
