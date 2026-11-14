'use client';

import { useI18n } from '@/i18n/client';

/** Subtotal, delivery and total of the cart. The delivery fee comes from the shop settings. */
export function Totals({ subtotal, shipping }: { subtotal: number; shipping: number }) {
  const { t } = useI18n();
  return (
    <dl className="totals">
      <div className="totals__row">
        <dt>{t('cart.subtotal')}</dt>
        <dd className="price">{t('fmt.price', { n: subtotal })}</dd>
      </div>
      <div className="totals__row">
        <dt>{t('cart.shipping')}</dt>
        <dd className={shipping > 0 ? 'price' : ''}>{shipping > 0 ? t('fmt.price', { n: shipping }) : t('cart.free')}</dd>
      </div>
      <div className="totals__row totals__row--strong">
        <dt>{t('cart.total')}</dt>
        <dd className="price">{t('fmt.price', { n: subtotal + shipping })}</dd>
      </div>
    </dl>
  );
}
