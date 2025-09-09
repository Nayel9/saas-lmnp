import { auth } from '@/lib/auth/core';
import { prisma } from '@/lib/prisma';
import IncomeStatementClient from './ui-client';
import BalanceClient from './balance-client';

export const dynamic = 'force-dynamic';

export default async function SynthesisPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await auth();
  const user = session?.user;
  if (!user) return <div className="p-8">Non authentifié</div>;
  // Coerce search params vers un type plus précis pour TS
  const spRaw = await (searchParams || Promise.resolve({}));
  const sp = spRaw as Record<string, string | undefined>;
  const tab = (sp.tab as string | undefined) ?? 'result';
  const spProp = sp.property ?? undefined;
  const spYear = sp.year ?? undefined;
  const properties = await prisma.property.findMany({ where: { user_id: user.id }, orderBy: { createdAt: 'asc' } });
  const year = new Date().getFullYear();
  const makeHref = (t: 'result'|'balance') => {
    const params = new URLSearchParams();
    if (spProp) params.set('property', spProp);
    if (spYear) params.set('year', spYear);
    params.set('tab', t);
    return `/synthesis?${params.toString()}`;
  };
  return (
    <main className="p-6 max-w-3xl mx-auto space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Synthèse</h1>
        <nav className="flex gap-2" aria-label="Onglets synthèse">
          <a href={makeHref('result')} className={`px-3 py-1.5 rounded-md text-sm ${tab==='result'?'bg-bg-muted text-brand':'hover:bg-bg-muted'}`}>Résultat (simple)</a>
          <a href={makeHref('balance')} className={`px-3 py-1.5 rounded-md text-sm ${tab==='balance'?'bg-bg-muted text-brand':'hover:bg-bg-muted'}`}>Bilan (simple)</a>
        </nav>
      </header>
      {tab === 'balance' ? (
        <BalanceClient properties={properties.map(p => ({ id: p.id, label: p.label }))} defaultYear={year} />
      ) : (
        <IncomeStatementClient properties={properties.map(p => ({ id: p.id, label: p.label }))} defaultYear={year} />)
      }
    </main>
  );
}
