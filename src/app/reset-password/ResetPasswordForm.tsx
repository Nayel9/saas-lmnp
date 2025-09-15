"use client";
import React, { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { PasswordStrengthMeter } from "@/components/ui/forms/password-strength-meter";
import { toast } from "sonner";

export default function ResetPasswordForm() {
  const router = useRouter();

  // Ne pas lire le token côté client. Le token doit être transmis automatiquement
  // via un cookie sécurisé (resetToken) ou via l'en-tête Authorization (Bearer ...)
  // (voir /api/auth/reset-password pour la résolution côté serveur).

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (loading) return;
      if (password !== confirm) {
        toast.error("Les mots de passe ne correspondent pas");
        return;
      }
      // On envoie uniquement le mot de passe. Le token sera lu côté serveur
      // (cookie resetToken ou Authorization header). Assurer l'envoi des cookies.

      setLoading(true);
      try {
        const r = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
          credentials: "same-origin",
        });
        const data = await r.json().catch(() => ({}));
        if (r.ok && data.success) {
          toast.success("Mot de passe réinitialisé");
          setDone(true);
          // Redirection immédiate après succès (plus simple pour l'utilisateur).
          router.push("/login?reset=1");
        } else {
          toast.error(data.error || "Échec de la réinitialisation");
        }
      } catch (err) {
        console.debug("reset-password error", err);
        toast.error("Erreur réseau");
      } finally {
        setLoading(false);
      }
    },
    [password, confirm, loading, router]
  );

  if (done) {
    return (
      <div className="rounded border p-4 bg-card text-sm text-muted-foreground">
        Mot de passe réinitialisé. Redirection…
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium">Nouveau mot de passe</label>
        <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        <PasswordStrengthMeter password={password} className="mt-2" />
        <p className="text-xs text-muted-foreground mt-1">Règles: minimum 8 caractères. Pour plus de sécurité, utilisez majuscules, minuscules, chiffres et caractères spéciaux.</p>
      </div>
      <div className="space-y-1">
        <label htmlFor="confirm" className="text-sm font-medium">Confirmation</label>
        <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} />
      </div>
      <Button type="submit" className="w-full btn-primary" disabled={loading || password.length < 8 || password !== confirm}>
        {loading ? "Réinitialisation…" : "Réinitialiser"}
      </Button>
    </form>
  );
}
