import type { Metadata } from 'next';

import { CheckoutForm } from '@/components/CheckoutForm';
import { getSettings } from '@/lib/data';
import { pageContext } from '@/lib/page';
import { pageMetadata } from '@/lib/site';

// The delivery fee comes from the shop settings.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps<'/[lang]/commande'>): Promise<Metadata> {
  const { lang, t } = await pageContext(params);
  return pageMetadata({ lang, path: '/commande', title: t('co.title'), description: t('co.intro'), index: false });
}

export default async function Page({ params }: PageProps<'/[lang]/commande'>) {
  const { t } = await pageContext(params);
  const settings = await getSettings();
  return (
    <div className="wrap page">
      <header className="page__head">
        <h1>{t('co.title')}</h1>
        <p className="lede">{t('co.intro')}</p>
      </header>
      <CheckoutForm shipping={settings.shippingMad} />
    </div>
  );
}
