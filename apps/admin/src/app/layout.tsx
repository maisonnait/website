import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'

import '@fontsource/josefin-sans/300.css'
import '@fontsource/josefin-sans/400.css'
import '@fontsource/josefin-sans/600.css'
import '@fontsource/spectral/400.css'
import '@fontsource/spectral/400-italic.css'
import '@fontsource/spectral/600.css'
import '@fontsource/tajawal/400.css'
import '@fontsource/tajawal/700.css'
import './globals.css'
import './ui.css'
import './pages.css'
import './print.css'

export const metadata: Metadata = {
  title: {
    default: 'Gestion | Maison N’Ait',
    template: '%s | Gestion N’Ait',
  },
  description: 'Gestionnaire de stock et de commandes de la Maison N’Ait. Accès réservé à l’équipe.',
  // The back office must never appear in a search engine (the same rule is sent as an HTTP header).
  robots: {
    index: false,
    follow: false,
    nocache: true,
    noarchive: true,
    nosnippet: true,
    noimageindex: true,
    googleBot: { index: false, follow: false, noimageindex: true, noarchive: true, nosnippet: true },
  },
  referrer: 'no-referrer',
  formatDetection: { telephone: false, email: false, address: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0b0b0c',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
