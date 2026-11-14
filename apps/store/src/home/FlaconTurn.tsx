'use client';

import { useEffect, useRef } from 'react';
import { useMode, usePrefersReducedMotion } from '@/lib/theme';

/**
 * The flacon of the hero turns. Fifteen pictures of the same 3D scene, the flacon turned a
 * little more on each (brand/render/scene.py --turn-seq), are packed in one sheet; this canvas
 * sits exactly over the flacon of the still picture and shows the frame for the current angle,
 * blending two neighbours in between. At rest the canvas fades away and the sharp still shows.
 *
 * What moves it: a slow look left and right on arrival, then the mouse (the flacon turns its
 * face towards it) and the scroll (it turns away as the page leaves). Nothing moves with
 * "reduce motion", on a data-saving connection, or in a theme that has no frames yet.
 */
const SHEETS: Partial<Record<string, string>> = { light: '/media/flacon/turn-light.webp' };
const COLS = 5;
const ROWS = 3;
const FRAMES = COLS * ROWS;
const MID = (FRAMES - 1) / 2; // the frame that faces the visitor; one frame = 2.8125 degrees
const FOLLOW_MS = 210; // how quickly the flacon catches up with the mouse or the scroll
const INTRO_MS = 4600;
const INTRO_REACH = 5.2; // frames to each side during the look on arrival
const REST_MS = 2400; // without mouse movement for this long, the flacon faces front again

export function FlaconTurn() {
  const ref = useRef<HTMLCanvasElement>(null);
  const mode = useMode();
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = ref.current;
    const sheetUrl = SHEETS[mode];
    const hero = canvas?.closest<HTMLElement>('.hero');
    if (!canvas || !hero || !sheetUrl || reduced) return;
    if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let alive = true;
    let sheet: HTMLImageElement | null = null;
    let frameWidth = 0;
    let frameHeight = 0;
    let angle = 0; // in frames, from -MID to MID
    let target = 0;
    let fromMouse: number | null = null;
    let fromScroll = 0;
    let introStart = 0; // 0 = no look on arrival running
    let onScreen = true;
    let raf = 0;
    let last = 0;
    let restTimer = 0;
    let introTimer = 0;

    const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

    const draw = () => {
      if (!sheet) return;
      const position = clamp(angle, -MID, MID) + MID;
      const first = Math.floor(position);
      const blend = position - first;
      context.clearRect(0, 0, frameWidth, frameHeight);
      for (const [index, alpha] of [
        [first, 1],
        [Math.min(FRAMES - 1, first + 1), blend],
      ] as const) {
        if (alpha < 0.004) continue;
        context.globalAlpha = alpha;
        context.drawImage(
          sheet,
          (index % COLS) * frameWidth,
          Math.floor(index / COLS) * frameHeight,
          frameWidth,
          frameHeight,
          0,
          0,
          frameWidth,
          frameHeight,
        );
      }
      context.globalAlpha = 1;
    };

    const step = (now: number) => {
      raf = 0;
      if (!alive || !sheet) return;
      const elapsed = last ? Math.min(64, now - last) : 16;
      last = now;
      if (introStart) {
        const progress = (now - introStart) / INTRO_MS;
        if (progress >= 1) {
          introStart = 0;
        } else {
          const eased = progress * progress * (3 - 2 * progress); // leaves and arrives without a jolt
          angle = -INTRO_REACH * Math.sin(2 * Math.PI * eased);
        }
      }
      if (!introStart) {
        target = fromMouse ?? fromScroll;
        angle += (target - angle) * (1 - Math.exp(-elapsed / FOLLOW_MS));
        if (Math.abs(target - angle) < 0.004) angle = target;
      }
      draw();
      const moving = introStart !== 0 || angle !== target;
      canvas.classList.toggle('is-live', moving || angle !== 0);
      if (moving && onScreen) raf = requestAnimationFrame(step);
      else last = 0;
    };

    const wake = () => {
      if (!raf && alive && sheet && onScreen) raf = requestAnimationFrame(step);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
      const box = canvas.getBoundingClientRect();
      const reach = Math.max(260, window.innerWidth * 0.42);
      // whole frames only: wherever the flacon stops, it shows one picture, never a blend of two
      fromMouse = Math.round(clamp((event.clientX - (box.left + box.width / 2)) / reach, -1, 1) * (MID - 0.4));
      introStart = 0;
      window.clearTimeout(restTimer);
      restTimer = window.setTimeout(() => {
        fromMouse = null;
        wake();
      }, REST_MS);
      wake();
    };
    const onPointerLeave = () => {
      window.clearTimeout(restTimer);
      fromMouse = null;
      wake();
    };
    const onScroll = () => {
      fromScroll = Math.round(clamp(window.scrollY / (hero.offsetHeight * 0.6), 0, 1) * (MID - 1));
      if (fromScroll > 0) introStart = 0;
      wake();
    };

    const observer = new IntersectionObserver(([entry]) => {
      onScreen = Boolean(entry?.isIntersecting);
      if (onScreen) wake();
    });
    observer.observe(hero);
    hero.addEventListener('pointermove', onPointerMove);
    hero.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('scroll', onScroll, { passive: true });

    // The sheet is fetched once the page itself has loaded, so it never delays the first picture.
    const load = () => {
      if (!alive) return;
      const image = new Image();
      image.decoding = 'async';
      image.src = sheetUrl;
      image
        .decode()
        .then(() => {
          if (!alive) return;
          sheet = image;
          frameWidth = Math.round(image.naturalWidth / COLS);
          frameHeight = Math.round(image.naturalHeight / ROWS);
          canvas.width = frameWidth;
          canvas.height = frameHeight;
          onScroll();
          if (window.scrollY < 40 && fromMouse === null) {
            introTimer = window.setTimeout(() => {
              if (!alive || fromMouse !== null || window.scrollY >= 40) return;
              introStart = performance.now();
              wake();
            }, 500);
          }
        })
        .catch(() => {
          /* without the sheet the still picture simply stays */
        });
    };
    if (document.readyState === 'complete') load();
    else window.addEventListener('load', load, { once: true });

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(restTimer);
      window.clearTimeout(introTimer);
      observer.disconnect();
      hero.removeEventListener('pointermove', onPointerMove);
      hero.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('load', load);
      canvas.classList.remove('is-live');
    };
  }, [mode, reduced]);

  return <canvas ref={ref} className="hero__turn" aria-hidden="true" />;
}
