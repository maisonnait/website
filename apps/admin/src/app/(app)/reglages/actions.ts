'use server'

import { revalidatePath } from 'next/cache'
import { getSettings, normalizePhone, setSetting } from '@nait/db'
import type { Settings } from '@nait/db/types'
import { requireOwner } from '@/lib/auth'
import { actionError, fail, ok, type ActionState } from '@/lib/errors'

const SHIPPING_MAX = 1000
const DELAY_MAX = 80
const ANNOUNCEMENT_MAX = 200

function text(formData: FormData, name: string): string {
  const value = formData.get(name)
  return (typeof value === 'string' ? value : '').replace(/\s+/g, ' ').trim()
}

export async function saveSettings(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireOwner()
  } catch (error) {
    return actionError(error, 'saveSettings')
  }

  const fields: Record<string, string> = {}

  const shippingText = text(formData, 'shippingMad')
  const shippingMad = /^\d{1,4}$/.test(shippingText) ? Number(shippingText) : Number.NaN
  if (!Number.isInteger(shippingMad) || shippingMad > SHIPPING_MAX) {
    fields.shippingMad = `Montant entier en dirhams, de 0 à ${SHIPPING_MAX}.`
  }

  // Phone numbers are stored in international form (+212…), ready for tel: and wa.me links.
  const phones: Partial<Record<'shopPhone' | 'whatsapp', string>> = {}
  for (const key of ['shopPhone', 'whatsapp'] as const) {
    const typed = text(formData, key)
    if (typed === '') {
      phones[key] = ''
      continue
    }
    const normalized = normalizePhone(typed)
    const international = typed.replace(/[\s.\-()]/g, '')
    if (normalized) phones[key] = normalized
    else if (/^\+[1-9]\d{7,14}$/.test(international)) phones[key] = international
    else fields[key] = 'Numéro non reconnu. Exemples : 06 12 34 56 78 ou +212 6 12 34 56 78.'
  }

  const deliveryDelay = text(formData, 'deliveryDelay')
  if (deliveryDelay.length === 0) fields.deliveryDelay = 'Indiquez un délai, par exemple « 1 à 3 jours ouvrés ».'
  else if (deliveryDelay.length > DELAY_MAX) fields.deliveryDelay = `${DELAY_MAX} caractères au maximum.`

  const announcement = text(formData, 'announcement')
  if (announcement.length > ANNOUNCEMENT_MAX) fields.announcement = `${ANNOUNCEMENT_MAX} caractères au maximum.`

  if (Object.keys(fields).length > 0) return fail('Rien n’a été enregistré : corrigez les champs signalés.', fields)

  const wanted: Settings = {
    shippingMad,
    shopPhone: phones.shopPhone ?? '',
    whatsapp: phones.whatsapp ?? '',
    deliveryDelay,
    announcement,
  }

  let changed = 0
  try {
    const current = await getSettings()
    for (const key of Object.keys(wanted) as Array<keyof Settings>) {
      if (current[key] === wanted[key]) continue
      await setSetting(key, wanted[key])
      changed += 1
    }
  } catch (error) {
    if (changed > 0) revalidatePath('/', 'layout')
    return actionError(error, 'saveSettings')
  }

  if (changed === 0) return ok('Aucune modification à enregistrer.')
  revalidatePath('/', 'layout')
  return ok('Réglages enregistrés. La boutique les applique aux prochaines commandes.')
}
