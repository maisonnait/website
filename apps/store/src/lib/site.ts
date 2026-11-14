import type { Metadata } from 'next';
import { DEFAULT_LOCALE, LOCALES, LOCALE_INFO, type Locale } from '@/i18n/config';

/** Public address of the shop, without trailing slash. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');

export const BRAND = 'Maison N’Ait';

/** Files supplied by the brand kit in apps/store/public. */
export const OG_IMAGE = '/og.jpg';
export const ICONS: Metadata['icons'] = {
  icon: [
    { url: '/favicon.ico', sizes: '48x48' },
    { url: '/favicon.svg', type: 'image/svg+xml' },
  ],
  apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
};
export const MANIFEST = '/site.webmanifest';

/** localePath('ar', '/collections') -> '/ar/collections'; localePath('ar') -> '/ar' */
export function localePath(lang: Locale, path = ''): string {
  return `/${lang}${path === '/' ? '' : path}`;
}

/** hreflang alternates for a path written without its language ('/collections'). */
export function alternatesFor(lang: Locale, path = ''): NonNullable<Metadata['alternates']> {
  const languages: Record<string, string> = {};
  for (const locale of LOCALES) languages[locale] = localePath(locale, path);
  languages['x-default'] = localePath(DEFAULT_LOCALE, path);
  return { canonical: localePath(lang, path), languages };
}

/**
 * Metadata of one page: title, description, canonical, hreflang and Open Graph.
 * Open Graph is not merged between layouts and pages, so it is written whole every time.
 */
export function pageMetadata(options: {
  lang: Locale;
  /** Path without the language, '' for the home page. */
  path?: string;
  title?: string;
  description: string;
  /** false for cart, checkout, confirmation and tracking. */
  index?: boolean;
  image?: string | null;
}): Metadata {
  const { lang, path = '', title, description, index = true, image } = options;
  const fullTitle = title ? `${title} | ${BRAND}` : undefined;
  return {
    ...(title ? { title } : {}),
    description,
    alternates: alternatesFor(lang, path),
    robots: index ? undefined : { index: false, follow: false },
    openGraph: {
      type: 'website',
      siteName: BRAND,
      locale: LOCALE_INFO[lang].og,
      url: localePath(lang, path),
      ...(fullTitle ? { title: fullTitle } : {}),
      description,
      images: [{ url: image || OG_IMAGE }],
    },
    twitter: {
      card: 'summary_large_image',
      ...(fullTitle ? { title: fullTitle } : {}),
      description,
      images: [image || OG_IMAGE],
    },
  };
}
