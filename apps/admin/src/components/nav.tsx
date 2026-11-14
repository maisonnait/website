'use client'

import Link, { useLinkStatus } from 'next/link'
import { usePathname } from 'next/navigation'
import { Fragment } from 'react'
import { Icon, type IconName } from './icons'

interface Item {
  href: string
  label: string
  /** Shorter word for the phone tab bar. */
  short: string
  icon: IconName
  ownerOnly?: boolean
}

const ITEMS: Item[] = [
  { href: '/', label: 'Tableau de bord', short: 'Tableau', icon: 'dashboard' },
  { href: '/commandes', label: 'Commandes', short: 'Commandes', icon: 'orders' },
  { href: '/stock', label: 'Stock', short: 'Stock', icon: 'stock' },
  { href: '/produits', label: 'Produits', short: 'Produits', icon: 'products' },
  { href: '/utilisateurs', label: 'Utilisateurs', short: 'Équipe', icon: 'users', ownerOnly: true },
  { href: '/reglages', label: 'Réglages', short: 'Réglages', icon: 'settings', ownerOnly: true },
]

function isCurrent(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
}

/** A thin gold line under the entry while its page is on the way (slow connection). */
function Pending() {
  const { pending } = useLinkStatus()
  return pending ? <span className="nav__pending" aria-hidden="true" /> : null
}

interface NavProps {
  /** 'rail' = laptop side bar with every destination, 'tabs' = phone bar with the four daily ones. */
  variant: 'rail' | 'tabs'
  owner: boolean
  /** Orders waiting for a confirmation call. */
  newOrders: number
}

export function Nav({ variant, owner, newOrders }: NavProps) {
  const pathname = usePathname()
  const items = ITEMS.filter((item) => (variant === 'tabs' ? !item.ownerOnly : owner || !item.ownerOnly))

  return (
    <>
      {items.map((item, index) => {
        const current = isCurrent(pathname, item.href)
        const badge = item.href === '/commandes' && newOrders > 0 ? newOrders : 0
        const firstOwnerItem = variant === 'rail' && item.ownerOnly && !items[index - 1]?.ownerOnly
        return (
          <Fragment key={item.href}>
            {firstOwnerItem ? <span className="rail__sep" aria-hidden="true" /> : null}
            <Link href={item.href} className="nav__link" aria-current={current ? 'page' : undefined}>
              <Icon name={item.icon} className="nav__icon" />
              <span className="nav__label">{variant === 'tabs' ? item.short : item.label}</span>
              {badge ? (
                <span className="nav__badge">
                  {badge > 99 ? '99+' : badge}
                  <span className="vh"> à confirmer</span>
                </span>
              ) : null}
              <Pending />
            </Link>
          </Fragment>
        )
      })}
    </>
  )
}
