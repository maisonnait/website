import Link from 'next/link'
import { formatNumber } from '@/lib/format'

interface PagerProps {
  page: number
  pageSize: number
  /** Rows on this page. */
  count: number
  /** Total number of rows when it is known. */
  total?: number
  /** When the total is unknown: is there a page after this one? */
  hasNext?: boolean
  /** Builds the address of a page. */
  href: (page: number) => string
  noun: string
  nounPlural?: string
}

export function Pager({ page, pageSize, count, total, hasNext, href, noun, nounPlural }: PagerProps) {
  const first = (page - 1) * pageSize + 1
  const last = (page - 1) * pageSize + count
  const more = total !== undefined ? last < total : Boolean(hasNext)
  if (page === 1 && !more && total === undefined) return null

  const words = nounPlural ?? `${noun}s`
  let info: string
  if (count === 0) info = `Aucune ligne sur cette page`
  else if (total !== undefined) info = `${formatNumber(first)} à ${formatNumber(last)} sur ${formatNumber(total)} ${total > 1 ? words : noun}`
  else info = `${words.charAt(0).toUpperCase()}${words.slice(1)} ${formatNumber(first)} à ${formatNumber(last)}`

  return (
    <nav className="pager" aria-label="Pagination">
      <p className="pager__info">{info}</p>
      {page > 1 || more ? (
        <div className="pager__links">
          {page > 1 ? (
            <Link className="btn btn--line btn--sm" href={href(page - 1)} rel="prev">
              Précédent
            </Link>
          ) : null}
          {more ? (
            <Link className="btn btn--line btn--sm" href={href(page + 1)} rel="next">
              Suivant
            </Link>
          ) : null}
        </div>
      ) : null}
    </nav>
  )
}
