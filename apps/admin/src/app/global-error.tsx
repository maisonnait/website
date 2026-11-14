'use client'

/** Last resort when even the root layout fails: plain page, no dependency on the app's styles. */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, fontFamily: 'Georgia, serif', background: '#fff', color: '#0b0b0c' }}>
        <main style={{ maxWidth: 520, margin: '18vh auto 0', padding: '0 20px' }}>
          <title>Erreur | Gestion N’Ait</title>
          <h1 style={{ fontWeight: 400, fontSize: 26 }}>Le gestionnaire est momentanément indisponible</h1>
          <p>Une erreur technique empêche l’affichage. Réessayez dans un instant.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ padding: '10px 18px', background: '#0b0b0c', color: '#f1dc9b', border: 0, fontSize: 16, cursor: 'pointer' }}
          >
            Réessayer
          </button>
        </main>
      </body>
    </html>
  )
}
