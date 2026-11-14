'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { logout } from '@/app/connexion/actions'

interface AccountMenuProps {
  name: string
  roleLabel: string
  initials: string
  owner: boolean
}

/** Phone only: who is signed in, the owner's pages and the way out. */
export function AccountMenu({ name, roleLabel, initials, owner }: AccountMenuProps) {
  const ref = useRef<HTMLDetailsElement>(null)
  const pathname = usePathname()

  // Close after a navigation, on Escape and on a tap outside.
  useEffect(() => {
    if (ref.current) ref.current.open = false
  }, [pathname])

  useEffect(() => {
    const details = ref.current
    if (!details) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && details.open) {
        details.open = false
        details.querySelector('summary')?.focus()
      }
    }
    const onPointer = (event: PointerEvent) => {
      if (details.open && event.target instanceof Node && !details.contains(event.target)) details.open = false
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [])

  return (
    <details className="account" ref={ref}>
      <summary aria-label={`Compte de ${name}`}>{initials}</summary>
      <div className="account__panel">
        <div className="account__who">
          <p className="account__name">{name}</p>
          <p className="account__role">{roleLabel}</p>
        </div>
        <Link className="account__link" href="/stock/mouvements">
          Mouvements de stock
        </Link>
        {owner ? (
          <>
            <Link className="account__link" href="/utilisateurs">
              Utilisateurs
            </Link>
            <Link className="account__link" href="/reglages">
              Réglages
            </Link>
          </>
        ) : null}
        <form action={logout}>
          <button type="submit" className="account__link">
            Se déconnecter
          </button>
        </form>
      </div>
    </details>
  )
}
