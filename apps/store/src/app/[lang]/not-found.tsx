import { lang as currentLang } from 'next/root-params';

import { translator } from '@/i18n';
import { DEFAULT_LOCALE, isLocale } from '@/i18n/config';
import { localePath } from '@/lib/site';

/** Shown by notFound() anywhere under /[lang] (unknown product, unknown address...). */
export default async function NotFound() {
  const value = await currentLang();
  const lang = isLocale(value) ? value : DEFAULT_LOCALE;
  const t = translator(lang);
  return (
    <div className="wrap page page--narrow">
      <header className="page__head">
        <h1>{t('nf.title')}</h1>
        <p className="lede">{t('nf.text')}</p>
      </header>
      <p className="actions">
        <a className="btn" href={localePath(lang)}>
          {t('nf.cta')}
        </a>
        <a className="tlink" href={localePath(lang, '/collections')}>
          {t('nav.allCollections')}
        </a>
      </p>
    </div>
  );
}
