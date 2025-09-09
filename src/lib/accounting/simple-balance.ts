import { computeLinearAmortization } from '@/lib/asset-amortization';

export interface SimpleAsset { amount_ht: number; duration_years: number; acquisition_date: Date }
export interface SimpleEntry { type: 'achat'|'vente'; amount: number; date: Date; isDeposit?: boolean }
export interface BalanceActif { vnc: number; treso: number; total: number }
export interface BalancePassif { cautions: number; dettes: number; total: number }
export interface SimpleBalanceResult { year: number; actif: BalanceActif; passif: BalancePassif; ecart: number }

function round2(n: number){ return Math.round(n*100)/100; }

export function computeVNC(assets: SimpleAsset[], year: number): number {
  const end = new Date(Date.UTC(year,11,31));
  let vnc = 0;
  for (const a of assets) {
    if (!(a.amount_ht>0) || a.duration_years<=0) continue;
    if (a.acquisition_date > end) continue;
    const sched = computeLinearAmortization(a.amount_ht, a.duration_years, a.acquisition_date);
    const last = sched.filter(s => s.year <= year).at(-1);
    const cumul = last ? last.cumul : 0;
    const net = a.amount_ht - cumul;
    vnc += net > 0 ? net : 0;
  }
  return round2(vnc);
}

export function computeCashAndDeposits(entries: SimpleEntry[], year: number): { cash: number; deposits: number } {
  const start = new Date(Date.UTC(year,0,1));
  const end = new Date(Date.UTC(year,11,31,23,59,59,999));
  let ventes = 0, achats = 0, cautions = 0;
  for (const e of entries) {
    const d = e.date;
    if (d < start || d > end) continue;
    const amt = e.amount || 0;
    if (e.type === 'vente') {
      if (e.isDeposit) cautions += amt; else ventes += amt;
    } else if (e.type === 'achat') achats += amt;
  }
  const cash = round2(ventes - achats);
  return { cash, deposits: round2(cautions) };
}

export function computeSimpleBalance(params: { assets: SimpleAsset[]; entries: SimpleEntry[]; year: number }): SimpleBalanceResult {
  const { assets, entries, year } = params;
  const vnc = computeVNC(assets, year);
  const { cash, deposits } = computeCashAndDeposits(entries, year);
  const actif: BalanceActif = { vnc, treso: cash, total: round2(vnc + cash) };
  const passif: BalancePassif = { cautions: deposits, dettes: 0, total: round2(deposits) };
  const ecart = round2(actif.total - passif.total);
  return { year, actif, passif, ecart };
}
