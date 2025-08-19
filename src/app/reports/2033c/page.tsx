import { createSupabaseServerClient } from '@/lib/supabase/server';
import { assertAdmin } from '@/lib/auth';
import { compute2033C } from '@/lib/accounting/compute2033c';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function C2033CPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const sp = await searchParams;
  const from = sp.from as string | undefined;
  const to = sp.to as string | undefined;
  const q = sp.q as string | undefined;
  const account_code = sp.account_code as string | undefined;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <div className="p-8">Non authentifié</div>;
  try { assertAdmin(user); } catch { return <div className="p-8">Accès administrateur requis</div>; }

  const data = await compute2033C({ userId: user.id, from, to, q, account_code });
  const hasFilters = !!(from||to||q||account_code);

  const rubriqueMap = Object.fromEntries(data.rubriques.map(r=>[r.rubrique,r]));
  const get = (code: string) => rubriqueMap[code];

  const produitsRows = [ get('CA'), get('CA_Moins') ].filter(Boolean);
  const chargesRows = data.rubriques.filter(r => !['CA','CA_Moins','DotationsAmortissements'].includes(r.rubrique));
  const dotationsRows = [ get('DotationsAmortissements') ].filter(Boolean);

  type RRow = { rubrique: string; label: string; total_debit: number; total_credit: number } | undefined;
  function montantProduit(r: RRow){ if(!r) return 0; if(r.rubrique==='CA') return r.total_credit - r.total_debit; if(r.rubrique==='CA_Moins') return -(r.total_debit - r.total_credit); return 0; }
  function montantCharge(r: RRow){ if(!r) return 0; return r.total_debit - r.total_credit; }

  return <main className="p-6 max-w-5xl mx-auto space-y-6">
    <header className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-semibold">Compte de résultat 2033-C</h1>
        <p className="text-sm text-muted-foreground">Agrégation simplifiée (LMNP)</p>
      </div>
      <div className="flex gap-2">
        <a className="btn text-xs" href={`/api/reports/2033c/export?format=xlsx${from?`&from=${from}`:''}${to?`&to=${to}`:''}${q?`&q=${q}`:''}${account_code?`&account_code=${account_code}`:''}`}>Export XLSX</a>
      </div>
    </header>

    <section className="card p-4 space-y-4 text-sm">
      <form className="grid md:grid-cols-6 gap-3" method="get">
        <input type="date" name="from" defaultValue={from||''} className="input" />
        <input type="date" name="to" defaultValue={to||''} className="input" />
        <input name="account_code" placeholder="Compte" defaultValue={account_code||''} className="input" />
        <input name="q" placeholder="Recherche (designation / tier / compte)" defaultValue={q||''} className="input md:col-span-2" />
        <div className="flex items-center gap-2 md:col-span-1">
          <button className="btn-primary">Filtrer</button>
          {hasFilters && <a href="/reports/2033c" className="text-xs underline">Reset</a>}
        </div>
        <div className="md:col-span-6 flex flex-wrap gap-4 mt-2 text-xs text-muted-foreground">
          {from && <span>Période: {from} → {to || '…'}</span>}
          {hasFilters && <span className="px-2 py-0.5 rounded bg-gray-200">Filtre actif</span>}
        </div>
      </form>
    </section>

    <section className="card p-4 overflow-x-auto text-sm space-y-6">
      {/* PRODUITS */}
      <div>
        <h2 className="font-semibold mb-2">Produits</h2>
        <table className="w-full mb-2">
          <tbody>
            {produitsRows.map(r => <tr key={r.rubrique} className="border-b last:border-none">
              <td className="py-1 pr-4">{r.label}</td>
              <td className="py-1 text-right tabular-nums">{montantProduit(r).toFixed(2)}</td>
            </tr>)}
            {!produitsRows.length && <tr><td colSpan={2} className="py-2 text-muted-foreground">Aucun produit</td></tr>}
            <tr className="font-medium">
              <td className="py-1 pr-4">Total Produits</td>
              <td className="py-1 text-right tabular-nums">{data.totals.produits.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* CHARGES */}
      <div>
        <h2 className="font-semibold mb-2">Charges</h2>
        <table className="w-full mb-2">
          <tbody>
            {chargesRows.map(r => <tr key={r.rubrique} className="border-b last:border-none">
              <td className="py-1 pr-4">{r.label}</td>
              <td className="py-1 text-right tabular-nums">{montantCharge(r).toFixed(2)}</td>
            </tr>)}
            {!chargesRows.length && <tr><td colSpan={2} className="py-2 text-muted-foreground">Aucune charge</td></tr>}
            <tr className="font-medium">
              <td className="py-1 pr-4">Total Charges</td>
              <td className="py-1 text-right tabular-nums">{data.totals.charges.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* DOTATIONS */}
      <div>
        <h2 className="font-semibold mb-2">Dotations</h2>
        <table className="w-full mb-2">
          <tbody>
            {dotationsRows.map(r => <tr key={r.rubrique} className="border-b last:border-none">
              <td className="py-1 pr-4">{r.label}</td>
              <td className="py-1 text-right tabular-nums">{montantCharge(r).toFixed(2)}</td>
            </tr>)}
            {!dotationsRows.length && <tr><td colSpan={2} className="py-2 text-muted-foreground">Aucune dotation</td></tr>}
            <tr className="font-medium">
              <td className="py-1 pr-4">Total Dotations</td>
              <td className="py-1 text-right tabular-nums">{data.totals.amortissements.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="text-sm font-semibold flex justify-between border-t pt-3">
        <span>Résultat</span>
        <span className="tabular-nums">{data.totals.resultat.toFixed(2)}</span>
      </div>
      {data.totals.resultat < 0 && <div className="text-xs text-red-600">Résultat négatif</div>}
      {(data.truncated) && <div className="text-xs text-amber-600">Données tronquées (volume &gt; limite interne)</div>}

      <div className="text-xs text-muted-foreground flex flex-wrap gap-4">
        <span>Période: {from || '—'} → {to || '—'}</span>
        <Link href="/reports/2033e" className="underline">Aller 2033-E (amortissements)</Link>
      </div>
    </section>
  </main>;
}
