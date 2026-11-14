import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { getOrder, getSettings } from '@nait/db'
import type { OrderDetail, OrderStatus } from '@nait/db/types'
import { Icon } from '@/components/icons'
import { PrintButton } from '@/components/print-button'
import { StatusTag } from '@/components/tags'
import { Wordmark } from '@/components/wordmark'
import { requireUser } from '@/lib/auth'
import {
  formatDate,
  formatDateTime,
  formatItem,
  formatMad,
  formatPhone,
  formatScent,
  formatSize,
  plural,
  telHref,
  whatsappHref,
} from '@/lib/format'
import { LANG_LABEL, STATUS_LABEL } from '@/lib/status'
import { NoteForm } from './note-form'
import { StatusActions } from './status-actions'

const loadOrder = cache(async (id: string): Promise<OrderDetail | null> => {
  const key = decodeURIComponent(id).trim()
  if (!key || key.length > 64) return null
  return getOrder(key)
})

export async function generateMetadata(props: PageProps<'/commandes/[id]'>): Promise<Metadata> {
  await requireUser()
  const { id } = await props.params
  const order = await loadOrder(id)
  return { title: order ? `Commande ${order.number}` : 'Commande introuvable' }
}

/** What to do now, in one sentence. */
const NEXT_HINT: Record<OrderStatus, string> = {
  new: 'Appelez le client pour confirmer l’adresse et le montant, puis confirmez la commande.',
  confirmed: 'Préparez le colis, imprimez le bon de livraison et remettez-le au livreur.',
  shipped: 'Le colis est en route. Marquez la commande comme livrée une fois le paiement encaissé.',
  delivered: 'Commande terminée. En cas de renvoi du colis, enregistrez un retour.',
  cancelled: 'Commande annulée : les articles sont de nouveau en stock. Si le client change d’avis, vous pouvez la rouvrir.',
  returned: 'Colis retourné : les articles sont de nouveau en stock.',
}

/** Opening line of the WhatsApp conversation, in the language the customer ordered in. */
function whatsappMessage(order: OrderDetail): string {
  const total = formatMad(order.totalMad)
  if (order.lang === 'ar' || order.lang === 'ary') {
    return `السلام عليكم ${order.customerName}، معكم Maison N'Ait. نتواصل معكم لتأكيد طلبكم رقم ${order.number} بمبلغ ${order.totalMad} درهم، الدفع عند الاستلام.`
  }
  if (order.lang === 'en') {
    return `Hello ${order.customerName}, this is Maison N'Ait. We are contacting you to confirm your order ${order.number} (${order.totalMad} MAD, cash on delivery).`
  }
  return `Bonjour ${order.customerName}, ici la Maison N'Ait. Nous vous contactons pour confirmer votre commande ${order.number} (${total}, paiement à la livraison).`
}

interface Step {
  label: string
  at: Date | null
}

function timeline(order: OrderDetail): Step[] {
  const steps: Step[] = [{ label: 'Commande passée', at: order.createdAt }]
  const closedEarly = order.status === 'cancelled' || order.status === 'returned'
  const path: Array<[string, Date | null]> = [
    ['Confirmée', order.confirmedAt],
    ['Expédiée', order.shippedAt],
    ['Livrée', order.deliveredAt],
  ]
  for (const [label, at] of path) {
    // After a cancellation or a return, the steps never reached are left out.
    if (at || !closedEarly) steps.push({ label, at })
  }
  if (order.cancelledAt || order.status === 'cancelled') steps.push({ label: 'Annulée', at: order.cancelledAt })
  if (order.returnedAt || order.status === 'returned') steps.push({ label: 'Retournée', at: order.returnedAt })
  return steps
}

