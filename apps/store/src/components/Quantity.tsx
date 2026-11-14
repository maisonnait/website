'use client';

import { useI18n } from '@/i18n/client';
import { IconMinus, IconPlus } from './Icons';

/** Minus / number / plus. `max` is what the stock allows. */
export function Quantity({
  value,
  max,
  onChange,
  label,
  small = false,
}: {
  value: number;
  max: number;
  onChange: (next: number) => void;
  /** What is being counted, for screen readers. */
  label: string;
  small?: boolean;
}) {
  const { t } = useI18n();
  return (
    <span className={`qty ${small ? 'qty--sm' : ''}`} role="group" aria-label={`${t('cart.qty')}, ${label}`}>
      <button type="button" className="qty__btn" aria-label={t('cart.less')} disabled={value <= 1} onClick={() => onChange(value - 1)}>
        <IconMinus />
      </button>
      <output className="qty__value" aria-live="polite">
        {value}
      </output>
      <button type="button" className="qty__btn" aria-label={t('cart.more')} disabled={value >= max} onClick={() => onChange(value + 1)}>
        <IconPlus />
      </button>
    </span>
  );
}
