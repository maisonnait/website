'use client'

import { useActionState } from 'react'
import { login, type LoginState } from './actions'

const INITIAL: LoginState = { message: '', email: '' }

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, INITIAL)

  return (
    <form action={action} className="form login__form">
      <input type="hidden" name="suite" value={next} />

      <label className="field">
        <span className="field__label">Adresse e-mail</span>
        <input
          className="input"
          type="email"
          name="email"
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={254}
          defaultValue={state.email}
          aria-invalid={state.message ? true : undefined}
          aria-describedby={state.message ? 'login-message' : undefined}
          autoFocus
        />
      </label>

      <label className="field">
        <span className="field__label">Mot de passe</span>
        <input
          className="input"
          type="password"
          name="password"
          autoComplete="current-password"
          required
          maxLength={200}
          aria-invalid={state.message ? true : undefined}
          aria-describedby={state.message ? 'login-message' : undefined}
        />
      </label>

      <p id="login-message" className="status-line status-line--err" role="alert" aria-live="assertive">
        {state.message}
      </p>

      <button type="submit" className="btn btn--gold btn--block" disabled={pending}>
        {pending ? 'Connexion…' : 'Se connecter'}
      </button>
    </form>
  )
}
