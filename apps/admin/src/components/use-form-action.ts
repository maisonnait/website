'use client'

import { startTransition, useActionState, useState, type FormEvent } from 'react'
import { IDLE_STATE, type ActionState } from '@/lib/action-state'

type FormAction = (previous: ActionState, formData: FormData) => Promise<ActionState>

/**
 * Runs a Server Action from a form without letting React wipe the fields afterwards.
 * (A form whose `action` is a function is reset when the action returns, even when the
 * answer is "this value is not valid": what was typed would be lost.)
 *
 * `formKey` changes after each success and only then: give it to the form as `key` when the
 * fields should start again from the values the server has just stored. After a refusal the
 * key stays the same, so everything typed stays in place.
 */
export function useFormAction(action: FormAction) {
  const [state, dispatch, pending] = useActionState(action, IDLE_STATE)
  const [savedAt, setSavedAt] = useState(0)

  // Remember the last success while rendering (no effect needed, no extra paint).
  if (state.ok && state.at && state.at !== savedAt) setSavedAt(state.at)

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) return
    const submitter = (event.nativeEvent as SubmitEvent).submitter
    const formData = new FormData(event.currentTarget, submitter instanceof HTMLElement ? submitter : undefined)
    startTransition(() => dispatch(formData))
  }

  return { state, pending, onSubmit, formKey: `form-${savedAt}` }
}
