/**
 * Order statuses and stock movement reasons: French wording and the order workflow.
 * Pure data, usable on the server and in client components.
 */
import { ORDER_STATUSES, type MovementReason, type OrderStatus } from '@nait/db/types'

export const ORDER_STATUS_LIST: readonly OrderStatus[] = ORDER_STATUSES

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && (ORDER_STATUS_LIST as readonly string[]).includes(value)
}

/** One order: 'Nouvelle' */
export const STATUS_LABEL: Record<OrderStatus, string> = {
  new: 'Nouvelle',
  confirmed: 'Confirmée',
  shipped: 'Expédiée',
  delivered: 'Livrée',
  cancelled: 'Annulée',
  returned: 'Retournée',
}

/** A filter over several orders: 'Nouvelles' */
export const STATUS_LABEL_PLURAL: Record<OrderStatus, string> = {
  new: 'Nouvelles',
  confirmed: 'Confirmées',
  shipped: 'Expédiées',
  delivered: 'Livrées',
  cancelled: 'Annulées',
  returned: 'Retournées',
}

/** What the team has to do with the orders in that status (dashboard). */
export const STATUS_TODO: Record<'new' | 'confirmed' | 'shipped' | 'delivered', string> = {
  new: 'À confirmer',
  confirmed: 'À expédier',
  shipped: 'En livraison',
  delivered: 'Livrées',
}

/** The normal path of an order. */
export const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  new: 'confirmed',
  confirmed: 'shipped',
  shipped: 'delivered',
}

/**
 * Ways out of the normal path. Cancelling or returning puts the bottles back in stock;
 * reopening a cancelled order takes them again, if they are still available.
 */
export const SIDE_STATUSES: Record<OrderStatus, readonly OrderStatus[]> = {
  new: ['cancelled'],
  confirmed: ['cancelled'],
  shipped: ['returned'],
  delivered: ['returned'],
  cancelled: ['new'],
  returned: [],
}

/** Targets that undo work: shown in red. */
export const DESTRUCTIVE_STATUSES: readonly OrderStatus[] = ['cancelled', 'returned']

export function allowedTargets(status: OrderStatus): OrderStatus[] {
  const next = NEXT_STATUS[status]
  return [...(next ? [next] : []), ...SIDE_STATUSES[status]]
}

/** Button wording: the same words come back in the confirmation and in the success message. */
export const STATUS_ACTION: Record<OrderStatus, { button: string; question: string; done: string; detail?: string }> = {
  new: {
    button: 'Rouvrir la commande',
    question: 'Rouvrir la commande ?',
    done: 'Commande rouverte : elle attend de nouveau une confirmation.',
    detail: 'Ses articles sont de nouveau retirés du stock, s’ils sont encore disponibles.',
  },
  confirmed: {
    button: 'Confirmer la commande',
    question: 'Confirmer la commande ?',
    done: 'Commande confirmée.',
    detail: 'À faire après avoir joint le client par téléphone ou WhatsApp.',
  },
  shipped: {
    button: 'Marquer comme expédiée',
    question: 'Marquer la commande comme expédiée ?',
    done: 'Commande expédiée.',
    detail: 'Le colis a été remis au livreur.',
  },
  delivered: {
    button: 'Marquer comme livrée',
    question: 'Marquer la commande comme livrée ?',
    done: 'Commande livrée.',
    detail: 'Le colis a été remis et le paiement encaissé.',
  },
  cancelled: {
    button: 'Annuler la commande',
    question: 'Annuler la commande ?',
    done: 'Commande annulée, les articles sont de nouveau en stock.',
    detail: 'Les articles retournent en stock.',
  },
  returned: {
    button: 'Enregistrer un retour',
    question: 'Enregistrer le retour de la commande ?',
    done: 'Retour enregistré, les articles sont de nouveau en stock.',
    detail: 'Colis refusé ou renvoyé : les articles retournent en stock.',
  },
}

export const MOVEMENT_LABEL: Record<MovementReason, string> = {
  sale: 'Vente',
  cancel: 'Annulation',
  return: 'Retour',
  restock: 'Réassort',
  adjust: 'Correction',
  initial: 'Stock initial',
}

export const LANG_LABEL: Record<string, string> = {
  fr: 'français',
  en: 'anglais',
  ar: 'arabe',
  ary: 'darija',
  zgh: 'tamazight',
}
