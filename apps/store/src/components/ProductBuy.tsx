'use client';

import { useMemo, useState } from 'react';
import { useCart } from '@/cart/CartProvider';
import { useI18n } from '@/i18n/client';
import type { PickerProduct, PickerVariant } from '@/lib/types';
import { Quantity } from './Quantity';

/**
 * Scent, size, quantity and "add to cart" of a product page. The price and the stock line
 * always describe the selected variant (one scent in one size).
 */
export function ProductBuy({ product }: { product: PickerProduct }) {
  const { t, dir } = useI18n();
  const { add, openDrawer } = useCart();

  const sizes = useMemo(
    () => [...new Set(product.variants.map((variant) => variant.sizeMl))].sort((a, b) => a - b),
    [product.variants],
  );
  const find = (scentId: string, sizeMl: number): PickerVariant | undefined =>
    product.variants.find((variant) => variant.scentId === scentId && variant.sizeMl === sizeMl);

  // Start on the first combination that can actually be bought.
  const initial = product.variants.find((variant) => variant.state !== 'out') ?? product.variants[0];
  const [scentId, setScentId] = useState(initial?.scentId ?? product.scents[0]?.id ?? '');
  const [sizeMl, setSizeMl] = useState(initial?.sizeMl ?? 0);
  const [wanted, setWanted] = useState(1);
  const [announce, setAnnounce] = useState('');

  const variant = find(scentId, sizeMl);
  const scent = product.scents.find((candidate) => candidate.id === scentId);
  const max = variant?.max ?? 0;
  const quantity = Math.max(1, Math.min(wanted, max || 1));
  const buyable = Boolean(variant && variant.state !== 'out');
  const showSizes = product.hasSizes && sizes.some((size) => size > 0);
  // A family without scents of its own has one scent named like itself: nothing to choose.
  const showScents =
    product.scents.length > 1 ||
    (product.scents.length === 1 && product.scents[0]!.name.trim().toLowerCase() !== product.name.trim().toLowerCase());
  const prices = product.variants.map((candidate) => candidate.price);
  const lowest = prices.length ? Math.min(...prices) : 0;

  const pickScent = (id: string) => {
    setScentId(id);
    setAnnounce('');
    // Keep the size when this scent has it in stock, otherwise move to one that is.
    const same = find(id, sizeMl);
    if (same && same.state !== 'out') return;
    const other = product.variants.find((candidate) => candidate.scentId === id && candidate.state !== 'out');
    if (other) setSizeMl(other.sizeMl);
    else if (!same) setSizeMl(product.variants.find((candidate) => candidate.scentId === id)?.sizeMl ?? sizeMl);
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!variant || !scent || !buyable) return;
    add(
      {
        variantId: variant.id,
        slug: product.slug,
        name: product.name,
        scent: scent.name,
        scentAr: scent.nameAr,
        tag: scent.tag,
        sizeMl: variant.sizeMl,
        price: variant.price,
        imageUrl: product.imageUrl,
        collectionSlug: product.collectionSlug,
        max: variant.max,
      },
      quantity,
    );
    setWanted(1);
    setAnnounce(t('cart.added'));
    openDrawer();
  };

  return (
    <form className="buy" onSubmit={onSubmit}>
      <p className="buy__price price">
        {variant ? t('fmt.price', { n: variant.price }) : t('fmt.from', { n: lowest })}
      </p>

      {showScents ? (
        <fieldset className="pick">
          <legend>
            <span className="pick__label">{t('pdp.scent')}</span>
            {scent ? (
              <span className="pick__value" dir="ltr">
                {scent.name}
                {scent.tag ? ` ${t(`tag.${scent.tag}`)}` : ''}
              </span>
            ) : null}
          </legend>
          <div className="chips">
            {product.scents.map((option) => {
              const soldOut = !product.variants.some((candidate) => candidate.scentId === option.id && candidate.state !== 'out');
              return (
                <label className={`chip ${soldOut ? 'is-out' : ''}`} key={option.id}>
                  <input
                    type="radio"
                    name="scent"
                    value={option.id}
                    checked={option.id === scentId}
                    onChange={() => pickScent(option.id)}
                  />
                  <span className="chip__box">
                    <span dir="ltr">{option.name}</span>
                    {option.tag ? <span className="tagchip">{t(`tag.${option.tag}`)}</span> : null}
                    {dir === 'rtl' && option.nameAr ? <span className="chip__ar">{option.nameAr}</span> : null}
                    {soldOut ? <span className="vh"> ({t('stock.out')})</span> : null}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {showSizes ? (
        <fieldset className="pick">
          <legend>
            <span className="pick__label">{t('pdp.size')}</span>
            {sizeMl > 0 ? <span className="pick__value">{t('fmt.ml', { n: sizeMl })}</span> : null}
          </legend>
          <div className="chips chips--sizes">
            {sizes.map((size) => {
              const option = find(scentId, size);
              const soldOut = !option || option.state === 'out';
              return (
                <label className={`chip chip--size ${soldOut ? 'is-out' : ''}`} key={size}>
                  <input
                    type="radio"
                    name="size"
                    value={size}
                    checked={size === sizeMl}
                    disabled={!option}
                    onChange={() => {
                      setSizeMl(size);
                      setAnnounce('');
                    }}
                  />
                  <span className="chip__box">
                    {t('fmt.ml', { n: size })}
                    {soldOut ? <span className="vh"> ({t(option ? 'stock.out' : 'pdp.unavailable')})</span> : null}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <p className={`stock stock--${variant ? variant.state : 'out'} buy__stock`} role="status">
        {!variant
          ? t('pdp.unavailable')
          : variant.state === 'out'
            ? t('stock.out')
            : variant.state === 'low'
              ? t('stock.low', { n: variant.left })
              : t('stock.in')}
      </p>

      <div className="buy__row">
        <Quantity value={quantity} max={Math.max(1, max)} onChange={setWanted} label={product.name} />
        <button className="btn btn--wide" type="submit" disabled={!buyable}>
          {buyable ? t('pdp.add') : t(variant ? 'stock.out' : 'pdp.unavailable')}
        </button>
      </div>
      <p className="vh" role="status" aria-live="polite">
        {announce}
      </p>
    </form>
  );
}
