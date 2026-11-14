import type { Metadata } from 'next'
import Link from 'next/link'
import { listMovements, listVariants } from '@nait/db'
import { Article } from '@/components/article'
import { Pager } from '@/components/pager'
import { requireUser } from '@/lib/auth'
import { formatNumber, formatScent, formatSize, formatWhen } from '@/lib/format'
import { firstParam, pageParam, withQuery } from '@/lib/paths'
import { MOVEMENT_LABEL } from '@/lib/status'

export const metadata: Metadata = { title: 'Mouvements de stock' }

const PAGE_SIZE = 50
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function MovementsPage(props: PageProps<'/stock/mouvements'>) {
  await requireUser()
  const searchParams = await props.searchParams

  const variantParam = firstParam(searchParams.variante)
  const variantId = UUID.test(variantParam) ? variantParam : undefined
  const page = pageParam(searchParams.page)

  // One row more than the page shows tells whether a next page exists.
  const [fetched, variants] = await Promise.all([
    listMovements({ variantId, limit: PAGE_SIZE + 1, offset: (page - 1) * PAGE_SIZE }),
    listVariants(),
  ])
  const hasNext = fetched.length > PAGE_SIZE
  const rows = fetched.slice(0, PAGE_SIZE)
  const now = new Date()

  // A movement names its scent without the Extra / Super tag: the variant list supplies it,
  // otherwise two variants of the same scent could not be told apart.
  const tagOf = new Map(variants.map((variant) => [variant.id, variant.scentTag]))

  // Name of the variant the history is limited to.
  let variantLabel = ''
  if (variantId) {
    const variant = variants.find((row) => row.id === variantId)
    if (variant) {
      variantLabel =
        `${formatScent(variant.scentName, variant.scentTag)} ${formatSize(variant.sizeMl)}`.trim() + `, ${variant.productName}`
    }
  }

  return (
    <>
      <Link className="back" href="/stock">
        ‹ Stock
      </Link>

      <header className="head">
        <div>
          <h1 className="head__title">Mouvements de stock</h1>
          <p className="head__sub">
            {variantId
              ? `Historique de ${variantLabel || 'cette variante'}`
              : 'Ventes, annulations, retours, réassorts et corrections, du plus récent au plus ancien'}
          </p>
        </div>
        {variantId ? (
          <div className="head__actions">
            <Link className="btn btn--line btn--sm" href="/stock/mouvements">
              Voir tous les mouvements
            </Link>
          </div>
        ) : null}
      </header>

      {rows.length === 0 ? (
        <div className="empty">
          <p className="empty__title">{page > 1 ? 'Fin de l’historique' : 'Aucun mouvement'}</p>
          <p className="empty__text">
            {page > 1
              ? 'Il n’y a pas de mouvement plus ancien.'
              : 'Chaque vente, retour, réassort ou correction de stock s’inscrit ici.'}
          </p>
          {page > 1 ? (
            <Link className="btn btn--line" href={withQuery('/stock/mouvements', { variante: variantId })}>
              Revenir au début
            </Link>
          ) : null}
        </div>
      ) : (
        <>
          <table className="table table--stack table--moves">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Article</th>
                <th scope="col">Motif</th>
                <th scope="col" className="num">
                  Mouvement
                </th>
                <th scope="col" className="num">
                  Stock après
                </th>
                <th scope="col">Commande</th>
                <th scope="col">Par</th>
                <th scope="col">Note</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((move) => (
                <tr key={move.id}>
                  <td className="muted nowrap m-when">{formatWhen(move.createdAt, now)}</td>
                  <td className="m-article">
                    <Article
                      productName={move.productName}
                      scentName={move.scentName}
                      scentTag={tagOf.get(move.variantId)}
                      sizeMl={move.sizeMl}
                      sku={move.sku}
                    />
                  </td>
                  <td className="m-reason nowrap">{MOVEMENT_LABEL[move.reason] ?? move.reason}</td>
                  <td className={`num strong m-delta ${move.delta < 0 ? 'delta--out' : 'delta--in'}`}>
                    {move.delta > 0 ? '+' : move.delta < 0 ? '−' : ''}
                    {formatNumber(Math.abs(move.delta))}
                  </td>
                  <td className="num m-after" data-label="Stock après">
                    {move.stockAfter === null ? '' : formatNumber(move.stockAfter)}
                  </td>
                  <td className="m-order">
                    {move.orderNumber ? (
                      <Link className="link nowrap" href={`/commandes/${encodeURIComponent(move.orderNumber)}`}>
                        {move.orderNumber}
                      </Link>
                    ) : null}
                  </td>
                  <td className="muted m-user">{move.userName ?? (move.reason === 'sale' ? 'Boutique' : '')}</td>
                  <td className="quote m-note">{move.note}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <Pager
            page={page}
            pageSize={PAGE_SIZE}
            count={rows.length}
            hasNext={hasNext}
            href={(target) =>
              withQuery('/stock/mouvements', { variante: variantId, page: target > 1 ? target : undefined })
            }
            noun="mouvement"
          />
        </>
      )}
    </>
  )
}
