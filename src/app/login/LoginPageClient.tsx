"use client";
import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

type Mode = 'login' | 'signup' | 'magic';
interface Message { type: 'success' | 'error'; text: string; }

export default function LoginPageClient() {
  const router = useRouter();
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    setSupabase(client);
    client.auth.getUser().then(({ data }) => { if (data.user) router.replace('/dashboard'); });
    const { data: sub } = client.auth.onAuthStateChange((_e, session) => {
      if (session?.user) router.replace('/dashboard');
    });
    return () => { sub.subscription.unsubscribe(); };
  }, [router]);

  const resetMessages = () => setMessage(null);

  const submit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (!supabase) return;
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setMessage({ type: 'success', text: 'Connexion réussie. Redirection…' });
      } else if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage({ type: 'success', text: 'Compte créé. Vérifiez vos emails (confirmation). Redirection si confirmé…' });
      } else if (mode === 'magic') {
        const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/dashboard` } });
        if (error) throw error;
        setMessage({ type: 'success', text: 'Email envoyé (si compte existant). Vérifiez votre boîte.' });
      }
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message?: string }).message) : 'Erreur inattendue';
      setMessage({ type: 'error', text: msg });
    } finally {
      setLoading(false);
    }
  }, [email, password, supabase, mode]);

  const isEmailValid = /.+@.+\..+/.test(email);
  const canSubmit = !loading && isEmailValid && (mode === 'magic' ? true : password.length >= 6);

  return (
    <main id="main" className="min-h-screen flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-md card" role="region" aria-labelledby="auth-title">
        <h1 id="auth-title" className="text-xl font-semibold tracking-tight mb-2">Authentification</h1>
        <p className="text-sm text-muted-foreground mb-6">Choisissez une méthode pour accéder à votre espace.</p>
        <div className="flex items-center gap-2 mb-6" role="tablist" aria-label="Modes d'authentification">
          <button role="tab" aria-selected={mode==='login'} className={`btn text-sm px-3 py-1.5 ${mode==='login'? 'bg-bg-muted' : 'btn-ghost'}`} onClick={()=>{ setMode('login'); resetMessages(); }}>
            Se connecter
          </button>
          <button role="tab" aria-selected={mode==='signup'} className={`btn text-sm px-3 py-1.5 ${mode==='signup'? 'bg-bg-muted' : 'btn-ghost'}`} onClick={()=>{ setMode('signup'); resetMessages(); }}>
            Créer un compte
          </button>
          <button role="tab" aria-selected={mode==='magic'} className={`btn text-sm px-3 py-1.5 ${mode==='magic'? 'bg-bg-muted' : 'btn-ghost'}`} onClick={()=>{ setMode('magic'); resetMessages(); setPassword(''); }}>
            Magic link
          </button>
        </div>
        <form onSubmit={submit} aria-describedby="auth-help" noValidate>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">Email</label>
              <input id="email" name="email" type="email" autoComplete="email" required className="input" placeholder="vous@exemple.fr" value={email} onChange={e=>setEmail(e.target.value)} />
            </div>
            {mode !== 'magic' && (
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-1">Mot de passe</label>
                <input id="password" name="password" type="password" autoComplete={mode==='login'? 'current-password':'new-password'} required className="input" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} />
                <p className="mt-1 text-xs text-muted-foreground">6 caractères minimum.</p>
              </div>
            )}
            {mode==='magic' && (
              <p id="auth-help" className="text-xs text-muted-foreground">Un email contenant un lien d&apos;accès sera envoyé si l&apos;adresse est valide.</p>
            )}
            <div className="flex flex-col gap-2 pt-2">
              <button type="submit" disabled={!canSubmit} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed" aria-disabled={!canSubmit} aria-label="Valider le formulaire d'authentification">
                {loading ? '...' : mode === 'login' ? 'Se connecter' : mode === 'signup' ? 'Créer le compte' : 'Envoyer le lien'}
              </button>
              <div className="grid grid-cols-2 gap-2 mt-2" aria-label="Boutons SSO">
                <button type="button" className="btn bg-bg-muted text-muted-foreground cursor-not-allowed" aria-disabled="true" title="Bientôt" disabled>Google</button>
                <button type="button" className="btn bg-bg-muted text-muted-foreground cursor-not-allowed" aria-disabled="true" title="Bientôt" disabled>Apple</button>
              </div>
            </div>
          </div>
        </form>
        <div className="mt-4 min-h-[1.25rem] text-sm" aria-live="polite" role="status">
          {message && (
            <p className={message.type === 'error' ? 'text-[--color-danger]' : 'text-brand'}>{message.text}</p>
          )}
        </div>
        <hr className="my-6 border-border" />
        <div className="text-xs leading-relaxed text-muted-foreground">
          <h2 className="font-semibold mb-1 text-sm">Notes</h2>
          <ul className="list-disc pl-4 space-y-1">
            <li>Les boutons Google / Apple seront activés dans une prochaine étape.</li>
            <li>Après connexion réussie vous serez redirigé vers le tableau de bord.</li>
            <li>Mode &quot;Magic link&quot;: pas de mot de passe nécessaire.</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
