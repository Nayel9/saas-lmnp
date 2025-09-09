import { auth } from "@/lib/auth/core";
import { prisma } from "@/lib/prisma";
import ExportAttachmentsClient from "./ui-client";

export const dynamic = "force-dynamic";

export default async function ExportsPage() {
  const session = await auth();
  const user = session?.user;
  if (!user) return <div className="p-8">Non authentifié</div>;

  const properties = await prisma.property.findMany({
    where: { user_id: user.id },
    orderBy: { createdAt: "asc" },
  });

  return (
    <main className="p-6 max-w-3xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Exports</h1>
        <p className="text-sm text-muted-foreground">
          Téléchargez un ZIP des pièces jointes par période et par bien.
        </p>
      </header>
      <section className="card p-4">
        <ExportAttachmentsClient
          properties={properties.map((p) => ({ id: p.id, label: p.label }))}
        />
      </section>
    </main>
  );
}
