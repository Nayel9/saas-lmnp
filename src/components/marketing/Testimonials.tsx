import React from 'react';

export function Testimonials() {
  const items = [
    { quote: 'J’ai enfin abandonné mon tableur. Les amortissements sont prêts sans effort.', author: 'Marie', role: 'Loueur meublé' },
    { quote: 'Les exports fiscaux ont réduit ma préparation annuelle de plusieurs heures.', author: 'Thomas', role: 'Investisseur LMNP' },
  ];
  return (
    <section className="py-16 px-4 bg-bg-muted" aria-labelledby="testimonials-title">
      <div className="max-w-5xl mx-auto">
        <h2 id="testimonials-title" className="text-2xl md:text-3xl font-semibold tracking-tight text-center mb-12">Ils en parlent</h2>
        <div className="grid gap-8 md:grid-cols-2">
          {items.map((t,i)=>(
            <figure key={i} className="card flex flex-col gap-4">
              <blockquote className="text-base leading-relaxed">“{t.quote}”</blockquote>
              <figcaption className="text-sm text-muted-foreground">{t.author} — {t.role}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
