/**
 * Display helpers. Pure functions, usable on the server and in client components.
 * Dates are always shown in Moroccan time, whatever the server's own time zone is.
 */

export const TIME_ZONE = 'Africa/Casablanca'

const NBSP = '\u00A0'

const numberFr = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })

/** 2388 -> '2 388' */
export function formatNumber(value: number): string {
  return numberFr.format(value)
}

/** 2388 -> '2 388 DH' */
export function formatMad(value: number): string {
  return `${numberFr.format(value)}${NBSP}DH`
}

const dateTimeFr = new Intl.DateTimeFormat('fr-FR', {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const dateFr = new Intl.DateTimeFormat('fr-FR', {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

const dayMonthFr = new Intl.DateTimeFormat('fr-FR', { timeZone: TIME_ZONE, day: 'numeric', month: 'short' })
const timeFr = new Intl.DateTimeFormat('fr-FR', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' })
const longDayFr = new Intl.DateTimeFormat('fr-FR', {
  timeZone: TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const isoDayParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** '13 nov. 2026, 14:02' */
export function formatDateTime(date: Date): string {
  return dateTimeFr.format(date)
}

/** '13 nov. 2026' */
export function formatDate(date: Date): string {
  return dateFr.format(date)
}

/** 'vendredi 13 novembre 2026' */
export function formatLongDay(date: Date): string {
  return longDayFr.format(date)
}

/** 'YYYY-MM-DD' of a date in Moroccan time. */
export function moroccoDay(date: Date): string {
  return isoDayParts.format(date)
}

/** "aujourd'hui 14:02", 'hier 09:15', then '11 nov. 16:40', then '3 mars 2025'. */
export function formatWhen(date: Date, now: Date = new Date()): string {
  const day = moroccoDay(date)
  const today = moroccoDay(now)
  if (day === today) return `aujourd’hui ${timeFr.format(date)}`
  const yesterday = moroccoDay(new Date(now.getTime() - 24 * 60 * 60 * 1000))
  if (day === yesterday) return `hier ${timeFr.format(date)}`
  if (day.slice(0, 4) === today.slice(0, 4)) return `${dayMonthFr.format(date)} ${timeFr.format(date)}`
  return dateFr.format(date)
}

const WEEKDAYS_SHORT = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']
const WEEKDAYS_LONG = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
const MONTHS_LONG = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
]

/** Parts of a 'YYYY-MM-DD' calendar day (no time zone involved: it is already a Moroccan day). */
export function dayParts(isoDay: string): { weekdayShort: string; weekdayLong: string; day: number; label: string } {
  const [y, m, d] = isoDay.split('-').map(Number)
  const date = new Date(Date.UTC(y || 1970, (m || 1) - 1, d || 1))
  const weekday = date.getUTCDay()
  return {
    weekdayShort: WEEKDAYS_SHORT[weekday] ?? '',
    weekdayLong: WEEKDAYS_LONG[weekday] ?? '',
    day: date.getUTCDate(),
    label: `${WEEKDAYS_LONG[weekday] ?? ''} ${date.getUTCDate()} ${MONTHS_LONG[date.getUTCMonth()] ?? ''}`,
  }
}

/** 50 -> '50 ml'; 0 (product sold in a single size) -> ''. */
export function formatSize(sizeMl: number): string {
  return sizeMl > 0 ? `${sizeMl}${NBSP}ml` : ''
}

/**
 * 'Black Incense' + 'EXTRA' -> 'Black Incense Extra'.
 * Order lines keep the name as it was sold, tag included ('Black Incense EXTRA'): without a
 * separate tag, a trailing EXTRA or SUPER is set the same way.
 */
export function formatScent(name: string, tag?: string | null): string {
  if (tag) return `${name} ${tag.charAt(0)}${tag.slice(1).toLowerCase()}`
  return name.replace(/ (EXTRA|SUPER)$/, (_match, word: string) => ` ${word.charAt(0)}${word.slice(1).toLowerCase()}`)
}

/** One line naming an item: 'AL QURASHI, Black Incense, 50 ml' (the scent is dropped when it repeats the product). */
export function formatItem(productName: string, scentName: string, sizeMl: number): string {
  const parts = [productName]
  if (scentName && scentName.toLowerCase() !== productName.toLowerCase()) parts.push(formatScent(scentName))
  const size = formatSize(sizeMl)
  if (size) parts.push(size)
  return parts.join(', ')
}

/** Digits of a Moroccan number without the country prefix: '+212612345678' or '0612345678' -> '612345678'. */
function nationalDigits(phone: string): string | null {
  const compact = phone.replace(/[^\d+]/g, '')
  const match = /^(?:\+212|00212|212|0)([5-7]\d{8})$/.exec(compact)
  return match ? match[1]! : null
}

/** '+212612345678' -> '06 12 34 56 78'. Unknown formats are returned untouched. */
export function formatPhone(phone: string): string {
  const national = nationalDigits(phone)
  if (!national) return phone
  const local = `0${national}`
  return local.replace(/(\d{2})(?=\d)/g, '$1 ').trim()
}

/** tel: link in international form. */
export function telHref(phone: string): string {
  const national = nationalDigits(phone)
  return national ? `tel:+212${national}` : `tel:${phone.replace(/[^\d+]/g, '')}`
}

/** https://wa.me/2126XXXXXXXX with an optional prefilled message. */
export function whatsappHref(phone: string, text?: string): string {
  const national = nationalDigits(phone)
  const number = national ? `212${national}` : phone.replace(/\D/g, '')
  const query = text ? `?text=${encodeURIComponent(text)}` : ''
  return `https://wa.me/${number}${query}`
}

/** 'Salma Bennani' -> 'SB' (for the account button). */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const letters = words.slice(0, 2).map((word) => Array.from(word)[0] ?? '')
  return letters.join('').toUpperCase() || '?'
}

/** French plural for regular nouns: plural(2, 'article') -> '2 articles'. */
export function plural(count: number, singular: string, pluralForm?: string): string {
  const word = count > 1 ? (pluralForm ?? `${singular}s`) : singular
  return `${formatNumber(count)}${NBSP}${word}`
}
