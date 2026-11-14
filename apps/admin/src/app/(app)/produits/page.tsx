import type { Metadata } from 'next'
import Link from 'next/link'
import { listCollections, listProducts } from '@nait/db'
import { SubmitButton } from '@/components/form-bits'
import { ActiveTag } from '@/components/tags'
import { Thumb } from '@/components/thumb'
import { requireUser } from '@/lib/auth'
import { formatMad, formatNumber, plural } from '@/lib/format'
import { displayImageUrl } from '@/lib/images'
import { firstParam, withQuery } from '@/lib/paths'
import { toggleProduct } from './actions'

export const metadata: Metadata = { title: 'Produits' }

export default async function ProductsPage(props: PageProps<'/produits'>) {
  await requireUser()
  const searchParams = await props.searchParams
  const collectionParam = firstParam(searchParams.collection)

  const [collections, everything] = await Promise.all([listCollections(), listProducts()])
  const collection = collections.find((one) => one.slug === collectionParam)
  const products = collection ? everything.filter((product) => product.collectionId === collection.id) : everything
  const collectionName = new Map(collections.map((one) => [one.id, one.nameFr]))
  const hidden = everything.filter((product) => !product.active).length

  return (
    <>
      <header className="head">
        <div>
          <h1 className="head__title">Produits</h1>
          <p className="head__sub">
            {plural(everything.length, 'parfum')} au catalogue
            {hidden > 0 ? `, dont ${formatNumber(hidden)} hors vente` : ''}
          </p>
        </div>
      </header>

      <nav className="chips" aria-label="Filtrer par collection">
        <Link className="chip" href="/produits" aria-current={collection ? undefined : 'true'}>
          Toutes <span className="chip__n">{formatNumber(everything.length)}</span>
        </Link>
        {collections.map((one) => (
          <Link
            key={one.id}
            className="chip"
            href={withQuery('/produits', { collection: one.slug })}
            aria-current={collection?.id === one.id ? 'true' : undefined}
          >
            {one.nameFr}{' '}
            <span className="chip__n">
              {formatNumber(everything.filter((product) => product.collectionId === one.id).length)}
            </span>
          </Link>
        ))}
      </nav>

      {products.length === 0 ? (
        <div className="empty section">
          <p className="empty__title">Aucun parfum dans cette collection</p>
          <p className="empty__text">Pour en ajouter un, ouvrez un parfum et changez sa collection.</p>
          <Link className="btn btn--line" href="/produits">
            Voir tous les produits
          </Link>
        </div>
      ) : (
        <table className="table table--stack table--products section">
          <thead>
            <tr>
              <th scope="col">Parfum</th>
              <th scope="col">Collection</th>
              <th scope="col" className="num">
                Senteurs
              </th>
              <th scope="col" className="num">
                À partir de
              </th>
              <th scope="col" className="num">
                Flacons en stock
              </th>
              <th scope="col">Boutique</th>
              <th scope="col">
                <span className="vh">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const image = displayImageUrl(product.imageUrl)
              return (
                <tr key={product.id}>
                  <td className="p-name">
                    <div className="withthumb">
                      <Thumb src={image} />
                      <div>
                        <Link className="rowlink" href={`/produits/${encodeURIComponent(product.slug)}`}>
                          {product.name}
                        </Link>
                        <span className="sub only-phone-block">{collectionName.get(product.collectionId) ?? ''}</span>
                      </div>
                    </div>
                  </td>
                  <td className="c-hide">{collectionName.get(product.collectionId) ?? ''}</td>
                  <td className="num p-scents" data-label="Senteurs">
                    {formatNumber(product.scentCount)}
                  </td>
                  <td className="num p-price" data-label="À partir de">
                    {product.minPrice > 0 ? formatMad(product.minPrice) : ''}
                  </td>
                  <td className="num p-stock" data-label="En stock">
                    {formatNumber(product.totalStock)}
                  </td>
                  <td className="p-state">
                    <ActiveTag active={product.active} on="En vente" off="Hors vente" />
                  </td>
                  <td className="p-actions">
                    <div className="rowactions">
                      <form action={toggleProduct.bind(null, product.id, !product.active)}>
                        <SubmitButton className="btn btn--line btn--sm" pendingLabel="…">
                          {product.active ? 'Retirer de la vente' : 'Remettre en vente'}
                        </SubmitButton>
                      </form>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </>
  )
}
