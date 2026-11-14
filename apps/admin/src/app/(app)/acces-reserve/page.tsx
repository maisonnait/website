import type { Metadata } from 'next'
import { OwnerOnly } from '@/components/owner-only'
import { requireUser } from '@/lib/auth'

export const metadata: Metadata = { title: 'Accès réservé' }

/** Target of the proxy rewrite (HTTP 403) when a non-owner opens an owner-only address. */
export default async function OwnerOnlyPage() {
  await requireUser()
  return <OwnerOnly />
}
