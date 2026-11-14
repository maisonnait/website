import type { MetadataRoute } from 'next';
import { LOCALES } from '@/i18n/config';
import { SITE_URL } from '@/lib/site';

/** Cart, checkout and tracking are personal pages: kept out of search engines. */
export default function robots(): MetadataRoute.Robots {
  const privatePaths = LOCALES.flatMap((lang) => [`/${lang}/panier`, `/${lang}/commande`, `/${lang}/suivi`]);
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: privatePaths }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
