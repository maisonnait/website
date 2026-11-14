import type { Metadata } from 'next';
import Link from 'next/link';

import { Policy } from '@/components/Policy';
import { getSettings } from '@/lib/data';
import { prettyPhone, telHref, whatsappHref } from '@/lib/format';
import { pageContext } from '@/lib/page';
import { localePath, pageMetadata } from '@/lib/site';

/*
 * TO BE VALIDATED BY THE HOUSE before going live. No form on purpose: the page shows the
 * phone (and the WhatsApp number, when there is one) entered in the back office settings.
 */

// The numbers come from the shop settings.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps<'/[lang]/contact'>): Promise<Metadata> {
  const { lang, t } = await pageContext(params);
  return pageMetadata({ lang, path: '/contact', title: t('foot.contact'), description: t('contact.lead') });
}

export default async function Page({ params }: PageProps<'/[lang]/contact'>) {
  const { lang, t } = await pageContext(params);
  const settings = await getSettings();
  const phone = settings.shopPhone.trim();
  const whatsapp = settings.whatsapp.trim();

  return (
    <Policy title={t('foot.contact')} lead={t('contact.lead')}>
      {phone ? (
        <p className="contact__phone">
          <span className="contact__label">{t('co.phone')}</span>
          <a href={telHref(phone)} dir="ltr">
            {prettyPhone(phone)}
          </a>
        </p>
      ) : (
        <p className="contact__soon">{t('contact.soon')}</p>
      )}
      <p className="actions">
        {phone ? (
          <a className="btn" href={telHref(phone)}>
            {t('contact.call')}
          </a>
        ) : null}
        {whatsapp ? (
          <a className="tlink" href={whatsappHref(whatsapp)} rel="noopener noreferrer" target="_blank">
            {t('contact.whatsapp')}
          </a>
        ) : null}
      </p>
      <p className="contact__order">{t('contact.order')}</p>
      <p className="actions">
        <Link className="tlink" href={localePath(lang, '/suivi')}>
          {t('nav.track')}
        </Link>
        <Link className="tlink" href={localePath(lang, '/faq')}>
          {t('foot.faq')}
        </Link>
      </p>
    </Policy>
  );
}
