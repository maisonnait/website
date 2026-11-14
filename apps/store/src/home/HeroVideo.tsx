'use client';

import { useEffect, useRef } from 'react';
import { useMode, usePrefersReducedMotion } from '@/lib/theme';

/**
 * The full-bleed film behind the hero: gold smoke on white, or on the night in the dark theme.
 * The still frame is painted by CSS (so the right theme shows before any script runs); the
 * video gets the same picture as its poster, loads its theme's cut and only plays on screen.
 * With "reduce motion", or on a connection that asks to save data, the still frame stays.
 */
export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const mode = useMode();
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const name = mode === 'dark' ? 'hero-dark' : 'hero';
    video.poster = `/media/${name}.jpg`;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    if (reduced || saveData) {
      video.pause();
      video.removeAttribute('src');
      video.load();
      return;
    }
    const src = `/media/${name}.mp4`;
    if (video.getAttribute('src') !== src) {
      video.setAttribute('src', src);
      video.load();
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) video.play().catch(() => {});
          else video.pause();
        }
      },
      { rootMargin: '120px' },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [mode, reduced]);

  return <video ref={ref} className="hero__video" muted loop playsInline preload="auto" aria-hidden="true" tabIndex={-1} />;
}

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
