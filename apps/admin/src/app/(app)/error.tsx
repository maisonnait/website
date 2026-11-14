'use client'

import { useEffect } from 'react'

export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  const digest = error instanceof Error && 'digest' in error && typeof error.digest === 'string' ? error.digest : ''

  return (
    <div className="empty" role="alert">
      <h1 className="empty__title">La page n’a pas pu s’afficher</h1>
      <p className="empty__text">
        Une erreur technique est survenue en lisant les données. Réessayez ; si elle persiste, transmettez ce repère au
        responsable{digest ? ` : ${digest}` : ''}.
      </p>
      <button type="button" className="btn" onClick={() => retry()}>
        Réessayer
      </button>
    </div>
  )
}
