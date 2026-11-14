'use client';

import Link from 'next/link';
import { useCart } from '@/cart/CartProvider';
import { useI18n } from '@/i18n/client';
import type { CartLine } from '@/lib/types';
import { ProductPhoto } from './ProductPhoto';
import { Quantity } from './Quantity';

/** Scent, tag and size of a line, in reading order. */
export function LineDetails({ line }: { line: CartLine }) {
  const { t, dir } = useI18n();
  // A family without scents of its own has one scent named like itself: not repeated.
  const named = line.scent.trim().toLowerCase() !== line.name.trim().toLowerCase();
  return (
    <span className="line__details">
      {named ? <span dir="ltr">{line.scent}</span> : null}
      {line.tag ? <span className="tagchip">{t(`tag.${line.tag}`)}</span> : null}
      {named && dir === 'rtl' && line.scentAr && line.scentAr !== line.scent ? <span className="line__ar">{line.scentAr}</span> : null}
      {line.sizeMl > 0 ? <span className="line__size">{t('fmt.ml', { n: line.sizeMl })}</span> : null}
    </span>
  );
}

/**
 * The lines of the cart, with quantities. A line that asks for more than the stock allows
 * says so and offers the fix.
 */
export function CartLines({ onNavigate }: { onNavigate?: () => void }) {
  const { t, href } = useI18n();
  const { lines, setQuantity, remove } = useCart();

  return (
    <ul className="lines">
      {lines.map((line) => {
        const gone = line.max <= 0;
        const over = !gone && line.quantity > line.max;
        return (
          <li className={`line ${gone || over ? 'has-issue' : ''}`} key={line.variantId}>
            <Link className="line__photo" href={href(`/produits/${line.slug}`)} onClick={onNavigate} tabIndex={-1} aria-hidden="true">
              <ProductPhoto src={line.imageUrl} alt="" collection={line.collectionSlug} />
            </Link>
            <div className="line__main">
              <Link className="line__name" href={href(`/produits/${line.slug}`)} onClick={onNavigate}>
                <span className="style-tag">{t('pdp.style')}</span> <span dir="ltr">{line.name}</span>
              </Link>
              <LineDetails line={line} />
              {gone ? (
                <p className="line__issue" role="alert">
                  {t('co.err.gone')}
                </p>
              ) : over ? (
                <p className="line__issue" role="alert">
                  {t('co.err.left', { n: line.max })}{' '}
                  <button type="button" className="textbtn" onClick={() => setQuantity(line.variantId, line.max)}>
                    {t('co.fix', { n: line.max })}
                  </button>
                </p>
              ) : null}
              <div className="line__row">
                {gone ? <span /> : (
                  <Quantity
                    small
                    value={line.quantity}
                    max={Math.max(line.max, line.quantity)}
                    label={`${line.name}, ${line.scent}`}
                    onChange={(next) => setQuantity(line.variantId, next)}
                  />
                )}
                <button type="button" className="textbtn line__remove" onClick={() => remove(line.variantId)}>
                  {t('cart.remove')}
                  <span className="vh">
                    {' '}
                    {line.name}, {line.scent}
                  </span>
                </button>
              </div>
            </div>
            <span className="line__price price">{t('fmt.price', { n: line.price * line.quantity })}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** true when no line asks for more than what is available. */
export function cartIsOrderable(lines: readonly CartLine[]): boolean {
  return lines.length > 0 && lines.every((line) => line.max > 0 && line.quantity <= line.max);
}
