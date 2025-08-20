import { createSupabaseServerClient } from '@/lib/supabase/server';
import { assertAdmin } from '@/lib/auth';
import { compute2033E } from '@/lib/accounting/compute2033e';

export const dynamic = 'force-dynamic';

export default async function C2033EPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const sp = await searchParams;
  const yearStr = sp.year as string | undefined;
  const q = sp.q as string | undefined;
  const year = yearStr ? parseInt(yearStr,10) : new Date().getFullYear();
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <div className="p-8">Non authentifié</div>;
  try { assertAdmin(user); } catch { return <div className="p-8">Accès administrateur requis</div>; }
  const data = await compute2033E({ userId: user.id, year, q });

  return <main className="p-6 max-w-6xl mx-auto space-y-6">
    <header className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-semibold">État des amortissements 2033-E</h1>
        <p className="text-sm text-muted-foreground">Année {year}</p>
      </div>
      <div className="flex gap-2">
        <a className="btn text-xs" href={`/api/reports/2033e/export?year=${year}${q?`&q=${encodeURIComponent(q)}`:''}`}>Export XLSX</a>
      </div>
    </header>

    <section className="card p-4 space-y-4 text-sm">
      <form className="flex flex-wrap gap-3 items-end" method="get">
        <div className="flex flex-col">
          <label className="text-xs font-medium mb-1">Année</label>
          <input type="number" name="year" defaultValue={year} className="input w-32" />
        </div>
        <div className="flex flex-col">
          <label className="text-xs font-medium mb-1">Recherche (label)</label>
          <input name="q" defaultValue={q||''} placeholder="Label" className="input" />
        </div>
        <button className="btn-primary h-9">Filtrer</button>
        {(yearStr || q) && <a href="/reports/2033e" className="underline text-xs">Reset</a>}
        <div className="text-xs text-muted-foreground ml-auto">{data.rows.length} actifs affichés {data.truncated && '(tronqué)'} </div>
      </form>
    </section>

    <div className="card p-4 overflow-x-auto text-sm">
      <table className="w-full">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 pr-4">Asset</th>
            <th className="py-2 pr-4 text-right">Origine</th>
            <th className="py-2 pr-4 text-right">Amort. antérieurs</th>
            <th className="py-2 pr-4 text-right">Dotation {year}</th>
            <th className="py-2 pr-4 text-right">Amort. cumulés</th>
            <th className="py-2 pr-2 text-right">Valeur nette</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map(r => <tr key={r.asset_id} className="border-b last:border-none hover:bg-bg-muted">
            <td className="py-1 pr-4 font-medium">{r.label}</td>
            <td className="py-1 pr-4 text-right tabular-nums">{r.valeur_origine.toFixed(2)}</td>
            <td className="py-1 pr-4 text-right tabular-nums">{r.amortissements_anterieurs.toFixed(2)}</td>
            <td className="py-1 pr-4 text-right tabular-nums">{r.dotation_exercice.toFixed(2)}</td>
            <td className="py-1 pr-4 text-right tabular-nums">{r.amortissements_cumules.toFixed(2)}</td>
            <td className="py-1 pr-2 text-right tabular-nums">{r.valeur_nette.toFixed(2)}</td>
          </tr>)}
          {!data.rows.length && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Aucun actif</td></tr>}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td className="py-2 pr-4">Totaux</td>
            <td className="py-2 pr-4 text-right">{data.totals.valeur_origine.toFixed(2)}</td>
            <td className="py-2 pr-4 text-right">{data.totals.amortissements_anterieurs.toFixed(2)}</td>
            <td className="py-2 pr-4 text-right">{data.totals.dotation_exercice.toFixed(2)}</td>
            <td className="py-2 pr-4 text-right">{data.totals.amortissements_cumules.toFixed(2)}</td>
            <td className="py-2 pr-2 text-right">{data.totals.valeur_nette.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  </main>;
}
