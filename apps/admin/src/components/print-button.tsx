'use client'

import { Icon } from './icons'

export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" className="btn btn--line btn--sm" onClick={() => window.print()}>
      <Icon name="print" className="btn__icon" />
      {label}
    </button>
  )
}
