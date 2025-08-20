import { auth } from '@/lib/auth/core';
import { prisma } from '@/lib/prisma';
import { formatAmount, formatDateISO } from '@/lib/format';
import Link from 'next/link';
import { deleteEntry } from './actions';
import JournalVentesClient, { EditButton } from './ui-client';
import type { Prisma } from '@prisma/client';
import { computeVisibleTotals } from '@/lib/journal-totals';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

export default async function JournalVentesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const session = await auth();
  const user = session?.user;
  if (!user) return <div className="p-8">Non authentifié</div>;

  const page = Math.max(1, parseInt((sp.page as string) || '1', 10));
  const where: Prisma.JournalEntryWhereInput = { user_id: user.id, type: 'vente' };
  if (sp.from || sp.to) where.date = {};
  if (sp.from) (where.date as Prisma.DateTimeFilter).gte = new Date(sp.from as string);
  if (sp.to) (where.date as Prisma.DateTimeFilter).lte = new Date(sp.to as string);
  if (sp.tier) where.tier = { contains: sp.tier as string, mode: 'insensitive' };
  if (sp.q) {
    where.OR = [
      { designation: { contains: sp.q as string, mode: 'insensitive' } },
      { tier: { contains: sp.q as string, mode: 'insensitive' } },
      { account_code: { contains: sp.q as string, mode: 'insensitive' } },
    ];
  }
  if (sp.account_code) where.account_code = { contains: sp.account_code as string, mode: 'insensitive' };

  const [total, entries, tierSuggestions, accountSuggestions] = await Promise.all([
    prisma.journalEntry.count({ where }),
    prisma.journalEntry.findMany({ where, orderBy: { date: 'desc' }, skip: (page-1)*PAGE_SIZE, take: PAGE_SIZE }),
    prisma.journalEntry.findMany({ where: { user_id: user.id, type: 'vente', tier: { not: null } }, distinct: ['tier'], select: { tier: true }, take: 20 }),
    prisma.journalEntry.findMany({ where: { user_id: user.id, type: 'vente' }, distinct: ['account_code'], select: { account_code: true }, take: 20 }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const totals = computeVisibleTotals(entries.map(e => ({ amount: Number(e.amount) })));
  const hasActiveFilter = !!(sp.from || sp.to || sp.q || sp.tier || sp.account_code);

  async function deleteEntryFormAction(formData: FormData) {
    'use server';
    const id = formData.get('id')?.toString() || '';
    if (id) await deleteEntry(id);
  }

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Journal Ventes</h1>
          <p className="text-sm text-muted-foreground">{total} écritures</p>
        </div>
        <JournalVentesClient />
      </header>

      <section className="card p-4 space-y-4">
        <form className="grid md:grid-cols-6 gap-3 text-sm" method="get">
          <input type="date" name="from" aria-label="Date début" defaultValue={(sp.from as string)||''} className="input" placeholder="De" />
          <input type="date" name="to" aria-label="Date fin" defaultValue={(sp.to as string)||''} className="input" placeholder="À" />
          <input name="tier" list="tiers-ventes" aria-label="Client" defaultValue={(sp.tier as string)||''} className="input" placeholder="Client" />
          <datalist id="tiers-ventes">{tierSuggestions.filter(t=>t.tier).map(t=> <option key={t.tier}>{t.tier}</option>)}</datalist>
          <input name="account_code" list="accounts-ventes" aria-label="Compte comptable" defaultValue={(sp.account_code as string)||''} className="input" placeholder="Compte" />
          <datalist id="accounts-ventes">{accountSuggestions.map(a=> <option key={a.account_code}>{a.account_code}</option>)}</datalist>
          <input name="q" aria-label="Recherche texte" defaultValue={(sp.q as string)||''} className="input md:col-span-2" placeholder="Recherche texte" />
          <div className="flex items-center gap-2 md:col-span-2">
            <button className="btn-primary">Filtrer</button>
            {hasActiveFilter && <a href="/journal/ventes" className="text-xs underline">Réinitialiser</a>}
          </div>
          <div className="md:col-span-2 flex items-center gap-2 text-xs text-muted-foreground">
            {sp.from && <span>Période: {sp.from} → {sp.to || '…'}</span>}
            {hasActiveFilter && <span className="badge">Filtre actif</span>}
          </div>
        </form>
        <div className="flex flex-wrap gap-4 text-sm">
          <span><strong>{totals.count}</strong> lignes visibles</span>
          <span>Total: <strong>{formatAmount(totals.sum)}</strong></span>
          <a className="btn text-xs" href={`/api/journal/ventes/export?format=pdf${sp.from?`&from=${sp.from}`:''}${sp.to?`&to=${sp.to}`:''}${sp.tier?`&tier=${sp.tier}`:''}${sp.account_code?`&account_code=${sp.account_code}`:''}${sp.q?`&q=${sp.q}`:''}`}>Export PDF</a>
        </div>
      </section>

      <div className="card p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-4">Désignation</th>
              <th className="py-2 pr-4">Client</th>
              <th className="py-2 pr-4">Compte</th>
              <th className="py-2 pr-4 text-right">Montant</th>
              <th className="py-2 pr-2" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {entries.map(e => (
              <tr key={e.id} className="border-b last:border-none hover:bg-bg-muted">
                <td className="py-1 pr-4 whitespace-nowrap">{formatDateISO(e.date)}</td>
                <td className="py-1 pr-4">{e.designation}</td>
                <td className="py-1 pr-4">{e.tier}</td>
                <td className="py-1 pr-4">{e.account_code}</td>
                <td className="py-1 pr-4 text-right tabular-nums">{formatAmount(Number(e.amount))}</td>
                <td className="py-1 pr-2 text-right">
                  <EditButton entry={{ id: e.id, date: e.date, designation: e.designation, tier: e.tier, account_code: e.account_code, amount: Number(e.amount) }} />
                  <form action={deleteEntryFormAction} className="inline-block ml-1">
                    <input type="hidden" name="id" value={e.id} />
                    <button className="text-xs text-[--color-danger] hover:underline">Suppr</button>
                  </form>
                </td>
              </tr>
            ))}
            {!entries.length && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Aucune écriture</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <div>Page {page} / {pages}</div>
        <div className="flex gap-2">
          {page > 1 && <Link className="btn" href={`?page=${page-1}`}>Précédent</Link>}
          {page < pages && <Link className="btn" href={`?page=${page+1}`}>Suivant</Link>}
        </div>
        <div className="flex gap-2">
          <Link className="btn" href="/api/journal/ventes/export?format=csv">Export CSV</Link>
          <Link className="btn" href="/api/journal/ventes/export?format=xlsx">Export XLSX</Link>
        </div>
      </div>
    </main>
  );
}
