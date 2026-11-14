'use client';

import { usePathname } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { LOCALE_COOKIE, LOCALE_INFO, MENU_ORDER, type Locale } from '@/i18n/config';

/** Same page in another language: '/fr/collections/femmes' -> '/ar/collections/femmes'. */
function pathIn(target: Locale, pathname: string, current: Locale): string {
  const rest = pathname === `/${current}` ? '' : pathname.startsWith(`/${current}/`) ? pathname.slice(current.length + 1) : '';
  return `/${target}${rest}`;
}

/**
 * The five languages as plain links to the same page in each language. Choosing one is
 * remembered (cookie read by the proxy for "/") and loads the page afresh, so that
 * <html lang dir> and the fonts change with it. The query (?n=NA-000123) and the anchor are kept.
 */
export function LanguageLinks({ onPick }: { onPick?: () => void }) {
  const { lang } = useI18n();
  const pathname = usePathname();
  return (
    <>
      {MENU_ORDER.map((code) => {
        const path = pathIn(code, pathname, lang);
        return (
          <a
            key={code}
            href={path}
            hrefLang={code}
            lang={code}
            dir={LOCALE_INFO[code].dir}
            aria-current={code === lang ? 'true' : undefined}
            onClick={(event) => {
              onPick?.();
              document.cookie = `${LOCALE_COOKIE}=${code}; path=/; max-age=31536000; samesite=lax`;
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
              event.preventDefault();
              window.location.assign(path + window.location.search + window.location.hash);
            }}
          >
            {LOCALE_INFO[code].name}
          </a>
        );
      })}
    </>
  );
}
