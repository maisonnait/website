'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { ActionMessage } from '@/components/form-bits'
import { useFormAction } from '@/components/use-form-action'
import { adjustVariantStock } from './actions'

interface StockAdjustProps {
  variantId: string
  /** Named in the confirmation, e.g. 'Black Incense 50 ml'. */
  label: string
  stock: number
  /** Shown at the start of the control row (the link to the variant's history). */
  aside?: ReactNode
}

type Direction = 'add' | 'remove'

/**
 * Type a quantity, choose "Ajouter" or "Retirer", check the resulting stock, confirm.
 * Nothing is sent before the last step.
 */
export function StockAdjust({ variantId, label, stock, aside }: StockAdjustProps) {
  const { state, pending, onSubmit } = useFormAction(adjustVariantStock.bind(null, variantId))
  const [quantity, setQuantity] = useState('1')
  const [direction, setDirection] = useState<Direction | null>(null)
  const [reason, setReason] = useState<'restock' | 'adjust'>('restock')
  const id = useId()
  const confirm = useRef<HTMLDivElement>(null)

  // On a phone the confirmation can open under the fold: bring it into view.
  useEffect(() => {
    if (direction) confirm.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [direction])

  // Back to rest once the change is saved.
  useEffect(() => {
    if (state.ok && state.at) {
      setDirection(null)
      setQuantity('1')
    }
  }, [state.ok, state.at])

  const amount = /^\d{1,4}$/.test(quantity) ? Number(quantity) : 0
  const valid = amount >= 1
  const after = direction === 'remove' ? stock - amount : stock + amount
  const tooMany = direction === 'remove' && after < 0

  const open = (wanted: Direction) => {
    setDirection(wanted)
    setReason(wanted === 'add' ? 'restock' : 'adjust')
  }

  return (
    <form
      className="adjust"
      onSubmit={(event) => {
        // Enter in the quantity field must not send anything before a direction is chosen.
        if (!direction) event.preventDefault()
        else onSubmit(event)
      }}
    >
      <div className="adjust__row">
        {aside}
        <label className="vh" htmlFor={`${id}-q`}>
          Quantité à ajouter ou retirer pour {label}
        </label>
        <input
          id={`${id}-q`}
          className="input input--sm adjust__qty"
          name="quantity"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          maxLength={4}
          value={quantity}
          onChange={(event) => setQuantity(event.target.value.replace(/\D/g, '').slice(0, 4))}
          onFocus={(event) => event.target.select()}
          aria-invalid={state.fields?.quantity ? true : undefined}
        />
        <button
          type="button"
          className="btn btn--sm"
          onClick={() => open('add')}
          disabled={!valid || pending}
          aria-pressed={direction === 'add'}
        >
          Ajouter
        </button>
        <button
          type="button"
          className="btn btn--line btn--sm"
          onClick={() => open('remove')}
          disabled={!valid || pending || stock <= 0}
          aria-pressed={direction === 'remove'}
        >
          Retirer
        </button>
      </div>

      {direction ? (
        <div className="adjust__confirm" ref={confirm}>
          <input type="hidden" name="direction" value={direction} />
          <p className="adjust__sum">
            {direction === 'add' ? 'Ajouter' : 'Retirer'} {amount} : le stock passe de {stock} à {tooMany ? '…' : after}
          </p>
          {tooMany ? (
            <p className="status-line status-line--err">Il n’y a que {stock} en stock : impossible d’en retirer {amount}.</p>
          ) : null}

          {direction === 'add' ? (
            <label className="field">
              <span className="field__label">Motif</span>
              <select
                className="select input--sm"
                name="reason"
                value={reason}
                onChange={(event) => setReason(event.target.value === 'adjust' ? 'adjust' : 'restock')}
              >
                <option value="restock">Réassort (arrivage)</option>
                <option value="adjust">Correction d’inventaire</option>
              </select>
            </label>
          ) : (
            <input type="hidden" name="reason" value="adjust" />
          )}

          <label className="field">
            <span className="field__label">Note {direction === 'remove' ? '(casse, testeur, erreur de comptage…)' : '(facultative)'}</span>
            <input className="input input--sm" name="note" type="text" maxLength={200} autoComplete="off" />
          </label>

          <div className="formactions">
            <button type="button" className="btn btn--line btn--sm" onClick={() => setDirection(null)} disabled={pending}>
              Ne rien changer
            </button>
            <button type="submit" className="btn btn--gold btn--sm" disabled={pending || !valid || tooMany}>
              {pending ? 'Enregistrement…' : direction === 'add' ? `Ajouter ${amount}` : `Retirer ${amount}`}
            </button>
          </div>
        </div>
      ) : null}

      <ActionMessage state={state} />
    </form>
  )
}
