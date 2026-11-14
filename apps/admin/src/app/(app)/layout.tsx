import Link from 'next/link'
import type { ReactNode } from 'react'
import { countOrders } from '@nait/db'
import { logout } from '@/app/connexion/actions'
import { AccountMenu } from '@/components/account-menu'
import { Nav } from '@/components/nav'
import { Sign } from '@/components/sign'
import { Wordmark } from '@/components/wordmark'
import { isOwner, requireUser } from '@/lib/auth'
import { initials } from '@/lib/format'

const ROLE_LABEL = { owner: 'Propriétaire', staff: 'Équipe' } as const

export default async function AppLayout({ children }: { children: ReactNode }) {
  // The shell shows who is signed in; each page checks the session again for itself,
  // because a layout is not rendered again when the visitor moves between pages.
  const user = await requireUser()
  const owner = isOwner(user)
  const newOrders = await countOrders({ status: 'new' })

  return (
    <div className="shell">
      <a className="skip" href="#contenu">
        Aller au contenu
      </a>

      <header className="topbar no-print">
        <Link href="/" className="brand" aria-label="N’Ait, tableau de bord">
          <Sign className="brand__sign" />
          <Wordmark className="brand__mark" />
          <span className="brand__sub">Gestion</span>
        </Link>
        <AccountMenu name={user.name} roleLabel={ROLE_LABEL[user.role]} initials={initials(user.name)} owner={owner} />
      </header>

      <aside className="rail no-print">
        <div className="rail__in">
          <Link href="/" className="brand" aria-label="N’Ait, tableau de bord">
            <Sign className="brand__sign" />
            <Wordmark className="brand__mark" />
            <span className="brand__sub">Gestionnaire de stock</span>
          </Link>
          <nav className="rail__nav" aria-label="Navigation principale">
            <Nav variant="rail" owner={owner} newOrders={newOrders} />
          </nav>
          <div className="rail__foot">
            <div>
              <p className="rail__name">{user.name}</p>
              <p className="rail__role">{ROLE_LABEL[user.role]}</p>
            </div>
            <form action={logout}>
              <button type="submit" className="rail__out">
                Se déconnecter
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main className="main" id="contenu">
        <div className="page">{children}</div>
      </main>

      <nav className="tabs no-print" aria-label="Navigation principale">
        <Nav variant="tabs" owner={owner} newOrders={newOrders} />
      </nav>
    </div>
  )
}
