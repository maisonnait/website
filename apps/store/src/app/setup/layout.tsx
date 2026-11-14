import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/** Root layout of the one page shown while the shop has no database (see proxy.ts). Nothing here reads data. */
export const metadata: Metadata = {
  title: 'Maison N’Ait',
  robots: { index: false, follow: false },
  icons: { icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }] },
};

export default function SetupLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, background: '#ffffff', color: '#0b0b0c', fontFamily: 'Georgia, "Times New Roman", serif' }}>{children}</body>
    </html>
  );
}
