'use client'

import { ActionMessage } from '@/components/form-bits'
import { useFormAction } from '@/components/use-form-action'
import { saveSettings } from './actions'

interface SettingsFormProps {
  shippingMad: number
  /** Phone numbers already formatted for reading: '06 12 34 56 78'. */
  shopPhone: string
  whatsapp: string
  deliveryDelay: string
  announcement: string
}

export function SettingsForm({ shippingMad, shopPhone, whatsapp, deliveryDelay, announcement }: SettingsFormProps) {
  const { state, pending, onSubmit, formKey } = useFormAction(saveSettings)
  const errors = state.fields ?? {}

  return (
    <form key={formKey} onSubmit={onSubmit} className="form">
      <div className="formgrid formgrid--2">
        <label className="field">
          <span className="field__label">Frais de livraison (DH)</span>
          <input
            className="input input--num"
            name="shippingMad"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            required
            autoComplete="off"
            defaultValue={shippingMad}
            aria-invalid={errors.shippingMad ? true : undefined}
          />
          {errors.shippingMad ? (
            <span className="field__error">{errors.shippingMad}</span>
          ) : (
            <span className="field__hint">Ajoutés à chaque nouvelle commande. 0 = livraison offerte.</span>
          )}
        </label>

        <label className="field">
          <span className="field__label">Délai de livraison annoncé</span>
          <input
            className="input"
            name="deliveryDelay"
            required
            maxLength={80}
            autoComplete="off"
            defaultValue={deliveryDelay}
            aria-invalid={errors.deliveryDelay ? true : undefined}
          />
          {errors.deliveryDelay ? (
            <span className="field__error">{errors.deliveryDelay}</span>
          ) : (
            <span className="field__hint">Texte montré aux clients, par exemple « 1 à 3 jours ouvrés ».</span>
          )}
        </label>

        <label className="field">
          <span className="field__label">Téléphone de la boutique</span>
          <input
            className="input"
            name="shopPhone"
            type="tel"
            inputMode="tel"
            maxLength={24}
            autoComplete="off"
            defaultValue={shopPhone}
            placeholder="06 12 34 56 78"
            aria-invalid={errors.shopPhone ? true : undefined}
          />
          {errors.shopPhone ? (
            <span className="field__error">{errors.shopPhone}</span>
          ) : (
            <span className="field__hint">Affiché sur la boutique et sur les bons de livraison. Vide = non affiché.</span>
          )}
        </label>

        <label className="field">
          <span className="field__label">Numéro WhatsApp</span>
          <input
            className="input"
            name="whatsapp"
            type="tel"
            inputMode="tel"
            maxLength={24}
            autoComplete="off"
            defaultValue={whatsapp}
            placeholder="06 12 34 56 78"
            aria-invalid={errors.whatsapp ? true : undefined}
          />
          {errors.whatsapp ? (
            <span className="field__error">{errors.whatsapp}</span>
          ) : (
            <span className="field__hint">Le bouton WhatsApp de la boutique ouvre une conversation avec ce numéro.</span>
          )}
        </label>

        <label className="field span-all">
          <span className="field__label">Annonce en haut de la boutique</span>
          <textarea
            className="textarea"
            name="announcement"
            rows={2}
            maxLength={200}
            defaultValue={announcement}
            aria-invalid={errors.announcement ? true : undefined}
          />
          {errors.announcement ? (
            <span className="field__error">{errors.announcement}</span>
          ) : (
            <span className="field__hint">200 caractères au maximum. Vide = pas de bandeau.</span>
          )}
        </label>
      </div>

      <div className="formactions">
        <button type="submit" className="btn" disabled={pending}>
          {pending ? 'Enregistrement…' : 'Enregistrer les réglages'}
        </button>
        <ActionMessage state={state} />
      </div>
    </form>
  )
}
