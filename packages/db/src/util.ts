/** Small helpers shared by the query modules. No public API here. */
import { DomainError } from './errors';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

/** Throws INVALID_INPUT unless `value` is a uuid. */
export function requireUuid(value: unknown, field: string): string {
  if (!isUuid(value)) throw new DomainError('INVALID_INPUT', `${field} is not a valid id`, { field });
  return value.toLowerCase();
}

/** Optional reference to a user: undefined, null and '' mean "nobody". */
export function optionalUuid(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  return requireUuid(value, field);
}

/** Trims and collapses whitespace; throws INVALID_INPUT when empty or too long. */
export function requireText(value: unknown, field: string, maxLength: number): string {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  if (text.length === 0) throw new DomainError('INVALID_INPUT', `${field} is required`, { field });
  if (text.length > maxLength) {
    throw new DomainError('INVALID_INPUT', `${field} is too long (maximum ${maxLength} characters)`, { field });
  }
  return text;
}

/** Free text that may be absent: returns null when empty. Keeps line breaks. */
export function optionalText(value: unknown, field: string, maxLength: number): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new DomainError('INVALID_INPUT', `${field} must be text`, { field });
  const text = value.replace(/\r\n?/g, '\n').trim();
  if (text.length === 0) return null;
  if (text.length > maxLength) {
    throw new DomainError('INVALID_INPUT', `${field} is too long (maximum ${maxLength} characters)`, { field });
  }
  return text;
}

export function requireInt(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new DomainError('INVALID_INPUT', `${field} must be a whole number between ${min} and ${max}`, { field });
  }
  return value;
}

/** Escapes the wildcards of a LIKE pattern (the escape character is the backslash, Postgres' default). */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Rows of a raw `db.execute()` result: postgres.js returns an array, PGlite an object with `rows`.
 */
export function rowsOf<T = Record<string, unknown>>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const rows = (result as { rows?: unknown } | null | undefined)?.rows;
  return Array.isArray(rows) ? (rows as T[]) : [];
}

/** Postgres error code (SQLSTATE) of a driver error, also when Drizzle wrapped it. */
export function sqlState(error: unknown): string | undefined {
  for (let current: unknown = error, depth = 0; current && depth < 5; depth += 1) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

export const UNIQUE_VIOLATION = '23505';

/** Highest price accepted for a variant, in MAD. Keeps every order total far below the integer limit. */
export const MAX_PRICE_MAD = 100_000;
