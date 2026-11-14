/**
 * Session token: a JWT signed with AUTH_SECRET (HS256), valid 12 hours.
 * No Next.js import here, so that both the proxy and the server code can use it.
 * The token carries the minimum: user id, role and display name. Every page and
 * every Server Action re-reads the user from the database (see lib/auth.ts).
 */
import { SignJWT, jwtVerify } from 'jose'

export const SESSION_TTL_SECONDS = 12 * 60 * 60

const IS_PRODUCTION = process.env.NODE_ENV === 'production'

/**
 * `__Host-` pins the cookie to this exact host (no Domain, Path=/, Secure), so the shop on
 * a sibling subdomain can never set or shadow it. Plain name in development, where the app
 * may be opened over http on a LAN address.
 */
export const SESSION_COOKIE = IS_PRODUCTION ? '__Host-nait-admin' : 'nait-admin'
export const SESSION_COOKIE_SECURE = IS_PRODUCTION

const ISSUER = 'nait-admin'
const AUDIENCE = 'nait-admin'

export type Role = 'owner' | 'staff'

export interface SessionClaims {
  /** User id. */
  sub: string
  role: Role
  name: string
}

export class MissingSecretError extends Error {
  constructor() {
    super('AUTH_SECRET is missing or shorter than 32 characters: sessions cannot be signed.')
    this.name = 'MissingSecretError'
  }
}

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 32) throw new MissingSecretError()
  return new TextEncoder().encode(secret)
}

export function hasAuthSecret(): boolean {
  const secret = process.env.AUTH_SECRET
  return Boolean(secret && secret.length >= 32)
}

export async function signSessionToken(claims: SessionClaims): Promise<string> {
  return new SignJWT({ role: claims.role, name: claims.name })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey())
}

/** Returns the claims of a valid, unexpired token, otherwise null. Never throws on a bad token. */
export async function verifySessionToken(token: string | undefined | null): Promise<SessionClaims | null> {
  if (!token || !hasAuthSecret()) return null
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    })
    const { sub, role, name } = payload as { sub?: unknown; role?: unknown; name?: unknown }
    if (typeof sub !== 'string' || sub.length === 0) return null
    if (role !== 'owner' && role !== 'staff') return null
    return { sub, role, name: typeof name === 'string' ? name : '' }
  } catch {
    return null
  }
}
