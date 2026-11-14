import type { OrderStatus } from '@nait/db/types'
import { STATUS_LABEL } from '@/lib/status'

export function StatusTag({ status }: { status: OrderStatus }) {
  return <span className={`tag tag--${status}`}>{STATUS_LABEL[status]}</span>
}

/** Stock state in a word; nothing when the level is fine. */
export function StockTag({ stock, low }: { stock: number; low: boolean }) {
  if (stock <= 0) return <span className="tag tag--out">Épuisé</span>
  if (low) return <span className="tag tag--low">Stock bas</span>
  return null
}

export function ActiveTag({ active, on = 'Actif', off = 'Inactif' }: { active: boolean; on?: string; off?: string }) {
  return <span className={`tag ${active ? 'tag--on' : 'tag--off'}`}>{active ? on : off}</span>
}
