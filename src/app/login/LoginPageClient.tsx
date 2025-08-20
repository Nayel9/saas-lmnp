"use client";
import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';

type Mode = 'login' | 'signup';
interface Message { type: 'success' | 'error'; text: string; }

export default function LoginPageClient() {
  const router = useRouter();
  const {status } = useSession();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  useEffect(() => { if (status === 'authenticated') router.replace('/dashboard'); }, [status, router]);

  const resetMessages = () => setMessage(null);

  const submit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      if (mode === 'signup') {
        const resp = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
        if (!resp.ok) {
          const txt = await resp.text();
            throw new Error(txt || 'Échec création');
        }
      }
      const res = await signIn('credentials', { email, password, redirect: false });
      if (res?.error) throw new Error('Identifiants invalides');
      setMessage({ type: 'success', text: 'Connexion réussie. Redirection…' });
      router.push('/dashboard');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erreur inattendue';
      setMessage({ type: 'error', text: errorMsg });
    } finally { setLoading(false); }
  }, [email, password, mode, router]);

  const isEmailValid = /.+@.+\..+/.test(email);
  const canSubmit = !loading && isEmailValid && password.length >= 8;

  if (status === 'loading') {
    return <main className="min-h-screen flex items-center justify-center"><p className="text-sm text-muted-foreground">Chargement…</p></main>;
  }

  return (
    <main id="main" className="min-h-screen flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-md card" role="region" aria-labelledby="auth-title">
        <h1 id="auth-title" className="text-xl font-semibold tracking-tight mb-2">Authentification</h1>
        <p className="text-sm text-muted-foreground mb-6">Accédez à votre espace.</p>
        <div className="flex items-center gap-2 mb-6" role="tablist" aria-label="Modes d'authentification">
          <button role="tab" aria-selected={mode==='login'} className={`btn text-sm px-3 py-1.5 ${mode==='login'? 'bg-bg-muted' : 'btn-ghost'}`} onClick={()=>{ setMode('login'); resetMessages(); }}>
            Se connecter
          </button>
          <button role="tab" aria-selected={mode==='signup'} className={`btn text-sm px-3 py-1.5 ${mode==='signup'? 'bg-bg-muted' : 'btn-ghost'}`} onClick={()=>{ setMode('signup'); resetMessages(); }}>
            Créer un compte
          </button>
        </div>
        <form onSubmit={submit} noValidate>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">Email</label>
              <input id="email" name="email" type="email" autoComplete="email" required className="input" placeholder="vous@exemple.fr" value={email} onChange={e=>setEmail(e.target.value)} />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1">Mot de passe</label>
              <input id="password" name="password" type="password" autoComplete={mode==='login'? 'current-password':'new-password'} required className="input" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} />
              <p className="mt-1 text-xs text-muted-foreground">8 caractères minimum.</p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <button type="submit" disabled={!canSubmit} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed" aria-disabled={!canSubmit}>
                {loading ? '…' : mode === 'login' ? 'Se connecter' : 'Créer le compte'}
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
            <li>Google / Apple seront activés plus tard.</li>
            <li>Après connexion réussie redirection tableau de bord.</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
