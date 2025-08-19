import { createSupabaseServerClient } from '@/lib/supabase/server';
import { assertAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

type SQLValue = string | number | Date;
interface RawRow { id: string; date: Date; designation: string; tier: string | null; type: 'achat' | 'vente'; amount: unknown; }
function parseNum(n: unknown): number { if (typeof n === 'number') return n; if (typeof n === 'string') { const v = parseFloat(n); return isNaN(v)?0:v; } if (n && typeof n === 'object' && 'toString' in n) { const v = parseFloat((n as { toString(): string }).toString()); return isNaN(v)?0:v; } return 0; }

async function fetchLedger(userId: string, account_code: string, params: { from?: string|null; to?: string|null; q?: string|null }) {
  const { from, to, q } = params;
  const whereParts = ['user_id = $1', 'account_code = $2'];
  const values: SQLValue[] = [userId, account_code];
  let idx = 3;
  if (from) { whereParts.push(`date >= $${idx++}`); values.push(new Date(from)); }
  if (to) { whereParts.push(`date <= $${idx++}`); values.push(new Date(to)); }
  if (q) { whereParts.push(`(designation ILIKE $${idx} OR tier ILIKE $${idx})`); values.push('%'+q+'%'); idx++; }
  const sql = `SELECT id, date, designation, tier, type, amount FROM journal_entries WHERE ${whereParts.join(' AND ')} ORDER BY date, created_at, id`;
  const rows = await prisma.$queryRawUnsafe<RawRow[]>(sql, ...values);
  return rows.map(r => ({
    id: r.id,
    date: r.date.toISOString(),
    designation: r.designation,
    tier: r.tier ?? '',
    debit: r.type === 'achat' ? parseNum(r.amount) : 0,
    credit: r.type === 'vente' ? parseNum(r.amount) : 0,
  }));
}

export default async function LedgerPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <div className="p-8">Non authentifié</div>;
  try { assertAdmin(user); } catch { return <div className="p-8">Accès administrateur requis</div>; }
  const sp = await searchParams;
  const account_code = sp.account_code as string | undefined;
  const from = sp.from as string | undefined;
  const to = sp.to as string | undefined;
  const q = sp.q as string | undefined;
  if (!account_code) return <div className="p-8 space-y-4"><h1 className="text-xl font-semibold">Grand livre</h1><p className="text-sm text-muted-foreground">Paramètre account_code requis. Retour à la <Link href="/reports/balance" className="underline">Balance</Link>.</p></div>;

  const rows = await fetchLedger(user.id, account_code, { from, to, q });
  let running = 0;
  const enriched = rows.map(r => { running += r.debit - r.credit; return { ...r, balance: running }; });
  const totalDebit = enriched.reduce((a,r)=>a+r.debit,0);
  const totalCredit = enriched.reduce((a,r)=>a+r.credit,0);

  const hasFilter = !!(from||to||q);

  return <main className="p-6 max-w-6xl mx-auto space-y-6">
    <header className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight">Grand livre – {account_code}</h1>
      <p className="text-sm text-muted-foreground">{enriched.length} écritures • Débit {totalDebit.toFixed(2)} • Crédit {totalCredit.toFixed(2)} • Solde {(totalDebit-totalCredit).toFixed(2)}</p>
      <p className="text-xs text-muted-foreground"><Link href="/reports/balance" className="underline">Retour Balance</Link></p>
    </header>
    <section className="card p-4 space-y-4 text-sm">
      <form className="grid md:grid-cols-6 gap-3" method="get">
        <input type="hidden" name="account_code" value={account_code} />
        <input type="date" name="from" defaultValue={from||''} className="input" />
        <input type="date" name="to" defaultValue={to||''} className="input" />
        <input name="q" placeholder="Recherche texte" defaultValue={q||''} className="input md:col-span-2" />
        <div className="flex items-center gap-2 md:col-span-1">
          <button className="btn-primary">Filtrer</button>
          {hasFilter && <a href={`/reports/ledger?account_code=${encodeURIComponent(account_code)}`} className="text-xs underline">Reset</a>}
        </div>
        <div className="md:col-span-6 flex flex-wrap gap-4 mt-2 text-xs text-muted-foreground">
          {from && <span>Période: {from} → {to||'…'}</span>}
          {hasFilter && <span className="px-2 py-0.5 bg-gray-200 rounded">Filtre actif</span>}
        </div>
      </form>
      <div className="flex gap-2">
        <a className="btn text-xs" href={`/api/reports/ledger/export?format=csv&account_code=${encodeURIComponent(account_code)}${from?`&from=${from}`:''}${to?`&to=${to}`:''}${q?`&q=${q}`:''}`}>Export CSV</a>
        <a className="btn text-xs" href={`/api/reports/ledger/export?format=pdf&account_code=${encodeURIComponent(account_code)}${from?`&from=${from}`:''}${to?`&to=${to}`:''}${q?`&q=${q}`:''}`}>Export PDF</a>
      </div>
    </section>
    <div className="card p-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2 pr-4">Date</th>
            <th className="py-2 pr-4">Tier</th>
            <th className="py-2 pr-4">Désignation</th>
            <th className="py-2 pr-4 text-right">Débit</th>
            <th className="py-2 pr-4 text-right">Crédit</th>
            <th className="py-2 pr-4 text-right">Solde</th>
          </tr>
        </thead>
        <tbody>
          {enriched.map(r => <tr key={r.id} className="border-b last:border-none hover:bg-gray-50">
            <td className="py-1 pr-4 whitespace-nowrap">{r.date.slice(0,10)}</td>
            <td className="py-1 pr-4">{r.tier}</td>
            <td className="py-1 pr-4 font-medium">{r.designation}</td>
            <td className="py-1 pr-4 text-right tabular-nums">{r.debit ? r.debit.toFixed(2) : ''}</td>
            <td className="py-1 pr-4 text-right tabular-nums">{r.credit ? r.credit.toFixed(2) : ''}</td>
            <td className="py-1 pr-4 text-right tabular-nums">{r.balance.toFixed(2)}</td>
          </tr>)}
          {!enriched.length && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Aucune écriture</td></tr>}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td className="py-2 pr-4" colSpan={3}>Totaux</td>
            <td className="py-2 pr-4 text-right">{totalDebit.toFixed(2)}</td>
            <td className="py-2 pr-4 text-right">{totalCredit.toFixed(2)}</td>
            <td className="py-2 pr-4 text-right">{(totalDebit-totalCredit).toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  </main>;
}

