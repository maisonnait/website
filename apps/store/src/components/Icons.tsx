/** Line icons, drawn on a 24 px grid with currentColor. */
type IconProps = { className?: string };

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
} as const;

export function IconGlobe({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.6 2.4 3.9 5.2 3.9 8.5S14.6 18.1 12 20.5c-2.6-2.4-3.9-5.2-3.9-8.5S9.4 5.9 12 3.5z" />
    </svg>
  );
}

export function IconChevron({ className }: IconProps) {
  return (
    <svg className={className} {...base} viewBox="0 0 10 10" strokeWidth={1.6}>
      <path d="M1 3l4 4 4-4" />
    </svg>
  );
}

export function IconMoon({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z" />
    </svg>
  );
}

export function IconSun({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
    </svg>
  );
}

/** The cart: a flacon-shouldered bag. */
export function IconBag({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M5.5 8.5h13l1 11.5h-15z" />
      <path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" />
    </svg>
  );
}

export function IconMenu({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M4 8h16M4 16h16" />
    </svg>
  );
}

export function IconClose({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M5.5 5.5l13 13M18.5 5.5l-13 13" />
    </svg>
  );
}

export function IconMinus({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M6 12h12" />
    </svg>
  );
}

export function IconPlus({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M6 12h12M12 6v12" />
    </svg>
  );
}
