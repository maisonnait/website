'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { isDomainError, verifyLogin, type User } from '@nait/db'
import { safeNextPath } from '@/lib/paths'
import { loginRetryAfterMs, recordLoginFailure, recordLoginSuccess } from '@/lib/rate-limit'
import { createSession, destroySession } from '@/lib/session'
import { hasAuthSecret } from '@/lib/session-token'

export interface LoginState {
  message: string
  /** Sent back so that the field keeps what was typed. Never the password. */
  email: string
}

const BAD_CREDENTIALS = 'Adresse e-mail ou mot de passe incorrect.'

async function clientAddress(): Promise<string> {
  const list = await headers()
  const forwarded = list.get('x-forwarded-for')?.split(',')[0]?.trim()
  return (forwarded || list.get('x-real-ip')?.trim() || 'local').slice(0, 64)
}

export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase()
    .slice(0, 254)
  const password = String(formData.get('password') ?? '')
  const next = safeNextPath(formData.get('suite'))

  if (!email || !password) {
    return { message: 'Saisissez votre adresse e-mail et votre mot de passe.', email }
  }
  if (!hasAuthSecret()) {
    console.error('[admin] login: AUTH_SECRET is missing or shorter than 32 characters')
    return { message: 'Connexion indisponible : la clé AUTH_SECRET n’est pas configurée sur le serveur.', email }
  }

  const address = await clientAddress()
  const wait = loginRetryAfterMs(address, email)
  if (wait > 0) {
    const minutes = Math.max(1, Math.ceil(wait / 60_000))
    return { message: `Trop de tentatives. Réessayez dans ${minutes} minute${minutes > 1 ? 's' : ''}.`, email }
  }

  // Oversized or malformed input is refused without touching the password hash.
  const plausible = password.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  let user: User | null = null
  if (plausible) {
    try {
      user = await verifyLogin(email, password)
    } catch (error) {
      if (!isDomainError(error)) {
        console.error('[admin] login:', error)
        return { message: 'Connexion impossible pour le moment (erreur technique). Réessayez dans un instant.', email }
      }
    }
  }

  if (!user || !user.active) {
    recordLoginFailure(address, email)
    return { message: BAD_CREDENTIALS, email }
  }

  recordLoginSuccess(address, email)
  await createSession({ sub: user.id, role: user.role, name: user.name })
  redirect(next)
}

export async function logout(): Promise<void> {
  await destroySession()
  redirect('/connexion')
}
