// Checks that every dictionary key used by a Client Component is part of the subset sent to
// the browser (CLIENT_PREFIXES in src/i18n/index.ts), and that every key used anywhere exists.
// Run: node scripts/check-client-keys.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../src/', import.meta.url));
const dict = JSON.parse(readFileSync(join(src, 'i18n/fr.json'), 'utf8'));
const index = readFileSync(join(src, 'i18n/index.ts'), 'utf8');
const prefixes = [...index.slice(index.indexOf('CLIENT_PREFIXES'), index.indexOf('] as const')).matchAll(/'([^']+)'/g)].map((m) => m[1]);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : /\.(tsx?|mjs)$/.test(name) ? [path] : [];
  });
}

let problems = 0;
for (const file of walk(src)) {
  const code = readFileSync(file, 'utf8');
  const client = /^'use client'/.test(code.trimStart());
  const keys = [
    ...[...code.matchAll(/\bt\(\s*'([^']+)'/g)].map((m) => m[1]),
    ...[...code.matchAll(/\bt\(\s*`([^`$]+)\$\{/g)].map((m) => `${m[1]}*`),
    ...[...code.matchAll(/'((?:co|tr|st|cart|pdp|stock|fmt|nav|foot|ty|faq|ship|ret|contact)\.[\w.]+)'/g)].map((m) => m[1]),
  ];
  for (const key of new Set(keys)) {
    const stem = key.replace(/\*$/, '');
    const known = key.endsWith('*') ? Object.keys(dict).some((k) => k.startsWith(stem)) : key in dict;
    if (!known) {
      console.error(`${file.replace(src, '')}: unknown key "${key}"`);
      problems++;
    }
    if (client && !prefixes.some((prefix) => stem === prefix || stem.startsWith(prefix))) {
      console.error(`${file.replace(src, '')}: "${key}" is used in the browser but not sent to it`);
      problems++;
    }
  }
}
console.log(problems ? `${problems} problem(s)` : 'ok: client keys are covered');
process.exit(problems ? 1 : 0);
