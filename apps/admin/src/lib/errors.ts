import 'server-only'

import { unstable_rethrow } from 'next/navigation'
import { isDomainError, type DomainError } from '@nait/db'
import { ForbiddenError } from './auth'
import { MissingSecretError } from './session-token'

import type { ActionState } from './action-state'

export type { ActionState }

export function ok(message: string): ActionState {
  return { ok: true, message, at: Date.now() }
}

export function fail(message: string, fields?: Record<string, string>): ActionState {
  return { ok: false, message, fields, at: Date.now() }
}

const FIELD_LABEL: Record<string, string> = {
  email: 'l’adresse e-mail',
  name: 'le nom',
  password: 'le mot de passe',
  role: 'le rôle',
  slug: 'l’identifiant du produit',
  collectionId: 'la collection',
  collectionSlug: 'la collection',
  imageUrl: 'l’adresse de la photo',
  priceMad: 'le prix',
  lowStockThreshold: 'le seuil de stock bas',
  delta: 'la quantité',
  reason: 'le motif',
  note: 'la note',
  status: 'le statut',
  shippingMad: 'les frais de livraison',
  shopPhone: 'le téléphone de la boutique',
  whatsapp: 'le numéro WhatsApp',
  deliveryDelay: 'le délai de livraison',
  announcement: 'l’annonce',
}

/** French sentence for a business error raised by @nait/db. */
export function domainMessage(error: DomainError): string {
  const { details } = error
  switch (error.code) {
    case 'OUT_OF_STOCK':
      return typeof details.available === 'number'
        ? `Stock insuffisant : il reste ${details.available} unité${details.available > 1 ? 's' : ''} pour au moins un article.`
        : 'Stock insuffisant pour au moins un article de la commande.'
    case 'NEGATIVE_STOCK':
      return typeof details.available === 'number'
        ? `Impossible de retirer autant : il n’y a que ${details.available} unité${details.available > 1 ? 's' : ''} en stock.`
        : 'Impossible de retirer autant : le stock deviendrait négatif.'
    case 'INVALID_PHONE':
      return 'Ce numéro n’est pas un numéro marocain valide (06…, 07…, 05… ou +212…).'
    case 'EMPTY_CART':
      return 'La commande ne contient aucun article.'
    case 'NOT_FOUND':
      return 'Introuvable : cet élément a peut-être été supprimé ou modifié entre-temps. Rechargez la page.'
    case 'CONFLICT': {
      const field = typeof details.field === 'string' ? details.field : ''
      if (field === 'email') return 'Un compte existe déjà avec cette adresse e-mail.'
      if (field === 'slug') return 'Un produit utilise déjà cet identifiant.'
      return 'Cette valeur est déjà utilisée.'
    }
    case 'INVALID_INPUT': {
      const field = typeof details.field === 'string' ? details.field : ''
      if (field === 'status') return 'Ce changement de statut n’est pas possible pour cette commande.'
      if (field === 'password') return 'Le mot de passe doit compter au moins 8 caractères.'
      const label = FIELD_LABEL[field]
      return label ? `Valeur refusée pour ${label}.` : 'Une des valeurs saisies a été refusée.'
    }
    default:
      return 'Action refusée.'
  }
}

/**
 * Turns anything thrown inside a Server Action into a message for the form.
 * Technical failures are logged on the server and never detailed to the browser.
 */
export function actionError(error: unknown, context: string): ActionState {
  // A redirect (expired session) or a not-found raised inside the action must reach Next.js.
  unstable_rethrow(error)
  if (isDomainError(error)) {
    const field = typeof error.details.field === 'string' ? error.details.field : undefined
    const message = domainMessage(error)
    return fail(message, field ? { [field]: message } : undefined)
  }
  if (error instanceof ForbiddenError) return fail('Cette action est réservée au propriétaire de la boutique.')
  if (error instanceof MissingSecretError) {
    console.error(`[admin] ${context}:`, error.message)
    return fail('Connexion indisponible : la clé AUTH_SECRET n’est pas configurée sur le serveur.')
  }
  console.error(`[admin] ${context}:`, error)
  return fail('Une erreur technique est survenue. Réessayez ; si le problème continue, prévenez le responsable.')
}
