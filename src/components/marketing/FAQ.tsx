import React from 'react';

export function FAQ() {
  const qa = [
    { q: 'Qu’est-ce que le régime LMNP ?', a: 'Le statut de Loueur en Meublé Non Professionnel permet d’amortir le bien et de réduire l’imposition sur les loyers.' },
    { q: 'Comment sont calculés les amortissements ?', a: 'Nous appliquons un amortissement linéaire avec prorata temporis la première année, cohérent avec les tableaux fiscaux.' },
    { q: 'Mes données sont-elles sécurisées ?', a: 'Elles sont stockées dans une base Postgres isolée (Supabase) avec politiques RLS, chiffrées en transit.' },
    { q: 'Puis-je essayer gratuitement ?', a: 'Oui: le plan Gratuit inclut 20 écritures sans limite de temps.' },
    { q: 'Puis-je exporter ma comptabilité ?', a: 'Oui: exports 2033C / 2033E / 2033A et journaux (CSV, XLSX, PDF selon le cas).' },
  ];
  return (
    <section className="py-20 px-4" aria-labelledby="faq-title">
      <div className="max-w-5xl mx-auto">
        <h2 id="faq-title" className="text-2xl md:text-3xl font-semibold tracking-tight mb-10 text-center">FAQ</h2>
        <dl className="space-y-6">
          {qa.map(item => (
            <div key={item.q} className="p-5 rounded-[--radius-lg] border border-border bg-card shadow-sm">
              <dt className="text-lg font-medium mb-2">{item.q}</dt>
              <dd className="text-sm text-muted-foreground leading-relaxed">{item.a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
