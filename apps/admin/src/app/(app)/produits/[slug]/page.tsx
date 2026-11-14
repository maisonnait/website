import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { getProduct, listCollections } from '@nait/db'
import type { ProductDetail } from '@nait/db/types'
import { ActiveTag } from '@/components/tags'
import { requireUser } from '@/lib/auth'
import { formatNumber, formatScent, formatSize, plural } from '@/lib/format'
import { blobUploadsEnabled, displayImageUrl } from '@/lib/images'
import { withQuery } from '@/lib/paths'
import { ProductForm } from './product-form'
import { VariantsForm, type VariantLine } from './variants-form'

const loadProduct = cache(async (slug: string): Promise<ProductDetail | null> => {
  const key = decodeURIComponent(slug).trim()
  if (!key || key.length > 64) return null
  return getProduct(key)
})

export async function generateMetadata(props: PageProps<'/produits/[slug]'>): Promise<Metadata> {
  await requireUser()
  const { slug } = await props.params
  const product = await loadProduct(slug)
  return { title: product ? product.name : 'Produit introuvable' }
}

export default async function ProductPage(props: PageProps<'/produits/[slug]'>) {
  await requireUser()
  const { slug } = await props.params
  const [product, collections] = await Promise.all([loadProduct(slug), listCollections()])
  if (!product) notFound()

  const scents = new Map(product.scents.map((scent) => [scent.id, scent]))
  const variants: VariantLine[] = product.variants.map((variant) => {
    const scent = scents.get(variant.scentId)
    return {
      id: variant.id,
      scent: scent ? formatScent(scent.nameLatin, scent.tag) : product.name,
      scentAr: scent?.nameAr ?? null,
      sizeMl: variant.sizeMl,
      size: formatSize(variant.sizeMl),
      sku: variant.sku,
      priceMad: variant.priceMad,
      lowStockThreshold: variant.lowStockThreshold,
      stock: variant.stock,
      active: variant.active,
    }
  })
  const sizes = [...new Set(product.variants.map((variant) => variant.sizeMl))].filter((size) => size > 0).sort((a, b) => a - b)
  const units = product.variants.reduce((sum, variant) => sum + variant.stock, 0)

  return (
    <>
      <Link className="back" href="/produits">
        ‹ Tous les produits
      </Link>

      <header className="head">
        <div>
          <h1 className="head__title">{product.name}</h1>
          <p className="order__meta">
            <ActiveTag active={product.active} on="En vente" off="Hors vente" />
            <span>{product.collection.nameFr}</span>
            <span>{plural(product.scents.length, 'senteur')}</span>
            <span>
              {formatNumber(units)} {units > 1 ? 'flacons' : 'flacon'} en stock
            </span>
          </p>
        </div>
        <div className="head__actions">
          <Link className="btn btn--line btn--sm" href={withQuery('/stock', { q: product.name })}>
            Voir son stock
          </Link>
        </div>
      </header>

      <section className="panel" aria-labelledby="titre-fiche">
        <h2 className="panel__title" id="titre-fiche">
          Fiche du parfum
        </h2>
        <ProductForm
          slug={product.slug}
          name={product.name}
          collectionId={product.collectionId}
          imageUrl={product.imageUrl ?? ''}
          imagePreview={displayImageUrl(product.imageUrl)}
          active={product.active}
          collections={collections.map((collection) => ({ id: collection.id, name: collection.nameFr }))}
          uploads={blobUploadsEnabled()}
        />
      </section>

      <section className="panel section" aria-labelledby="titre-variantes">
        <h2 className="panel__title" id="titre-variantes">
          Prix et seuils par variante
        </h2>
        <VariantsForm slug={product.slug} variants={variants} sizes={sizes} />
      </section>
    </>
  )
}
