import React from 'react';
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-20 py-10 px-4 border-t border-border bg-bg-muted" aria-label="Pied de page">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-6 md:items-center md:justify-between text-sm">
        <p className="text-muted-foreground">© {new Date().getFullYear()} LMNP App</p>
        <nav aria-label="Liens légaux" className="flex gap-4">
          <Link href="/mentions-legales" className="hover:underline">Mentions légales</Link>
          <Link href="/cgu" className="hover:underline">CGU</Link>
          <Link href="/contact" className="hover:underline">Contact</Link>
        </nav>
      </div>
    </footer>
  );
}
