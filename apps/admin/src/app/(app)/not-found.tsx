import Link from 'next/link'

export default function NotFoundInApp() {
  return (
    <div className="empty">
      <h1 className="empty__title">Introuvable</h1>
      <p className="empty__text">
        Cette commande ou ce produit n’existe pas, ou plus sous cette adresse. Repartez d’une liste pour le retrouver.
      </p>
      <Link className="btn" href="/commandes">
        Voir les commandes
      </Link>
    </div>
  )
}
