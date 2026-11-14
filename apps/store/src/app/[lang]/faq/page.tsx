import type { Metadata } from 'next';
import Link from 'next/link';

import { Policy } from '@/components/Policy';
import type { MessageKey } from '@/i18n';
import { pageContext } from '@/lib/page';
import { localePath, pageMetadata } from '@/lib/site';

/*
 * TO BE VALIDATED BY THE HOUSE before going live. Every answer reuses a text shown elsewhere
 * on the site (delivery, payment, returns, the "Style" note), so the pages cannot disagree.
 */
const QUESTIONS: { q: MessageKey; a: MessageKey[]; link?: { path: string; label: MessageKey } }[] = [
  { q: 'faq.q1', a: ['faq.a1'] },
  { q: 'faq.q2', a: ['ship.p4'] },
  { q: 'faq.q3', a: ['ship.p1', 'ship.p2'], link: { path: '/livraison', label: 'foot.shipping' } },
  { q: 'faq.q4', a: ['ch4.note'] },
  { q: 'faq.q5', a: ['ch3.sizes'] },
  { q: 'faq.q6', a: ['ch5.returns', 'ret.p3'], link: { path: '/retours', label: 'foot.returns' } },
  { q: 'faq.q7', a: ['faq.a7'], link: { path: '/suivi', label: 'nav.track' } },
];

export async function generateMetadata({ params }: PageProps<'/[lang]/faq'>): Promise<Metadata> {
  const { lang, t } = await pageContext(params);
  return pageMetadata({ lang, path: '/faq', title: t('foot.faq'), description: `${t('faq.q1')} ${t('faq.q2')} ${t('faq.q3')}` });
}

export default async function Page({ params }: PageProps<'/[lang]/faq'>) {
  const { lang, t } = await pageContext(params);
  return (
    <Policy title={t('foot.faq')}>
      <dl className="faq">
        {QUESTIONS.map(({ q, a, link }) => (
          <div className="faq__item" key={q}>
            <dt>{t(q)}</dt>
            <dd>
              <p>{a.map((key) => t(key)).join(' ')}</p>
              {link ? (
                <Link className="tlink" href={localePath(lang, link.path)}>
                  {t(link.label)}
                </Link>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
      <p className="actions">
        <Link className="btn" href={localePath(lang, '/contact')}>
          {t('foot.contact')}
        </Link>
      </p>
    </Policy>
  );
}
