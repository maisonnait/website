/**
 * Languages of the shop. This file has no dependency: it is imported by the proxy,
 * by Server Components and by Client Components alike.
 */
export const LOCALES = ['fr', 'en', 'ar', 'ary', 'zgh'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'fr';

/** Cookie written when the visitor picks a language; read by the proxy for the "/" redirect. */
export const LOCALE_COOKIE = 'nait-lang';

export type Direction = 'ltr' | 'rtl';

export const LOCALE_INFO: Record<
  Locale,
  {
    dir: Direction;
    /** Name of the language, written in the language itself. */
    name: string;
    /** Open Graph locale. */
    og: string;
    /** Cut of the film: Darija and Tamazight are read in Arabic. */
    film: 'fr' | 'en' | 'ar';
  }
> = {
  fr: { dir: 'ltr', name: 'Français', og: 'fr_MA', film: 'fr' },
  en: { dir: 'ltr', name: 'English', og: 'en_GB', film: 'en' },
  ar: { dir: 'rtl', name: 'العربية', og: 'ar_MA', film: 'ar' },
  ary: { dir: 'rtl', name: 'الدارجة', og: 'ar_MA', film: 'ar' },
  zgh: { dir: 'ltr', name: 'ⵜⴰⵎⴰⵣⵉⵖⵜ', og: 'zgh_MA', film: 'ar' },
};

/** Order of the language menu (the three languages of the country first). */
export const MENU_ORDER: readonly Locale[] = ['ary', 'ar', 'zgh', 'fr', 'en'];

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export function dirOf(lang: Locale): Direction {
  return LOCALE_INFO[lang].dir;
}

/** Tamazight is announced by several language tags. */
const TAMAZIGHT = new Set(['zgh', 'tzm', 'ber', 'shi', 'rif', 'kab']);

/**
 * Picks the shop language from an Accept-Language header. Arabic browsers get Modern
 * Standard Arabic; Darija is only chosen when the browser asks for it by name ('ary').
 */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  const wanted = header
    .split(',')
    .map((part, index) => {
      const [tag = '', ...params] = part.trim().split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      const weight = q ? Number.parseFloat(q.slice(2)) : 1;
      return { tag: tag.toLowerCase(), weight: Number.isFinite(weight) ? weight : 0, index };
    })
    .filter((entry) => entry.tag && entry.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index);

  for (const { tag } of wanted) {
    const base = tag.split('-')[0] ?? '';
    if (base === 'ary') return 'ary';
    if (base === 'ar') return 'ar';
    if (TAMAZIGHT.has(base)) return 'zgh';
    if (base === 'en') return 'en';
    if (base === 'fr') return 'fr';
  }
  return DEFAULT_LOCALE;
}
