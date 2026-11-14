import 'server-only'

import { cookies } from 'next/headers'
import {
  SESSION_COOKIE,
  SESSION_COOKIE_SECURE,
  SESSION_TTL_SECONDS,
  signSessionToken,
  verifySessionToken,
  type SessionClaims,
} from './session-token'

/** Writes the session cookie. Only callable from a Server Action or a Route Handler. */
export async function createSession(claims: SessionClaims): Promise<void> {
  const token = await signSessionToken(claims)
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: SESSION_COOKIE_SECURE,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  })
}

export async function destroySession(): Promise<void> {
  const store = await cookies()
  // Same attributes as when it was set, otherwise a `__Host-` cookie is not replaced.
  store.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: SESSION_COOKIE_SECURE,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}

export async function readSessionClaims(): Promise<SessionClaims | null> {
  const store = await cookies()
  return verifySessionToken(store.get(SESSION_COOKIE)?.value)
}
