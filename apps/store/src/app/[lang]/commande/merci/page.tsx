import type { Metadata } from 'next';
import Link from 'next/link';

import { pageContext } from '@/lib/page';
import { localePath, pageMetadata } from '@/lib/site';

export async function generateMetadata({ params }: PageProps<'/[lang]/commande/merci'>): Promise<Metadata> {
  const { lang, t } = await pageContext(params);
  return pageMetadata({ lang, path: '/commande/merci', title: t('ty.title'), description: t('ty.lead'), index: false });
}

/** Confirmation: /[lang]/commande/merci?n=NA-000123 */
export default async function Page({ params, searchParams }: PageProps<'/[lang]/commande/merci'>) {
  const { lang, t } = await pageContext(params);
  const { n } = await searchParams;
  const raw = Array.isArray(n) ? n[0] : n;
  const number = raw && /^NA-\d{4,12}$/.test(raw) ? raw : null;

  if (!number) {
    return (
      <div className="wrap page page--narrow">
        <header className="page__head">
          <h1>{t('ty.title')}</h1>
          <p className="lede">{t('ty.none')}</p>
        </header>
        <p className="actions">
          <Link className="btn" href={localePath(lang, '/suivi')}>
            {t('nav.track')}
          </Link>
          <Link className="tlink" href={localePath(lang, '/collections')}>
            {t('nav.allCollections')}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="wrap page page--narrow">
      <header className="page__head">
        <h1>{t('ty.title')}</h1>
        <p className="lede">{t('ty.lead')}</p>
      </header>

      <p className="ordernumber">
        <span className="ordernumber__label">{t('ty.number')}</span>
        <strong className="ordernumber__value" dir="ltr">
          {number}
        </strong>
      </p>

      <section className="next" aria-labelledby="next-title">
        <h2 id="next-title">{t('ty.next')}</h2>
        <ol className="steps steps--three">
          {(['s1', 's2', 's3'] as const).map((key, index) => (
            <li className="step" key={key}>
              <span className="step__n" aria-hidden="true">
                {index + 1}
              </span>
              <h3 className="step__t">{t(`ty.${key}.t`)}</h3>
              <p className="step__d">{t(`ty.${key}.d`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <p className="actions">
        <Link className="btn" href={`${localePath(lang, '/suivi')}?n=${encodeURIComponent(number)}`}>
          {t('ty.track')}
        </Link>
        <Link className="tlink" href={localePath(lang, '/collections')}>
          {t('cart.continue')}
        </Link>
      </p>
    </div>
  );
}
