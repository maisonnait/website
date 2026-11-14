'use client'

import { useState } from 'react'

/** Small product photo; falls back to the house initial when there is none or it cannot load. */
export function Thumb({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <span className="thumb thumb--none" aria-hidden="true">
        N
      </span>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote catalogue photos, no optimizer in front
    <img className="thumb" src={src} alt="" width={40} height={40} loading="lazy" decoding="async" onError={() => setFailed(true)} />
  )
}
