import type { ReactNode } from 'react'

/** Line icons drawn on a 24 px grid, coloured by the text around them. */
const PATHS = {
  dashboard: <path d="M4 4h7v8H4zM13 4h7v5h-7zM13 12h7v8h-7zM4 15h7v5H4z" />,
  orders: (
    <>
      <path d="M4 8l8-4 8 4v8l-8 4-8-4z" />
      <path d="M4 8l8 4 8-4M12 12v8" />
    </>
  ),
  // the flacon: neck, cut shoulders, the level of the perfume
  stock: (
    <>
      <path d="M10 3h4v3h-4zM9 6h6l3 3v10l-2 2H8l-2-2V9z" />
      <path d="M6 13h12" />
    </>
  ),
  products: (
    <>
      <path d="M4 4h7l9 9-7 7-9-9z" />
      <path d="M8.2 8.2h.01" />
    </>
  ),
  users: (
    <>
      <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M17.5 14.4c2.1.8 3.5 2.8 3.5 5.6" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <path d="M13 5h4v4h-4zM7 15h4v4H7z" />
    </>
  ),
  phone: <path d="M6 3h4l1.5 5L9 9.5a11 11 0 0 0 5.5 5.5L16 12.5l5 1.5v4a2 2 0 0 1-2 2C10.7 20 4 13.3 4 5a2 2 0 0 1 2-2z" />,
  chat: <path d="M4 5h16v11H10l-5 4v-4H4z" />,
  print: (
    <>
      <path d="M7 9V4h10v5M7 17H4V9h16v8h-3" />
      <path d="M7 14h10v6H7z" />
    </>
  ),
  download: <path d="M12 4v11M7.5 11l4.5 4.5 4.5-4.5M4 20h16" />,
  history: (
    <>
      <path d="M4 12a8 8 0 1 0 2.3-5.6M4 5v4h4" />
      <path d="M12 8v4.5l3 2" />
    </>
  ),
} satisfies Record<string, ReactNode>

export type IconName = keyof typeof PATHS

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  )
}
