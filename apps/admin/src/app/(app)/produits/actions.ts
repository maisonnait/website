'use server'

import { revalidatePath } from 'next/cache'
import { put } from '@vercel/blob'
import { getProduct, listCollections, setProductActive, setVariant, upsertProduct } from '@nait/db'
import { requireUser } from '@/lib/auth'
import { actionError, fail, ok, type ActionState } from '@/lib/errors'
import { blobUploadsEnabled, IMAGE_MAX_BYTES, IMAGE_TYPES, isAcceptableImageUrl } from '@/lib/images'

const NAME_MAX = 80
const UPLOAD_TIMEOUT_MS = 25_000
const PRICE_MAX = 100_000
const THRESHOLD_MAX = 10_000

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 64
}

function integer(value: FormDataEntryValue | null): number | null {
  const text = typeof value === 'string' ? value.trim() : ''
  return /^\d{1,7}$/.test(text) ? Number(text) : null
}

/**
 * Sends a photo to Vercel Blob and returns its public address.
 * The storage client keeps retrying for minutes when the service cannot be reached, and its own
 * abort signal does not cut that short: the wait is bounded here so the form always answers.
 */
async function uploadPhoto(pathname: string, file: File): Promise<string> {
  const controller = new AbortController()
  const upload = put(pathname, file, {
    access: 'public',
    addRandomSuffix: true,
    contentType: file.type,
    abortSignal: controller.signal,
  })
  // If the deadline wins, the abandoned upload must not end as an unhandled rejection.
  upload.catch(() => undefined)

  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new Error(`photo upload gave no answer after ${UPLOAD_TIMEOUT_MS / 1000} s`))
    }, UPLOAD_TIMEOUT_MS)
  })
  try {
    const blob = await Promise.race([upload, deadline])
    return blob.url
  } finally {
    clearTimeout(timer)
  }
}

/** Shows or hides a product in the shop. Its variants keep their own settings. */
export async function toggleProduct(productId: string, active: boolean, _formData: FormData): Promise<void> {
  await requireUser()
  if (!validId(productId) || typeof active !== 'boolean') return
  try {
    await setProductActive(productId, active)
  } catch (error) {
    // A product that no longer exists: the refreshed list shows the truth.
    actionError(error, 'toggleProduct')
  }
  revalidatePath('/', 'layout')
}

/** Name, collection and photo of a product. */
export async function saveProduct(slug: string, _previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser()
  if (!validId(slug)) return fail('Demande incomplète. Rechargez la page et réessayez.')

  const name = String(formData.get('name') ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  const collectionId = String(formData.get('collectionId') ?? '')
  const imageField = String(formData.get('imageUrl') ?? '').trim()
  // The checkbox only counts when the form really carried it.
  const active = formData.has('activeField') ? formData.get('active') === 'on' : undefined
  const file = formData.get('photo')

  const fields: Record<string, string> = {}
  if (name.length === 0) fields.name = 'Le nom est obligatoire.'
  else if (name.length > NAME_MAX) fields.name = `${NAME_MAX} caractères au maximum.`
  if (imageField !== '' && !isAcceptableImageUrl(imageField)) {
    fields.imageUrl = 'Adresse non reconnue. Elle doit commencer par https:// (ou par / pour une image de la boutique).'
  }

  let imageUrl: string | null = imageField === '' ? null : imageField

  try {
    const [product, collections] = await Promise.all([getProduct(slug), listCollections()])
    if (!product) return fail('Ce produit est introuvable. Il a peut-être été renommé : revenez à la liste.')
    if (!collections.some((collection) => collection.id === collectionId)) fields.collectionId = 'Choisissez une collection.'

    const hasFile = file instanceof File && file.size > 0
    if (hasFile) {
      if (!blobUploadsEnabled()) fields.photo = 'L’envoi de photos n’est pas activé sur ce serveur.'
      else if (!IMAGE_TYPES[file.type]) fields.photo = 'Format non accepté. Utilisez une image JPEG, PNG, WebP ou AVIF.'
      else if (file.size > IMAGE_MAX_BYTES) fields.photo = 'Image trop lourde : 4 Mo au maximum.'
    }

    if (Object.keys(fields).length > 0) return fail('Corrigez les champs signalés.', fields)

    if (hasFile) {
      try {
        imageUrl = await uploadPhoto(`produits/${product.slug}.${IMAGE_TYPES[file.type]}`, file)
      } catch (error) {
        console.error('[admin] saveProduct: photo upload failed:', error)
        return fail('La photo n’a pas pu être envoyée. Vérifiez la connexion et réessayez.', {
          photo: 'Envoi impossible pour le moment.',
        })
      }
    }

    await upsertProduct({ id: product.id, name, collectionId, imageUrl, ...(active === undefined ? {} : { active }) }, user.id)
  } catch (error) {
    return actionError(error, 'saveProduct')
  }

  revalidatePath('/', 'layout')
  return ok('Produit enregistré.')
}

/** Price, low-stock threshold and availability of each variant of one product. */
export async function saveVariants(slug: string, _previous: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser()
  if (!validId(slug)) return fail('Demande incomplète. Rechargez la page et réessayez.')

  let changed = 0
  try {
    const product = await getProduct(slug)
    if (!product) return fail('Ce produit est introuvable. Revenez à la liste des produits.')

    // Only the variants of this product are read from the form, whatever else was posted.
    const updates: Array<{ id: string; priceMad?: number; lowStockThreshold?: number; active?: boolean }> = []
    const fields: Record<string, string> = {}

    for (const variant of product.variants) {
      if (!formData.has(`prix:${variant.id}`)) continue
      const price = integer(formData.get(`prix:${variant.id}`))
      const threshold = integer(formData.get(`seuil:${variant.id}`))
      const active = formData.get(`actif:${variant.id}`) === 'on'

      if (price === null || price < 1 || price > PRICE_MAX) fields[`prix:${variant.id}`] = 'Prix invalide'
      if (threshold === null || threshold > THRESHOLD_MAX) fields[`seuil:${variant.id}`] = 'Seuil invalide'
      if (price === null || threshold === null) continue

      const update: (typeof updates)[number] = { id: variant.id }
      if (price !== variant.priceMad) update.priceMad = price
      if (threshold !== variant.lowStockThreshold) update.lowStockThreshold = threshold
      if (active !== variant.active) update.active = active
      if (Object.keys(update).length > 1) updates.push(update)
    }

    if (Object.keys(fields).length > 0) {
      return fail(
        `Rien n’a été enregistré : corrigez les valeurs signalées (prix de 1 à ${PRICE_MAX} DH, seuil de 0 à ${THRESHOLD_MAX}, nombres entiers).`,
        fields,
      )
    }

    for (const { id, ...input } of updates) {
      await setVariant(id, input)
      changed += 1
    }
  } catch (error) {
    if (changed > 0) revalidatePath('/', 'layout')
    return actionError(error, 'saveVariants')
  }

  if (changed === 0) return ok('Aucune modification à enregistrer.')
  revalidatePath('/', 'layout')
  return ok(changed > 1 ? `${changed} variantes enregistrées.` : '1 variante enregistrée.')
}
