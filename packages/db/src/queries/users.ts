/** Back-office users. The password hash never leaves this module. */
import { and, asc, eq, ne, sql } from 'drizzle-orm';
import { getDb } from '../client';
import { DomainError } from '../errors';
import { decoyHash, hashPassword, verifyPassword } from '../password';
import { users } from '../schema';
import { USER_ROLES } from '../types';
import type { CreateUserInput, User, UserRole } from '../types';
import { UNIQUE_VIOLATION, isUuid, requireText, requireUuid, sqlState } from '../util';

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 200;

const publicFields = {
  id: users.id,
  email: users.email,
  name: users.name,
  role: users.role,
  active: users.active,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
};

function normalizeEmail(value: unknown): string | null {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function requirePassword(value: unknown): string {
  if (typeof value !== 'string' || value.length < MIN_PASSWORD_LENGTH || value.length > MAX_PASSWORD_LENGTH) {
    throw new DomainError('INVALID_INPUT', `the password must have at least ${MIN_PASSWORD_LENGTH} characters`, {
      field: 'password',
    });
  }
  return value;
}

/**
 * Returns the user when the email exists, the account is active and the password matches;
 * null in every other case (the caller cannot tell which, and neither can a timing attack).
 */
export async function verifyLogin(email: string, password: string): Promise<User | null> {
  const normalized = normalizeEmail(email);
  const candidate = typeof password === 'string' ? password : '';
  const db = await getDb();
  const [row] = normalized
    ? await db
        .select({ ...publicFields, passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.email, normalized))
        .limit(1)
    : [];
  // Always spend the time of one scrypt verification, also for an unknown email.
  const matches = await verifyPassword(candidate, row?.passwordHash ?? (await decoyHash()));
  if (!row || !matches || !row.active) return null;
  const { passwordHash: _passwordHash, ...user } = row;
  return user;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  if (!input || typeof input !== 'object') {
    throw new DomainError('INVALID_INPUT', 'user data is required', { field: 'input' });
  }
  const email = normalizeEmail(input.email);
  if (!email) throw new DomainError('INVALID_INPUT', 'the email address is not valid', { field: 'email' });
  const name = requireText(input.name, 'name', 120);
  const password = requirePassword(input.password);
  const role: UserRole = input.role ?? 'staff';
  if (!USER_ROLES.includes(role)) {
    throw new DomainError('INVALID_INPUT', 'role must be owner or staff', { field: 'role' });
  }
  const db = await getDb();
  const passwordHash = await hashPassword(password);
  try {
    const [created] = await db.insert(users).values({ email, name, role, passwordHash }).returning(publicFields);
    if (!created) throw new Error('@nait/db: the user was not created');
    return created;
  } catch (error) {
    if (sqlState(error) === UNIQUE_VIOLATION) {
      throw new DomainError('CONFLICT', 'a user with this email already exists', { field: 'email' });
    }
    throw error;
  }
}

/** Every user, owners first, then by name. */
export async function listUsers(): Promise<User[]> {
  const db = await getDb();
  return db
    .select(publicFields)
    .from(users)
    .orderBy(sql`case when ${users.role} = 'owner' then 0 else 1 end`, asc(users.name), asc(users.email));
}

/** One user by id, or null. Use it to check on each request that a session's user is still active. */
export async function getUser(id: string): Promise<User | null> {
  if (!isUuid(id)) return null;
  const db = await getDb();
  const [user] = await db.select(publicFields).from(users).where(eq(users.id, id.toLowerCase())).limit(1);
  return user ?? null;
}

/** Enables or disables an account. The last active owner cannot be disabled. */
export async function setUserActive(id: string, active: boolean): Promise<User> {
  const userId = requireUuid(id, 'id');
  if (typeof active !== 'boolean') {
    throw new DomainError('INVALID_INPUT', 'active must be true or false', { field: 'active' });
  }
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [current] = await tx.select(publicFields).from(users).where(eq(users.id, userId)).for('update');
    if (!current) throw new DomainError('NOT_FOUND', 'user not found', { field: 'id' });
    if (!active && current.active && current.role === 'owner') {
      const others = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.role, 'owner'), eq(users.active, true), ne(users.id, userId)))
        .for('update');
      if (others.length === 0) {
        throw new DomainError('CONFLICT', 'the last active owner cannot be disabled', { field: 'active' });
      }
    }
    const [updated] = await tx.update(users).set({ active }).where(eq(users.id, userId)).returning(publicFields);
    if (!updated) throw new DomainError('NOT_FOUND', 'user not found', { field: 'id' });
    return updated;
  });
}

export async function setUserPassword(id: string, password: string): Promise<User> {
  const userId = requireUuid(id, 'id');
  const passwordHash = await hashPassword(requirePassword(password));
  const db = await getDb();
  const [updated] = await db.update(users).set({ passwordHash }).where(eq(users.id, userId)).returning(publicFields);
  if (!updated) throw new DomainError('NOT_FOUND', 'user not found', { field: 'id' });
  return updated;
}
