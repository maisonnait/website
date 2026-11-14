'use client'

import { ActionMessage } from '@/components/form-bits'
import { useFormAction } from '@/components/use-form-action'
import { saveOrderNote } from '../actions'

export function NoteForm({ orderId, note }: { orderId: string; note: string }) {
  const { state, pending, onSubmit } = useFormAction(saveOrderNote.bind(null, orderId))

  return (
    <form onSubmit={onSubmit} className="form">
      <label className="field">
        <span className="vh">Note interne</span>
        <textarea
          className="textarea"
          name="note"
          defaultValue={note}
          maxLength={2000}
          rows={3}
          placeholder="Visible par l’équipe uniquement : rappel convenu, livreur, remarque…"
          aria-invalid={state.fields?.note ? true : undefined}
        />
      </label>
      <div className="formactions">
        <button type="submit" className="btn btn--sm" disabled={pending}>
          {pending ? 'Enregistrement…' : 'Enregistrer la note'}
        </button>
        <ActionMessage state={state} />
      </div>
    </form>
  )
}
