/** Slugs fixed by the contract, in menu order. The header and the footer link to them. */
export const COLLECTION_SLUGS = ['arabisant', 'femmes', 'hommes', 'unisexe'] as const;
export type CollectionSlug = (typeof COLLECTION_SLUGS)[number];

export function isKnownCollection(slug: string): slug is CollectionSlug {
  return (COLLECTION_SLUGS as readonly string[]).includes(slug);
}
