import Link from 'next/link';
import type { Collection } from '@nait/db';
import type { Locale } from '@/i18n/config';
import type { Translate } from '@/i18n';
import { collectionName } from '@/lib/data';
import { localePath } from '@/lib/site';

/** The collections as a row of links, with the current one marked. `current` is a slug, or null for "all". */
export function CollectionNav({
  collections,
  current,
  lang,
  t,
}: {
  collections: Collection[];
  current: string | null;
  lang: Locale;
  t: Translate;
}) {
  return (
    <nav className="tabs" aria-label={t('col.filter')}>
      <Link className="tab" href={localePath(lang, '/collections')} aria-current={current === null ? 'page' : undefined}>
        <span className="tab__name">{t('col.all')}</span>
      </Link>
      {collections.map((collection) => (
        <Link
          className="tab"
          key={collection.slug}
          href={localePath(lang, `/collections/${collection.slug}`)}
          aria-current={current === collection.slug ? 'page' : undefined}
        >
          <span className="tab__name">{collectionName(collection, lang, t)}</span>
          <span className="tab__n">
            {collection.productCount > 0 ? t('fmt.families', { n: collection.productCount }) : t('card.soon')}
          </span>
        </Link>
      ))}
    </nav>
  );
}
