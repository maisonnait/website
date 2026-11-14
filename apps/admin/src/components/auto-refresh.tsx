'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Keeps a list fresh while it stays open on the counter: reloads the server data every
 * `seconds`, and as soon as the tab is looked at again. Nothing happens in a hidden tab.
 */
export function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter()

  useEffect(() => {
    let last = Date.now()
    const refresh = () => {
      if (document.visibilityState !== 'visible') return
      last = Date.now()
      router.refresh()
    }
    const timer = window.setInterval(refresh, seconds * 1000)
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - last > 15_000) refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [router, seconds])

  return null
}
