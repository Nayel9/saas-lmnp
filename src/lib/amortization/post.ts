import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const AMORT_SCOPE = z.enum(["property", "asset"]).default("property");
export const PostAmortizationInput = z.object({
  propertyId: z.string().min(1),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  scope: AMORT_SCOPE.optional().default("property"),
  assetId: z.string().min(1).optional(),
});
export type PostAmortizationInput = z.infer<typeof PostAmortizationInput>;

function daysInMonth(year: number, month1to12: number) {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}
function round2(n: number) { return Math.round(n * 100) / 100; }

/** Compute monthly linear amortization amount for a given asset and target (year, month). Prorata for the first month based on acquisition day. */
export function computeMonthlyAmortAmount(params: {
  amountHT: number;
  durationYears: number;
  acquisitionDate: Date;
  year: number;
  month: number; // 1..12
}): number {
  const { amountHT, durationYears, acquisitionDate, year, month } = params;
  if (!(amountHT > 0) || !Number.isInteger(durationYears) || durationYears <= 0) return 0;
  const startY = acquisitionDate.getUTCFullYear();
  const startM = acquisitionDate.getUTCMonth() + 1; // 1..12
  const startD = acquisitionDate.getUTCDate();
  const totalMonths = durationYears * 12;
  // month index from acquisition start (1-based for readability)
  const idx = (year - startY) * 12 + (month - startM) + 1;
  if (idx < 1 || idx > totalMonths) return 0; // out of amortization window
  const monthlyFull = amountHT / totalMonths;
  // Prorata only for the very first month (idx === 1)
  if (idx === 1) {
    const dim = daysInMonth(year, month);
    const fraction = Math.max(0, Math.min(1, (dim - startD + 1) / dim));
    return round2(monthlyFull * fraction);
  }
  return round2(monthlyFull);
}

/** Idempotent posting: creates one Amortization row per asset with note "month:YYYY-MM;asset:ASSET_ID" if not already present. */
export async function postAmortizationForMonth(input: PostAmortizationInput & { userId: string }) {
  const parsed = PostAmortizationInput.parse(input);
  const { propertyId, year, month, scope, assetId } = parsed;
  const userId = input.userId;
  const targetMonth = `${year}-${String(month).padStart(2, "0")}`;
  let createdCount = 0;
  let skippedCount = 0;

  if (scope === "asset") {
    if (!assetId) throw new Error("assetId requis pour scope=asset");
    const asset = await prisma.asset.findFirst({
      where: { id: assetId, propertyId, user_id: userId },
      select: { id: true, amount_ht: true, duration_years: true, acquisition_date: true },
    });
    if (!asset) throw new Error("ASSET_FORBIDDEN");
    const noteContains = `month:${targetMonth}`;
    const noteContains2 = `asset:${asset.id}`;
    const existing = await prisma.amortization.findFirst({
      where: {
        user_id: userId,
        propertyId,
        year,
        AND: [ { note: { contains: noteContains } }, { note: { contains: noteContains2 } } ],
      },
      select: { id: true },
    });
    if (existing) { skippedCount++; return { createdCount, skippedCount }; }
    const amount = computeMonthlyAmortAmount({
      amountHT: Number(asset.amount_ht),
      durationYears: asset.duration_years,
      acquisitionDate: new Date(asset.acquisition_date),
      year, month,
    });
    await prisma.amortization.create({
      data: {
        user_id: userId,
        propertyId,
        year,
        amount,
        note: `month:${targetMonth};asset:${asset.id}`,
      },
    });
    createdCount++;
    return { createdCount, skippedCount };
  }

  // D'abord, récupérer les lignes existantes pour ce mois
  const existingRows = await prisma.amortization.findMany({
    where: {
      user_id: userId,
      propertyId,
      year,
      note: { contains: `month:${targetMonth}` },
    },
    select: { id: true, note: true },
  });
  const already = new Set<string>();
  for (const r of existingRows) {
    const m = /asset:([a-z0-9-]+)/i.exec(r.note || "");
    if (m?.[1]) already.add(m[1]);
  }

  // Ensuite, récupérer les assets de la propriété
  const assets = (await prisma.asset.findMany({
    where: { propertyId, user_id: userId },
    select: { id: true, amount_ht: true, duration_years: true, acquisition_date: true },
  })) ?? [];

  // Si aucun asset retourné mais des lignes existent déjà pour ce mois, considérer comme skipped
  if (assets.length === 0 && already.size > 0) {
    return { createdCount: 0, skippedCount: already.size };
  }
  if (assets.length === 0) return { createdCount: 0, skippedCount: 0 };

  for (const a of assets) {
    if (already.has(a.id)) { skippedCount++; continue; }
    const amount = computeMonthlyAmortAmount({
      amountHT: Number(a.amount_ht),
      durationYears: a.duration_years,
      acquisitionDate: new Date(a.acquisition_date),
      year, month,
    });
    if (amount <= 0) { skippedCount++; continue; }
    await prisma.amortization.create({
      data: {
        user_id: userId,
        propertyId,
        year,
        amount,
        note: `month:${targetMonth};asset:${a.id}`,
      },
    });
    createdCount++;
  }
  return { createdCount, skippedCount };
}
