import type { Metadata } from 'next';
import Link from 'next/link';

import { Announcement } from '@/components/Announcement';
import { CollectionNav } from '@/components/CollectionNav';
import { ProductCard } from '@/components/ProductCard';
import { StyleNote } from '@/components/StyleNote';
import { collectionDescription, collectionName, getSettings, listCollections, listProducts } from '@/lib/data';
import { pageContext } from '@/lib/page';
import { localePath, pageMetadata } from '@/lib/site';

// Stock and prices are live: rendered on request.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps<'/[lang]/collections'>): Promise<Metadata> {
  const { lang, t } = await pageContext(params);
  return pageMetadata({ lang, path: '/collections', title: t('ch4.title'), description: t('ch4.intro') });
}

export default async function CollectionsPage({ params }: PageProps<'/[lang]/collections'>) {
  const { lang, t } = await pageContext(params);
  const [collections, products, settings] = await Promise.all([listCollections(), listProducts(), getSettings()]);

  return (
    <>
      <Announcement text={settings.announcement} />
      <div className="wrap page">
        <header className="page__head">
          <h1>{t('ch4.title')}</h1>
          <p className="lede">{t('ch4.intro')}</p>
        </header>
        <CollectionNav collections={collections} current={null} lang={lang} t={t} />

        {collections.map((collection, index) => {
          const items = products.filter((product) => product.collectionSlug === collection.slug);
          const name = collectionName(collection, lang, t);
          return (
            <section className="shelf" key={collection.slug} aria-labelledby={`shelf-${collection.slug}`}>
              <div className="shelf__head">
                <h2 id={`shelf-${collection.slug}`}>
                  <Link href={localePath(lang, `/collections/${collection.slug}`)}>{name}</Link>
                </h2>
                <p>{collectionDescription(collection, lang, t)}</p>
              </div>
              {items.length > 0 ? (
                <div className="grid">
                  {items.map((product, position) => (
                    <ProductCard key={product.id} product={product} lang={lang} t={t} eager={index === 0 && position < 4} />
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}

        <StyleNote t={t} />
      </div>
    </>
  );
}
