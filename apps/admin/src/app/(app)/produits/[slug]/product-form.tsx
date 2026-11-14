'use client'

import { useState } from 'react'
import { ActionMessage } from '@/components/form-bits'
import { useFormAction } from '@/components/use-form-action'
import { saveProduct } from '../actions'

interface ProductFormProps {
  slug: string
  name: string
  collectionId: string
  /** The address stored for the photo, as typed. */
  imageUrl: string
  /** The same photo as an address this application can load (null when it cannot). */
  imagePreview: string | null
  active: boolean
  collections: Array<{ id: string; name: string }>
  /** True when Vercel Blob is configured: a file can be sent instead of an address. */
  uploads: boolean
}

interface PhotoFieldsProps {
  name: string
  imageUrl: string
  imagePreview: string | null
  uploads: boolean
  errors: Record<string, string>
}

const UPLOAD_MAX_BYTES = 4 * 1024 * 1024
const UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

function PhotoFields({ name, imageUrl, imagePreview, uploads, errors }: PhotoFieldsProps) {
  const [preview, setPreview] = useState(imagePreview)
  const [fileProblem, setFileProblem] = useState('')
  const fileError = fileProblem || errors.photo

  return (
    <div className="photo">
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote catalogue photo, no optimizer in front
        <img className="photo__img" src={preview} alt={`Photo actuelle de ${name}`} width={96} height={96} onError={() => setPreview(null)} />
      ) : (
        <span className="photo__none">Pas de photo affichable</span>
      )}
      <div className="form">
        <label className="field">
          <span className="field__label">Adresse de la photo</span>
          <input
            className="input"
            name="imageUrl"
            type="text"
            inputMode="url"
            defaultValue={imageUrl}
            maxLength={600}
            placeholder="https://…"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={errors.imageUrl ? true : undefined}
            onBlur={(event) => {
              const value = event.target.value.trim()
              if (value.startsWith('https://')) setPreview(value)
              else if (value === '') setPreview(null)
            }}
          />
          {errors.imageUrl ? (
            <span className="field__error">{errors.imageUrl}</span>
          ) : (
            <span className="field__hint">Laissez vide pour retirer la photo.</span>
          )}
        </label>

        {uploads ? (
          <label className="field">
            <span className="field__label">Ou envoyer une nouvelle photo</span>
            <input
              className="input"
              name="photo"
              type="file"
              accept={UPLOAD_TYPES.join(',')}
              aria-invalid={fileError ? true : undefined}
              onChange={(event) => {
                // Checked here first: a file over the limit would be cut off by the server
                // before the form could answer with a proper message.
                const file = event.target.files?.[0]
                let problem = ''
                if (file && !UPLOAD_TYPES.includes(file.type)) problem = 'Format non accepté. Utilisez une image JPEG, PNG, WebP ou AVIF.'
                else if (file && file.size > UPLOAD_MAX_BYTES) problem = 'Image trop lourde : 4 Mo au maximum.'
                if (problem) event.target.value = ''
                setFileProblem(problem)
              }}
            />
            {fileError ? (
              <span className="field__error" role="alert">
                {fileError}
              </span>
            ) : (
              <span className="field__hint">JPEG, PNG, WebP ou AVIF, 4 Mo au maximum. Elle remplace l’adresse ci-dessus.</span>
            )}
          </label>
        ) : null}
      </div>
    </div>
  )
}

export function ProductForm({ slug, name, collectionId, imageUrl, imagePreview, active, collections, uploads }: ProductFormProps) {
  const { state, pending, onSubmit, formKey } = useFormAction(saveProduct.bind(null, slug))
  const errors = state.fields ?? {}

  // `formKey` changes after a successful save: the fields start again from what is stored.
  return (
    <form key={formKey} onSubmit={onSubmit} className="form">
      <div className="formgrid formgrid--2">
        <label className="field">
          <span className="field__label">Nom du parfum</span>
          <input
            className="input"
            name="name"
            defaultValue={name}
            required
            maxLength={80}
            autoComplete="off"
            aria-invalid={errors.name ? true : undefined}
          />
          {errors.name ? <span className="field__error">{errors.name}</span> : null}
        </label>

        <label className="field">
          <span className="field__label">Collection</span>
          <select className="select" name="collectionId" defaultValue={collectionId} aria-invalid={errors.collectionId ? true : undefined}>
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.name}
              </option>
            ))}
          </select>
          {errors.collectionId ? <span className="field__error">{errors.collectionId}</span> : null}
        </label>
      </div>

      <PhotoFields name={name} imageUrl={imageUrl} imagePreview={imagePreview} uploads={uploads} errors={errors} />

      <input type="hidden" name="activeField" value="1" />
      <label className="check">
        <input type="checkbox" name="active" defaultChecked={active} />
        <span className="check__label">En vente sur la boutique</span>
      </label>

      <div className="formactions">
        <button type="submit" className="btn" disabled={pending}>
          {pending ? 'Enregistrement…' : 'Enregistrer le produit'}
        </button>
        <ActionMessage state={state} />
      </div>
    </form>
  )
}
