'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useMode, usePrefersReducedMotion } from '@/lib/theme';
import { Plume } from './plume';

/**
 * The flacon of the hero, staged like a short film.
 *
 * The pictures are stills of one 3D scene. Fifteen more frames of that scene, the flacon turned
 * 2.8125 degrees further on each (brand/render/scene.py --turn-seq), are packed in one sheet per
 * theme; a canvas laid exactly over the flacon of the still shows the frame for the current
 * angle, blending two neighbours in between. At rest the canvas fades away and the sharp still
 * shows again.
 *
 * What happens:
 *  - arrival: the camera pulls back and the focus comes in (CSS, see home.css), the flacon swings
 *    round to face the visitor, a spray of mist leaves the stopper, light passes over the glass;
 *  - afterwards, every few seconds, a small take: a slow turn with a thin wisp, or the light again;
 *  - the mouse: the flacon turns its face towards it and the picture shifts a little against it;
 *    a click or a tap on the flacon sprays;
 *  - the scroll: the flacon turns away and lags behind the page.
 * With "reduce motion", or on a data-saving connection, none of this runs: the still stays.
 */
const SHEETS: Record<string, string> = { light: '/media/flacon/turn-light.webp', dark: '/media/flacon/turn-dark.webp' };
const COLS = 5;
const ROWS = 3;
const FRAMES = COLS * ROWS;
const MID = (FRAMES - 1) / 2; // the frame that faces the visitor
const FOLLOW_MS = 210; // how quickly the flacon catches up with the mouse or the scroll
const REST_MS = 2400; // without mouse movement for this long, the flacon faces front again
const STOPPER = 0.022; // top of the stopper, from the top of the frame

interface Take {
  name: 'arrival' | 'sway';
  start: number;
  duration: number;
  /** Angle in frames for a progress from 0 to 1. */
  path: (progress: number) => number;
  /** Things that happen once, at a given progress. */
  cues: { at: number; run: () => void; done?: boolean }[];
}

