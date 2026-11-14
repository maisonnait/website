import Link from 'next/link';
import type { ProductCard as ProductCardData } from '@nait/db';
import type { Locale } from '@/i18n/config';
import type { Translate } from '@/i18n';
import { localePath } from '@/lib/site';
import { ProductPhoto } from './ProductPhoto';

/** One product in a grid: photo, "Style" + name, scent count, price, availability. */
export function ProductCard({
  product,
  lang,
  t,
  eager = false,
  collection,
}: {
  product: ProductCardData;
  lang: Locale;
  t: Translate;
  eager?: boolean;
  /** Name of the collection, shown in lists that mix several collections. */
  collection?: string;
}) {
  const scents = product.scentCount === 1 ? t('fmt.scents1') : t('fmt.scents', { n: product.scentCount });
  return (
    <article className={`card ${product.inStock ? '' : 'is-out'}`}>
      <Link className="card__link" href={localePath(lang, `/produits/${product.slug}`)}>
        {/* Decorative here: the name is written right below, inside the same link. */}
        <ProductPhoto src={product.imageUrl} alt="" slug={product.slug} collection={product.collectionSlug} eager={eager} />
        <span className="card__body">
          <span className="card__title">
            <span className="style-tag">{t('pdp.style')}</span>
            <span className="card__name" dir="ltr">
              {product.name}
            </span>
          </span>
          <span className="card__meta">{collection ? `${collection}, ${scents}` : scents}</span>
          <span className="card__foot">
            <span className="price">{t('fmt.price', { n: product.minPrice })}</span>
            <span className={`stock stock--${product.inStock ? 'in' : 'out'}`}>{t(product.inStock ? 'stock.in' : 'stock.out')}</span>
          </span>
        </span>
      </Link>
    </article>
  );
}