export default async function OrderPage(props: PageProps<'/commandes/[id]'>) {
  await requireUser()
  const { id } = await props.params
  const order = await loadOrder(id)
  if (!order) notFound()

  const settings = await getSettings()
  const bottles = order.items.reduce((sum, item) => sum + item.quantity, 0)
  const steps = timeline(order)

  return (
    <>
      <div className="no-print">
        <Link className="back" href="/commandes">
          ‹ Toutes les commandes
        </Link>

        <header className="head">
          <div>
            <h1 className="head__title">Commande {order.number}</h1>
            <p className="order__meta">
              <StatusTag status={order.status} />
              <span>Passée le {formatDateTime(order.createdAt)}</span>
              <span>Boutique en {LANG_LABEL[order.lang] ?? order.lang}</span>
            </p>
          </div>
          <div className="head__actions">
            <PrintButton label="Imprimer le bon de livraison" />
          </div>
        </header>

        <div className="order__grid">
          <div className="order__col">
            <section className="panel panel--wash order__next" aria-labelledby="titre-suite">
              <h2 className="panel__title" id="titre-suite">
                Suite à donner
              </h2>
              <div className="next">
                <p className="next__hint">{NEXT_HINT[order.status]}</p>
                <StatusActions orderId={order.id} number={order.number} status={order.status} />
              </div>
            </section>

            <section className="panel order__items" aria-labelledby="titre-articles">
              <h2 className="panel__title" id="titre-articles">
                {plural(bottles, 'article')}
              </h2>
              <table className="items">
                <tbody>
                  {order.items.map((item) => {
                    const same = item.scentName.trim().toLowerCase() === item.productName.trim().toLowerCase()
                    return (
                      <tr key={item.id}>
                        <td>
                          <span className="items__name">{same ? item.productName : formatScent(item.scentName)}</span>
                          {formatSize(item.sizeMl) ? <span className="nowrap"> {formatSize(item.sizeMl)}</span> : null}
                          {same ? null : <span className="sub">{item.productName}</span>}
                        </td>
                        <td className="num muted">
                          {item.quantity} × {formatMad(item.unitPriceMad)}
                        </td>
                        <td className="num strong">{formatMad(item.quantity * item.unitPriceMad)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <dl className="totals">
                <dt>Sous-total</dt>
                <dd>{formatMad(order.subtotalMad)}</dd>
                <dt>Livraison</dt>
                <dd>{order.shippingMad === 0 ? 'Offerte' : formatMad(order.shippingMad)}</dd>
                <dt className="totals__due">À encaisser à la livraison</dt>
                <dd className="totals__due">{formatMad(order.totalMad)}</dd>
              </dl>
            </section>

            <section className="panel order__note" aria-labelledby="titre-note">
              <h2 className="panel__title" id="titre-note">
                Note interne
              </h2>
              <NoteForm orderId={order.id} note={order.internalNote ?? ''} />
            </section>
          </div>

          <div className="order__col">
            <section className="panel order__customer" aria-labelledby="titre-client">
              <h2 className="panel__title" id="titre-client">
                Client
              </h2>
              <p className="customer__name">
                <bdi>{order.customerName}</bdi>
              </p>
              <p className="customer__phone">{formatPhone(order.phone)}</p>
              <div className="customer__contact">
                <a className="btn" href={telHref(order.phone)}>
                  <Icon name="phone" className="btn__icon" />
                  Appeler
                </a>
                <a
                  className="btn btn--line"
                  href={whatsappHref(order.phone, whatsappMessage(order))}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="chat" className="btn__icon" />
                  WhatsApp
                </a>
              </div>
              <dl className="kv">
                <dt>Ville</dt>
                <dd>
                  <bdi>{order.city}</bdi>
                </dd>
                <dt>Adresse</dt>
                <dd className="quote">
                  <bdi>{order.address}</bdi>
                </dd>
                {order.note ? (
                  <>
                    <dt>Sa note</dt>
                    <dd className="quote">
                      <bdi>{order.note}</bdi>
                    </dd>
                  </>
                ) : null}
              </dl>
            </section>

            <section className="panel order__steps" aria-labelledby="titre-suivi">
              <h2 className="panel__title" id="titre-suivi">
                Suivi
              </h2>
              <ol className="steps">
                {steps.map((step) => (
                  <li key={step.label} className={step.at ? undefined : 'steps__todo'}>
                    <span>{step.label}</span>
                    <span className="steps__when">{step.at ? formatDateTime(step.at) : 'à venir'}</span>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </div>
      </div>

      {/* Printed only: the slip that travels with the parcel. No internal note on it. */}
      <article className="print-only slip">
        <header className="slip__head">
          <div>
            <p aria-label="N’Ait">
              <Wordmark className="slip__mark" />
            </p>
            <p className="slip__shop">
              Maison N’Ait{settings.shopPhone ? `, ${formatPhone(settings.shopPhone)}` : ''}
            </p>
          </div>
          <div className="slip__doc">
            <p className="slip__doc-title">Bon de livraison</p>
            <p className="slip__number">{order.number}</p>
            <p>{formatDate(order.createdAt)}</p>
          </div>
        </header>

        <section className="slip__to">
          <p className="slip__label">Destinataire</p>
          <p className="slip__name">
            <bdi>{order.customerName}</bdi>
          </p>
          <p className="slip__phone">{formatPhone(order.phone)}</p>
          <p className="slip__address">
            <bdi>{order.address}</bdi>
            {'\n'}
            <bdi>{order.city}</bdi>
          </p>
          {order.note ? (
            <p className="slip__note">
              Note du client : <bdi>{order.note}</bdi>
            </p>
          ) : null}
        </section>

        <table className="slip__items">
          <thead>
            <tr>
              <th scope="col">Article</th>
              <th scope="col" className="num">
                Qté
              </th>
              <th scope="col" className="num">
                Prix
              </th>
              <th scope="col" className="num">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <td>{formatItem(item.productName, item.scentName, item.sizeMl)}</td>
                <td className="num">{item.quantity}</td>
                <td className="num">{formatMad(item.unitPriceMad)}</td>
                <td className="num">{formatMad(item.quantity * item.unitPriceMad)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="slip__totals">
          <dt>Sous-total</dt>
          <dd>{formatMad(order.subtotalMad)}</dd>
          <dt>Livraison</dt>
          <dd>{order.shippingMad === 0 ? 'Offerte' : formatMad(order.shippingMad)}</dd>
        </dl>

        <p className="slip__due">
          <span className="slip__due-label">À encaisser à la livraison</span>
          <span className="slip__due-amount">{formatMad(order.totalMad)}</span>
        </p>

        <p className="slip__foot">
          Paiement en espèces à la livraison. {plural(bottles, 'article')}. Statut au moment de l’impression :{' '}
          {STATUS_LABEL[order.status].toLowerCase()}.
        </p>
      </article>
    </>
  )
}
