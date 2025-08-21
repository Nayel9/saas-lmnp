"use client";
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Modal, Title, Text, Button, Loader, Alert, Group} from '@mantine/core';
import {useMantineTheme} from '@mantine/core';
import {notifications} from '@mantine/notifications';
import {useRouter} from 'next/navigation';

interface SignupVerifyModalProps {
  opened: boolean;
  onClose: () => void;
  email: string;
  enablePolling?: boolean; // pour désactiver dans certains tests
}

const RESEND_COOLDOWN_MS = 60_000;
const POLL_INTERVAL_MS = 5_000;
const POLL_MAX_DURATION_MS = 90_000;

export function SignupVerifyModal({opened, onClose, email, enablePolling = true}: SignupVerifyModalProps) {
  const theme = useMantineTheme();
  const router = useRouter();
  const [cooldownEnd, setCooldownEnd] = useState<number>(0);
  const [now, setNow] = useState<number>(Date.now());
  const [resendState, setResendState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const pollTimeoutRef = useRef<number | null>(null);
  const pollStartedRef = useRef<number | null>(null);

  // countdown rafraîchi chaque seconde
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

  // Reset état à l'ouverture
  useEffect(() => {
    if (opened) {
      setCooldownEnd(0); // pas de cooldown initial
      setResendState('idle');
      setMessage(null);
    }
  }, [opened]);

  // Polling vérification
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
            return; // stop
          }
        }
      } catch {/* ignore */}
      const elapsed = Date.now() - (pollStartedRef.current || 0);
      if (elapsed >= POLL_MAX_DURATION_MS) {
        setPolling(false); // stop polling
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

  return (
    <Modal opened={opened} onClose={onClose} title="Vérifiez vos emails"
           centered radius="md" shadow="xl" overlayProps={{opacity: 0.55, blur: 3}} data-testid="signup-verify-modal"
           aria-labelledby="signup-verify-title" aria-describedby="signup-verify-desc">
      <div id="signup-verify-desc" style={{display: 'grid', gap: theme.spacing.sm}}>
        <Text>Nous avons envoyé un lien de confirmation à <strong>{email}</strong>. Cliquez dessus pour activer votre compte.</Text>
        <Group gap="xs" align="center">
          <Loader color={theme.primaryColor} size="sm" aria-label="En attente de vérification" />
          <Text size="xs" c="dimmed">{polling ? 'En attente de la vérification…' : 'Vous pouvez renvoyer un email.'}</Text>
        </Group>
        <div>
          <Button data-testid="resend-btn" onClick={doResend} disabled={inCooldown || resendState==='loading'} size="sm" variant="filled">
            {resendState === 'loading' ? 'Envoi…' : inCooldown ? `Renvoyer (${secondsLeft}s)` : 'Renvoyer l\'email'}
          </Button>
        </div>
        <Text size="xs" c="dimmed">Pas reçu ? Regardez dans le dossier indésirables.</Text>
        <Button variant="subtle" size="xs" onClick={onClose} aria-label="Modifier l'adresse">Modifier l’adresse</Button>
        {message && (
          <Alert color={resendState === 'error' ? 'red' : 'blue'} title={resendState === 'error' ? 'Erreur' : 'Info'}
                 data-testid="resend-alert" radius="sm">
            {message}
          </Alert>
        )}
      </div>
    </Modal>
  );
}

export default SignupVerifyModal;
