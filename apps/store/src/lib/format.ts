import type { Locale } from '@/i18n/config';

/** Phone numbers and order numbers are always written left to right, with Latin digits. */
export function formatDate(date: Date | string, _lang: Locale): string {
  const value = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return '';
  // dd/mm/yyyy in Moroccan time: read the same way in the five languages.
  return new Intl.DateTimeFormat('fr-MA', {
    timeZone: 'Africa/Casablanca',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(value);
}

/** '+212612345678' or '0612345678' -> '06 12 34 56 78' */
export function prettyPhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  const local = digits.startsWith('+212') ? `0${digits.slice(4)}` : digits.startsWith('00212') ? `0${digits.slice(5)}` : digits;
  return /^0\d{9}$/.test(local) ? local.replace(/(\d{2})(?=\d)/g, '$1 ') : phone;
}

/** tel: link target in international form. */
export function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return `tel:${digits}`;
  if (digits.startsWith('00')) return `tel:+${digits.slice(2)}`;
  if (/^0\d{9}$/.test(digits)) return `tel:+212${digits.slice(1)}`;
  return `tel:${digits}`;
}

/** wa.me link: digits only, international form. */
export function whatsappHref(phone: string): string {
  return `https://wa.me/${telHref(phone).replace('tel:+', '').replace('tel:', '')}`;
}
