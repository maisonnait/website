import { notFound } from 'next/navigation';

/** Any address that no page claims ends here, and shows the translated "not found" page. */
export default function CatchAll() {
  notFound();
}
