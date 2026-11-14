import type { Metadata } from 'next';

import { TrackForm } from '@/components/TrackForm';
import { pageContext } from '@/lib/page';
import { pageMetadata } from '@/lib/site';

export async function generateMetadata({ params }: PageProps<'/[lang]/suivi'>): Promise<Metadata> {
  const { lang, t } = await pageContext(params);
  return pageMetadata({ lang, path: '/suivi', title: t('nav.track'), description: t('tr.intro'), index: false });
}

/** Order tracking: /[lang]/suivi (the confirmation page links here with ?n=NA-000123). */
export default async function Page({ params, searchParams }: PageProps<'/[lang]/suivi'>) {
  const { t } = await pageContext(params);
  const { n } = await searchParams;
  const raw = Array.isArray(n) ? n[0] : n;
  const initial = raw && /^NA-\d{1,12}$/i.test(raw) ? raw.toUpperCase() : '';

  return (
    <div className="wrap page page--narrow">
      <header className="page__head">
        <h1>{t('nav.track')}</h1>
        <p className="lede">{t('tr.intro')}</p>
      </header>
      <TrackForm initialNumber={initial} />
    </div>
  );
}
