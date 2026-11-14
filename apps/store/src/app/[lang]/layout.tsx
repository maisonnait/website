import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';

// Self-hosted fonts (no request to Google): only the subsets and weights the shop uses.
import '@fontsource/josefin-sans/latin-300.css';
import '@fontsource/josefin-sans/latin-400.css';
import '@fontsource/josefin-sans/latin-600.css';
import '@fontsource/spectral/latin-300.css';
import '@fontsource/spectral/latin-400.css';
import '@fontsource/spectral/latin-400-italic.css';
import '@fontsource/reem-kufi/arabic-400.css';
import '@fontsource/reem-kufi/arabic-600.css';
import '@fontsource/tajawal/arabic-400.css';
import '@fontsource/tajawal/arabic-500.css';
import '@fontsource/tajawal/arabic-700.css';
import '@fontsource/noto-naskh-arabic/arabic-400.css';
import '@fontsource/noto-naskh-arabic/arabic-600.css';
import '@fontsource/noto-sans-tifinagh/tifinagh-400.css';

import '@/styles/tokens.css';
import '@/styles/base.css';
import '@/styles/chrome.css';
import '@/styles/shop.css';

import { CartProvider } from '@/cart/CartProvider';
import { CartDrawer } from '@/components/CartDrawer';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { SvgDefs } from '@/components/SvgDefs';
import { ThemeScript } from '@/components/ThemeScript';
import { clientMessages, translator } from '@/i18n';
import { I18nProvider } from '@/i18n/client';
import { LOCALES, dirOf, isLocale } from '@/i18n/config';
import { BRAND, ICONS, MANIFEST, SITE_URL, pageMetadata } from '@/lib/site';
import { THEME_COLOR } from '@/lib/theme-script';

/** The five languages are known in advance: pages without live data are prerendered for each. */
export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<'/[lang]'>): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = translator(lang);
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t('meta.title'), template: `%s | ${BRAND}` },
    applicationName: BRAND,
    icons: ICONS,
    manifest: MANIFEST,
    formatDetection: { telephone: false },
    ...pageMetadata({ lang, description: t('meta.desc') }),
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: THEME_COLOR.light,
};

export default async function RootLayout({ children, params }: LayoutProps<'/[lang]'>) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = translator(lang);

  return (
    // data-scroll-behavior: page changes jump to the top at once; in-page anchors still scroll smoothly.
    <html lang={lang} dir={dirOf(lang)} data-mode="light" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <I18nProvider lang={lang} messages={clientMessages(lang)}>
          <CartProvider>
            <a className="skip" href="#main">
              {t('skip')}
            </a>
            <SvgDefs />
            <Header />
            <main id="main" tabIndex={-1}>
              {children}
            </main>
            <Footer lang={lang} t={t} />
            <CartDrawer />
          </CartProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
