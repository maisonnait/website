import type { Metadata } from 'next'
import Form from 'next/form'
import Link from 'next/link'
import { listVariants } from '@nait/db'
import { Article } from '@/components/article'
import { Gauge } from '@/components/gauge'
import { Icon } from '@/components/icons'
import { Pager } from '@/components/pager'
import { StockTag } from '@/components/tags'
import { requireUser } from '@/lib/auth'
import { formatMad, formatNumber, formatScent, formatSize } from '@/lib/format'
import { firstParam, pageParam, withQuery } from '@/lib/paths'
import { StockAdjust } from './stock-adjust'

export const metadata: Metadata = { title: 'Stock' }

const PAGE_SIZE = 40

export default async function StockPage(props: PageProps<'/stock'>) {
  await requireUser()
  const searchParams = await props.searchParams

  const q = firstParam(searchParams.q).trim().slice(0, 80)
  const lowOnly = firstParam(searchParams.bas) === '1'
  const page = pageParam(searchParams.page)

  const matching = await listVariants({ q: q || undefined, lowOnly })
  const total = matching.length
  const low = lowOnly ? total : matching.filter((row) => row.low).length
  const rows = matching.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const units = matching.reduce((sum, row) => sum + row.stock, 0)

  return (
    <>
      <header className="head">
        <div>
          <h1 className="head__title">Stock</h1>
          <p className="head__sub">
            {formatNumber(total)} {total > 1 ? 'variantes' : 'variante'}
            {q || lowOnly ? ' dans cette sélection' : ''}, {formatNumber(units)} {units > 1 ? 'flacons' : 'flacon'} en stock
          </p>
        </div>
        <div className="head__actions">
          <Link className="btn btn--line btn--sm" href="/stock/mouvements">
            <Icon name="history" className="btn__icon" />
            Historique des mouvements
          </Link>
        </div>
      </header>

      <nav className="chips" aria-label="Filtrer le stock">
        <Link className="chip" href={withQuery('/stock', { q })} aria-current={lowOnly ? undefined : 'true'}>
          Tout le stock
        </Link>
        <Link className="chip" href={withQuery('/stock', { q, bas: 1 })} aria-current={lowOnly ? 'true' : undefined}>
          Stock bas <span className="chip__n">{formatNumber(low)}</span>
        </Link>
      </nav>

      <Form action="/stock" className="searchbar" role="search">
        {lowOnly ? <input type="hidden" name="bas" value="1" /> : null}
        <input
          className="input"
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Parfum, senteur ou référence"
          aria-label="Rechercher dans le stock"
          maxLength={80}
          enterKeyHint="search"
        />
        <button type="submit" className="btn">
          Rechercher
        </button>
      </Form>

      {rows.length === 0 ? (
        <div className="empty">
          {page > 1 && total > 0 ? (
            <>
              <p className="empty__title">Il n’y a pas de page {formatNumber(page)}</p>
              <p className="empty__text">La liste est plus courte que cela.</p>
              <Link className="btn btn--line" href={withQuery('/stock', { q, bas: lowOnly ? 1 : undefined })}>
                Revenir à la première page
              </Link>
            </>
          ) : lowOnly && !q ? (
            <>
              <p className="empty__title">Aucun stock bas</p>
              <p className="empty__text">Toutes les variantes sont au-dessus de leur seuil.</p>
              <Link className="btn btn--line" href="/stock">
                Voir tout le stock
              </Link>
            </>
          ) : (
            <>
              <p className="empty__title">Aucune variante ne correspond</p>
              <p className="empty__text">
                {q ? `Rien pour « ${q} »${lowOnly ? ' parmi les stocks bas' : ''}. ` : ''}Essayez le nom du parfum, celui de
                la senteur ou la référence.
              </p>
              <Link className="btn btn--line" href="/stock">
                Voir tout le stock
              </Link>
            </>
          )}
        </div>
      ) : (
        <>
          <table className="table table--stack table--stock">
            <thead>
              <tr>
                <th scope="col">Article</th>
                <th scope="col" className="num">
                  Prix
                </th>
                <th scope="col" className="num">
                  En stock
                </th>
                <th scope="col" className="num">
                  Seuil
                </th>
                <th scope="col" className="num">
                  Ajouter ou retirer
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const name = `${formatScent(row.scentName, row.scentTag)} ${formatSize(row.sizeMl)}`.trim()
                const sellable = row.active && row.productActive
                return (
                  <tr key={row.id}>
                    <td className="s-article">
                      <Article
                        productName={row.productName}
                        scentName={row.scentName}
                        scentTag={row.scentTag}
                        sizeMl={row.sizeMl}
                        sku={row.sku}
                        lead={<Gauge stock={row.stock} threshold={row.lowStockThreshold} />}
                      >
                        {sellable ? null : <span className="tag tag--off article__tag">Hors vente</span>}
                      </Article>
                    </td>
                    <td className="num c-hide">{formatMad(row.priceMad)}</td>
                    <td className="num s-stock">
                      <span className="stockcell">
                        <StockTag stock={row.stock} low={row.low} />
                        <span className="stockcell__n">{formatNumber(row.stock)}</span>
                      </span>
                    </td>
                    <td className="num muted s-threshold">
                      <span className="only-phone">seuil </span>
                      {formatNumber(row.lowStockThreshold)}
                    </td>
                    <td className="num s-adjust">
                      <StockAdjust
                        variantId={row.id}
                        label={name}
                        stock={row.stock}
                        aside={
                          <Link className="link s-history" href={withQuery('/stock/mouvements', { variante: row.id })}>
                            Historique<span className="vh"> de {name}</span>
                          </Link>
                        }
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <Pager
            page={page}
            pageSize={PAGE_SIZE}
            count={rows.length}
            total={total}
            href={(target) => withQuery('/stock', { q, bas: lowOnly ? 1 : undefined, page: target > 1 ? target : undefined })}
            noun="variante"
          />
        </>
      )}
    </>
  )
}
