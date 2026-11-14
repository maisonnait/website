'use client'

import type { ReactNode } from 'react'
import { useFormStatus } from 'react-dom'

interface SubmitButtonProps {
  children: ReactNode
  /** Shown while the action runs. */
  pendingLabel?: string
  className?: string
  disabled?: boolean
  name?: string
  value?: string
}

/** Submit button that locks itself while its form is being sent. */
export function SubmitButton({ children, pendingLabel, className = 'btn', disabled, name, value }: SubmitButtonProps) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className={className} disabled={pending || disabled} name={name} value={value}>
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  )
}

/** Result of a Server Action, announced to screen readers. */
export function ActionMessage({ state, className = '' }: { state: { ok: boolean; message: string }; className?: string }) {
  return (
    <p
      className={`status-line ${state.message ? (state.ok ? 'status-line--ok' : 'status-line--err') : ''} ${className}`}
      role={state.message && !state.ok ? 'alert' : 'status'}
      aria-live={state.ok ? 'polite' : 'assertive'}
    >
      {state.message}
    </p>
  )
}
