'use client';

import { useEffect, useRef, useState } from 'react';
import { useMode, usePrefersReducedMotion } from '@/lib/theme';
import { Mist } from './mist';

export interface StageText {
  key: 'top' | 'heart' | 'base';
  name: string;
  time: string;
  text: string;
}

const WAVE = 'M-160 0q20-6 40 0t40 0 40 0 40 0 40 0 40 0 40 0 40 0 40 0 40 0V240H-160Z';
const FULL = 122;

/**
 * "A perfume is read in three stages". The button sprays the drawn flacon; the three stages
 * then light up one after the other, each for as long as it lasts on skin (in proportion).
 */
export function ReadPerfume({
  title,
  intro,
  spray,
  sizes,
  tip,
  stages,
}: {
  title: string;
  intro: string;
  spray: string;
  sizes: string;
  tip: string;
  stages: StageText[];
}) {
  const mistCanvas = useRef<HTMLCanvasElement>(null);
  const flacon = useRef<SVGSVGElement>(null);
  const mist = useRef<Mist | null>(null);
  const timers = useRef<number[]>([]);
  const mode = useMode();
  const reduced = usePrefersReducedMotion();

  const [level, setLevel] = useState(FULL);
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState(0);
  const [active, setActive] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!mistCanvas.current) return;
    const instance = new Mist(mistCanvas.current);
    mist.current = instance;
    const onResize = () => instance.resize();
    window.addEventListener('resize', onResize);
    const pending = timers.current;
    return () => {
      window.removeEventListener('resize', onResize);
      instance.stop();
      pending.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  useEffect(() => {
    mist.current?.setLight(mode !== 'dark');
  }, [mode]);

  const onSpray = () => {
    setLevel((value) => (value > 236 ? FULL : value + 9)); // the flacon empties a little, then refills
    if (reduced) return;

    const bottle = flacon.current?.getBoundingClientRect();
    const canvas = mistCanvas.current?.getBoundingClientRect();
    if (bottle && canvas && mist.current) {
      mist.current.resize();
      const x = bottle.left + bottle.width / 2 - canvas.left;
      const y = bottle.top + bottle.height * (2 / 320) - canvas.top;
      mist.current.burst(x, y, { n: 150, spread: 0.75, power: 1.05 });
      const instance = mist.current;
      window.setTimeout(() => instance.burst(x, y, { n: 70, spread: 0.5, power: 0.8 }), 140);
    }

    timers.current.forEach((id) => window.clearTimeout(id));
    const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
    const on = (key: string, ms: number) => setActive((current) => ({ ...current, [key]: ms }));
    const off = (key: string) =>
      setActive((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });

    timers.current = [];
    setRun((value) => value + 1); // restarts the three bars
    setRunning(true);
    setActive({ top: 1500 });
    later(1200, () => on('heart', 2900));
    later(1900, () => off('top'));
    later(3700, () => on('base', 3600));
    later(4600, () => off('heart'));
    later(8200, () => {
      setRunning(false);
      setActive({});
    });
  };

  return (
    <div className={`wrap read__grid ${running ? 'is-playing' : ''}`}>
      <div className="atom">
        <div className="atom__stage">
          <canvas className="atom__mist" ref={mistCanvas} aria-hidden="true" />
          <svg className="atom__flacon" ref={flacon} viewBox="0 0 200 320" aria-hidden="true">
            <ellipse cx="100" cy="313" rx="76" ry="6" fill="currentColor" opacity=".12" />
            <g clipPath="url(#clip-body)">
              <g className="flacon__liq" style={{ transform: `translate(0px, ${level}px)` }}>
                <path className="flacon__wave" d={WAVE} fill="url(#liq-amber)" />
              </g>
            </g>
            <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
              <polygon points="56,70 144,70 170,96 170,284 144,310 56,310 30,284 30,96" fill="currentColor" fillOpacity=".03" />
              <rect x="88" y="52" width="24" height="18" />
              <rect x="70" y="14" width="60" height="38" fill="currentColor" fillOpacity=".07" />
              <rect x="82" y="2" width="36" height="12" fill="currentColor" fillOpacity=".07" />
              <path d="M100 140 134 190 100 240 66 190Z" strokeOpacity=".7" />
              <circle cx="100" cy="190" r="8" strokeOpacity=".7" />
            </g>
          </svg>
        </div>
        <button className="btn" type="button" onClick={onSpray}>
          {spray}
        </button>
        <ul className="sizes" aria-hidden="true">
          {[
            [50, 9],
            [75, 7.5],
            [100, 6],
          ].map(([ml, stroke]) => (
            <li key={ml}>
              <svg viewBox="0 0 200 320" strokeWidth={stroke}>
                <use href="#flacon" />
              </svg>
              {ml} ml
            </li>
          ))}
        </ul>
        <p className="read__sizes">{sizes}</p>
      </div>
      <div className="read__txt">
        <h2>{title}</h2>
        <p className="lede">{intro}</p>
        <ol className="stages">
          {stages.map((stage) => {
            const duration = active[stage.key];
            return (
              <li
                key={stage.key}
                className={`stage stage--${stage.key} ${duration ? 'is-on' : ''}`}
                style={duration ? ({ '--dur': `${duration}ms` } as React.CSSProperties) : undefined}
              >
                <h3 className="stage__name">{stage.name}</h3>
                <p className="stage__time">{stage.time}</p>
                <p className="stage__text">{stage.text}</p>
                <div className="stage__bar" aria-hidden="true">
                  <i key={run} />
                </div>
              </li>
            );
          })}
        </ol>
        <p className="read__tip">{tip}</p>
      </div>
    </div>
  );
}
