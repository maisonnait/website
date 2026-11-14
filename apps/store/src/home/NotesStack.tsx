'use client';

import { useEffect, useRef } from 'react';
import { useMode, usePrefersReducedMotion } from '@/lib/theme';
import { SKETCHES, setLight, type SketchName } from './sketches';

export interface NoteText {
  key: SketchName;
  name: string;
  place: string;
  text: string;
}

interface Item {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  name: SketchName;
  w: number;
  h: number;
  /** on screen */
  on: boolean;
  /** covered by the next note */
  covered: boolean;
}

/**
 * The five notes as stacked fields: each one sticks under the header while the next slides
 * over it. Each carries a small generative drawing that only moves while it can be seen.
 */
export function NotesStack({ notes }: { notes: NoteText[] }) {
  const root = useRef<HTMLDivElement>(null);
  const mode = useMode();
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const stack = root.current;
    if (!stack) return;
    const articles = Array.from(stack.querySelectorAll<HTMLElement>('.note'));
    const items: Item[] = [];
    for (const article of articles) {
      const canvas = article.querySelector('canvas');
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) items.push({ canvas, ctx, name: canvas.dataset.sketch as SketchName, w: 0, h: 0, on: false, covered: false });
    }

    setLight(mode !== 'dark');
    const start = performance.now();
    let raf = 0;
    let odd = false;
    let ticking = false;
    let vh = window.innerHeight;

    const size = (item: Item) => {
      const rect = item.canvas.getBoundingClientRect();
      if (!rect.width) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      item.w = Math.round(rect.width);
      item.h = Math.round(rect.height);
      item.canvas.width = Math.round(item.w * dpr);
      item.canvas.height = Math.round(item.h * dpr);
      item.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const draw = (item: Item, seconds: number) => {
      if (!item.w) return;
      try {
        SKETCHES[item.name]?.(item.ctx, item.w, item.h, seconds);
      } catch {
        // a sketch must never break the page
      }
    };
    const loop = (now: number) => {
      raf = 0;
      odd = !odd; // every other frame is enough for these slow drawings
      const seconds = (now - start) / 1000;
      let live = false;
      for (const item of items) {
        if (!item.on) continue;
        live = true;
        if (odd && !item.covered) draw(item, seconds);
      }
      if (live) raf = requestAnimationFrame(loop);
    };

    // How far the next note has slid over each one.
    const frame = () => {
      ticking = false;
      for (let i = 0; i < articles.length; i++) {
        const article = articles[i]!;
        const next = articles[i + 1];
        const item = items[i];
        if (!next) {
          if (item) item.covered = false;
          break;
        }
        const a = article.getBoundingClientRect();
        const b = next.getBoundingClientRect();
        const cover = Math.min(1, Math.max(0, (vh - b.top) / (vh * 0.85)));
        article.style.setProperty('--cover', reduced ? '0' : cover.toFixed(3));
        if (item) item.covered = b.top <= a.top + 16;
      }
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(frame);
    };

    const layout = () => {
      vh = window.innerHeight;
      const bar = document.querySelector<HTMLElement>('.bar')?.offsetHeight ?? 60;
      // A note taller than the screen sticks by its bottom edge, so all of it can be read.
      articles.forEach((article, i) => {
        article.style.top = `${Math.min(bar + i * 12, vh - article.offsetHeight)}px`;
      });
      const seconds = reduced ? 4 : (performance.now() - start) / 1000;
      for (const item of items) {
        size(item);
        draw(item, seconds);
      }
      frame();
    };

    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(layout, 160);
    };

    let observer: IntersectionObserver | null = null;
    if (!reduced) {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const item = items.find((candidate) => candidate.canvas === entry.target);
            if (item) item.on = entry.isIntersecting;
          }
          if (!raf) raf = requestAnimationFrame(loop);
        },
        { rootMargin: '60px' },
      );
      for (const item of items) observer.observe(item.canvas);
    }

    layout();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    document.fonts?.ready.then(layout).catch(() => {});

    return () => {
      observer?.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      window.clearTimeout(resizeTimer);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [mode, reduced]);

  return (
    <div className="notes__stack" ref={root}>
      {notes.map((note, index) => (
        <article className={`note note--${note.key}`} key={note.key} style={{ '--i': index } as React.CSSProperties}>
          <div className="wrap note__in">
            <canvas className="note__art" data-sketch={note.key} aria-hidden="true" />
            <div className="note__txt">
              <h3>{note.name}</h3>
              <p className="note__place">{note.place}</p>
              <p className="note__text">{note.text}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
