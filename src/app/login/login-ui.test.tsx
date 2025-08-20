import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() })
}));

// Empêcher appel window dans tests SSR (le code actuel est dans useEffect, donc pas exécuté)
vi.mock('@/lib/supabase/client', () => ({
  getSupabaseBrowserClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) } })
}));

import LoginPageClient from './LoginPageClient';

describe('LoginPage UI (L1)', () => {
  it('rend les 3 modes et les champs essentiels', () => {
    const html = renderToString(<LoginPageClient />);
    expect(html).toContain('Se connecter');
    expect(html).toContain('Créer un compte');
    expect(html).toContain('Magic link');
    expect(html).toContain('Email');
    // champ password (placeholder •••) présent
    expect(html).toMatch(/type=\"password\"/);
    // Boutons SSO désactivés
    expect(html).toContain('Google');
    expect(html).toContain('Apple');
    // Zone aria-live
    expect(html).toMatch(/aria-live=\"polite\"/);
  });
});
