import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/core";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = z.string().uuid();
const SCOPE = z.enum(["user", "property"]).default("user");

export async function GET(req: NextRequest) {
  const session = await auth();
  const user = session?.user;
  if (!user) return new Response("Non authentifié", { status: 401 });

  const { searchParams } = new URL(req.url);
  const p = searchParams.get("property");
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

  const baseWhere = { user_id: user.id } as const;
  const propFilter = scope === "property" && propertyId ? { propertyId } : {};

  const sales = await prisma.journalEntry.findMany({
    where: { ...baseWhere, ...propFilter, type: "vente", isDeposit: false },
    select: { id: true, date: true, amount: true, tier: true, designation: true },
    orderBy: { date: "desc" },
    take: 5,
  });

  const purchases = await prisma.journalEntry.findMany({
    where: { ...baseWhere, ...propFilter, type: "achat" },
    select: { id: true, date: true, amount: true, tier: true, designation: true },
    orderBy: { date: "desc" },
    take: 5,
  });

  const payload = {
    sales: sales.map((e) => ({
      id: e.id,
      date: e.date,
      amount: Number(e.amount),
      tenant: e.tier || e.designation || null,
    })),
    purchases: purchases.map((e) => ({
      id: e.id,
      date: e.date,
      amount: Number(e.amount),
      supplier: e.tier || e.designation || null,
    })),
  };

  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
  });
}

