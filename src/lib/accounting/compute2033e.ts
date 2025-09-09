import { prisma } from "../prisma";
import { computeLinearAmortization } from "../asset-amortization";
import type { Prisma } from "@prisma/client";

export interface C2033EParams {
  userId: string;
  year: number;
  q?: string | null;
}
export interface C2033ERow {
  asset_id: string;
  label: string;
  valeur_origine: number;
  amortissements_anterieurs: number;
  dotation_exercice: number;
  amortissements_cumules: number;
  valeur_nette: number;
}
export interface C2033EResult {
  year: number;
  rows: C2033ERow[];
  totals: Omit<C2033ERow, "asset_id" | "label">;
  truncated: boolean;
  count_assets: number;
}

const MAX_ASSETS = 10000;
function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export async function compute2033E(
  params: C2033EParams,
): Promise<C2033EResult> {
  const { userId, year, q } = params;
  const where: Prisma.AssetWhereInput = { user_id: userId };
  if (q) where.label = { contains: q, mode: "insensitive" };
  const assets = await prisma.asset.findMany({
    where,
    orderBy: { acquisition_date: "asc" },
  });
  let truncated = false;
  let list = assets;
  if (assets.length > MAX_ASSETS) {
    truncated = true;
    list = assets.slice(0, MAX_ASSETS);
  }

  const rows: C2033ERow[] = [];
  for (const a of list) {
    const amount = Number(a.amount_ht);
    if (!(amount > 0) || a.duration_years <= 0) continue;
    const sched = computeLinearAmortization(
      amount,
      a.duration_years,
      a.acquisition_date,
    );
    const entry = sched.find((s) => s.year === year);
    if (!entry) continue; // année hors plage amortissement
    const prev = sched.filter((s) => s.year < year).at(-1);
    const amortAnt = prev ? prev.cumul : 0;
    const dotation = entry.dotation;
    const cumul = amortAnt + dotation;
    const nette = amount - cumul;
    rows.push({
      asset_id: a.id,
      label: a.label,
      valeur_origine: round2(amount),
      amortissements_anterieurs: round2(amortAnt),
      dotation_exercice: round2(dotation),
      amortissements_cumules: round2(cumul),
      valeur_nette: round2(nette),
    });
  }
  const totals = rows.reduce(
    (acc, r) => {
      acc.valeur_origine += r.valeur_origine;
      acc.amortissements_anterieurs += r.amortissements_anterieurs;
      acc.dotation_exercice += r.dotation_exercice;
      acc.amortissements_cumules += r.amortissements_cumules;
      acc.valeur_nette += r.valeur_nette;
      return acc;
    },
    {
      valeur_origine: 0,
      amortissements_anterieurs: 0,
      dotation_exercice: 0,
      amortissements_cumules: 0,
      valeur_nette: 0,
    },
  );
  (Object.keys(totals) as (keyof typeof totals)[]).forEach((k) => {
    totals[k] = round2(totals[k]);
  });
  return { year, rows, totals, truncated, count_assets: assets.length };
}
