import type { Metadata } from 'next'
import Link from 'next/link'
import { dashboard } from '@nait/db'
import type { DashboardDay } from '@nait/db/types'
import { Article } from '@/components/article'
import { AutoRefresh } from '@/components/auto-refresh'
import { BarChart, type BarDatum } from '@/components/bar-chart'
import { Gauge } from '@/components/gauge'
import { StockTag } from '@/components/tags'
import { requireUser } from '@/lib/auth'
import { dayParts, formatLongDay, formatMad, formatNumber, plural } from '@/lib/format'
import { withQuery } from '@/lib/paths'
import { STATUS_TODO } from '@/lib/status'

export const metadata: Metadata = { title: 'Tableau de bord' }

const PIPELINE = ['new', 'confirmed', 'shipped', 'delivered'] as const

const PIPELINE_HINT: Record<(typeof PIPELINE)[number], string> = {
  new: 'Appeler le client',
  confirmed: 'Préparer le colis',
  shipped: 'Chez le livreur',
  delivered: 'Terminées',
}

const LOW_STOCK_SHOWN = 8

/** The seven days of the charts as figures (the chart's table view). */
function DayTable({ days }: { days: DashboardDay[] }) {
  const lastIndex = days.length - 1
  return (
    <table className="table daytable">
      <caption className="vh">Commandes et chiffre d’affaires des 7 derniers jours, hors annulations et retours</caption>
      <thead>
        <tr>
          <th scope="col">Jour</th>
          <th scope="col" className="num">
            Commandes
          </th>
          <th scope="col" className="num">
            Chiffre d’affaires
          </th>
        </tr>
      </thead>
      <tbody>
        {days.map((day, index) => {
          const parts = dayParts(day.day)
          return (
            <tr key={day.day}>
              <td className="nowrap">{index === lastIndex ? 'aujourd’hui' : `${parts.weekdayShort} ${parts.day}`}</td>
              <td className="num">{formatNumber(day.orders)}</td>
              <td className="num">{formatMad(day.revenue)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export default async function DashboardPage() {
  await requireUser()
  const data = await dashboard()
  const lastIndex = data.last7Days.length - 1

  const orderBars: BarDatum[] = data.last7Days.map((day, index) => {
    const parts = dayParts(day.day)
    return {
      key: day.day,
      tick: parts.weekdayShort,
      name: parts.label,
      value: day.orders,
      text: plural(day.orders, 'commande'),
      today: index === lastIndex,
    }
  })
  const revenueBars: BarDatum[] = data.last7Days.map((day, index) => {
    const parts = dayParts(day.day)
    return {
      key: day.day,
      tick: parts.weekdayShort,
      name: parts.label,
      value: day.revenue,
      text: formatMad(day.revenue),
      today: index === lastIndex,
    }
  })

  const lowStock = data.lowStock.slice(0, LOW_STOCK_SHOWN)
  const cancelled = data.ordersByStatus.cancelled ?? 0
  const returned = data.ordersByStatus.returned ?? 0

  return (
    <>
      <AutoRefresh seconds={60} />

      <header className="head">
        <div>
          <h1 className="head__title">Tableau de bord</h1>
          <p className="head__sub">{formatLongDay(new Date())}</p>
        </div>
      </header>

      <section aria-labelledby="titre-suivi">
        <h2 id="titre-suivi" className="vh">
          Commandes à traiter
        </h2>
        <ol className="pipeline">
          {PIPELINE.map((status) => {
            const count = data.ordersByStatus[status] ?? 0
            const todo = status === 'new' && count > 0
            return (
              <li key={status}>
                <Link className={`tile${todo ? ' tile--todo' : ''}`} href={withQuery('/commandes', { statut: status })}>
                  <span className="tile__n">{formatNumber(count)}</span>
                  <span className="tile__l">{STATUS_TODO[status]}</span>
                  <span className="tile__h">{PIPELINE_HINT[status]}</span>
                </Link>
              </li>
            )
          })}
        </ol>
        {cancelled + returned > 0 ? (
          <p className="pipeline__side">
            {cancelled > 0 ? (
              <Link href={withQuery('/commandes', { statut: 'cancelled' })}>
                {plural(cancelled, 'commande annulée', 'commandes annulées')}
              </Link>
            ) : null}
            {returned > 0 ? (
              <Link href={withQuery('/commandes', { statut: 'returned' })}>
                {plural(returned, 'commande retournée', 'commandes retournées')}
              </Link>
            ) : null}
          </p>
        ) : null}
      </section>

      <section className="section" aria-labelledby="titre-ventes">
        <h2 id="titre-ventes" className="vh">
          Ventes
        </h2>
        <div className="stats">
          <article className="stat">
            <h3 className="stat__label">Commandes aujourd’hui</h3>
            <p className="stat__value">{formatNumber(data.ordersToday)}</p>
            <figure className="stat__chart">
              <BarChart label="Commandes par jour, 7 derniers jours" data={orderBars} emptyMax={4} />
              <figcaption className="stat__cap">Commandes par jour, 7 derniers jours</figcaption>
            </figure>
          </article>
          <article className="stat">
            <h3 className="stat__label">Chiffre d’affaires aujourd’hui</h3>
            <p className="stat__value">
              {formatNumber(data.revenueToday)} <span className="stat__unit">DH</span>
            </p>
            <figure className="stat__chart">
              <BarChart label="Chiffre d’affaires par jour en dirhams, 7 derniers jours" data={revenueBars} emptyMax={1000} />
              <figcaption className="stat__cap">Chiffre d’affaires par jour (DH), 7 derniers jours</figcaption>
            </figure>
          </article>
          {/* The same figures as a table: beside the charts on a wide screen... */}
          <div className="stats__table">
            <DayTable days={data.last7Days} />
          </div>
        </div>

        {/* ...and behind a link where there is no room for it. */}
        <details className="figures">
          <summary>Voir les chiffres jour par jour</summary>
          <DayTable days={data.last7Days} />
        </details>
        <p className="stat__cap">Les commandes annulées ou retournées ne sont pas comptées.</p>
      </section>

      <section className="section" aria-labelledby="titre-stock">
        <div className="section__head">
          <h2 id="titre-stock" className="section__title">
            Stock bas
          </h2>
          {data.lowStock.length > 0 ? (
            <Link className="link" href={withQuery('/stock', { bas: 1 })}>
              {data.lowStock.length > LOW_STOCK_SHOWN
                ? `Voir les ${formatNumber(data.lowStock.length)} articles`
                : 'Ouvrir dans le stock'}
            </Link>
          ) : null}
        </div>

        {lowStock.length === 0 ? (
          <p className="notice notice--ok">Aucun article sous son seuil : le stock est à niveau.</p>
        ) : (
          <table className="table table--stack">
            <thead>
              <tr>
                <th scope="col">Article</th>
                <th scope="col" className="num">
                  En stock
                </th>
                <th scope="col" className="num">
                  Seuil
                </th>
                <th scope="col">
                  <span className="vh">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {lowStock.map((row) => (
                <tr key={row.id}>
                  <td className="c-wide">
                    <Article
                      productName={row.productName}
                      scentName={row.scentName}
                      scentTag={row.scentTag}
                      sizeMl={row.sizeMl}
                      lead={<Gauge stock={row.stock} threshold={row.lowStockThreshold} />}
                    />
                  </td>
                  <td className="num">
                    <span className="stockcell">
                      <StockTag stock={row.stock} low={row.low} />
                      <span className="stockcell__n">{formatNumber(row.stock)}</span>
                    </span>
                  </td>
                  <td className="num c-hide">{formatNumber(row.lowStockThreshold)}</td>
                  <td className="num c-end">
                    <Link className="btn btn--line btn--sm" href={withQuery('/stock', { q: row.sku })}>
                      Réassortir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  )
}
