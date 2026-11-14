import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Announcement } from '@/components/Announcement';
import { CollectionNav } from '@/components/CollectionNav';
import { ProductCard } from '@/components/ProductCard';
import { StyleNote } from '@/components/StyleNote';
import { collectionDescription, collectionName, getSettings, listCollections, listProducts } from '@/lib/data';
import { pageContext } from '@/lib/page';
import { localePath, pageMetadata } from '@/lib/site';
import { FlaconPlate } from '@/components/FlaconPlate';

// Stock and prices are live: rendered on request.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps<'/[lang]/collections/[slug]'>): Promise<Metadata> {
  const { lang, t } = await pageContext(params);
  const { slug } = await params;
  const collection = (await listCollections()).find((candidate) => candidate.slug === slug);
  if (!collection) return {};
  return pageMetadata({
    lang,
    path: `/collections/${collection.slug}`,
    title: collectionName(collection, lang, t),
    description: collectionDescription(collection, lang, t) || t('ch4.intro'),
  });
}

export default async function CollectionPage({ params }: PageProps<'/[lang]/collections/[slug]'>) {
  const { lang, t } = await pageContext(params);
  const { slug } = await params;
  const collections = await listCollections();
  const collection = collections.find((candidate) => candidate.slug === slug);
  if (!collection) notFound();

  const [products, settings] = await Promise.all([listProducts(collection.slug), getSettings()]);
  const name = collectionName(collection, lang, t);

  return (
    <>
      <Announcement text={settings.announcement} />
      <div className="wrap page">
        <header className="page__head">
          <h1>{name}</h1>
          <p className="lede">{products.length > 0 ? collectionDescription(collection, lang, t) : t('col.soon')}</p>
        </header>
        <CollectionNav collections={collections} current={collection.slug} lang={lang} t={t} />

        {products.length > 0 ? (
          <>
            <div className="grid grid--first">
              {products.map((product, position) => (
                <ProductCard key={product.id} product={product} lang={lang} t={t} eager={position < 4} />
              ))}
            </div>
            <StyleNote t={t} />
          </>
        ) : (
          <div className="soon">
            <span className="soon__plate">
              <FlaconPlate collection={collection.slug} className="soon__flacon" />
            </span>
            <Link className="btn" href={localePath(lang, '/collections')}>
              {t('nav.allCollections')}
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
