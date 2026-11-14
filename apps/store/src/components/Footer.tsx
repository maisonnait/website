import Link from 'next/link';
import { Logo } from '@/brand/Logo';
import type { Locale } from '@/i18n/config';
import type { Translate } from '@/i18n';
import { COLLECTION_SLUGS } from '@/lib/collections';
import { localePath } from '@/lib/site';
import { LanguageLinks } from './LanguageLinks';

export function Footer({ lang, t }: { lang: Locale; t: Translate }) {
  const to = (path = '') => localePath(lang, path);
  return (
    <footer className="foot onyx">
      <div className="wrap">
        <div className="foot__grid">
          <div className="foot__brand">
            <Logo className="foot__logo" title={t('brand')} />
            <p className="foot__tag">{t('foot.tag')}</p>
          </div>
          <nav className="foot__col" aria-labelledby="foot-collections">
            <h2 id="foot-collections">{t('foot.col1')}</h2>
            {COLLECTION_SLUGS.map((slug) => (
              <Link key={slug} href={to(`/collections/${slug}`)}>
                {t(`tab.${slug}`)}
              </Link>
            ))}
            <Link href={to('/collections')}>{t('nav.allCollections')}</Link>
          </nav>
          <nav className="foot__col" aria-labelledby="foot-shop">
            <h2 id="foot-shop">{t('foot.col2')}</h2>
            <Link href={to('/suivi')}>{t('nav.track')}</Link>
            <Link href={to('/livraison')}>{t('foot.shipping')}</Link>
            <Link href={`${to('/livraison')}#paiement`}>{t('foot.pay')}</Link>
            <Link href={to('/retours')}>{t('foot.returns')}</Link>
            <Link href={to('/faq')}>{t('foot.faq')}</Link>
            <Link href={to('/contact')}>{t('foot.contact')}</Link>
          </nav>
          <nav className="foot__col" aria-labelledby="foot-lang">
            <h2 id="foot-lang">{t('foot.col3')}</h2>
            <LanguageLinks />
          </nav>
        </div>
        <p className="foot__legal">{t('foot.legal')}</p>
      </div>
    </footer>
  );
}
