'use server'

import { revalidatePath } from 'next/cache'
import { adjustStock } from '@nait/db'
import { requireUser } from '@/lib/auth'
import { actionError, fail, ok, type ActionState } from '@/lib/errors'
import { formatNumber } from '@/lib/format'

const QUANTITY_MAX = 9999
const NOTE_MAX = 200

/**
 * Adds bottles to a variant (a delivery from the workshop, or a count that found more) or
 * removes some (breakage, tester, count that found fewer). Every change is written to the
 * movement history with its reason, its note and the person who made it.
 */
export async function adjustVariantStock(variantId: string, _previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser()
  if (typeof variantId !== 'string' || variantId.length === 0 || variantId.length > 64) {
    return fail('Demande incomplète. Rechargez la page et réessayez.')
  }

  const direction = formData.get('direction')
  const reason = formData.get('reason')
  const quantityText = String(formData.get('quantity') ?? '').trim()
  const noteRaw = formData.get('note')
  const note = (typeof noteRaw === 'string' ? noteRaw : '').trim()

  if (direction !== 'add' && direction !== 'remove') return fail('Choisissez d’ajouter ou de retirer des unités.')
  if (!/^\d{1,4}$/.test(quantityText) || Number(quantityText) < 1) {
    return fail(`Indiquez une quantité entière entre 1 et ${formatNumber(QUANTITY_MAX)}.`, { quantity: 'Quantité invalide' })
  }
  const quantity = Number(quantityText)
  if (reason !== 'restock' && reason !== 'adjust') return fail('Choisissez un motif : réassort ou correction.')
  if (direction === 'remove' && reason === 'restock') {
    return fail('Un réassort ajoute du stock. Pour retirer des unités, choisissez « Correction ».')
  }
  if (note.length > NOTE_MAX) return fail(`La note est trop longue (${NOTE_MAX} caractères au maximum).`, { note: 'Trop long' })

  const delta = direction === 'add' ? quantity : -quantity
  let stock: number
  try {
    const variant = await adjustStock(variantId, delta, reason, user.id, note === '' ? null : note)
    stock = variant.stock
  } catch (error) {
    return actionError(error, 'adjustVariantStock')
  }

  revalidatePath('/', 'layout')
  const sign = delta > 0 ? '+' : '−'
  return ok(`${sign}${formatNumber(quantity)} enregistré. Stock : ${formatNumber(stock)}.`)
}
