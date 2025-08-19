import {prisma} from '../prisma';
import {computeLinearAmortization} from '../asset-amortization';
import type {Prisma} from '@prisma/client';

export interface C2033AParams { userId: string; year: number; q?: string | null; }
export interface C2033AResult {
  year: number;
  immobilisations_brutes: number;
  amortissements_cumules: number;
  immobilisations_nettes: number;
  tresorerie: number; // v1 fixe 0
  actif_total: number;
  capitaux_propres_equilibrage: number;
  count_assets: number;
  truncated: boolean;
}

const MAX_ASSETS = 20000;
function round2(n: number){ return Math.round(n*100)/100; }

export async function compute2033A(params: C2033AParams): Promise<C2033AResult> {
  const { userId, year, q } = params;
  const endDate = new Date(Date.UTC(year,11,31));
  const where: Prisma.AssetWhereInput = { user_id: userId, acquisition_date: { lte: endDate } };
  if (q) where.label = { contains: q, mode: 'insensitive' };
  const assets = await prisma.asset.findMany({ where, orderBy: { acquisition_date: 'asc' } });
  let truncated = false;
  let list = assets;
  if (assets.length > MAX_ASSETS) { truncated = true; list = assets.slice(0, MAX_ASSETS); }
  let brut = 0; let cumul = 0;
  for (const a of list) {
    const amount = Number(a.amount_ht);
    if (!(amount>0) || a.duration_years <=0) continue;
    brut += amount;
    const sched = computeLinearAmortization(amount, a.duration_years, a.acquisition_date);
    const lastYearEntry = sched.filter(s => s.year <= year).at(-1);
    if (lastYearEntry) cumul += lastYearEntry.cumul;
  }
  brut = round2(brut);
  cumul = round2(cumul);
  let nettes = round2(brut - cumul); if (nettes < 0) nettes = 0;
  const tresorerie = 0; // v1
  const actif_total = round2(nettes + tresorerie);
   // équilibrage V1
    return { year, immobilisations_brutes: brut, amortissements_cumules: cumul, immobilisations_nettes: nettes, tresorerie, actif_total, capitaux_propres_equilibrage: actif_total, count_assets: assets.length, truncated };
}

