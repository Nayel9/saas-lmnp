import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/core";
import { prisma } from "@/lib/prisma";
import { computeSimpleBalance } from "@/lib/accounting/simple-balance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = z.string().uuid();
const YEAR = z.coerce.number().int().min(2000).max(2100);

export async function GET(req: NextRequest) {
  const session = await auth();
  const user = session?.user;
  if (!user) return new Response("Non authentifié", { status: 401 });
  const { searchParams } = new URL(req.url);
  const p =
    searchParams.get("property") || searchParams.get("propertyId") || undefined;
  const y = searchParams.get("year") ?? undefined;
  if (!p) return new Response("BAD_REQUEST: property requis", { status: 400 });
  const idParse = UUID.safeParse(p);
  if (!idParse.success)
    return new Response("BAD_REQUEST: property invalide", { status: 400 });
  const yearParse = YEAR.safeParse(y ?? String(new Date().getFullYear()));
  if (!yearParse.success)
    return new Response("BAD_REQUEST: year invalide", { status: 400 });
  const propertyId = idParse.data;
  const year = yearParse.data;

  // Contrôle d’appartenance
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
  });
  if (!property || property.user_id !== user.id)
    return new Response("FORBIDDEN: propriété inconnue", { status: 403 });

  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

  // Assets jusqu’au 31/12
  const assets = await prisma.asset.findMany({
    where: { user_id: user.id, acquisition_date: { lte: end } },
    orderBy: { acquisition_date: "asc" },
  });

  // Écritures de l’année (achat/vente)
  const entries = await prisma.journalEntry.findMany({
    where: { user_id: user.id, date: { gte: start, lte: end } },
  });

  const assetsSimple = assets.map((a) => ({
    amount_ht: Number(a.amount_ht),
    duration_years: a.duration_years,
    acquisition_date: new Date(a.acquisition_date),
  }));
  const entriesSimple = entries.map((e) => ({
    type: e.type,
    amount: Number(e.amount),
    date: new Date(e.date),
    isDeposit: e.isDeposit,
  })) as {
    type: "achat" | "vente";
    amount: number;
    date: Date;
    isDeposit?: boolean;
  }[];

  const result = computeSimpleBalance({
    assets: assetsSimple,
    entries: entriesSimple,
    year,
  });
  // Retourner le résultat (contient year) et propertyId sans duplication
  return new Response(JSON.stringify({ propertyId, ...result }), {
    headers: { "Content-Type": "application/json" },
  });
}