export function HeroFlacon({ children }: { children: ReactNode }) {
  const camRef = useRef<HTMLDivElement>(null);
  const turnRef = useRef<HTMLCanvasElement>(null);
  const mistRef = useRef<HTMLCanvasElement>(null);
  const sheenRef = useRef<HTMLSpanElement>(null);
  const mode = useMode();
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const cam = camRef.current;
    const canvas = turnRef.current;
    const mistCanvas = mistRef.current;
    const sheen = sheenRef.current;
    const hero = canvas?.closest<HTMLElement>('.hero');
    const art = cam?.parentElement;
    const sheetUrl = SHEETS[mode];
    if (!cam || !art || !canvas || !mistCanvas || !sheen || !hero || !sheetUrl || reduced) return;
    if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const plume = new Plume(mistCanvas);
    plume.setLight(mode !== 'dark');
    plume.drift = document.documentElement.dir === 'rtl' ? 1 : -1;

    let alive = true;
    let sheet: HTMLImageElement | null = null;
    let frameWidth = 0;
    let frameHeight = 0;
    let angle = 0; // in frames, from -MID to MID
    let target = 0;
    let fromMouse: number | null = null;
    let fromScroll = 0;
    let take: Take | null = null;
    let wispUntil = 0;
    let onScreen = true;
    let raf = 0;
    let last = 0;
    let restTimer = 0;
    let idleTimer = 0;
    let idleCount = 0;

    const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
    const smooth = (value: number) => value * value * (3 - 2 * value);

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

    /** Where the stopper is on the mist canvas, and how big the flacon is compared with a desktop one. */
    const nozzle = () => {
      const flacon = canvas.getBoundingClientRect();
      const field = mistCanvas.getBoundingClientRect();
      return {
        x: flacon.left + flacon.width / 2 - field.left,
        y: flacon.top + flacon.height * STOPPER - field.top,
        scale: clamp(flacon.height / 660, 0.4, 1.3),
      };
    };
    const spray = (strength = 1) => {
      const at = nozzle();
      plume.resize();
      // with little room above the stopper (phones), the spray leans into the free space beside it
      plume.lean = clamp(1.5 - at.y / (260 * at.scale), 0.75, 1.1);
      plume.spray(at.x, at.y, at.scale, strength);
      canvas.dataset.sprays = String(Number(canvas.dataset.sprays ?? 0) + 1);
      wispUntil = Math.max(wispUntil, performance.now() + 1400 + 1800 * strength);
    };
    const shine = () => {
      sheen.classList.remove('is-on');
      void sheen.offsetWidth; // lets the same animation start again
      sheen.classList.add('is-on');
    };

    const arrival = (): Take => ({
      name: 'arrival',
      start: performance.now(),
      duration: 4600,
      // swings to one side, comes back through the front, a smaller swing to the other side, settles
      path: (p) => -6 * Math.sin(2.5 * Math.PI * p) * Math.pow(1 - p, 1.3) * smooth(clamp(p / 0.14, 0, 1)),
      cues: [
        { at: 0.38, run: () => spray(1) },
        { at: 0.8, run: shine },
      ],
    });
    const sway = (side: number, withSpray: boolean): Take => ({
      name: 'sway',
      start: performance.now(),
      duration: 4200,
      path: (p) => side * 3.4 * Math.sin(Math.PI * smooth(p)),
      cues: withSpray
        ? [{ at: 0.5, run: () => spray(0.45) }]
        : [
            {
              at: 0.12,
              run: () => {
                wispUntil = performance.now() + 3000;
              },
            },
          ],
    });

    const quiet = () => fromMouse === null && fromScroll === 0 && !take && onScreen && !document.hidden;
    const planIdle = () => {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(
        () => {
          if (!alive) return;
          if (quiet() && sheet) {
            const turn = idleCount++ % 3;
            if (turn === 1) shine();
            else take = sway(turn === 0 ? -1 : 1, turn === 2);
            wake();
          }
          planIdle();
        },
        6200 + Math.random() * 1800,
      );
    };

    const step = (now: number) => {
      raf = 0;
      if (!alive || !sheet) return;
      const elapsed = last ? Math.min(64, now - last) : 16;
      last = now;
      if (take) {
        const progress = (now - take.start) / take.duration;
        if (progress >= 1) {
          take = null;
        } else {
          angle = take.path(progress);
          for (const cue of take.cues) {
            if (!cue.done && progress >= cue.at) {
              cue.done = true;
              cue.run();
            }
          }
        }
      }
      if (!take) {
        target = fromMouse ?? fromScroll;
        angle += (target - angle) * (1 - Math.exp(-elapsed / FOLLOW_MS));
        if (Math.abs(target - angle) < 0.004) angle = target;
      }
      const wisping = now < wispUntil && onScreen;
      if (wisping) {
        const at = nozzle();
        plume.wisp(at.x, at.y, at.scale);
      }
      draw();
      const moving = take !== null || angle !== target;
      canvas.classList.toggle('is-live', moving || angle !== 0);
      canvas.dataset.state = take ? take.name : fromMouse !== null ? 'mouse' : fromScroll !== 0 ? 'scroll' : angle !== 0 ? 'settle' : 'rest';
      if ((moving || wisping) && onScreen) raf = requestAnimationFrame(step);
      else last = 0;
    };

    const wake = () => {
      if (!raf && alive && sheet && onScreen) raf = requestAnimationFrame(step);
    };

    const overFlacon = (x: number, y: number) => {
      const box = canvas.getBoundingClientRect();
      return x > box.left - box.width * 0.04 && x < box.right + box.width * 0.04 && y > box.top && y < box.bottom;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
      const box = canvas.getBoundingClientRect();
      const reach = Math.max(260, window.innerWidth * 0.42);
      const side = clamp((event.clientX - (box.left + box.width / 2)) / reach, -1, 1);
      // whole frames only: wherever the flacon stops, it shows one picture, never a blend of two
      fromMouse = Math.round(side * (MID - 0.4));
      take = null;
      // the picture shifts a little against the mouse: the flacon seems closer than the page
      cam.style.setProperty('--px', (-side * 9).toFixed(2));
      cam.style.setProperty('--py', (-clamp((event.clientY - (box.top + box.height / 2)) / window.innerHeight, -1, 1) * 6).toFixed(2));
      hero.style.cursor = overFlacon(event.clientX, event.clientY) ? 'pointer' : '';
      window.clearTimeout(restTimer);
      restTimer = window.setTimeout(release, REST_MS);
      wake();
    };
    const release = () => {
      window.clearTimeout(restTimer);
      fromMouse = null;
      cam.style.setProperty('--px', '0');
      cam.style.setProperty('--py', '0');
      wake();
    };
    const onPointerLeave = () => {
      hero.style.cursor = '';
      release();
    };
    const onClick = (event: MouseEvent) => {
      if (!sheet || (event.target as HTMLElement).closest('a, button')) return;
      if (!overFlacon(event.clientX, event.clientY)) return;
      spray(1);
      shine();
      art.classList.remove('is-pressed');
      void art.offsetWidth;
      art.classList.add('is-pressed');
      wake();
    };
    const onScroll = () => {
      const travelled = clamp(window.scrollY / (hero.offsetHeight * 0.6), 0, 1);
      fromScroll = Math.round(travelled * (MID - 1));
      cam.style.setProperty('--sy', (Math.min(window.scrollY, hero.offsetHeight) * 0.14).toFixed(1));
      if (fromScroll > 0) take = null;
      wake();
    };
    const onResize = () => plume.resize();

    const observer = new IntersectionObserver(([entry]) => {
      onScreen = Boolean(entry?.isIntersecting);
      if (onScreen) wake();
    });
    observer.observe(hero);
    hero.addEventListener('pointermove', onPointerMove);
    hero.addEventListener('pointerleave', onPointerLeave);
    hero.addEventListener('click', onClick);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);

    // The sheet is fetched once the page itself has loaded, so it never delays the first picture.
    let arrivalTimer = 0;
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
          plume.resize();
          onScroll();
          arrivalTimer = window.setTimeout(() => {
            if (!alive) return;
            if (window.scrollY < 40 && fromMouse === null && !document.hidden) {
              take = arrival();
              wake();
            }
            planIdle();
          }, 350);
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
      window.clearTimeout(idleTimer);
      window.clearTimeout(arrivalTimer);
      observer.disconnect();
      hero.removeEventListener('pointermove', onPointerMove);
      hero.removeEventListener('pointerleave', onPointerLeave);
      hero.removeEventListener('click', onClick);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('load', load);
      plume.stop();
      hero.style.cursor = '';
      canvas.classList.remove('is-live');
      sheen.classList.remove('is-on');
      art.classList.remove('is-pressed');
      for (const name of ['--px', '--py', '--sy']) cam.style.removeProperty(name);
      delete canvas.dataset.state;
      delete canvas.dataset.sprays;
    };
  }, [mode, reduced]);

  return (
    <>
      <div className="hero__art" aria-hidden="true">
        <div className="hero__cam" ref={camRef}>
          {children}
          <canvas ref={turnRef} className="hero__turn" />
          <span ref={sheenRef} className="hero__sheen" />
        </div>
      </div>
      <canvas ref={mistRef} className="hero__mist" aria-hidden="true" />
    </>
  );
}
