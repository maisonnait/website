'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { trackOrder } from '@/app/[lang]/suivi/actions';
import { useI18n } from '@/i18n/client';
import type { TrackState, TrackedOrder } from '@/lib/order-types';

const IDLE: TrackState = { status: 'idle' };
const PATH = ['new', 'confirmed', 'shipped', 'delivered'] as const;

function OrderView({ order }: { order: TrackedOrder }) {
  const { t, href } = useI18n();
  const reached = PATH.indexOf(order.status as (typeof PATH)[number]);
  const dates = [order.placedOn, order.confirmedOn, order.shippedOn, order.deliveredOn];
  const stopped = order.status === 'cancelled' || order.status === 'returned';

  return (
    <section className="tracked" aria-labelledby="tracked-title">
      <header className="tracked__head">
        <h2 id="tracked-title" dir="ltr">
          {order.number}
        </h2>
        <p>{t('tr.placed', { d: order.placedOn })}</p>
      </header>

      <p className={`tracked__status ${stopped ? 'is-stopped' : ''}`} role="status">
        <strong>{t(`st.${order.status}`)}</strong>
        <span>{t(`st.${order.status}.d`)}</span>
      </p>

      {stopped ? null : (
        <ol className="progress">
          {PATH.map((step, index) => (
            <li
              key={step}
              className={`progress__step ${index <= reached ? 'is-done' : ''}`}
              aria-current={index === reached ? 'step' : undefined}
            >
              <span className="progress__name">{t(`st.${step}`)}</span>
              {index <= reached && dates[index] ? <span className="progress__date">{dates[index]}</span> : null}
            </li>
          ))}
        </ol>
      )}

      <h3 className="tracked__sub">{t('tr.items')}</h3>
      <ul className="lines lines--plain">
        {order.items.map((item, index) => (
          <li className="line" key={index}>
            <div className="line__main">
              <span className="line__name">
                <span className="style-tag">{t('pdp.style')}</span> <span dir="ltr">{item.productName}</span>
              </span>
              <span className="line__details">
                {item.scentName.trim().toLowerCase() !== item.productName.trim().toLowerCase() ? (
                  <span dir="ltr">{item.scentName}</span>
                ) : null}
                {item.sizeMl > 0 ? <span className="line__size">{t('fmt.ml', { n: item.sizeMl })}</span> : null}
                <span className="line__size">× {item.quantity}</span>
              </span>
            </div>
            <span className="line__price price">{t('fmt.price', { n: item.unitPrice * item.quantity })}</span>
          </li>
        ))}
      </ul>
      <dl className="totals">
        <div className="totals__row">
          <dt>{t('cart.shipping')}</dt>
          <dd className={order.shipping > 0 ? 'price' : ''}>
            {order.shipping > 0 ? t('fmt.price', { n: order.shipping }) : t('cart.free')}
          </dd>
        </div>
        <div className="totals__row totals__row--strong">
          <dt>{t('cart.total')}</dt>
          <dd className="price">{t('fmt.price', { n: order.total })}</dd>
        </div>
      </dl>
      <p className="tracked__help">
        {t('tr.help')}{' '}
        <Link className="tlink" href={href('/contact')}>
          {t('foot.contact')}
        </Link>
      </p>
    </section>
  );
}

/** Order tracking by number and phone. */
export function TrackForm({ initialNumber }: { initialNumber: string }) {
  const { t, lang } = useI18n();
  const [state, formAction, pending] = useActionState(trackOrder, IDLE);
  const [number, setNumber] = useState(initialNumber);
  const [phone, setPhone] = useState('');
  const errors = state.status === 'error' ? (state.fields ?? {}) : {};

  return (
    <div className="track">
      <form className="track__form" action={formAction} noValidate>
        {state.status === 'notfound' ? (
          <p className="formerror" role="alert">
            {t('tr.notfound')}
          </p>
        ) : null}
        {state.status === 'error' && state.failed ? (
          <p className="formerror" role="alert">
            {t('tr.error')}
          </p>
        ) : null}

        <div className={`field ${errors.number ? 'has-error' : ''}`}>
          <label htmlFor="tr-number">{t('ty.number')}</label>
          <input
            id="tr-number"
            name="number"
            type="text"
            dir="ltr"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            required
            maxLength={20}
            value={number}
            onChange={(event) => setNumber(event.target.value)}
            aria-invalid={errors.number ? true : undefined}
            aria-describedby={errors.number ? 'tr-number-error' : 'tr-number-hint'}
          />
          {errors.number ? (
            <p className="field__error" id="tr-number-error">
              {t(errors.number)}
            </p>
          ) : (
            <p className="field__hint" id="tr-number-hint">
              {t('tr.numberHint')}
            </p>
          )}
        </div>

        <div className={`field ${errors.phone ? 'has-error' : ''}`}>
          <label htmlFor="tr-phone">{t('co.phone')}</label>
          <input
            id="tr-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            required
            maxLength={40}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            aria-invalid={errors.phone ? true : undefined}
            aria-describedby={errors.phone ? 'tr-phone-error' : 'tr-phone-hint'}
          />
          {errors.phone ? (
            <p className="field__error" id="tr-phone-error">
              {t(errors.phone)}
            </p>
          ) : (
            <p className="field__hint" id="tr-phone-hint">
              {t('co.phoneHint')}
            </p>
          )}
        </div>

        <input type="hidden" name="lang" value={lang} />
        <button className="btn" type="submit" disabled={pending}>
          {pending ? t('tr.pending') : t('tr.submit')}
        </button>
      </form>

      {state.status === 'found' ? <OrderView order={state.order} /> : null}
    </div>
  );
}
