import type { MetadataRoute } from 'next'

/**
 * Nothing here may be indexed. That rule is carried by the `X-Robots-Tag: noindex` header and
 * the robots meta tag on every response. Crawling is deliberately NOT disallowed: a crawler
 * that is forbidden to fetch a page never sees its noindex, and the bare address could then
 * still be listed if another site links to it.
 */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', allow: '/' }] }
}
