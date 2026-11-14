import { NextResponse, type NextRequest } from 'next/server';
import { LOCALE_COOKIE, isLocale, localeFromAcceptLanguage } from '@/i18n/config';

/**
 * Every page lives under /[lang]/. A request without a language ("/", "/collections"...)
 * is redirected to the visitor's language: the one chosen earlier (cookie), else the
 * browser's (Accept-Language), else French.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split('/')[1] ?? '';
  if (isLocale(first)) return NextResponse.next();

  const remembered = request.cookies.get(LOCALE_COOKIE)?.value;
  const lang = isLocale(remembered) ? remembered : localeFromAcceptLanguage(request.headers.get('accept-language'));

  const url = request.nextUrl.clone();
  url.pathname = `/${lang}${pathname === '/' ? '' : pathname}`;
  const response = NextResponse.redirect(url, 307);
  response.headers.set('Vary', 'Accept-Language, Cookie');
  return response;
}

export const config = {
  // Not for Next.js internals, nor for files (anything with an extension: media, icons, sitemap.xml...).
  matcher: ['/((?!_next/|.*\\.[\\w]+$).*)'],
};
