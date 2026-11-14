import type { ReactNode } from 'react';

/** Frame of the short information pages (delivery, returns, questions, contact). */
export function Policy({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
  return (
    <div className="wrap page page--narrow policy">
      <header className="page__head">
        <h1>{title}</h1>
        {lead ? <p className="lede">{lead}</p> : null}
      </header>
      {children}
    </div>
  );
}

export function PolicySection({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section className="policy__section" id={id}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
