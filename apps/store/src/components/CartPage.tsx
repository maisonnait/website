'use client';

import Link from 'next/link';
import { useCart } from '@/cart/CartProvider';
import { useI18n } from '@/i18n/client';
import { useHydrated } from '@/lib/hydrated';
import { CartLines, cartIsOrderable } from './CartLines';
import { Totals } from './Totals';
import { useCartRefresh } from './useCartRefresh';

export function CartPage({ shipping }: { shipping: number }) {
  const { t, href } = useI18n();
  const { lines, subtotal } = useCart();
  const hydrated = useHydrated();
  useCartRefresh(hydrated);

  if (!hydrated) return <div className="cartpage cartpage--loading" aria-busy="true" />;

  if (lines.length === 0) {
    return (
      <div className="empty">
        <p className="empty__title">{t('cart.empty')}</p>
        <p>{t('cart.emptyHint')}</p>
        <Link className="btn" href={href('/collections')}>
          {t('nav.allCollections')}
        </Link>
      </div>
    );
  }

  const orderable = cartIsOrderable(lines);
  return (
    <div className="cartpage">
      <div className="cartpage__lines">
        <CartLines />
        <Link className="tlink" href={href('/collections')}>
          {t('cart.continue')}
        </Link>
      </div>
      <aside className="summary">
        <Totals subtotal={subtotal} shipping={shipping} />
        <p className="summary__note">{t('cart.cod')}</p>
        {orderable ? (
          <Link className="btn btn--wide" href={href('/commande')}>
            {t('cart.checkout')}
          </Link>
        ) : (
          <p className="formerror" role="alert">
            {t('co.err.stock')}
          </p>
        )}
      </aside>
    </div>
  );
}
