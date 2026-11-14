/**
 * Where to go after signing in. Only a path inside this application is accepted: anything
 * that could send the browser to another site falls back to the dashboard.
 */
export function safeNextPath(value: unknown): string {
  if (typeof value !== 'string') return '/'
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/'
  if (/[\u0000-\u001f\u007f\\]/.test(value) || value.length > 512) return '/'
  if (value === '/connexion' || value.startsWith('/connexion?') || value.startsWith('/acces-reserve')) return '/'
  return value
}

/** First value of a search parameter that may be repeated. */
export function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

/** Builds '/path?a=1&b=2' leaving out empty values. */
export function withQuery(path: string, params: Record<string, string | number | undefined | null | false>): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === false || value === '') continue
    query.set(key, String(value))
  }
  const text = query.toString()
  return text ? `${path}?${text}` : path
}

/** Page number from the URL: an integer of at least 1. */
export function pageParam(value: string | string[] | undefined): number {
  const page = Number.parseInt(firstParam(value), 10)
  return Number.isFinite(page) && page >= 1 ? Math.min(page, 100_000) : 1
}
