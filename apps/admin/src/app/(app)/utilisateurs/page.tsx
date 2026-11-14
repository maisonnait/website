import type { Metadata } from 'next'
import { listUsers } from '@nait/db'
import { OwnerOnly } from '@/components/owner-only'
import { ActiveTag } from '@/components/tags'
import { isOwner, requireUser } from '@/lib/auth'
import { formatDate, plural } from '@/lib/format'
import { CreateUserForm, UserRowActions } from './user-forms'

export const metadata: Metadata = { title: 'Utilisateurs' }

const ROLE_LABEL = { owner: 'Propriétaire', staff: 'Équipe' } as const

export default async function UsersPage() {
  const me = await requireUser()
  if (!isOwner(me)) return <OwnerOnly />

  const users = await listUsers()
  const activeCount = users.filter((user) => user.active).length

  return (
    <>
      <header className="head">
        <div>
          <h1 className="head__title">Utilisateurs</h1>
          <p className="head__sub">{plural(activeCount, 'compte actif', 'comptes actifs')}</p>
        </div>
      </header>

      <table className="table table--stack table--users">
        <thead>
          <tr>
            <th scope="col">Nom</th>
            <th scope="col">Rôle</th>
            <th scope="col">État</th>
            <th scope="col">Créé le</th>
            <th scope="col">
              <span className="vh">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td className="c-wide">
                <span className="strong">{user.name}</span>
                {user.id === me.id ? <span className="muted"> (vous)</span> : null}
                <span className="sub">{user.email}</span>
              </td>
              <td>{ROLE_LABEL[user.role]}</td>
              <td className="c-end">
                <ActiveTag active={user.active} on="Actif" off="Désactivé" />
              </td>
              <td className="muted c-hide nowrap">{formatDate(user.createdAt)}</td>
              <td className="c-wide">
                <UserRowActions userId={user.id} name={user.name} active={user.active} self={user.id === me.id} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="panel section narrow" aria-labelledby="titre-nouveau">
        <h2 className="panel__title" id="titre-nouveau">
          Nouveau compte
        </h2>
        <CreateUserForm />
      </section>
    </>
  )
}
