import { auth } from "@/lib/auth/core";
import { prisma } from "@/lib/prisma";
import VatToggleClient from "@/components/settings/VatToggleClient";
import PropertyVatBadge from "@/components/settings/PropertyVatBadge";


export const dynamic = "force-dynamic";

export default async function AccountingSettingsPage() {
  const session = await auth();
  const user = session?.user;
  if (!user) return <div className="p-6">Non authentifié</div>;

  const properties = await prisma.$queryRawUnsafe<
    Array<{ id: string; label: string; vatEnabled: boolean }>
  >(
    `SELECT "id", "label", COALESCE("vatEnabled", false) AS "vatEnabled" FROM "Property" WHERE "user_id" = $1 ORDER BY "label" ASC`,
    user.id,
  );

  return (
    <main className="p-6 max-w-3xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Paramètres comptables</h1>
        <p className="text-sm text-muted-foreground">
          TVA désactivée par défaut (LMNP).
        </p>
      </header>
      <section className="card p-4 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-medium">TVA par bien</h2>
            <p className="text-sm text-muted-foreground">
              ℹ️ LMNP : la TVA est généralement non applicable. Activez uniquement
              si votre activité le nécessite.
            </p>
          </div>
        </div>

        <div className="grid gap-3">
          {properties.length > 0 ? (
            properties.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-4 rounded-md border p-3 hover:shadow-sm"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="font-medium truncate">{p.label}</div>
                    <PropertyVatBadge propertyId={p.id} initial={p.vatEnabled} />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Gère l’affichage des champs HT/TVA dans les journaux pour ce
                    bien.
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <VatToggleClient propertyId={p.id} initial={p.vatEnabled} />
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-muted-foreground">Aucun bien</div>
          )}
        </div>
      </section>
    </main>
  );
}
