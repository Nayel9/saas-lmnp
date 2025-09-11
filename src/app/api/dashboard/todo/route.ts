import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/core";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = z.string().uuid();
const YEAR = z.coerce.number().int().min(2000).max(2100);
const MONTH = z.coerce.number().int().min(1).max(12);
const SCOPE = z.enum(["user", "property"]).default("user");

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const user = session?.user;
  if (!user) return new Response("Non authentifié", { status: 401 });

  const { searchParams } = new URL(req.url);
  const p = searchParams.get("property");
  const y = searchParams.get("year");
  const m = searchParams.get("month");
  const s = searchParams.get("scope") ?? undefined;

  const scope = SCOPE.parse(s ?? "user");

  let propertyId: string | null = null;
  if (scope === "property") {
    const idParse = UUID.safeParse(p);
    if (!idParse.success)
      return new Response("BAD_REQUEST: property invalide", { status: 400 });
    propertyId = idParse.data;
    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property || property.user_id !== user.id) {
      return new Response("FORBIDDEN: propriété inconnue", { status: 403 });
    }
  }

  const yearParse = YEAR.safeParse(y ?? String(new Date().getFullYear()));
  if (!yearParse.success)
    return new Response("BAD_REQUEST: year invalide", { status: 400 });
  const monthParse = MONTH.safeParse(m ?? String(new Date().getMonth() + 1));
  if (!monthParse.success)
    return new Response("BAD_REQUEST: month invalide", { status: 400 });

  const year = yearParse.data;
  const month = monthParse.data; // 1..12

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1)); // exclusif

  const baseWhere = { user_id: user.id, date: { gte: start, lt: end } } as const;
  const propFilter = scope === "property" && propertyId ? { propertyId } : {};

  // Loyers non encaissés (heuristique: non-dépôt et pas sur compte de trésorerie)
  const unpaidRents = await prisma.journalEntry.findMany({
    where: {
      ...baseWhere,
      ...propFilter,
      type: "vente",
      isDeposit: false,
      NOT: { account_code: { in: ["512", "53"] } },
    },
    select: { id: true, date: true, amount: true, tier: true, designation: true },
    orderBy: { date: "asc" },
    take: 5,
  });

  const expensesWithoutDocs = await prisma.journalEntry.findMany({
    where: {
      ...baseWhere,
      ...propFilter,
      type: "achat",
      attachments: { none: {} },
    },
    select: { id: true, date: true, amount: true, tier: true, designation: true },
    orderBy: { date: "asc" },
    take: 5,
  });

  // Nouveaux: loyers récemment encaissés (compte trésorerie)
  const recentlyPaidRents = await prisma.journalEntry.findMany({
    where: {
      ...baseWhere,
      ...propFilter,
      type: "vente",
      isDeposit: false,
      account_code: { in: ["512", "53"] },
    },
    select: { id: true, date: true, amount: true, tier: true, designation: true },
    orderBy: { date: "desc" },
    take: 3,
  });

  const depositsWhere = {
    ...baseWhere,
    ...propFilter,
    type: "vente" as const,
    isDeposit: true,
  };
  const [depositAgg, depositCount] = await Promise.all([
    prisma.journalEntry.aggregate({ _sum: { amount: true }, where: depositsWhere }),
    prisma.journalEntry.count({ where: depositsWhere }),
  ]);

  const depositsHeld = {
    total: round2(Number(depositAgg._sum.amount || 0)),
    count: depositCount,
  };

  const payload = {
    unpaidRents: unpaidRents.map((e) => ({
      id: e.id,
      date: e.date,
      amount: Number(e.amount),
      tenant: e.tier || e.designation || null,
    })),
    expensesWithoutDocs: expensesWithoutDocs.map((e) => ({
      id: e.id,
      date: e.date,
      amount: Number(e.amount),
      supplier: e.tier || e.designation || null,
    })),
    recentlyPaidRents: recentlyPaidRents.map((e) => ({
      id: e.id,
      date: e.date,
      amount: Number(e.amount),
      tenant: e.tier || e.designation || null,
    })),
    depositsHeld,
  };

  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
  });
}
