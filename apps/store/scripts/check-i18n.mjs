// Checks that the five dictionaries have the same keys and the same {placeholders}.
// Run: pnpm --filter store i18n:check
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const LANGS = ['fr', 'en', 'ar', 'ary', 'zgh'];
const dir = fileURLToPath(new URL('../src/i18n/', import.meta.url));
const dicts = Object.fromEntries(LANGS.map((lang) => [lang, JSON.parse(readFileSync(`${dir}${lang}.json`, 'utf8'))]));
const reference = Object.keys(dicts.fr);
const placeholders = (text) => (text.match(/\{\w+\}/g) ?? []).sort().join(',');

let problems = 0;
for (const lang of LANGS.slice(1)) {
  const keys = new Set(Object.keys(dicts[lang]));
  for (const key of reference) {
    if (!keys.has(key)) {
      console.error(`${lang}: missing "${key}"`);
      problems++;
    } else if (!String(dicts[lang][key]).trim()) {
      console.error(`${lang}: empty "${key}"`);
      problems++;
    } else if (placeholders(dicts[lang][key]) !== placeholders(dicts.fr[key])) {
      console.error(`${lang}: placeholders of "${key}" differ from fr`);
      problems++;
    }
  }
  for (const key of keys) {
    if (!(key in dicts.fr)) {
      console.error(`${lang}: unknown key "${key}"`);
      problems++;
    }
  }
}
console.log(problems ? `${problems} problem(s)` : `ok: ${reference.length} keys in ${LANGS.length} languages`);
process.exit(problems ? 1 : 0);
