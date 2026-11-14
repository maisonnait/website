import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session-token'

/**
 * First filter in front of every page: no valid session cookie, no page.
 * This is the quick check on the signed cookie only. The real decision is taken again,
 * against the database, by every page and every Server Action (lib/auth.ts).
 */

const LOGIN_PATH = '/connexion'
const OWNER_ONLY = ['/utilisateurs', '/reglages']

function isUnder(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`)
}

/** On Vercel the stock manager needs a Postgres database. Without one, every page is replaced by a note (app/configuration). */
const NO_DATABASE = Boolean(process.env.VERCEL) && !process.env.DATABASE_URL?.trim()

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  if (pathname === '/configuration') {
    return NO_DATABASE ? NextResponse.next() : NextResponse.redirect(new URL('/', request.url))
  }
  if (NO_DATABASE) return NextResponse.rewrite(new URL('/configuration', request.url))
  const claims = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)

  if (!claims) {
    if (pathname === LOGIN_PATH) return NextResponse.next()
    // A Server Action posted with an expired session answers for itself: it checks the
    // session and sends the browser to the login page in the format the client expects.
    if (request.method !== 'GET' && request.method !== 'HEAD') return NextResponse.next()

    const login = request.nextUrl.clone()
    login.pathname = LOGIN_PATH
    login.search = ''
    const wanted = `${pathname}${search}`
    if (wanted !== '/') login.searchParams.set('suite', wanted)
    return NextResponse.redirect(login)
  }

  if (claims.role !== 'owner' && OWNER_ONLY.some((base) => isUnder(pathname, base))) {
    const denied = request.nextUrl.clone()
    denied.pathname = '/acces-reserve'
    denied.search = ''
    return NextResponse.rewrite(denied, { status: 403 })
  }

  return NextResponse.next()
}

export const config = {
  // Everything except build assets and static files.
  matcher: ['/((?!_next/static|_next/image|robots\\.txt|.*\\.(?:ico|png|jpg|jpeg|svg|webp|avif|woff|woff2|txt)$).*)'],
}
