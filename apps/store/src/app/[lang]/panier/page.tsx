import type { Metadata } from 'next';

import { CartPage } from '@/components/CartPage';
import { getSettings } from '@/lib/data';
import { pageContext } from '@/lib/page';
import { pageMetadata } from '@/lib/site';

// The delivery fee comes from the shop settings.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps<'/[lang]/panier'>): Promise<Metadata> {
  const { lang, t } = await pageContext(params);
  return pageMetadata({ lang, path: '/panier', title: t('cart.title'), description: t('cart.cod'), index: false });
}

export default async function Page({ params }: PageProps<'/[lang]/panier'>) {
  const { t } = await pageContext(params);
  const settings = await getSettings();
  return (
    <div className="wrap page">
      <header className="page__head">
        <h1>{t('cart.title')}</h1>
      </header>
      <CartPage shipping={settings.shippingMad} />
    </div>
  );
}
