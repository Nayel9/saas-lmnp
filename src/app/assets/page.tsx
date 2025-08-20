import { createSupabaseServerClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { formatAmount, formatDateISO } from '@/lib/format';
import Link from 'next/link';
import { AddAssetButton, EditAssetButton } from './ui-client';
import { deleteAsset } from './actions';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

export default async function AssetsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <div className="p-8">Non authentifié</div>;
  const page = Math.max(1, parseInt((sp.page as string) || '1', 10));
  const where: Prisma.AssetWhereInput = { user_id: user.id };
  if (sp.from || sp.to) where.acquisition_date = {};
  if (sp.from) (where.acquisition_date as Prisma.DateTimeFilter).gte = new Date(sp.from as string);
  if (sp.to) (where.acquisition_date as Prisma.DateTimeFilter).lte = new Date(sp.to as string);
  if (sp.q) where.OR = [
    { label: { contains: sp.q as string, mode: 'insensitive' } },
    { account_code: { contains: sp.q as string, mode: 'insensitive' } }
  ];
  const [total, rows] = await Promise.all([
    prisma.asset.count({ where }),
    prisma.asset.findMany({ where, orderBy: { acquisition_date: 'desc' }, skip: (page-1)*PAGE_SIZE, take: PAGE_SIZE })
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function deleteAction(formData: FormData) {
    'use server';
    const id = formData.get('id')?.toString();
    if (id) await deleteAsset(id);
  }

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Immobilisations</h1>
          <p className="text-sm text-muted-foreground">{total} éléments</p>
        </div>
        <AddAssetButton />
      </header>
      <div className="card p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-4">Libellé</th>
              <th className="py-2 pr-4">Montant HT</th>
              <th className="py-2 pr-4">Durée</th>
              <th className="py-2 pr-4">Compte</th>
              <th className="py-2 pr-4">Amort.</th>
              <th className="py-2 pr-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map(a => (
              <tr key={a.id} className="border-b last:border-none hover:bg-bg-muted">
                <td className="py-1 pr-4 whitespace-nowrap">{formatDateISO(a.acquisition_date)}</td>
                <td className="py-1 pr-4">{a.label}</td>
                <td className="py-1 pr-4 tabular-nums text-right">{formatAmount(Number(a.amount_ht))}</td>
                <td className="py-1 pr-4">{a.duration_years} ans</td>
                <td className="py-1 pr-4">{a.account_code}</td>
                <td className="py-1 pr-4"><Link href={`/assets/${a.id}/amortization`} className="text-brand text-xs hover:underline">Voir</Link></td>
                <td className="py-1 pr-2 text-right">
                  <EditAssetButton asset={{ id: a.id, label: a.label, amount_ht: Number(a.amount_ht), duration_years: a.duration_years, acquisition_date: a.acquisition_date, account_code: a.account_code }} />
                  <form action={deleteAction} className="inline-block ml-1">
                    <input type="hidden" name="id" value={a.id} />
                    <button className="text-xs text-[--color-danger] hover:underline">Suppr</button>
                  </form>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">Aucune immobilisation</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm">
        <div>Page {page} / {pages}</div>
        <div className="flex gap-2">
          {page > 1 && <Link className="btn" href={`?page=${page-1}`}>Précédent</Link>}
          {page < pages && <Link className="btn" href={`?page=${page+1}`}>Suivant</Link>}
        </div>
      </div>
    </main>
  );
}
