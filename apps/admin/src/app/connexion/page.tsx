import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'
import { firstParam, safeNextPath } from '@/lib/paths'
import { hasAuthSecret } from '@/lib/session-token'
import { Wordmark } from '@/components/wordmark'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Connexion' }

export default async function LoginPage(props: PageProps<'/connexion'>) {
  const searchParams = await props.searchParams
  const next = safeNextPath(firstParam(searchParams.suite))

  // Already signed in (and still an active account): straight to work.
  const user = await getSessionUser()
  if (user) redirect(next)

  return (
    <main className="login">
      <div className="login__brand">
        <p aria-label="N’Ait">
          <Wordmark className="login__mark" />
        </p>
        <p className="login__sub">Gestion du stock et des commandes</p>
      </div>

      <div className="login__panel">
        <h1 className="login__title">Connexion</h1>
        <p className="login__lead">Accès réservé à l’équipe de la Maison N’Ait.</p>
        {hasAuthSecret() ? null : (
          <p className="notice notice--err" role="alert">
            Configuration incomplète : la variable AUTH_SECRET (32 caractères au minimum) doit être définie sur le
            serveur avant toute connexion.
          </p>
        )}
        <LoginForm next={next} />
      </div>
    </main>
  )
}
