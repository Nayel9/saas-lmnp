import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { Hero } from './Hero';

// Test minimal sans dépendances externes (pas de RTL) pour valider présence contenu clé

describe('Hero', () => {
  it('affiche le H1 et le CTA /login si non authentifié', () => {
    const html = renderToString(<Hero authenticated={false} />);
    expect(html).toContain('La compta LMNP');
    expect(html).toContain('Essayez gratuitement');
    expect(html).toContain('/login');
  });
  it('affiche CTA dashboard si authentifié', () => {
    const html = renderToString(<Hero authenticated />);
    expect(html).toContain('/dashboard');
  });
});

