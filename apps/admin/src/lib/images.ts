import 'server-only'

/** Photo uploads go to Vercel Blob, and only when its token is configured. */
export function blobUploadsEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

/** A request to a Vercel function cannot carry more than about 4.5 MB. */
export const IMAGE_MAX_BYTES = 4 * 1024 * 1024

/** Accepted image types and the extension they are stored with. */
export const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
}

/** A photo address typed by hand: an https URL, or a path served by the shop ('/media/x.jpg'). */
export function isAcceptableImageUrl(value: string): boolean {
  if (value.length > 600 || /\s/.test(value)) return false
  if (value.startsWith('/')) return !value.startsWith('//')
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Address the back office can display: a path of the shop is resolved against the shop's own
 * address (NEXT_PUBLIC_SITE_URL), because this application runs on another host.
 */
export function displayImageUrl(value: string | null): string | null {
  if (!value) return null
  if (!value.startsWith('/')) return value
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '')
  return site ? `${site}${value}` : null
}
