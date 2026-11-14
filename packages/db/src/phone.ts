/**
 * Moroccan phone numbers. Pure functions without any dependency: this file can be imported
 * in client components as `@nait/db/phone`.
 *
 * Accepted: 0[5-7]XXXXXXXX or +212[5-7]XXXXXXXX (also 00212...), with optional spaces, dots,
 * dashes or parentheses between the digits.
 */

const SEPARATORS = /[\s.\-() ‎‏‪-‮]/g;
const ARABIC_INDIC_ZERO = 0x0660;
const EXTENDED_ARABIC_INDIC_ZERO = 0x06f0;

/** Replaces Arabic-Indic digits (٠-٩, ۰-۹) by ASCII digits. */
function toAsciiDigits(value: string): string {
  let out = '';
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code >= ARABIC_INDIC_ZERO && code <= ARABIC_INDIC_ZERO + 9) out += String(code - ARABIC_INDIC_ZERO);
    else if (code >= EXTENDED_ARABIC_INDIC_ZERO && code <= EXTENDED_ARABIC_INDIC_ZERO + 9)
      out += String(code - EXTENDED_ARABIC_INDIC_ZERO);
    else out += char;
  }
  return out;
}

/**
 * Returns the number in international form ('+2126XXXXXXXX'), or null when it is not a valid
 * Moroccan number.
 */
export function normalizePhone(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const compact = toAsciiDigits(input).replace(SEPARATORS, '');
  const match = /^(?:0|\+212|00212)([5-7]\d{8})$/.exec(compact);
  return match ? `+212${match[1]}` : null;
}

export function isValidPhone(input: unknown): boolean {
  return normalizePhone(input) !== null;
}

/** '+212612345678' -> '0612345678'. Anything that is not a normalised number is returned as is. */
export function formatPhoneLocal(phone: string): string {
  const match = /^\+212([5-7]\d{8})$/.exec(phone);
  return match ? `0${match[1]}` : phone;
}
