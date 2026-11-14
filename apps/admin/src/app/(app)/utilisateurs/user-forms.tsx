'use client'

import { useActionState } from 'react'
import { ActionMessage } from '@/components/form-bits'
import { useFormAction } from '@/components/use-form-action'
import { IDLE_STATE } from '@/lib/action-state'
import { createUserAction, setUserActiveAction, setUserPasswordAction } from './actions'

export function CreateUserForm() {
  const { state, pending, onSubmit, formKey } = useFormAction(createUserAction)
  const errors = state.fields ?? {}

  // After a success the key changes and the form comes back empty for the next account.
  return (
    <form key={formKey} onSubmit={onSubmit} className="form">
      <div className="formgrid formgrid--2">
        <label className="field">
          <span className="field__label">Prénom et nom</span>
          <input className="input" name="name" required maxLength={80} autoComplete="off" aria-invalid={errors.name ? true : undefined} />
          {errors.name ? <span className="field__error">{errors.name}</span> : null}
        </label>
        <label className="field">
          <span className="field__label">Adresse e-mail</span>
          <input
            className="input"
            name="email"
            type="email"
            inputMode="email"
            required
            maxLength={254}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={errors.email ? true : undefined}
          />
          {errors.email ? <span className="field__error">{errors.email}</span> : null}
        </label>
        <label className="field">
          <span className="field__label">Rôle</span>
          <select className="select" name="role" defaultValue="staff" aria-invalid={errors.role ? true : undefined}>
            <option value="staff">Équipe : commandes, stock, produits</option>
            <option value="owner">Propriétaire : tout, y compris utilisateurs et réglages</option>
          </select>
          {errors.role ? <span className="field__error">{errors.role}</span> : null}
        </label>
        <label className="field">
          <span className="field__label">Mot de passe provisoire</span>
          <input
            className="input"
            name="password"
            type="text"
            required
            minLength={10}
            maxLength={200}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={errors.password ? true : undefined}
          />
          {errors.password ? (
            <span className="field__error">{errors.password}</span>
          ) : (
            <span className="field__hint">10 caractères au minimum.</span>
          )}
        </label>
      </div>
      <div className="formactions">
        <button type="submit" className="btn" disabled={pending}>
          {pending ? 'Création…' : 'Créer le compte'}
        </button>
        <ActionMessage state={state} />
      </div>
    </form>
  )
}

interface UserRowActionsProps {
  userId: string
  name: string
  active: boolean
  /** The signed-in owner cannot block their own account. */
  self: boolean
}

export function UserRowActions({ userId, name, active, self }: UserRowActionsProps) {
  const [activeState, toggle, toggling] = useActionState(setUserActiveAction.bind(null, userId, !active), IDLE_STATE)
  const password = useFormAction(setUserPasswordAction.bind(null, userId))

  return (
    <div className="useractions">
      <div className="rowactions">
        <details className="inline-details">
          <summary className="btn btn--line btn--sm">Nouveau mot de passe</summary>
          <form key={password.formKey} onSubmit={password.onSubmit} className="form useractions__pw">
            <label className="field">
              <span className="field__label">Nouveau mot de passe de {name}</span>
              <input
                className="input input--sm"
                name="password"
                type="text"
                required
                minLength={10}
                maxLength={200}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                aria-invalid={password.state.fields?.password ? true : undefined}
              />
              <span className="field__hint">10 caractères au minimum. L’ancien cesse de fonctionner.</span>
            </label>
            <button type="submit" className="btn btn--sm" disabled={password.pending}>
              {password.pending ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </form>
        </details>
        {self ? null : (
          <form action={toggle}>
            <button type="submit" className={`btn btn--line btn--sm${active ? ' btn--danger' : ''}`} disabled={toggling}>
              {active ? 'Désactiver' : 'Réactiver'}
            </button>
          </form>
        )}
      </div>
      <ActionMessage state={password.state.message ? password.state : activeState} />
    </div>
  )
}
