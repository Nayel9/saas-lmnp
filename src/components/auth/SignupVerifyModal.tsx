import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Text, Loader, Alert} from '@mantine/core';
import {notifications} from '@mantine/notifications';
import {useRouter} from 'next/navigation';
import { X } from 'lucide-react';

interface SignupVerifyModalProps {
  opened: boolean;
  onClose: () => void;
  email: string;
  enablePolling?: boolean;
}

const RESEND_COOLDOWN_MS = 60_000;
const POLL_INTERVAL_MS = 5_000;
const POLL_MAX_DURATION_MS = 90_000;

export function SignupVerifyModal({opened, onClose, email, enablePolling = true}: SignupVerifyModalProps) {
  const router = useRouter();
  const [cooldownEnd, setCooldownEnd] = useState<number>(0);
  const [animate, setAnimate] = useState(false);
  const [now, setNow] = useState<number>(Date.now());
  const [resendState, setResendState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const pollTimeoutRef = useRef<number | null>(null);
  const pollStartedRef = useRef<number | null>(null);

  useEffect(() => {
    if (!opened) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [opened]);

  const secondsLeft = Math.max(0, Math.ceil((cooldownEnd - now) / 1000));
  const inCooldown = secondsLeft > 0;

  const doResend = useCallback(async () => {
    if (inCooldown || resendState === 'loading') return;
    setResendState('loading');
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email})
      });
      if (res.ok) {
        setCooldownEnd(Date.now() + RESEND_COOLDOWN_MS);
        setResendState('success');
        setMessage('Si un compte existe, un email a été renvoyé.');
      } else {
        setResendState('error');
        setMessage('Une erreur est survenue. Réessayez plus tard.');
      }
    } catch {
      setResendState('error');
      setMessage('Une erreur est survenue. Réessayez plus tard.');
    }
  }, [email, inCooldown, resendState]);

  useEffect(() => {
    if (opened) {
      setCooldownEnd(0);
      setResendState('idle');
      setMessage(null);
    }
  }, [opened]);

  useEffect(() => {
    if (!opened || !enablePolling) return;
    setPolling(true);
    pollStartedRef.current = Date.now();
    let cancelled = false;

    async function poll() {
      if (cancelled) return;
      try {
        const r = await fetch(`/api/auth/check-verified?email=${encodeURIComponent(email)}`, {cache: 'no-store'});
        if (r.ok) {
          const data = await r.json();
          if (data.verified) {
            notifications.show({title: 'Email vérifié', message: 'Email vérifié !', color: 'green'});
            onClose();
            router.push('/login?verified=1');
            return;
          }
        }
      } catch {/* ignore */}
      const elapsed = Date.now() - (pollStartedRef.current || 0);
      if (elapsed >= POLL_MAX_DURATION_MS) {
        setPolling(false);
        return;
      }
      pollTimeoutRef.current = window.setTimeout(poll, POLL_INTERVAL_MS);
    }

    pollTimeoutRef.current = window.setTimeout(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (pollTimeoutRef.current) window.clearTimeout(pollTimeoutRef.current);
    };
  }, [opened, email, enablePolling, onClose, router]);

  useEffect(() => { if(opened) console.log('[SignupVerifyModal] opened for', email); }, [opened, email]);

  useEffect(() => {
    if (opened) {
      requestAnimationFrame(() => setAnimate(true));
    } else {
      setAnimate(false);
    }
  }, [opened]);

  useEffect(() => {
    if (!opened) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [opened, onClose]);

  return (
    <>
      {opened && (
        <div data-testid="signup-verify-modal" role="dialog" aria-modal="true" aria-labelledby="signup-verify-title" aria-describedby="signup-verify-desc"
             onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
             className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 transition-opacity duration-300 ease-out ${animate ? 'opacity-100' : 'opacity-0'}`}>
          <div className={`bg-bg rounded-md shadow-xl w-full max-w-md p-6 flex flex-col gap-3 relative transform transition-all duration-300 ease-out will-change-transform will-change-opacity ${animate ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
               onMouseDown={(e) => e.stopPropagation()}>
            <button type="button" onClick={onClose} aria-label="Fermer la fenêtre" data-testid="close-btn"
                    className="absolute h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-bg-muted focus:outline-none focus:ring focus:ring-ring transition"
                    style={{top: 8, right: 8}}>
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <h2 id="signup-verify-title" className="text-lg font-semibold pr-8">Vérifiez vos emails</h2>
            <div id="signup-verify-desc" className="text-sm flex flex-col gap-2">
              <Text size="sm">Nous avons envoyé un lien de confirmation à <strong>{email}</strong>. Cliquez dessus pour activer votre compte.</Text>
              <div className="flex items-center gap-2 text-xs">
                <Loader size="sm" aria-label="En attente de vérification" />
                <Text size="xs" c="dimmed">{polling ? 'En attente de la vérification…' : 'Vous pouvez renvoyer un email.'}</Text>
              </div>
              <div className="flex flex-wrap gap-2 mt-1">
                <button data-testid="resend-btn" type="button" onClick={doResend} disabled={inCooldown || resendState==='loading'}
                        className={`btn-primary h-8 px-3 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed ${inCooldown ? 'relative' : ''}`}
                        aria-disabled={inCooldown || resendState==='loading'}>
                  {resendState === 'loading' ? 'Envoi…' : inCooldown ? `Renvoyer (${secondsLeft}s)` : "Renvoyer l'email"}
                </button>
                <button data-testid="home-btn" type="button" onClick={() => router.push('/')} className="btn-ghost h-8 px-3 text-xs">
                  Accueil
                </button>
              </div>
              <Text size="xs" c="dimmed">Pas reçu ? Vérifiez les indésirables.</Text>
              {message && (
                <Alert color={resendState === 'error' ? 'red' : 'blue'} title={resendState === 'error' ? 'Erreur' : 'Info'} data-testid="resend-alert" radius="sm" mt="xs">
                  {message}
                </Alert>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default SignupVerifyModal;