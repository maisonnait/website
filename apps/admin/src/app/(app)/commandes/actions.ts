'use server'

import { revalidatePath } from 'next/cache'
import { getOrder, setOrderStatus, updateOrderNote } from '@nait/db'
import { requireUser } from '@/lib/auth'
import { actionError, fail, ok, type ActionState } from '@/lib/errors'
import { allowedTargets, isOrderStatus, STATUS_ACTION, STATUS_LABEL } from '@/lib/status'

const NOTE_MAX = 2000

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 64
}

/** Moves an order along its workflow. Cancelling or returning puts the bottles back in stock. */
export async function changeOrderStatus(orderId: string, _previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser()

  const target = formData.get('target')
  if (!validId(orderId) || !isOrderStatus(target)) return fail('Demande incomplète. Rechargez la page et réessayez.')

  try {
    const order = await getOrder(orderId)
    if (!order) return fail('Cette commande est introuvable.')
    if (order.status === target) return fail(`La commande est déjà « ${STATUS_LABEL[target].toLowerCase()} ».`)
    if (!allowedTargets(order.status).includes(target)) {
      return fail(
        `Une commande « ${STATUS_LABEL[order.status].toLowerCase()} » ne peut pas passer à « ${STATUS_LABEL[target].toLowerCase()} ». Rechargez la page : un collègue l’a peut-être déjà traitée.`,
      )
    }
    await setOrderStatus(order.id, target, user.id)
  } catch (error) {
    return actionError(error, 'changeOrderStatus')
  }

  // The dashboard, the lists, the stock and the badge in the menu all depend on it.
  revalidatePath('/', 'layout')
  return ok(STATUS_ACTION[target].done)
}

export async function saveOrderNote(orderId: string, _previous: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser()
  if (!validId(orderId)) return fail('Demande incomplète. Rechargez la page et réessayez.')

  const raw = formData.get('note')
  const note = (typeof raw === 'string' ? raw : '').replace(/\r\n?/g, '\n').trim()
  if (note.length > NOTE_MAX) {
    return fail(`La note est trop longue (${note.length} caractères, ${NOTE_MAX} au maximum).`, { note: 'Trop long' })
  }

  try {
    await updateOrderNote(orderId, note === '' ? null : note)
  } catch (error) {
    return actionError(error, 'saveOrderNote')
  }

  revalidatePath('/commandes', 'layout')
  return ok(note === '' ? 'Note effacée.' : 'Note enregistrée.')
}
