import type { Metadata } from 'next';
import Link from 'next/link';

import { Policy, PolicySection } from '@/components/Policy';
import { pageContext } from '@/lib/page';
import { localePath, pageMetadata } from '@/lib/site';

/*
 * TO BE VALIDATED BY THE HOUSE before going live: return within 3 days and exchange within
 * 7 days of purchase are the only terms known at launch. The precise conditions (state of the
 * bottle, who pays the return, refund method) are NOT written here: the house must supply them.
 * The wording lives in src/i18n/<lang>.json under the keys ret.*.
 */

export async function generateMetadata({ params }: PageProps<'/[lang]/retours'>): Promise<Metadata> {
  const { lang, t } = await pageContext(params);
  return pageMetadata({ lang, path: '/retours', title: t('foot.returns'), description: t('ch5.returns') });
}

export default async function Page({ params }: PageProps<'/[lang]/retours'>) {
  const { lang, t } = await pageContext(params);
  return (
    <Policy title={t('foot.returns')} lead={t('ret.lead')}>
      <PolicySection title={t('ret.h1')}>
        <p>{t('ret.p1')}</p>
      </PolicySection>
      <PolicySection title={t('ret.h2')}>
        <p>{t('ret.p2')}</p>
      </PolicySection>
      <PolicySection title={t('ret.h3')}>
        <p>{t('ret.p3')}</p>
      </PolicySection>
      <p className="actions">
        <Link className="btn" href={localePath(lang, '/contact')}>
          {t('foot.contact')}
        </Link>
        <Link className="tlink" href={localePath(lang, '/suivi')}>
          {t('nav.track')}
        </Link>
      </p>
    </Policy>
  );
}
