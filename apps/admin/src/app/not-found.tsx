import type { Metadata } from 'next'
import Link from 'next/link'
import { Wordmark } from '@/components/wordmark'

export const metadata: Metadata = { title: 'Page introuvable' }

export default function NotFound() {
  return (
    <main className="lone">
      <p aria-label="N’Ait">
        <Wordmark className="lone__mark" />
      </p>
      <h1 className="lone__title">Cette page n’existe pas</h1>
      <p className="lone__text">L’adresse est peut-être incomplète, ou l’élément a été renommé depuis.</p>
      <Link className="btn" href="/">
        Revenir au tableau de bord
      </Link>
    </main>
  )
}
