'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import type { OrderStatus } from '@nait/db/types'
import { ActionMessage } from '@/components/form-bits'
import { IDLE_STATE } from '@/lib/action-state'
import { DESTRUCTIVE_STATUSES, NEXT_STATUS, SIDE_STATUSES, STATUS_ACTION } from '@/lib/status'
import { changeOrderStatus } from '../actions'

interface StatusActionsProps {
  orderId: string
  number: string
  status: OrderStatus
}

/**
 * The next step of the order as one gold button, the ways out next to it.
 * Every change is confirmed in a dialog before it is sent.
 */
export function StatusActions({ orderId, number, status }: StatusActionsProps) {
  const [state, action, pending] = useActionState(changeOrderStatus.bind(null, orderId), IDLE_STATE)
  const [target, setTarget] = useState<OrderStatus | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)

  const next = NEXT_STATUS[status]
  const sides = SIDE_STATUSES[status]

  const ask = (wanted: OrderStatus) => {
    setTarget(wanted)
    dialog.current?.showModal()
  }

  // The answer came back: the dialog has done its job.
  useEffect(() => {
    if (state.at) dialog.current?.close()
  }, [state.at])

  if (!next && sides.length === 0) {
    return <ActionMessage state={state} />
  }

  const copy = target ? STATUS_ACTION[target] : null

  return (
    <div className="next">
      <div className="next__buttons">
        {next ? (
          <button type="button" className="btn btn--gold" onClick={() => ask(next)} disabled={pending}>
            {STATUS_ACTION[next].button}
          </button>
        ) : null}
        {sides.map((side) => (
          <button
            key={side}
            type="button"
            className={`btn btn--line${DESTRUCTIVE_STATUSES.includes(side) ? ' btn--danger' : ''}`}
            onClick={() => ask(side)}
            disabled={pending}
          >
            {STATUS_ACTION[side].button}
          </button>
        ))}
      </div>
      <ActionMessage state={state} />

      <dialog className="dlg" ref={dialog} aria-labelledby="status-dialog-title" onClose={() => setTarget(null)}>
        <form action={action}>
          <input type="hidden" name="target" value={target ?? ''} />
          <div className="dlg__body">
            <h2 className="dlg__title" id="status-dialog-title">
              {copy?.question}
            </h2>
            <p className="dlg__text">
              Commande {number}. {copy?.detail}
            </p>
          </div>
          <div className="dlg__actions">
            <button type="button" className="btn btn--line" onClick={() => dialog.current?.close()} disabled={pending}>
              Ne rien changer
            </button>
            <button type="submit" className="btn btn--gold" disabled={pending || !target}>
              {pending ? 'Enregistrement…' : copy?.button}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  )
}
