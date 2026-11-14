import type { MetadataRoute } from 'next';
import { DEFAULT_LOCALE, LOCALES } from '@/i18n/config';
import { listCollections, listProducts } from '@/lib/data';
import { SITE_URL } from '@/lib/site';

// Lists the catalogue as it is now: generated on request, never at build time.
export const dynamic = 'force-dynamic';

const STATIC_PATHS = ['', '/collections', '/livraison', '/retours', '/faq', '/contact'];

function entry(path: string, priority: number, lastModified?: Date): MetadataRoute.Sitemap {
  const languages: Record<string, string> = {};
  for (const lang of LOCALES) languages[lang] = `${SITE_URL}/${lang}${path}`;
  languages['x-default'] = `${SITE_URL}/${DEFAULT_LOCALE}${path}`;
  return LOCALES.map((lang) => ({
    url: `${SITE_URL}/${lang}${path}`,
    ...(lastModified ? { lastModified } : {}),
    changeFrequency: 'weekly' as const,
    priority,
    alternates: { languages },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = STATIC_PATHS.flatMap((path) => entry(path, path === '' ? 1 : path === '/collections' ? 0.9 : 0.4));
  try {
    const [collections, products] = await Promise.all([listCollections(), listProducts()]);
    for (const collection of collections) entries.push(...entry(`/collections/${collection.slug}`, 0.8, collection.updatedAt));
    for (const product of products) entries.push(...entry(`/produits/${product.slug}`, 0.7, product.updatedAt));
  } catch (error) {
    // Without the database the fixed pages are still listed.
    console.error('[store] sitemap: catalogue unavailable', error);
  }
  return entries;
}
