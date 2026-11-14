import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Announcement } from '@/components/Announcement';
import { ProductBuy } from '@/components/ProductBuy';
import { ProductCard } from '@/components/ProductCard';
import { ProductPhoto } from '@/components/ProductPhoto';
import { StyleNote } from '@/components/StyleNote';
import { collectionName, getProduct, getSettings, listProducts, toPickerProduct } from '@/lib/data';
import { pageContext } from '@/lib/page';
import { localePath, pageMetadata } from '@/lib/site';

// Stock per variant is live: rendered on request.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps<'/[lang]/produits/[slug]'>): Promise<Metadata> {
  const { lang, t } = await pageContext(params);
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return {};
  const title = `${t('pdp.style')} ${product.name}`;
  const scents = product.scentCount === 1 ? t('fmt.scents1') : t('fmt.scents', { n: product.scentCount });
  return pageMetadata({
    lang,
    path: `/produits/${product.slug}`,
    title,
    description: `${title}, ${collectionName(product.collection, lang, t)}. ${scents}. ${t('s3.d')} ${t('s4.d')}`,
    image: product.imageUrl,
  });
}

export default async function ProductPage({ params }: PageProps<'/[lang]/produits/[slug]'>) {
  const { lang, t } = await pageContext(params);
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const [siblings, settings] = await Promise.all([listProducts(product.collectionSlug), getSettings()]);
  const related = siblings.filter((candidate) => candidate.slug !== product.slug).slice(0, 4);
  const collection = collectionName(product.collection, lang, t);
  const collectionPath = localePath(lang, `/collections/${product.collectionSlug}`);
  const scents = product.scentCount === 1 ? t('fmt.scents1') : t('fmt.scents', { n: product.scentCount });

  return (
    <>
      <Announcement text={settings.announcement} />
      <div className="wrap page pdp">
        <nav className="crumbs" aria-label={t('crumb.label')}>
          <ol>
            <li>
              <Link href={localePath(lang, '/collections')}>{t('ch4.title')}</Link>
            </li>
            <li>
              <Link href={collectionPath}>{collection}</Link>
            </li>
          </ol>
        </nav>

        <div className="pdp__grid">
          <div className="pdp__media">
            <ProductPhoto
              src={product.imageUrl}
              alt={`${t('pdp.style')} ${product.name}`}
              collection={product.collectionSlug}
              eager
              className="plate--large"
            />
          </div>

          <div className="pdp__info">
            <h1 className="pdp__title">
              <span className="style-tag">{t('pdp.style')}</span>
              <span className="pdp__name" dir="ltr">
                {product.name}
              </span>
            </h1>
            <p className="pdp__meta">
              {collection}, {scents}
            </p>

            <ProductBuy product={toPickerProduct(product)} />

            <ul className="facts">
              <li>{t('s3.d')}</li>
              <li>{t('s4.d')}</li>
              <li>
                {t('ch5.returns')}{' '}
                <Link className="tlink" href={localePath(lang, '/retours')}>
                  {t('ch5.returnsLink')}
                </Link>
              </li>
            </ul>
            <StyleNote t={t} />
          </div>
        </div>

        {related.length > 0 ? (
          <section className="related" aria-labelledby="related-title">
            <div className="shelf__head">
              <h2 id="related-title">{t('pdp.related')}</h2>
              <Link className="tlink" href={collectionPath}>
                {t('col.see')}
              </Link>
            </div>
            <div className="grid">
              {related.map((candidate) => (
                <ProductCard key={candidate.id} product={candidate} lang={lang} t={t} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
