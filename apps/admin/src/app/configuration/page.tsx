import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Configuration' }

/**
 * Shown instead of every page while the stock manager runs on Vercel without DATABASE_URL
 * (see proxy.ts): a clear note instead of an error page.
 */
export default function ConfigurationPage() {
  return (
    <main className="lone">
      <div style={{ maxWidth: 620 }}>
        <h1 className="lone__title">Le gestionnaire est déployé. Il reste à relier sa base de données.</h1>
        <ol style={{ paddingInlineStart: 22, marginTop: 18, display: 'grid', gap: 10, lineHeight: 1.55 }}>
          <li>
            Dans Vercel, ouvrez ce projet, onglet <strong>Storage</strong>, puis <strong>Connect</strong> : choisissez la même base Postgres que
            celle de la boutique. Cela ajoute la variable <code>DATABASE_URL</code>.
          </li>
          <li>
            Dans <strong>Settings &gt; Environment Variables</strong>, ajoutez <code>AUTH_SECRET</code> (32 caractères au minimum),{' '}
            <code>ADMIN_EMAIL</code> et <code>ADMIN_PASSWORD</code> (8 caractères au minimum) : ce sera votre compte propriétaire.
          </li>
          <li>
            Onglet <strong>Deployments</strong> : sur le dernier déploiement, menu «&nbsp;…&nbsp;» puis <strong>Redeploy</strong>.
          </li>
        </ol>
        <p style={{ marginTop: 18, opacity: 0.72 }}>Le détail est dans le fichier DEPLOY.md du dépôt.</p>
      </div>
    </main>
  )
}
