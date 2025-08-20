import React from 'react';
import Link from 'next/link';

export function Hero({ authenticated }: { authenticated: boolean }) {
  return (
    <section className="pt-20 pb-16 px-4" aria-labelledby="hero-title">
      <div className="mx-auto max-w-5xl text-center space-y-6">
        <h1 id="hero-title" className="text-3xl md:text-5xl font-semibold tracking-tight">
          La compta LMNP, enfin simple et sans prise de tête
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Générez vos amortissements, votre bilan et votre déclaration en quelques clics.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href={authenticated ? '/dashboard' : '/login'} className="btn-primary" aria-label="Essayez gratuitement l'application de comptabilité LMNP">
            Essayez gratuitement
          </Link>
          {authenticated && (
            <Link href="/dashboard" className="btn-ghost" aria-label="Voir le dashboard">
              Voir le dashboard
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
