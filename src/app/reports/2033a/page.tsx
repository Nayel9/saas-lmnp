import { auth } from '@/lib/auth/core';
import { compute2033A } from '@/lib/accounting/compute2033a';

export const dynamic = 'force-dynamic';

export default async function C2033APage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const sp = await searchParams;
  const yearStr = sp.year as string | undefined;
  const q = (sp.q as string | undefined) || undefined;
  const year = yearStr ? parseInt(yearStr,10) : new Date().getFullYear();
  const session = await auth();
  const user = session?.user;
  if (!user) return <div className="p-8">Non authentifié</div>;
  const d = await compute2033A({ userId: user.id, year, q });
  const totalPassif = d.deposits_held + d.capitaux_propres_equilibrage;
  const balanceOK = d.actif_total === totalPassif;
  return <main className="p-6 max-w-4xl mx-auto space-y-6">
    <header className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-semibold">Bilan simplifié 2033-A</h1>
        <p className="text-sm text-muted-foreground">Année {year}</p>
      </div>
      <div className="flex gap-2">
        <a className="btn text-xs" href={`/api/reports/2033a/export?year=${year}${q?`&q=${encodeURIComponent(q)}`:''}`}>Export XLSX</a>
      </div>
    </header>
    <section className="card p-4 space-y-4 text-sm">
      <form className="flex flex-wrap gap-3 items-end" method="get">
        <div className="flex flex-col">
          <label className="text-xs font-medium mb-1">Année</label>
          <input type="number" name="year" defaultValue={year} className="input w-32" />
        </div>
        <div className="flex flex-col">
          <label className="text-xs font-medium mb-1">Recherche (label asset)</label>
            <input name="q" defaultValue={q||''} placeholder="Label" className="input" />
        </div>
        <button className="btn-primary h-9">Filtrer</button>
        {(yearStr || q) && <a href="/reports/2033a" className="underline text-xs">Reset</a>}
        <div className="text-xs text-muted-foreground ml-auto">{d.count_assets} actifs (brut {d.immobilisations_brutes.toFixed(2)}) {d.truncated && '(tronqué)'} </div>
      </form>
    </section>
    <div className="grid md:grid-cols-2 gap-6">
      <div className="card p-4 text-sm">
        <h2 className="font-semibold mb-3">Actif</h2>
        <table className="w-full">
          <tbody>
            <tr><td className="py-1 pr-4">Immobilisations nettes</td><td className="py-1 text-right tabular-nums">{d.immobilisations_nettes.toFixed(2)}</td></tr>
            <tr><td className="py-1 pr-4">Trésorerie (v1)</td><td className="py-1 text-right tabular-nums">{d.tresorerie.toFixed(2)}</td></tr>
          </tbody>
          <tfoot>
            <tr className="font-semibold border-t"><td className="py-2 pr-4">Total Actif</td><td className="py-2 text-right tabular-nums">{d.actif_total.toFixed(2)}</td></tr>
          </tfoot>
        </table>
      </div>
      <div className="card p-4 text-sm">
        <h2 className="font-semibold mb-3">Passif</h2>
        <table className="w-full">
          <tbody>
            <tr><td className="py-1 pr-4">Cautions détenues</td><td className="py-1 text-right tabular-nums">{d.deposits_held.toFixed(2)}</td></tr>
            <tr><td className="py-1 pr-4">Capitaux propres (équilibrage v1)</td><td className="py-1 text-right tabular-nums">{d.capitaux_propres_equilibrage.toFixed(2)}</td></tr>
          </tbody>
          <tfoot>
            <tr className="font-semibold border-t"><td className="py-2 pr-4">Total Passif</td><td className="py-2 text-right tabular-nums">{totalPassif.toFixed(2)}</td></tr>
          </tfoot>
        </table>
      </div>
    </div>
    <div className="text-xs flex items-center gap-3">
      <span>Équilibre: {balanceOK ? <span className="text-[--color-success] font-medium">OK</span> : <span className="text-[--color-danger] font-medium">Déséquilibré</span>}</span>
      <span className="text-muted-foreground">(Nettes = Brut - Amort. cumulés au 31/12)</span>
    </div>
  </main>;
}
