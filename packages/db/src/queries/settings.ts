/** Shop settings (key / jsonb value). Unknown keys are ignored, missing keys take their default. */
import { getDb } from '../client';
import type { Db } from '../client';
import { DomainError } from '../errors';
import { normalizePhone } from '../phone';
import { settings } from '../schema';
import { DEFAULT_SETTINGS } from '../seed';
import type { SettingKey, Settings } from '../types';

const KEYS = Object.keys(DEFAULT_SETTINGS) as SettingKey[];

export async function readSettings(db: Db): Promise<Settings> {
  const rows = await db.select({ key: settings.key, value: settings.value }).from(settings);
  const stored = new Map(rows.map((row) => [row.key, row.value]));
  const result: Settings = { ...DEFAULT_SETTINGS };
  const target = result as unknown as Record<string, unknown>;
  for (const key of KEYS) {
    const value = stored.get(key);
    // A stored value of the wrong type is ignored rather than passed on to the apps.
    if (typeof value === typeof DEFAULT_SETTINGS[key]) target[key] = value;
  }
  return result;
}

/** All settings, typed, with defaults for anything not stored yet. */
export async function getSettings(): Promise<Settings> {
  return readSettings(await getDb());
}

function clean<K extends SettingKey>(key: K, value: unknown): Settings[K] {
  const fail = (message: string): never => {
    throw new DomainError('INVALID_INPUT', message, { field: key });
  };
  switch (key) {
    case 'shippingMad': {
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 10_000) {
        return fail('shippingMad must be a whole number of dirhams between 0 and 10000');
      }
      return value as Settings[K];
    }
    case 'shopPhone':
    case 'whatsapp': {
      if (typeof value !== 'string') return fail(`${key} must be text`);
      const text = value.trim();
      if (text === '') return '' as Settings[K];
      // Moroccan numbers are stored normalised (+212...); anything else is kept as typed.
      const normalised = normalizePhone(text);
      if (!normalised && !/^\+?[0-9][0-9 .\-()]{5,24}$/.test(text)) return fail(`${key} is not a phone number`);
      return (normalised ?? text) as Settings[K];
    }
    case 'deliveryDelay':
    case 'announcement': {
      if (typeof value !== 'string') return fail(`${key} must be text`);
      const text = value.replace(/\s+/g, ' ').trim();
      if (text.length > 300) return fail(`${key} is too long (maximum 300 characters)`);
      return text as Settings[K];
    }
    default:
      return fail(`unknown setting "${String(key)}"`);
  }
}

/** Changes one setting and returns all of them. */
export async function setSetting<K extends SettingKey>(key: K, value: Settings[K]): Promise<Settings> {
  if (!KEYS.includes(key)) throw new DomainError('INVALID_INPUT', `unknown setting "${String(key)}"`, { field: 'key' });
  const cleaned = clean(key, value);
  const db = await getDb();
  await db
    .insert(settings)
    .values({ key, value: cleaned })
    .onConflictDoUpdate({ target: settings.key, set: { value: cleaned, updatedAt: new Date() } });
  return readSettings(db);
}
