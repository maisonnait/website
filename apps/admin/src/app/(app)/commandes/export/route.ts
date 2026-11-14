import type { NextRequest } from 'next/server'
import { listOrders } from '@nait/db'
import type { OrderListItem, OrderStatus } from '@nait/db/types'
import { getSessionUser } from '@/lib/auth'
import { CSV_BOM, csvRow } from '@/lib/csv'
import { formatPhone, moroccoDay, TIME_ZONE } from '@/lib/format'
import { isOrderStatus, STATUS_LABEL } from '@/lib/status'

/** The export covers the whole filtered list, not just the page on screen. */
const BATCH = 500
const MAX_ROWS = 20_000

const stamp = new Intl.DateTimeFormat('fr-FR', {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function when(date: Date | null): string {
  return date ? stamp.format(date).replace(',', '') : ''
}

const HEADER = [
  'Commande',
  'Statut',
  'Passée le',
  'Client',
  'Téléphone',
  'Ville',
  'Adresse',
  'Note du client',
  'Articles',
  'Sous-total (DH)',
  'Livraison (DH)',
  'Total (DH)',
  'Paiement',
  'Langue',
  'Confirmée le',
  'Expédiée le',
  'Livrée le',
  'Annulée le',
  'Retournée le',
  'Note interne',
]

function line(order: OrderListItem): string {
  return csvRow([
    order.number,
    STATUS_LABEL[order.status],
    when(order.createdAt),
    order.customerName,
    formatPhone(order.phone),
    order.city,
    order.address,
    order.note,
    order.itemCount,
    order.subtotalMad,
    order.shippingMad,
    order.totalMad,
    order.paymentMethod === 'cod' ? 'À la livraison' : order.paymentMethod,
    order.lang,
    when(order.confirmedAt),
    when(order.shippedAt),
    when(order.deliveredAt),
    when(order.cancelledAt),
    when(order.returnedAt),
    order.internalNote,
  ])
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return new Response('Connexion requise.', { status: 401, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })

  const params = request.nextUrl.searchParams
  const statusParam = params.get('statut') ?? ''
  const status: OrderStatus | undefined = isOrderStatus(statusParam) ? statusParam : undefined
  const q = (params.get('q') ?? '').trim().slice(0, 80) || undefined

  let body = CSV_BOM + csvRow(HEADER)
  for (let offset = 0; offset < MAX_ROWS; offset += BATCH) {
    const batch = await listOrders({ status, q, limit: BATCH, offset })
    for (const order of batch) body += line(order)
    if (batch.length < BATCH) break
  }

  const name = `commandes-nait-${moroccoDay(new Date())}${status ? `-${status}` : ''}.csv`
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
