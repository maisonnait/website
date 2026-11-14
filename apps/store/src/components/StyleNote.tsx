import type { Translate } from '@/i18n';

/**
 * The families of the catalogue are named after famous houses and sold as the house's own
 * interpretations ("Style"). This note says so and states the absence of any affiliation;
 * it accompanies every list of products and every product page.
 */
export function StyleNote({ t, className = '' }: { t: Translate; className?: string }) {
  return <p className={`stylenote ${className}`}>{t('ch4.note')}</p>;
}
