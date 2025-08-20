import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth/core';
import { computeLinearAmortization } from '@/lib/asset-amortization';
import { formatAmount } from '@/lib/format';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AssetAmortizationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const user = session?.user;
  if (!user) return <div className="p-8">Non authentifié</div>;
  const asset = await prisma.asset.findFirst({ where: { id, user_id: user.id } });
  if (!asset) return <div className="p-8">Introuvable</div>;
  const schedule = computeLinearAmortization(Number(asset.amount_ht), asset.duration_years, new Date(asset.acquisition_date));
  return (
    <main className="p-6 max-w-4xl mx-auto space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Amortissement - {asset.label}</h1>
        <p className="text-sm text-muted-foreground">Montant HT: {formatAmount(Number(asset.amount_ht))} • Durée: {asset.duration_years} ans • Début: {asset.acquisition_date.toISOString().slice(0,10)}</p>
        <div className="flex gap-2 text-sm">
          <Link href="/assets" className="btn">Retour</Link>
          <Link href={`/api/assets/${asset.id}/amortization/export?format=csv`} className="btn">Export CSV</Link>
        </div>
      </header>
      <div className="card p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-4">Année</th>
              <th className="py-2 pr-4 text-right">Dotation</th>
              <th className="py-2 pr-4 text-right">Cumul</th>
            </tr>
          </thead>
          <tbody>
            {schedule.map(r => (
              <tr key={r.year} className="border-b last:border-none">
                <td className="py-1 pr-4">{r.year}</td>
                <td className="py-1 pr-4 text-right tabular-nums">{formatAmount(r.dotation)}</td>
                <td className="py-1 pr-4 text-right tabular-nums">{formatAmount(r.cumul)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
