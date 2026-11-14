/**
 * @nait/db - data layer of the Maison N'Ait shop and stock manager.
 *
 * Server only (Node runtime): never import this entry from a client component. For the browser,
 * `@nait/db/types` (types and constants) and `@nait/db/phone` (phone validation) have no
 * server dependency.
 *
 * Every function is async. Business refusals are thrown as `DomainError` (see ./errors.ts);
 * test them with `isDomainError(e)` and read `e.code`.
 */

// connection
export { getDb, getDbInfo, closeDb, findRepoRoot, pgliteDir } from './client';
export type { Db, Driver } from './client';

// catalogue
export { listCollections, listProducts, getProduct, upsertProduct, setProductActive } from './queries/catalog';

// orders
export {
  placeOrder,
  getOrderForCustomer,
  listOrders,
  countOrders,
  getOrder,
  setOrderStatus,
  updateOrderNote,
} from './queries/orders';

// stock
export { listVariants, adjustStock, setVariant, listMovements } from './queries/stock';

// dashboard
export { dashboard, shopDay, SHOP_TIME_ZONE } from './queries/dashboard';

// users
export { verifyLogin, createUser, listUsers, getUser, setUserActive, setUserPassword } from './queries/users';

// settings
export { getSettings, setSetting } from './queries/settings';

// errors, phone helpers, types and constants
export { DomainError, isDomainError } from './errors';
export type { DomainErrorCode, DomainErrorDetails } from './errors';
export { normalizePhone, isValidPhone, formatPhoneLocal } from './phone';
export * from './types';

// For custom queries with `getDb()`: the tables, and the usual Drizzle operators.
export * as schema from './schema';
export {
  sql,
  eq,
  ne,
  and,
  or,
  not,
  gt,
  gte,
  lt,
  lte,
  inArray,
  notInArray,
  isNull,
  isNotNull,
  like,
  ilike,
  between,
  asc,
  desc,
  count,
  sum,
} from 'drizzle-orm';
