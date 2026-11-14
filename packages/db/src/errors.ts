/**
 * Business errors. Every function of @nait/db throws a `DomainError` when a business rule
 * refuses the operation; anything else that is thrown is a technical failure.
 */
export type DomainErrorCode =
  /** placeOrder / setOrderStatus: not enough stock (also used for an unknown or inactive variant). */
  | 'OUT_OF_STOCK'
  /** placeOrder: the phone is not a Moroccan number. */
  | 'INVALID_PHONE'
  /** placeOrder: no item. */
  | 'EMPTY_CART'
  /** A field is missing or malformed. `details.field` names it. */
  | 'INVALID_INPUT'
  /** The order, product, variant or user does not exist. */
  | 'NOT_FOUND'
  /** adjustStock: the adjustment would bring the stock below zero. */
  | 'NEGATIVE_STOCK'
  /** A unique value is already taken (email, product slug). */
  | 'CONFLICT';

export interface DomainErrorDetails {
  /** Name of the offending input field, when there is one. */
  field?: string;
  /** OUT_OF_STOCK / NEGATIVE_STOCK: the variant concerned. */
  variantId?: string;
  /** OUT_OF_STOCK / NEGATIVE_STOCK: units available right now. */
  available?: number;
  /** OUT_OF_STOCK: units asked for. */
  requested?: number;
  [key: string]: unknown;
}

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly details: DomainErrorDetails;

  constructor(code: DomainErrorCode, message?: string, details: DomainErrorDetails = {}) {
    super(message ?? code);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Safe test across bundles and module copies (Next.js can load a package twice, in which case
 * `instanceof` fails): checks the shape, not the class identity.
 */
export function isDomainError(error: unknown): error is DomainError {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'DomainError' &&
    typeof (error as { code?: unknown }).code === 'string'
  );
}
