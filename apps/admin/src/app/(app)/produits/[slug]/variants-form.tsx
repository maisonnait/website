'use client'

import { useRef, useState } from 'react'
import { ActionMessage } from '@/components/form-bits'
import { useFormAction } from '@/components/use-form-action'
import { saveVariants } from '../actions'

export interface VariantLine {
  id: string
  /** 'Black Incense Extra' */
  scent: string
  scentAr: string | null
  sizeMl: number
  /** '50 ml', or '' for a product sold in a single size */
  size: string
  sku: string
  priceMad: number
  lowStockThreshold: number
  stock: number
  active: boolean
}

interface VariantsFormProps {
  slug: string
  variants: VariantLine[]
  /** Sizes present in this product, to set one price for a whole size at once. */
  sizes: number[]
}

export function VariantsForm({ slug, variants, sizes }: VariantsFormProps) {
  const { state, pending, onSubmit, formKey } = useFormAction(saveVariants.bind(null, slug))
  const form = useRef<HTMLFormElement>(null)
  const [bulkSize, setBulkSize] = useState('all')
  const [bulkPrice, setBulkPrice] = useState('')
  const [bulkNote, setBulkNote] = useState('')
  const errors = state.fields ?? {}

  /** Writes one price into every matching row; nothing is saved until the form is sent. */
  const applyPrice = () => {
    if (!/^\d{1,6}$/.test(bulkPrice) || Number(bulkPrice) < 1 || !form.current) {
      setBulkNote('Indiquez un prix entier en dirhams.')
      return
    }
    const selector = bulkSize === 'all' ? 'input[data-price]' : `input[data-price][data-size="${bulkSize}"]`
    const inputs = form.current.querySelectorAll<HTMLInputElement>(selector)
    inputs.forEach((input) => {
      input.value = bulkPrice
    })
    setBulkNote(
      `${bulkPrice} DH reporté sur ${inputs.length} variante${inputs.length > 1 ? 's' : ''}. Enregistrez pour valider.`,
    )
  }

  return (
    <form key={formKey} ref={form} onSubmit={onSubmit} className="form">
      {variants.length > 1 ? (
        <div className="bulk">
          {sizes.length > 1 ? (
            <label className="field">
              <span className="field__label">Taille</span>
              <select className="select input--sm" value={bulkSize} onChange={(event) => setBulkSize(event.target.value)}>
                <option value="all">Toutes les tailles</option>
                {sizes.map((size) => (
                  <option key={size} value={String(size)}>
                    {size} ml
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="field">
            <span className="field__label">Même prix (DH)</span>
            <input
              className="input input--sm input--num"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoComplete="off"
              value={bulkPrice}
              onChange={(event) => setBulkPrice(event.target.value.replace(/\D/g, ''))}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  applyPrice()
                }
              }}
            />
          </label>
          <button type="button" className="btn btn--line btn--sm" onClick={applyPrice}>
            Reporter ce prix
          </button>
          <p className="status-line" role="status">
            {bulkNote}
          </p>
        </div>
      ) : null}

      <table className="table table--stack variants">
        <thead>
          <tr>
            <th scope="col">Variante</th>
            <th scope="col" className="num">
              En stock
            </th>
            <th scope="col">Prix (DH)</th>
            <th scope="col">Seuil de stock bas</th>
            <th scope="col">En vente</th>
          </tr>
        </thead>
        <tbody>
          {variants.map((variant) => {
            const label = `${variant.scent} ${variant.size}`.trim()
            return (
              <tr key={variant.id}>
                <td className="c-wide">
                  <span className="strong">{variant.scent}</span>
                  {variant.size ? <span className="nowrap"> {variant.size}</span> : null}
                  <span className="sub">
                    {variant.scentAr ? (
                      <span className="article__ar" lang="ar" dir="rtl">
                        {variant.scentAr}
                      </span>
                    ) : null}{' '}
                    <span className="article__sku">{variant.sku}</span>
                  </span>
                </td>
                <td className="num c-wide" data-label="En stock">
                  {variant.stock}
                </td>
                <td className="vfield">
                  <label className="vh" htmlFor={`prix-${variant.id}`}>
                    Prix de {label} en dirhams
                  </label>
                  <span className="field__label only-phone-block" aria-hidden="true">
                    Prix (DH)
                  </span>
                  <input
                    id={`prix-${variant.id}`}
                    className="input input--sm input--num"
                    name={`prix:${variant.id}`}
                    data-price=""
                    data-size={variant.sizeMl}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoComplete="off"
                    defaultValue={variant.priceMad}
                    aria-invalid={errors[`prix:${variant.id}`] ? true : undefined}
                  />
                </td>
                <td className="vfield">
                  <label className="vh" htmlFor={`seuil-${variant.id}`}>
                    Seuil de stock bas de {label}
                  </label>
                  <span className="field__label only-phone-block" aria-hidden="true">
                    Seuil de stock bas
                  </span>
                  <input
                    id={`seuil-${variant.id}`}
                    className="input input--sm input--num"
                    name={`seuil:${variant.id}`}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={5}
                    autoComplete="off"
                    defaultValue={variant.lowStockThreshold}
                    aria-invalid={errors[`seuil:${variant.id}`] ? true : undefined}
                  />
                </td>
                <td className="c-wide">
                  <label className="check">
                    <input type="checkbox" name={`actif:${variant.id}`} defaultChecked={variant.active} />
                    <span className="check__label only-phone" aria-hidden="true">
                      En vente
                    </span>
                    <span className="vh">En vente : {label}</span>
                  </label>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="formactions">
        <button type="submit" className="btn" disabled={pending}>
          {pending ? 'Enregistrement…' : 'Enregistrer les variantes'}
        </button>
        <ActionMessage state={state} />
      </div>
    </form>
  )
}
