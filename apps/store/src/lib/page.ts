import { notFound } from 'next/navigation';
import { translator, type Translate } from '@/i18n';
import { isLocale, type Locale } from '@/i18n/config';

/** Validates the [lang] segment of a page and hands back its translator. */
export async function pageContext(params: Promise<{ lang: string }>): Promise<{ lang: Locale; t: Translate }> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return { lang, t: translator(lang) };
}
