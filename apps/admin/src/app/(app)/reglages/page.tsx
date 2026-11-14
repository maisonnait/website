import type { Metadata } from 'next'
import { getSettings } from '@nait/db'
import { OwnerOnly } from '@/components/owner-only'
import { isOwner, requireUser } from '@/lib/auth'
import { formatPhone } from '@/lib/format'
import { SettingsForm } from './settings-form'

export const metadata: Metadata = { title: 'Réglages' }

export default async function SettingsPage() {
  const me = await requireUser()
  if (!isOwner(me)) return <OwnerOnly />

  const settings = await getSettings()

  return (
    <>
      <header className="head">
        <div>
          <h1 className="head__title">Réglages</h1>
          <p className="head__sub">Ce que la boutique annonce aux clients</p>
        </div>
      </header>

      <section className="panel narrow" aria-label="Réglages de la boutique">
        <SettingsForm
          shippingMad={settings.shippingMad}
          shopPhone={settings.shopPhone ? formatPhone(settings.shopPhone) : ''}
          whatsapp={settings.whatsapp ? formatPhone(settings.whatsapp) : ''}
          deliveryDelay={settings.deliveryDelay}
          announcement={settings.announcement}
        />
      </section>
    </>
  )
}
