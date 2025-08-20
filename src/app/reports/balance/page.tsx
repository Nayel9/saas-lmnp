import { createSupabaseServerClient } from '@/lib/supabase/server';
import { assertAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { BalanceRow } from '@/lib/balance';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface RawRow { account_code: string; total_debit: unknown; total_credit: unknown; }
function parseNum(n: unknown): number { if (typeof n === 'number') return n; if (typeof n === 'string') { const v = parseFloat(n); return isNaN(v)?0:v; } if (n && typeof n === 'object' && 'toString' in n) { const v = parseFloat((n as { toString(): string }).toString()); return isNaN(v)?0:v; } return 0; }

async function fetchAggregated(userId: string, params: { from?: string|null; to?: string|null; account_code?: string|null; q?: string|null }): Promise<BalanceRow[]> {
  const { from, to, account_code, q } = params;
  const whereParts = ['user_id = $1'];
  const values: SQLValue[] = [userId];
  let idx = 2;
  if (from) { whereParts.push(`date >= $${idx++}`); values.push(new Date(from)); }
  if (to) { whereParts.push(`date <= $${idx++}`); values.push(new Date(to)); }
  if (account_code) { whereParts.push(`account_code ILIKE $${idx++}`); values.push('%'+account_code+'%'); }
  if (q) { whereParts.push(`(designation ILIKE $${idx} OR tier ILIKE $${idx} OR account_code ILIKE $${idx})`); values.push('%'+q+'%'); idx++; }
  const sql = `SELECT account_code, 
    SUM(CASE WHEN type='achat' THEN amount ELSE 0 END) AS total_debit,
    SUM(CASE WHEN type='vente' THEN amount ELSE 0 END) AS total_credit
    FROM journal_entries
    WHERE ${whereParts.join(' AND ')}
    GROUP BY account_code
    ORDER BY account_code`;
  const rows = await prisma.$queryRawUnsafe<RawRow[]>(sql, ...values);
  return rows.map(r => ({ account_code: r.account_code, total_debit: parseNum(r.total_debit), total_credit: parseNum(r.total_credit), balance: parseNum(r.total_debit) - parseNum(r.total_credit) }));
}

export default async function BalanceReportPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const sp = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <div className="p-8">Non authentifié</div>;
  try { assertAdmin(user); } catch { return <div className="p-8">Accès administrateur requis</div>; }

  const from = sp.from as string | undefined; const to = sp.to as string | undefined; const account_code = sp.account_code as string | undefined; const q = sp.q as string | undefined;
  const rows = await fetchAggregated(user.id, { from, to, account_code, q });
  const total_debit = rows.reduce((a,r)=>a+r.total_debit,0);
  const total_credit = rows.reduce((a,r)=>a+r.total_credit,0);
  const total_balance = total_debit - total_credit;
  const hasActiveFilter = !!(from||to||account_code||q);

  return <main className="p-6 max-w-5xl mx-auto space-y-6">
    <header className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Balance</h1>
        <p className="text-sm text-muted-foreground">{rows.length} comptes agrégés</p>
      </div>
      <div className="flex gap-2">
        <a className="btn text-xs" href={`/api/reports/balance/export?format=csv${from?`&from=${from}`:''}${to?`&to=${to}`:''}${account_code?`&account_code=${account_code}`:''}${q?`&q=${q}`:''}`}>Export CSV</a>
        <a className="btn text-xs" href={`/api/reports/balance/export?format=pdf${from?`&from=${from}`:''}${to?`&to=${to}`:''}${account_code?`&account_code=${account_code}`:''}${q?`&q=${q}`:''}`}>Export PDF</a>
      </div>
    </header>

    <section className="card p-4 space-y-4 text-sm">
      <form className="grid md:grid-cols-6 gap-3" method="get">
        <input type="date" name="from" defaultValue={from||''} className="input" />
        <input type="date" name="to" defaultValue={to||''} className="input" />
        <input name="account_code" placeholder="Compte" defaultValue={account_code||''} className="input" />
        <input name="q" placeholder="Recherche texte" defaultValue={q||''} className="input md:col-span-2" />
        <div className="flex items-center gap-2 md:col-span-1">
          <button className="btn-primary">Filtrer</button>
          {hasActiveFilter && <a href="/reports/balance" className="text-xs underline">Reset</a>}
        </div>
        <div className="md:col-span-6 flex flex-wrap gap-4 mt-2 text-xs text-muted-foreground">
          {from && <span>Période: {from} → {to || '…'}</span>}
          {hasActiveFilter && <span className="badge">Filtre actif</span>}
          <span>Totaux: Débit {total_debit.toFixed(2)} · Crédit {total_credit.toFixed(2)} · Solde {total_balance.toFixed(2)}</span>
        </div>
      </form>
    </section>

    <div className="card p-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2 pr-4">Compte</th>
            <th className="py-2 pr-4 text-right">Total Débit</th>
            <th className="py-2 pr-4 text-right">Total Crédit</th>
            <th className="py-2 pr-4 text-right">Solde</th>
            <th className="py-2 pr-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map(r => <tr key={r.account_code} className="border-b last:border-none hover:bg-bg-muted">
            <td className="py-1 pr-4 font-medium">{r.account_code}</td>
            <td className="py-1 pr-4 text-right tabular-nums">{r.total_debit.toFixed(2)}</td>
            <td className="py-1 pr-4 text-right tabular-nums">{r.total_credit.toFixed(2)}</td>
            <td className="py-1 pr-4 text-right tabular-nums">{r.balance.toFixed(2)}</td>
            <td className="py-1 pr-2 text-right text-xs"><Link href={`/reports/ledger?account_code=${encodeURIComponent(r.account_code)}${from?`&from=${from}`:''}${to?`&to=${to}`:''}`} className="underline">Grand livre</Link></td>
          </tr>)}
          {!rows.length && <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Aucun compte</td></tr>}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td className="py-2 pr-4">Totaux</td>
            <td className="py-2 pr-4 text-right">{total_debit.toFixed(2)}</td>
            <td className="py-2 pr-4 text-right">{total_credit.toFixed(2)}</td>
            <td className="py-2 pr-4 text-right">{total_balance.toFixed(2)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  </main>;
}

type SQLValue = string | number | Date;
