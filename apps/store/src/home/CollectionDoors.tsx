'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '@/lib/theme';

export type Door = { slug: string; name: string; count: string; href: string };

/** Collections that have their own rendered flacon in /media/flacon. */
const RENDERED = new Set(['arabisant', 'femmes', 'hommes', 'unisexe']);
const TURN_MS = 3200; // one perfume stays this long before the next
const HOLD_MS = 9000; // after the visitor pointed at a collection, the flacon waits this long

/**
 * The collections as four doors next to one flacon. The four pictures are the same flacon
 * rendered with each collection's perfume, so passing from one door to the next only changes
 * the colour of the perfume. It changes by itself while the block is on screen; pointing at a
 * door (or reaching it with the keyboard) chooses it.
 */
export function CollectionDoors({ doors }: { doors: Door[] }) {
  const [active, setActive] = useState(0);
  const [seen, setSeen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const held = useRef(0);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setSeen(Boolean(entry?.isIntersecting)), { threshold: 0.35 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!seen || reduced || doors.length < 2) return;
    const timer = window.setInterval(() => {
      if (Date.now() < held.current) return;
      setActive((index) => (index + 1) % doors.length);
    }, TURN_MS);
    return () => window.clearInterval(timer);
  }, [seen, reduced, doors.length]);

  const choose = (index: number) => {
    held.current = Date.now() + HOLD_MS;
    setActive(index);
  };

  return (
    <div className="showcase" ref={root}>
      <div className="showcase__flacon" aria-hidden="true">
        {doors.map((door, index) => (
          <img
            key={door.slug}
            className={`showcase__img ${index === active ? 'is-on' : ''}`}
            src={`/media/flacon/bottle-${RENDERED.has(door.slug) ? door.slug : 'arabisant'}.webp`}
            alt=""
            width={1200}
            height={1500}
            loading="lazy"
            decoding="async"
          />
        ))}
      </div>
      <ul className="doors">
        {doors.map((door, index) => (
          <li key={door.slug}>
            <Link
              className={`door ${index === active ? 'is-on' : ''}`}
              href={door.href}
              onPointerEnter={(event) => {
                if (event.pointerType === 'mouse') choose(index);
              }}
              onFocus={() => choose(index)}
            >
              <span className="door__name">{door.name}</span>
              <span className="door__count">{door.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
