import { Mark } from '@/brand/Logo';

/**
 * Shown instead of every page while the shop runs on Vercel without DATABASE_URL (see proxy.ts):
 * a clear note for the owner instead of an error page. It disappears on the first deployment
 * that has the variable.
 */
export default function SetupPage() {
  const step = { margin: '0 0 10px', lineHeight: 1.55 } as const;
  const code = { fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: '0.92em', background: '#f5f1e6', padding: '1px 6px' } as const;
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '48px 24px', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 560 }}>
        <Mark className="" title="Maison N’Ait" />
        <style>{'main svg{height:96px;width:auto;display:block;margin-bottom:28px}'}</style>
        <h1 style={{ font: '300 2rem/1.15 "Century Gothic", "Avenir Next", Futura, sans-serif', margin: '0 0 14px' }}>
          La boutique est déployée. Il reste à relier sa base de données.
        </h1>
        <p style={{ ...step, color: 'rgba(11,11,12,.72)', marginBottom: 22 }}>
          The shop is deployed; it only needs its database. Until then no page can show the catalogue.
        </p>
        <ol style={{ paddingInlineStart: 22, margin: 0 }}>
          <li style={step}>
            Dans Vercel, ouvrez ce projet, onglet <strong>Storage</strong>, puis <strong>Create Database</strong> (Neon, Postgres) ou{' '}
            <strong>Connect</strong> si la base existe déjà. Cela ajoute la variable <span style={code}>DATABASE_URL</span>.
          </li>
          <li style={step}>
            Reliez la <strong>même</strong> base au projet du gestionnaire de stock.
          </li>
          <li style={step}>
            Onglet <strong>Deployments</strong> : sur le dernier déploiement, menu «&nbsp;…&nbsp;» puis <strong>Redeploy</strong>. Les variables ne
            s’appliquent qu’aux nouveaux déploiements.
          </li>
        </ol>
        <p style={{ ...step, color: 'rgba(11,11,12,.72)', marginTop: 22, fontSize: '0.95rem' }}>
          Le détail est dans le fichier <span style={code}>DEPLOY.md</span> du dépôt.
        </p>
      </div>
    </main>
  );
}
