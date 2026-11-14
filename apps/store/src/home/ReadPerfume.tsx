'use client';

import { useEffect, useRef, useState } from 'react';
import { useMode, usePrefersReducedMotion } from '@/lib/theme';
import { Mark } from '@/brand/Logo';
import { Mist } from './mist';

export interface StageText {
  key: 'top' | 'heart' | 'base';
  name: string;
  time: string;
  text: string;
}

/** Where the top of the stopper is in the picture of the flacon, from the top of its box. */
const STOPPER_TOP = 0.145;

/**
 * "A perfume is read in three stages". The button sprays the house flacon; the three stages
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
  const flacon = useRef<HTMLImageElement>(null);
  const mist = useRef<Mist | null>(null);
  const timers = useRef<number[]>([]);
  const mode = useMode();
  const reduced = usePrefersReducedMotion();

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
    if (reduced) return;

    const bottle = flacon.current?.getBoundingClientRect();
    const canvas = mistCanvas.current?.getBoundingClientRect();
    if (bottle && canvas && mist.current) {
      mist.current.resize();
      const x = bottle.left + bottle.width / 2 - canvas.left;
      const y = bottle.top + bottle.height * STOPPER_TOP - canvas.top;
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
          <img
            className="atom__flacon"
            ref={flacon}
            src="/media/flacon/bottle-arabisant.webp"
            alt=""
            width={1200}
            height={1500}
            loading="lazy"
            decoding="async"
          />
        </div>
        <button className="btn" type="button" onClick={onSpray}>
          {spray}
        </button>
        <ul className="sizes" aria-hidden="true">
          {[50, 75, 100].map((ml) => (
            <li key={ml}>
              <Mark className="sizes__sign" title="" />
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
