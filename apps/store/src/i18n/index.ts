/**
 * Dictionaries (server side). One flat JSON file per language in this folder; fr.json is the
 * reference: TypeScript refuses a language file that misses one of its keys.
 */
import 'server-only';

import ar from './ar.json';
import ary from './ary.json';
import en from './en.json';
import fr from './fr.json';
import zgh from './zgh.json';
import type { Locale } from './config';

export type MessageKey = keyof typeof fr;
export type Messages = Record<MessageKey, string>;
export type Vars = Record<string, string | number>;
export type Translate = (key: MessageKey, vars?: Vars) => string;

const DICTIONARIES: Record<Locale, Messages> = { fr, en, ar, ary, zgh };

export function getMessages(lang: Locale): Messages {
  return DICTIONARIES[lang];
}

/** Replaces {n}, {d}... by their values. */
export function fill(text: string, vars?: Vars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

export function translator(lang: Locale): Translate {
  const messages = DICTIONARIES[lang];
  return (key, vars) => fill(messages[key] ?? DICTIONARIES.fr[key] ?? key, vars);
}

/**
 * Strings sent to the browser for the interactive parts (header, cart, product picker,
 * checkout, tracking). Everything else stays on the server.
 */
const CLIENT_PREFIXES = [
  'brand',
  'skip',
  'lang.',
  'theme.',
  'nav.',
  'tab.',
  'foot.',
  'drawer.',
  'fmt.',
  'tag.',
  'stock.',
  'pdp.',
  'cart.',
  'co.',
  'tr.',
  'st.',
  'ty.number',
  'err.',
] as const;

export function clientMessages(lang: Locale): Partial<Messages> {
  const messages = DICTIONARIES[lang];
  const picked: Partial<Messages> = {};
  for (const key of Object.keys(messages) as MessageKey[]) {
    if (CLIENT_PREFIXES.some((prefix) => key === prefix || key.startsWith(prefix))) picked[key] = messages[key];
  }
  return picked;
}
