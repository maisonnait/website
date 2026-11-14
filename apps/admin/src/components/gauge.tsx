import type { CSSProperties } from 'react'

/**
 * Stock level drawn as a small flacon. The bottle is full at four times the low-stock
 * threshold, so the "low" line always sits at a quarter of the bottle.
 * Decorative: the number is always printed next to it.
 */
export function Gauge({ stock, threshold }: { stock: number; threshold: number }) {
  const full = Math.max(threshold * 4, 4)
  const level = Math.max(0, Math.min(1, stock / full))
  const state = stock <= 0 ? 'gauge--out' : stock <= threshold ? 'gauge--low' : ''
  // a few units must stay visible at the bottom of the bottle
  const shown = stock > 0 ? Math.max(level, 0.12) : 0
  return <span className={`gauge ${state}`} style={{ '--level': shown.toFixed(3) } as CSSProperties} aria-hidden="true" />
}
