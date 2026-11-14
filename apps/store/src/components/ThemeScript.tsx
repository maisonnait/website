'use client';

import { MODE_SCRIPT } from '@/lib/theme-script';

/**
 * Applies a saved dark theme before the first paint. The script only has to run while the
 * browser parses the HTML sent by the server; when React builds the element in the browser
 * (which never executes scripts) it is marked as plain text, as the Next.js guide
 * "preventing flash before hydration" recommends.
 */
export function ThemeScript() {
  return (
    <script
      type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: MODE_SCRIPT }}
    />
  );
}
