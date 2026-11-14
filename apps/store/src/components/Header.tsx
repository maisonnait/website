'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Logo } from '@/brand/Logo';
import { useCart } from '@/cart/CartProvider';
import { useI18n } from '@/i18n/client';
import { LOCALE_INFO } from '@/i18n/config';
import { COLLECTION_SLUGS as COLLECTIONS } from '@/lib/collections';
import { setMode, syncMode, useMode } from '@/lib/theme';
import { IconBag, IconChevron, IconClose, IconGlobe, IconMenu, IconMoon, IconSun } from './Icons';
import { LanguageLinks } from './LanguageLinks';

function LanguageMenu() {
  const { lang, t } = useI18n();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      box.current?.querySelector('button')?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={`langbox ${open ? 'is-open' : ''}`} ref={box}>
      <button
        className="langbox__btn"
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="lang-list"
        aria-label={`${t('lang.label')} : ${LOCALE_INFO[lang].name}`}
        onClick={() => setOpen((value) => !value)}
      >
        <IconGlobe className="langbox__globe" />
        <span className="langbox__name" lang={lang}>
          {LOCALE_INFO[lang].name}
        </span>
        <IconChevron className="langbox__chevron" />
      </button>
      <div className="langbox__list" id="lang-list" hidden={!open}>
        <LanguageLinks onPick={() => setOpen(false)} />
      </div>
    </div>
  );
}

function ThemeToggle({ withLabel = false }: { withLabel?: boolean }) {
  const { t } = useI18n();
  const mode = useMode();
  const label = t(mode === 'dark' ? 'theme.toLight' : 'theme.toDark');
  return (
    <button
      className={withLabel ? 'menu__theme' : 'iconbtn mode'}
      type="button"
      aria-label={withLabel ? undefined : label}
      onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
    >
      {mode === 'dark' ? <IconSun /> : <IconMoon />}
      {withLabel ? <span>{label}</span> : null}
    </button>
  );
}

function CartButton() {
  const { t, href } = useI18n();
  const { count, openDrawer } = useCart();
  const pathname = usePathname();
  const cartPath = href('/panier');
  const label = count === 0 ? t('cart.open') : `${t('cart.open')} (${count === 1 ? t('cart.count1') : t('cart.count', { n: count })})`;
  return (
    <Link
      className="iconbtn cartbtn"
      href={cartPath}
      aria-label={label}
      onClick={(event) => {
        // On the cart page and in the checkout the page itself shows the cart.
        if (pathname === cartPath || pathname.startsWith(href('/commande'))) return;
        event.preventDefault();
        openDrawer();
      }}
    >
      <IconBag />
      {count > 0 ? (
        <span className="cartbtn__count" aria-hidden="true">
          {count}
        </span>
      ) : null}
    </Link>
  );
}

function MobileMenu() {
  const { t, href } = useI18n();
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const close = () => dialog.current?.close();

  // Following a link closes the menu.
  useEffect(() => {
    dialog.current?.close();
  }, [pathname]);

  return (
    <>
      <button
        className="iconbtn menubtn"
        type="button"
        aria-label={t('nav.menu')}
        aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}
      >
        <IconMenu />
      </button>
      <dialog
        className="sheet menu"
        ref={dialog}
        aria-label={t('nav.menuTitle')}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div className="sheet__panel">
          <header className="sheet__head">
            <h2 className="sheet__title">{t('nav.menuTitle')}</h2>
            <button className="iconbtn" type="button" aria-label={t('nav.menuClose')} onClick={close}>
              <IconClose />
            </button>
          </header>
          <div className="sheet__body menu__body">
            <nav aria-label={t('nav.main')}>
              <h3 className="menu__label">{t('nav.collections')}</h3>
              <ul className="menu__list menu__list--big">
                <li>
                  <Link href={href('/collections')} onClick={close}>
                    {t('nav.allCollections')}
                  </Link>
                </li>
                {COLLECTIONS.map((slug) => (
                  <li key={slug}>
                    <Link href={href(`/collections/${slug}`)} onClick={close}>
                      {t(`tab.${slug}`)}
                    </Link>
                  </li>
                ))}
              </ul>
              <h3 className="menu__label">{t('nav.house')}</h3>
              <ul className="menu__list">
                <li>
                  <Link href={`${href()}#nom`} onClick={close}>
                    {t('nav.story')}
                  </Link>
                </li>
                <li>
                  <Link href={`${href()}#notes`} onClick={close}>
                    {t('nav.notes')}
                  </Link>
                </li>
                <li>
                  <Link href={`${href()}#film`} onClick={close}>
                    {t('nav.film')}
                  </Link>
                </li>
                <li>
                  <Link href={`${href()}#lire`} onClick={close}>
                    {t('nav.read')}
                  </Link>
                </li>
              </ul>
              <h3 className="menu__label">{t('nav.help')}</h3>
              <ul className="menu__list">
                <li>
                  <Link href={href('/suivi')} onClick={close}>
                    {t('nav.track')}
                  </Link>
                </li>
                <li>
                  <Link href={href('/livraison')} onClick={close}>
                    {t('foot.shipping')}
                  </Link>
                </li>
                <li>
                  <Link href={href('/retours')} onClick={close}>
                    {t('foot.returns')}
                  </Link>
                </li>
                <li>
                  <Link href={href('/faq')} onClick={close}>
                    {t('foot.faq')}
                  </Link>
                </li>
                <li>
                  <Link href={href('/contact')} onClick={close}>
                    {t('foot.contact')}
                  </Link>
                </li>
              </ul>
            </nav>
            <h3 className="menu__label">{t('lang.label')}</h3>
            <div className="menu__langs">
              <LanguageLinks onPick={close} />
            </div>
            <ThemeToggle withLabel />
          </div>
        </div>
      </dialog>
    </>
  );
}

export function Header() {
  const { t, href, lang } = useI18n();
  const pathname = usePathname();
  const isHome = pathname === `/${lang}`;
  const [atTop, setAtTop] = useState(true);

  useEffect(() => {
    syncMode();
  }, []);

  // Over the hero of the home page the bar is transparent; it turns solid as soon as the page moves.
  useEffect(() => {
    const onScroll = () => setAtTop(window.scrollY < 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const current = (path: string) => (pathname === path || pathname.startsWith(`${path}/`) ? 'page' : undefined);

  return (
    <header className={`bar ${isHome && atTop ? 'is-clear' : ''}`}>
      <Link className="bar__brand" href={href()} aria-label={`${t('brand')}, ${t('nav.home')}`}>
        <Logo className="bar__logo" title={t('brand')} />
      </Link>
      <nav className="bar__nav" aria-label={t('nav.main')}>
        {COLLECTIONS.slice(0, 3).map((slug) => (
          <Link key={slug} href={href(`/collections/${slug}`)} aria-current={current(href(`/collections/${slug}`))}>
            {t(`tab.${slug}`)}
          </Link>
        ))}
        <Link href={`${href()}#nom`}>{t('nav.story')}</Link>
        <Link href={href('/suivi')} aria-current={current(href('/suivi'))}>
          {t('nav.track')}
        </Link>
      </nav>
      <div className="bar__tools">
        <LanguageMenu />
        <ThemeToggle />
        <CartButton />
        <MobileMenu />
      </div>
    </header>
  );
}
