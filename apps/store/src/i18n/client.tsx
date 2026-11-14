'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { dirOf, type Direction, type Locale } from './config';
import type { MessageKey, Messages, Vars } from './index';

type Translate = (key: MessageKey, vars?: Vars) => string;

interface I18nValue {
  lang: Locale;
  dir: Direction;
  t: Translate;
  /** '/collections' -> '/fr/collections' */
  href: (path?: string) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  lang,
  messages,
  children,
}: {
  lang: Locale;
  messages: Partial<Messages>;
  children: ReactNode;
}) {
  const value = useMemo<I18nValue>(() => {
    const t: Translate = (key, vars) => {
      const text = messages[key] ?? key;
      if (!vars) return text;
      return text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
    };
    const href = (path = '') => `/${lang}${path === '/' ? '' : path}`;
    return { lang, dir: dirOf(lang), t, href };
  }, [lang, messages]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside <I18nProvider>');
  return value;
}
