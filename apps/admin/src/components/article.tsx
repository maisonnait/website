import type { ReactNode } from 'react'
import { formatScent, formatSize } from '@/lib/format'

interface ArticleProps {
  productName: string
  scentName: string
  scentTag?: string | null
  sizeMl: number
  /** Printed under the name when given. */
  sku?: string
  /** Shown before the text: the stock gauge or a photo. */
  lead?: ReactNode
  /** Extra tags after the name (inactive, ...). */
  children?: ReactNode
}

/**
 * One sellable bottle, named the way the team says it: the scent and its size first,
 * the perfume line under it.
 */
export function Article({ productName, scentName, scentTag, sizeMl, sku, lead, children }: ArticleProps) {
  const scent = formatScent(scentName, scentTag)
  const sameAsProduct = scentName.trim().toLowerCase() === productName.trim().toLowerCase()
  const size = formatSize(sizeMl)
  return (
    <div className="article">
      {lead}
      <div className="article__text">
        <span className="article__name">{sameAsProduct ? productName : scent}</span>
        {size ? <span className="nowrap"> {size}</span> : null}
        {children}
        <span className="sub">
          {sameAsProduct ? null : <span>{productName}</span>}
          {sku ? <span className="article__sku">{sku}</span> : null}
        </span>
      </div>
    </div>
  )
}
