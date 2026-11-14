import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'
import { getUser } from '@nait/db'
import { readSessionClaims } from './session'
import type { Role } from './session-token'

export interface SessionUser {
  id: string
  name: string
  email: string
  role: Role
}

/**
 * The signed cookie says who the visitor claims to be; the database says whether that account
 * still exists, is still active and which role it has today. A deactivated user is therefore
 * locked out on the next request, not when the 12 hour token runs out.
 *
 * `cache` deduplicates the lookup inside one render pass (layout + page).
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const claims = await readSessionClaims()
  if (!claims) return null
  const user = await getUser(claims.sub)
  if (!user || !user.active) return null
  return { id: user.id, name: user.name, email: user.email, role: user.role }
})

/** For pages, layouts and route handlers: sends anonymous visitors to the login page. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) redirect('/connexion')
  return user
}

export function isOwner(user: SessionUser): boolean {
  return user.role === 'owner'
}

/** Thrown by Server Actions when the caller is signed in but not allowed. */
export class ForbiddenError extends Error {
  constructor() {
    super('Réservé au propriétaire.')
    this.name = 'ForbiddenError'
  }
}

/** For owner-only Server Actions. */
export async function requireOwner(): Promise<SessionUser> {
  const user = await requireUser()
  if (!isOwner(user)) throw new ForbiddenError()
  return user
}
