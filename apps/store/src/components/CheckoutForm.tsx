'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useRef, useState } from 'react';
import { submitOrder } from '@/app/[lang]/commande/actions';
import { useCart } from '@/cart/CartProvider';
import { applyChecks } from '@/cart/store';
import { useI18n } from '@/i18n/client';
import { CITIES } from '@/lib/cities';
import { useHydrated } from '@/lib/hydrated';
import type { OrderField, OrderState } from '@/lib/order-types';
import { CartLines, cartIsOrderable } from './CartLines';
import { Totals } from './Totals';
import { useCartRefresh } from './useCartRefresh';

/** What the visitor typed survives a detour by the cart (this tab only, never sent anywhere). */
const DRAFT_KEY = 'nait-checkout';
const FIELDS: OrderField[] = ['name', 'phone', 'city', 'address', 'note'];
const EMPTY: Record<OrderField, string> = { name: '', phone: '', city: '', address: '', note: '' };
const IDLE: OrderState = { status: 'idle' };

/** Checkout: delivery details on one side, the order on the other. Cash on delivery only. */
export function CheckoutForm({ shipping }: { shipping: number }) {
  const { t, href, lang } = useI18n();
  const router = useRouter();
  const { lines, subtotal, clear } = useCart();
  const hydrated = useHydrated();
  const [state, formAction, pending] = useActionState(submitOrder, IDLE);
  const [values, setValues] = useState(EMPTY);
  const [sent, setSent] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const alert = useRef<HTMLParagraphElement>(null);
  useCartRefresh(hydrated);

  // Restore the draft once, then keep it up to date.
  useEffect(() => {
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(DRAFT_KEY) ?? 'null') as Partial<Record<OrderField, unknown>> | null;
      if (!saved) return;
      setValues((current) => {
        const next = { ...current };
        for (const field of FIELDS) if (typeof saved[field] === 'string') next[field] = saved[field];
        return next;
      });
    } catch {
      // no draft
    }
  }, []);

  const change = (field: OrderField, value: string) => {
    setValues((current) => {
      const next = { ...current, [field]: value };
      try {
        window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(next));
      } catch {
        // the draft simply is not kept
      }
      return next;
    });
  };

  // What the server answered.
  useEffect(() => {
    if (state.status === 'ok') {
      setSent(true);
      try {
        window.sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        // nothing to clean
      }
      clear();
      router.replace(href(`/commande/merci?n=${encodeURIComponent(state.number)}`));
      return;
    }
    if (state.status !== 'error') return;
    if (state.error === 'stock' && state.checks) applyChecks(state.checks);
    if (state.error === 'fields' && state.fields) {
      const first = FIELDS.find((field) => state.fields?.[field]);
      const input = first ? form.current?.querySelector<HTMLElement>(`[name="${first}"]`) : null;
      if (input) {
        input.focus();
        return;
      }
    }
    alert.current?.focus();
  }, [state, clear, router, href]);

  if (!hydrated) return <div className="checkout checkout--loading" aria-busy="true" />;

  if (sent) {
    return (
      <p className="checkout__sent" role="status">
        {t('co.sending')}
      </p>
    );
  }

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

  const errors = state.status === 'error' ? (state.fields ?? {}) : {};
  const orderable = cartIsOrderable(lines);
  const problem =
    state.status === 'error'
      ? state.error === 'fields'
        ? t('co.err.fields')
        : state.error === 'stock'
          ? t('co.err.stock')
          : state.error === 'empty'
            ? t('co.err.empty')
            : t('co.err.server')
      : !orderable
        ? t('co.err.stock')
        : '';

  /** id of the text that explains a field: its error when there is one, else its hint. */
  const describe = (field: OrderField, hasHint = false) =>
    errors[field] ? `${field}-error` : hasHint ? `${field}-hint` : undefined;

  return (
    <form className="checkout" action={formAction} ref={form} noValidate>
      <div className="checkout__form">
        <h2>{t('co.details')}</h2>

        {problem ? (
          <p className="formerror" role="alert" tabIndex={-1} ref={alert}>
            {problem}
          </p>
        ) : null}

        <div className={`field ${errors.name ? 'has-error' : ''}`}>
          <label htmlFor="co-name">{t('co.name')}</label>
          <input
            id="co-name"
            name="name"
            type="text"
            autoComplete="name"
            required
            maxLength={120}
            value={values.name}
            onChange={(event) => change('name', event.target.value)}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={describe('name')}
          />
          {errors.name ? (
            <p className="field__error" id="name-error">
              {t(errors.name)}
            </p>
          ) : null}
        </div>

        <div className={`field ${errors.phone ? 'has-error' : ''}`}>
          <label htmlFor="co-phone">{t('co.phone')}</label>
          <input
            id="co-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            required
            maxLength={40}
            value={values.phone}
            onChange={(event) => change('phone', event.target.value)}
            aria-invalid={errors.phone ? true : undefined}
            aria-describedby={describe('phone', true)}
          />
          {errors.phone ? (
            <p className="field__error" id="phone-error">
              {t(errors.phone)}
            </p>
          ) : (
            <p className="field__hint" id="phone-hint">
              {t('co.phoneHint')}
            </p>
          )}
        </div>

        <div className={`field ${errors.city ? 'has-error' : ''}`}>
          <label htmlFor="co-city">{t('co.city')}</label>
          <input
            id="co-city"
            name="city"
            type="text"
            autoComplete="address-level2"
            list="co-cities"
            required
            maxLength={80}
            value={values.city}
            onChange={(event) => change('city', event.target.value)}
            aria-invalid={errors.city ? true : undefined}
            aria-describedby={describe('city')}
          />
          <datalist id="co-cities">
            {CITIES.map((city) => (
              <option key={city} value={city} />
            ))}
          </datalist>
          {errors.city ? (
            <p className="field__error" id="city-error">
              {t(errors.city)}
            </p>
          ) : null}
        </div>

        <div className={`field ${errors.address ? 'has-error' : ''}`}>
          <label htmlFor="co-address">{t('co.address')}</label>
          <textarea
            id="co-address"
            name="address"
            autoComplete="street-address"
            rows={2}
            required
            maxLength={300}
            value={values.address}
            onChange={(event) => change('address', event.target.value)}
            aria-invalid={errors.address ? true : undefined}
            aria-describedby={describe('address', true)}
          />
          {errors.address ? (
            <p className="field__error" id="address-error">
              {t(errors.address)}
            </p>
          ) : (
            <p className="field__hint" id="address-hint">
              {t('co.addressHint')}
            </p>
          )}
        </div>

        <div className={`field ${errors.note ? 'has-error' : ''}`}>
          <label htmlFor="co-note">
            {t('co.note')} <span className="field__optional">({t('co.optional')})</span>
          </label>
          <textarea
            id="co-note"
            name="note"
            rows={2}
            maxLength={600}
            value={values.note}
            onChange={(event) => change('note', event.target.value)}
            aria-invalid={errors.note ? true : undefined}
            aria-describedby={describe('note')}
          />
          {errors.note ? (
            <p className="field__error" id="note-error">
              {t(errors.note)}
            </p>
          ) : null}
        </div>

        {/* Honeypot: hidden from people and from assistive technology; only robots fill it. */}
        <div className="hp" aria-hidden="true">
          <label htmlFor="co-website">{t('co.hp')}</label>
          <input id="co-website" name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
        </div>

        <input type="hidden" name="lang" value={lang} />
        <input
          type="hidden"
          name="cart"
          value={JSON.stringify(lines.map(({ variantId, slug, quantity }) => ({ variantId, slug, quantity })))}
        />
      </div>

      <aside className="summary checkout__summary">
        <div className="summary__head">
          <h2>{t('co.summary')}</h2>
          <Link className="tlink" href={href('/panier')}>
            {t('co.edit')}
          </Link>
        </div>
        <CartLines />
        <Totals subtotal={subtotal} shipping={shipping} />
        <p className="summary__note">{t('cart.cod')}</p>
        <button className="btn btn--wide" type="submit" disabled={pending || !orderable}>
          {pending ? t('co.sending') : t('co.submit')}
        </button>
        <p className="summary__consent">{t('co.consent')}</p>
      </aside>
    </form>
  );
}
