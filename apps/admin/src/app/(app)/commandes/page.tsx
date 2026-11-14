import type { Metadata } from 'next'
import Form from 'next/form'
import Link from 'next/link'
import { countOrders, listOrders } from '@nait/db'
import type { OrderStatus } from '@nait/db/types'
import { AutoRefresh } from '@/components/auto-refresh'
import { Icon } from '@/components/icons'
import { Pager } from '@/components/pager'
import { StatusTag } from '@/components/tags'
import { requireUser } from '@/lib/auth'
import { formatMad, formatNumber, formatPhone, formatWhen, plural } from '@/lib/format'
import { firstParam, pageParam, withQuery } from '@/lib/paths'
import { isOrderStatus, ORDER_STATUS_LIST, STATUS_LABEL_PLURAL } from '@/lib/status'

export const metadata: Metadata = { title: 'Commandes' }

const PAGE_SIZE = 25

export default async function OrdersPage(props: PageProps<'/commandes'>) {
  await requireUser()
  const searchParams = await props.searchParams

  const statusParam = firstParam(searchParams.statut)
  const status: OrderStatus | undefined = isOrderStatus(statusParam) ? statusParam : undefined
  const q = firstParam(searchParams.q).trim().slice(0, 80)
  const page = pageParam(searchParams.page)
  const search = q || undefined

  const [orders, total, all, ...perStatus] = await Promise.all([
    listOrders({ status, q: search, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    countOrders({ status, q: search }),
    countOrders({ q: search }),
    ...ORDER_STATUS_LIST.map((one) => countOrders({ status: one, q: search })),
  ])

  const now = new Date()
  const filtered = Boolean(status || q)
  const exportHref = withQuery('/commandes/export', { statut: status, q })

  return (
    <>
      <AutoRefresh seconds={60} />

      <header className="head">
        <h1 className="head__title">Commandes</h1>
        <div className="head__actions">
          {total > 0 ? (
            <a className="btn btn--line btn--sm" href={exportHref} download>
              <Icon name="download" className="btn__icon" />
              Exporter en CSV
            </a>
          ) : null}
        </div>
      </header>

      <nav className="chips" aria-label="Filtrer par statut">
        <Link className="chip" href={withQuery('/commandes', { q })} aria-current={status ? undefined : 'true'}>
          Toutes <span className="chip__n">{formatNumber(all)}</span>
        </Link>
        {ORDER_STATUS_LIST.map((one, index) => (
          <Link
            key={one}
            className="chip"
            href={withQuery('/commandes', { statut: one, q })}
            aria-current={status === one ? 'true' : undefined}
          >
            {STATUS_LABEL_PLURAL[one]} <span className="chip__n">{formatNumber(perStatus[index] ?? 0)}</span>
          </Link>
        ))}
      </nav>

      <Form action="/commandes" className="searchbar" role="search">
        {status ? <input type="hidden" name="statut" value={status} /> : null}
        <input
          className="input"
          type="search"
          name="q"
          defaultValue={q}
          placeholder="N°, nom, téléphone ou ville"
          aria-label="Rechercher une commande"
          maxLength={80}
          enterKeyHint="search"
        />
        <button type="submit" className="btn">
          Rechercher
        </button>
      </Form>

      {orders.length === 0 ? (
        <div className="empty">
          {page > 1 && total > 0 ? (
            <>
              <p className="empty__title">Il n’y a pas de page {formatNumber(page)}</p>
              <p className="empty__text">La liste est plus courte que cela.</p>
              <Link className="btn btn--line" href={withQuery('/commandes', { statut: status, q })}>
                Revenir à la première page
              </Link>
            </>
          ) : filtered ? (
            <>
              <p className="empty__title">Aucune commande ne correspond</p>
              <p className="empty__text">
                {q ? `Rien pour « ${q} »` : 'Rien'}
                {status ? ` parmi les commandes ${STATUS_LABEL_PLURAL[status].toLowerCase()}` : ''}. Vérifiez
                l’orthographe ou élargissez la recherche.
              </p>
              <Link className="btn btn--line" href="/commandes">
                Voir toutes les commandes
              </Link>
            </>
          ) : (
            <>
              <p className="empty__title">Pas encore de commande</p>
              <p className="empty__text">
                Les commandes passées sur la boutique arrivent ici, les plus récentes en premier.
              </p>
            </>
          )}
        </div>
      ) : (
        <>
          <table className="table table--stack table--orders">
            <thead>
              <tr>
                <th scope="col">Commande</th>
                <th scope="col">Statut</th>
                <th scope="col">Client</th>
                <th scope="col">Ville</th>
                <th scope="col" className="num">
                  Articles
                </th>
                <th scope="col" className="num">
                  Total
                </th>
                <th scope="col">Passée</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="o-num">
                    <Link className="rowlink nowrap" href={`/commandes/${encodeURIComponent(order.number)}`}>
                      {order.number}
                    </Link>
                  </td>
                  <td className="o-status">
                    <StatusTag status={order.status} />
                  </td>
                  <td className="o-who">
                    <bdi className="strong">{order.customerName}</bdi>
                    <span className="sub nowrap">{formatPhone(order.phone)}</span>
                  </td>
                  <td className="c-hide">
                    <bdi>{order.city}</bdi>
                  </td>
                  <td className="num muted o-count">{plural(order.itemCount, 'article')}</td>
                  <td className="num strong o-total">{formatMad(order.totalMad)}</td>
                  <td className="muted o-meta">
                    <span className="only-phone">
                      <bdi>{order.city}</bdi>,{' '}
                    </span>
                    <span className="nowrap">{formatWhen(order.createdAt, now)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <Pager
            page={page}
            pageSize={PAGE_SIZE}
            count={orders.length}
            total={total}
            href={(target) => withQuery('/commandes', { statut: status, q, page: target > 1 ? target : undefined })}
            noun="commande"
          />
        </>
      )}
    </>
  )
}
