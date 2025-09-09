import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/core";
import { prisma } from "@/lib/prisma";
import { computeLinearAmortization } from "@/lib/asset-amortization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = z.string().uuid();
const YEAR = z.coerce.number().int().min(2000).max(2100);
const SCOPE = z.enum(["user", "property"]).default("user");

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

type DecimalLike = { toNumber: () => number };
function isDecimalLike(x: unknown): x is DecimalLike {
  return (
    typeof x === "object" &&
    x !== null &&
    "toNumber" in (x as Record<string, unknown>) &&
    typeof (x as { toNumber?: unknown }).toNumber === "function"
  );
}

function toNum(v: unknown): number {
  if (isDecimalLike(v)) {
    try {
      return v.toNumber();
    } catch {
      // ignore
    }
  }
  const n = typeof v === "string" || typeof v === "number" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
}

interface JournalEntryLike {
  type: "achat" | "vente";
  date: Date | string;
  amount: unknown;
  isDeposit?: boolean;
}

interface AmortizationRow {
  amount: unknown;
}

interface AssetLike {
  amount_ht: unknown;
  duration_years: number;
  acquisition_date: Date | string;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const user = session?.user;
  if (!user) return new Response("Non authentifié", { status: 401 });

  const { searchParams } = new URL(req.url);
  const p =
    searchParams.get("property") || searchParams.get("propertyId") || undefined;
  const y = searchParams.get("year") ?? undefined;
  const s = searchParams.get("scope") ?? undefined;

  if (!p) return new Response("BAD_REQUEST: property requis", { status: 400 });
  const idParse = UUID.safeParse(p);
  if (!idParse.success)
    return new Response("BAD_REQUEST: property invalide", { status: 400 });
  const yearParse = YEAR.safeParse(y ?? String(new Date().getFullYear()));
  if (!yearParse.success)
    return new Response("BAD_REQUEST: year invalide", { status: 400 });

  const propertyId = idParse.data;
  const year = yearParse.data;
  const scope = SCOPE.parse(s ?? "user");

  // Vérifier que le bien appartient à l'utilisateur
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
  });
  if (!property || property.user_id !== user.id) {
    return new Response("FORBIDDEN: propriété inconnue", { status: 403 });
  }

  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

  let revenus = 0,
    depenses = 0;

  if (scope === "user") {
    // Note: le schéma JournalEntry n'a pas de propertyId; on scope par user + année.
    const entries = (await prisma.journalEntry.findMany({
      where: { user_id: user.id, date: { gte: start, lte: end } },
      orderBy: { date: "asc" },
    })) as unknown as JournalEntryLike[];

    for (const e of entries) {
      const d = new Date(e.date);
      if (d < start || d > end) continue; // garde-fou
      const amt = toNum(e.amount);
      if (!amt) continue;
      if (e.type === "vente") {
        if (e.isDeposit) continue; // exclure cautions
        revenus += amt;
      } else if (e.type === "achat") {
        depenses += amt;
      }
    }
  } else {
    // scope === "property": utiliser Income/Expense par bien
    const [incomeAgg, expenseAgg] = await Promise.all([
      prisma.income.aggregate({
        _sum: { amount: true },
        where: { user_id: user.id, propertyId, date: { gte: start, lte: end } },
      }),
      prisma.expense.aggregate({
        _sum: { amount: true },
        where: { user_id: user.id, propertyId, date: { gte: start, lte: end } },
      }),
    ]);
    revenus = toNum(incomeAgg._sum.amount);
    depenses = toNum(expenseAgg._sum.amount);
  }

  revenus = round2(revenus);
  depenses = round2(depenses);

  // Amortissements: priorité aux enregistrements Amortization (par bien + année)
  const amortRows = (await prisma.amortization.findMany({
    where: { user_id: user.id, propertyId, year },
    select: { amount: true },
  })) as unknown as AmortizationRow[];
  let amortissements = amortRows.reduce((acc, r) => acc + toNum(r.amount), 0);

  // Fallback: si aucune écriture Amortization, calculer depuis les assets de l'utilisateur
  if (amortRows.length === 0) {
    const assets = (await prisma.asset.findMany({
      where: { user_id: user.id },
    })) as unknown as AssetLike[];
    let sum = 0;
    for (const a of assets) {
      const amount = toNum(a.amount_ht);
      if (!(amount > 0) || a.duration_years <= 0) continue;
      const sched = computeLinearAmortization(
        amount,
        a.duration_years,
        new Date(a.acquisition_date),
      );
      const entry = sched.find((s) => s.year === year);
      if (entry) sum += entry.dotation;
    }
    amortissements = sum;
  }

  amortissements = round2(amortissements);

  const resultat = round2(revenus - depenses - amortissements);

  const body = JSON.stringify({
    year,
    propertyId,
    scope,
    revenus,
    depenses,
    amortissements,
    resultat,
  });
  return new Response(body, {
    headers: { "Content-Type": "application/json" },
  });
}
