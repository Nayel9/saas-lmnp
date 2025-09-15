"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    grecaptcha?: { execute(siteKey: string, opts: { action: string }): Promise<string> };
  }
}

const DEFAULT_COOLDOWN_SECONDS = parseInt(process.env.NEXT_PUBLIC_FORGOT_PASSWORD_COOLDOWN_SECONDS || "600", 10); // 10 min
const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cooldownExpires, setCooldownExpires] = useState<number | null>(null);
  const [remainingLabel, setRemainingLabel] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  // Pas d'état de debug reCAPTCHA en prod/dev — le token est obtenu silencieusement

  function getStorageKey(e: string) {
    return `forgot_cooldown:${e.trim().toLowerCase()}`;
  }

  const tickRemaining = useCallback((expireTs: number) => {
    const diff = Math.max(0, Math.floor((expireTs - Date.now()) / 1000));
    if (diff <= 0) {
      setCooldownExpires(null);
      setRemainingLabel(null);
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      try { localStorage.removeItem(getStorageKey(email)); } catch { /* ignore */ }
    } else {
      const m = Math.floor(diff / 60);
      const s = diff % 60;
      setRemainingLabel(m > 0 ? `${m}m ${s}s` : `${s}s`);
    }
  }, [email]);

  const updateCooldownForEmail = useCallback((e: string) => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (!e) {
      setCooldownExpires(null);
      setRemainingLabel(null);
      return;
    }
    try {
      const raw = localStorage.getItem(getStorageKey(e));
      const ts = raw ? parseInt(raw, 10) : null;
      if (ts && ts > Date.now()) {
        setCooldownExpires(ts);
        tickRemaining(ts);
        timerRef.current = window.setInterval(() => tickRemaining(ts), 1000);
      } else {
        setCooldownExpires(null);
        setRemainingLabel(null);
        if (raw) localStorage.removeItem(getStorageKey(e));
      }
    } catch {
      setCooldownExpires(null);
      setRemainingLabel(null);
    }
  }, [tickRemaining]);

  useEffect(() => {
    updateCooldownForEmail(email);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [email, updateCooldownForEmail]);

  async function loadRecaptcha(): Promise<boolean> {
    if (!RECAPTCHA_SITE_KEY) return false;
    if (typeof window === "undefined") return false;
    if (window.grecaptcha) {
      return true;
    }
    return new Promise((res) => {
      const s = document.createElement("script");
      s.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
      s.async = true;
      s.defer = true;
      s.onload = () => res(true);
      s.onerror = () => res(false);
      document.head.appendChild(s);
    });
  }

  async function getRecaptchaToken(action = 'forgot_password'): Promise<string | null> {
    if (!RECAPTCHA_SITE_KEY) return null;
    const ok = await loadRecaptcha();
    if (!ok) return null;
    try {
      // @ts-expect-error grecaptcha injecté dynamiquement par script externe
      return await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action });
    } catch {
      return null;
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (!email) return;
    // Si cooldown actif, bloquer
    if (cooldownExpires && cooldownExpires > Date.now()) return;

    setLoading(true);
    try {
      const recaptchaToken = await getRecaptchaToken();
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, recaptchaToken }),
      });
      // UX identique qu'avant: message neutre
      setSubmitted(true);
      // poser cooldown côté client
      const expireTs = Date.now() + DEFAULT_COOLDOWN_SECONDS * 1000;
      try {
        localStorage.setItem(getStorageKey(email), String(expireTs));
      } catch { /* ignore */ }
      updateCooldownForEmail(email);
    } catch {
      setSubmitted(true); // même réponse UX
    } finally {
      setLoading(false);
    }
  }

  const isCooling = Boolean(cooldownExpires && cooldownExpires > Date.now());

  if (submitted) {
    return (
      <div className="rounded border p-4 bg-card text-sm text-muted-foreground">
        Si un compte existe, un email de réinitialisation a été envoyé.
        {isCooling && remainingLabel && (
          <div className="mt-2 text-xs text-muted-foreground">Vous pourrez redemander dans {remainingLabel}.</div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <Input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vous@example.com"
        />
        {/* reCAPTCHA v3 silencieux : pas d'indicateur UI */}
        {isCooling && remainingLabel && (
          <p className="text-xs text-muted-foreground mt-1">Re-demande possible dans {remainingLabel}</p>
        )}
      </div>
      <Button type="submit" disabled={loading || !email || isCooling} className="w-full btn-primary">
        {loading ? "Envoi…" : isCooling ? `Attendez ${remainingLabel || "..."}` : "Envoyer le lien de réinitialisation"}
      </Button>
    </form>
  );
}
