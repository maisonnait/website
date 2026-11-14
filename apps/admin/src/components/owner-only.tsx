import Link from 'next/link'

/** Shown to a signed-in member of the team on a page kept for the owner. */
export function OwnerOnly() {
  return (
    <div className="empty">
      <h1 className="empty__title">Page réservée au propriétaire</h1>
      <p className="empty__text">
        Les utilisateurs et les réglages de la boutique sont gérés par le propriétaire. Demandez-lui la modification dont
        vous avez besoin.
      </p>
      <Link className="btn" href="/">
        Revenir au tableau de bord
      </Link>
    </div>
  )
}
