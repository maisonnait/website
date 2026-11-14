'use client';

import { useEffect, useRef } from 'react';
import { usePrefersReducedMotion } from '@/lib/theme';

/** A looping background film that only runs while it is on screen (the amber block). */
export function LoopVideo({ src, poster, className }: { src: string; poster: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const video = ref.current;
    if (!video || reduced) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (video.preload === 'none') video.preload = 'auto';
            video.play().catch(() => {});
          } else video.pause();
        }
      },
      { rootMargin: '120px' },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [reduced]);

  return (
    <video ref={ref} className={className} src={src} poster={poster} muted loop playsInline preload="none" aria-hidden="true" tabIndex={-1} />
  );
}
