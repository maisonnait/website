'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useCart } from '@/cart/CartProvider';
import { useI18n } from '@/i18n/client';
import { CartLines } from './CartLines';
import { IconClose } from './Icons';

/** The cart, sliding in from the edge. A native <dialog>: focus stays inside, Escape closes it. */
export function CartDrawer() {
  const { t, href } = useI18n();
  const { lines, count, subtotal, drawerOpen, closeDrawer } = useCart();
  const dialog = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (drawerOpen && !element.open) element.showModal();
    if (!drawerOpen && element.open) element.close();
  }, [drawerOpen]);

  // Following a link closes the drawer.
  useEffect(() => {
    closeDrawer();
  }, [pathname, closeDrawer]);

  return (
    <dialog
      className="sheet drawer"
      ref={dialog}
      aria-labelledby="drawer-title"
      onClose={closeDrawer}
      onClick={(event) => {
        if (event.target === event.currentTarget) closeDrawer();
      }}
    >
      <div className="sheet__panel">
        <header className="sheet__head">
          <h2 className="sheet__title" id="drawer-title">
            {t('cart.title')}
            {count > 0 ? <span className="sheet__count">{count === 1 ? t('cart.count1') : t('cart.count', { n: count })}</span> : null}
          </h2>
          <button className="iconbtn" type="button" aria-label={t('cart.close')} onClick={closeDrawer}>
            <IconClose />
          </button>
        </header>
        {lines.length === 0 ? (
          <div className="sheet__body drawer__empty">
            <p className="drawer__emptytitle">{t('cart.empty')}</p>
            <p>{t('cart.emptyHint')}</p>
            <Link className="btn" href={href('/collections')} onClick={closeDrawer}>
              {t('nav.allCollections')}
            </Link>
          </div>
        ) : (
          <>
            <div className="sheet__body">
              <CartLines onNavigate={closeDrawer} />
            </div>
            <footer className="sheet__foot">
              <p className="totals__row totals__row--strong">
                <span>{t('cart.subtotal')}</span>
                <span className="price">{t('fmt.price', { n: subtotal })}</span>
              </p>
              <p className="drawer__note">{t('cart.cod')}</p>
              <Link className="btn btn--wide" href={href('/commande')} onClick={closeDrawer}>
                {t('cart.checkout')}
              </Link>
              <Link className="tlink drawer__view" href={href('/panier')} onClick={closeDrawer}>
                {t('cart.view')}
              </Link>
            </footer>
          </>
        )}
      </div>
    </dialog>
  );
}
