"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import React from "react";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const schema = z.object({
  firstName: z.string().min(1, "Requis").max(50),
  lastName: z.string().min(1, "Requis").max(60),
  phone: z
    .string()
    .trim()
    .min(5, "Requis")
    .max(30)
    .regex(/^[+0-9 ()-]*$/, "Format invalide"),
});

export default function OnboardingProfilePage() {
  const router = useRouter();
  const { data: session, status, update } = useSession();

  // ✅ Extraction pour des deps stables (évite le warning ESLint)
  const needsProfile = session?.user?.needsProfile;

  const [form, setForm] = React.useState({
    firstName: session?.user.firstName ?? "",
    lastName: session?.user.lastName ?? "",
    phone: session?.user.phone ?? "",
  });
  const [errors, setErrors] = React.useState<{ [k: string]: string | undefined }>({});
  const [loading, setLoading] = React.useState(false);

  // Si l'utilisateur est authentifié et que le profil est déjà complet → dashboard
  React.useEffect(() => {
    if (session?.user && !needsProfile) {
      router.replace("/dashboard");
    }
  }, [needsProfile, router, session?.user]);

  // Sync du formulaire quand la session arrive/évolue (ex: SSO prérempli)
  React.useEffect(() => {
    if (session?.user) {
      setForm({
        firstName: session.user.firstName ?? "",
        lastName: session.user.lastName ?? "",
        phone: session.user.phone ?? "",
      });
    }
  }, [session?.user?.firstName, session?.user?.lastName, session?.user?.phone]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const fe = parsed.error.flatten().fieldErrors;
      setErrors({
        firstName: fe.firstName?.[0],
        lastName: fe.lastName?.[0],
        phone: fe.phone?.[0],
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);

      // Force la resync NextAuth (callbacks jwt/session vont recalculer needsProfile)
      await update();

      toast("Profil mis à jour ✅");
      router.replace("/dashboard");
    } catch {
      toast("Impossible d’enregistrer.");
    } finally {
      setLoading(false);
    }
  }

  // Petit état de chargement quand NextAuth prépare la session
  if (status === "loading") {
    return (
      <main className="min-h-screen grid place-items-center">
        <div className="flex flex-col items-center gap-3">
          <div className="spinner" aria-label="chargement" />
          <p className="text-sm text-muted-foreground">Chargement…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md card space-y-4">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold">Complétez votre profil</h1>
          <p className="text-sm text-muted-foreground">
            Un dernier petit formulaire pour accéder au tableau de bord.
          </p>
        </header>

        <form onSubmit={submit} className="space-y-3" noValidate>
          <div className="space-y-1">
            <Label htmlFor="firstName">Prénom</Label>
            <Input
              id="firstName"
              value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              className={errors.firstName ? "!border-red-500" : ""}
              autoComplete="given-name"
            />
            {errors.firstName && <p className="text-[11px] text-red-600">{errors.firstName}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="lastName">Nom</Label>
            <Input
              id="lastName"
              value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              className={errors.lastName ? "!border-red-500" : ""}
              autoComplete="family-name"
            />
            {errors.lastName && <p className="text-[11px] text-red-600">{errors.lastName}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="phone">Téléphone</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className={errors.phone ? "!border-red-500" : ""}
              placeholder="+33 ..."
              autoComplete="tel"
            />
            {errors.phone && <p className="text-[11px] text-red-600">{errors.phone}</p>}
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Enregistrement…" : "Enregistrer et continuer"}
          </button>
        </form>
      </div>
    </main>
  );
}

