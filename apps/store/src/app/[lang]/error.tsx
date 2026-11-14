'use client';

import { useEffect } from 'react';
import { useI18n } from '@/i18n/client';

/** Shown when a page fails to render (for instance when the database cannot be reached). */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="wrap page page--narrow">
      <header className="page__head">
        <h1>{t('err.title')}</h1>
        <p className="lede">{t('err.text')}</p>
      </header>
      <p className="actions">
        <button className="btn" type="button" onClick={reset}>
          {t('err.retry')}
        </button>
      </p>
    </div>
  );
}
