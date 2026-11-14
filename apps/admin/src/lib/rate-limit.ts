import 'server-only'

/**
 * In-memory limiter for failed login attempts (fixed window).
 * It lives in the server process: on a platform that runs several instances each one counts
 * on its own, which loosens the limit but never blocks a legitimate user by mistake.
 */

interface Bucket {
  count: number
  resetAt: number
}

const WINDOW_MS = 15 * 60 * 1000
const MAX_BUCKETS = 10_000

/** Failures allowed per window before the key is locked until the window ends. */
const LIMITS = {
  /** one visitor guessing one account */
  pair: 5,
  /** one account attacked from many addresses */
  email: 10,
  /** one address trying many accounts */
  ip: 30,
} as const

type Scope = keyof typeof LIMITS

const globalStore = globalThis as typeof globalThis & { __naitLoginBuckets?: Map<string, Bucket> }
const buckets: Map<string, Bucket> = (globalStore.__naitLoginBuckets ??= new Map())

function keysFor(ip: string, email: string): Array<[Scope, string]> {
  return [
    ['pair', `pair:${ip}|${email}`],
    ['email', `email:${email}`],
    ['ip', `ip:${ip}`],
  ]
}

function prune(now: number): void {
  if (buckets.size < MAX_BUCKETS) return
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
  // Still full of live buckets: drop the oldest ones rather than grow without bound.
  if (buckets.size >= MAX_BUCKETS) {
    let excess = buckets.size - MAX_BUCKETS + 1
    for (const key of buckets.keys()) {
      if (excess-- <= 0) break
      buckets.delete(key)
    }
  }
}

/** Milliseconds to wait before another attempt is accepted; 0 when the attempt may proceed. */
export function loginRetryAfterMs(ip: string, email: string, now = Date.now()): number {
  let wait = 0
  for (const [scope, key] of keysFor(ip, email)) {
    const bucket = buckets.get(key)
    if (!bucket) continue
    if (bucket.resetAt <= now) {
      buckets.delete(key)
      continue
    }
    if (bucket.count >= LIMITS[scope]) wait = Math.max(wait, bucket.resetAt - now)
  }
  return wait
}

export function recordLoginFailure(ip: string, email: string, now = Date.now()): void {
  prune(now)
  for (const [, key] of keysFor(ip, email)) {
    const bucket = buckets.get(key)
    if (!bucket || bucket.resetAt <= now) buckets.set(key, { count: 1, resetAt: now + WINDOW_MS })
    else bucket.count += 1
  }
}

/** A successful login clears the visitor's own counter, not the per-account or per-address ones. */
export function recordLoginSuccess(ip: string, email: string): void {
  buckets.delete(`pair:${ip}|${email}`)
}
