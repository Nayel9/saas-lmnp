import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/core";
import { getUserRole } from "@/lib/auth";
import Link from "next/link";
import { createProperty } from "./actions";
import { getDepositsSummary } from "@/lib/deposits";
import { prisma } from "@/lib/prisma";
import DashboardMonthlyClient from "./monthly-client";
import DashboardTodoClient from "./todo-client";
import DashboardHistoryClient from "./history-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  const user = session?.user;
  if (!user) redirect("/login");
  const role = getUserRole(user);

  const displayName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.email;

  const deposits = await getDepositsSummary({
    userId: user.id,
    to: new Date(),
  });

  const properties = await prisma.property.findMany({
    where: { user_id: user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, label: true },
  });

  return (
    <main className="min-h-screen p-8 space-y-8 max-w-5xl mx-auto">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Tableau de bord</h1>
        <p className="text-muted-foreground text-sm">
          Connecté en tant que <span className="font-medium">{displayName}</span>
        </p>
        {role === "admin" && (
          <p className="text-xs text-muted-foreground">
            <Link href="/admin" className="underline">
              Accès administration
            </Link>
          </p>
        )}
      </header>

      {/* Cartes clés (mois) */}
      <section className="card p-4 space-y-4">
        <h2 className="text-lg font-medium">Cartes clés (mois)</h2>
        <DashboardMonthlyClient properties={properties} />
      </section>

      {/* À faire */}
      <section>
        <DashboardTodoClient />
      </section>

      {/* Historique rapide */}
      <section>
        <DashboardHistoryClient />
      </section>

      {/* Banner profil incomplet (SSO uniquement) */}
      {user?.isSso && user?.needsProfile && (
        <div className="rounded-[var(--radius)] p-4 border border-border bg-blue-100 text-blue-800">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm">
              Votre profil est incomplet. Merci de renseigner votre prénom, nom et téléphone.
            </p>
            <a href="/onboarding/profile" className="btn-ghost whitespace-nowrap">
              Compléter maintenant
            </a>
          </div>
        </div>
      )}

      <section className="grid gap-6 md:grid-cols-2">
        <div className="card space-y-4">
          <h2 className="text-lg font-medium">Nouveau bien</h2>
          <form action={createProperty} className="space-y-3">
            <input name="label" placeholder="Nom du bien" className="input" autoComplete="off" />
            <input name="address" placeholder="Adresse (optionnel)" className="input" autoComplete="off" />
            <div className="pt-1">
              <button className="btn-primary w-full">Ajouter</button>
            </div>
          </form>
        </div>
        <div className="card">
          <h2 className="text-lg font-medium mb-2">Prochaines étapes</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
            <li>Ajouter revenus & dépenses</li>
            <li>Amortissements</li>
            <li>Exports fiscaux</li>
            <li>
              <span className="text-foreground font-medium">Cautions en cours</span>: {deposits.sum.toFixed(2)} EUR ({deposits.count})
            </li>
          </ul>
        </div>
      </section>
    </main>
  );
}
