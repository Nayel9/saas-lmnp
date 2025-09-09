import { auth } from '@/lib/auth/core';
import { prisma } from '@/lib/prisma';
import IncomeStatementClient from './ui-client';

export const dynamic = 'force-dynamic';

export default async function SynthesisPage() {
  const session = await auth();
  const user = session?.user;
  if (!user) return <div className="p-8">Non authentifié</div>;
  const properties = await prisma.property.findMany({ where: { user_id: user.id }, orderBy: { createdAt: 'asc' } });
  const year = new Date().getFullYear();
  return (
    <main className="p-6 max-w-3xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Synthèse</h1>
        <p className="text-sm text-muted-foreground">Compte de résultat simple par bien et par année.</p>
      </header>
      <IncomeStatementClient properties={properties.map(p => ({ id: p.id, label: p.label }))} defaultYear={year} />
    </main>
  );
}

