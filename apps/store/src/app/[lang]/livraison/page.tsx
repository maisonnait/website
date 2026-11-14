import type { Metadata } from 'next';
import Link from 'next/link';

import { Policy, PolicySection } from '@/components/Policy';
import { pageContext } from '@/lib/page';
import { localePath, pageMetadata } from '@/lib/site';

/*
 * TO BE VALIDATED BY THE HOUSE before going live: this page states the delivery and payment
 * terms as they were given for the launch (free delivery, usually 1 to 3 working days, payment
 * on delivery). The wording lives in src/i18n/<lang>.json under the keys ship.*.
 */

export async function generateMetadata({ params }: PageProps<'/[lang]/livraison'>): Promise<Metadata> {
  const { lang, t } = await pageContext(params);
  return pageMetadata({ lang, path: '/livraison', title: t('foot.shipping'), description: `${t('ship.p1')} ${t('ship.p2')}` });
}

export default async function Page({ params }: PageProps<'/[lang]/livraison'>) {
  const { lang, t } = await pageContext(params);
  return (
    <Policy title={t('foot.shipping')} lead={t('ship.lead')}>
      <PolicySection title={t('ship.h1')}>
        <p>{t('ship.p1')}</p>
      </PolicySection>
      <PolicySection title={t('ship.h2')}>
        <p>{t('ship.p2')}</p>
      </PolicySection>
      <PolicySection title={t('ship.h3')}>
        <p>{t('ship.p3')}</p>
      </PolicySection>
      <PolicySection id="paiement" title={t('foot.pay')}>
        <p>{t('ship.p4')}</p>
      </PolicySection>
      <p className="actions">
        <Link className="tlink" href={localePath(lang, '/retours')}>
          {t('foot.returns')}
        </Link>
        <Link className="tlink" href={localePath(lang, '/suivi')}>
          {t('nav.track')}
        </Link>
      </p>
    </Policy>
  );
}
