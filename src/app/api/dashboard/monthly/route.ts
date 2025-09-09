import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/core";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = z.string().uuid();
const YEAR = z.coerce.number().int().min(2000).max(2100);
const MONTH = z
  .coerce.number()
  .int()
  .min(1)
  .max(12);

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

  const idParse = UUID.safeParse(p);
  if (!idParse.success)
    return new Response("BAD_REQUEST: property invalide", { status: 400 });
  const yearParse = YEAR.safeParse(y ?? String(new Date().getFullYear()));
  if (!yearParse.success)
    return new Response("BAD_REQUEST: year invalide", { status: 400 });
  const monthParse = MONTH.safeParse(m ?? String(new Date().getMonth() + 1));
  if (!monthParse.success)
    return new Response("BAD_REQUEST: month invalide", { status: 400 });

  const propertyId = idParse.data;
  const year = yearParse.data;
  const month = monthParse.data; // 1..12

  // Propriété appartient à l'utilisateur ?
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property || property.user_id !== user.id) {
    return new Response("FORBIDDEN: propriété inconnue", { status: 403 });
  }

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1)); // exclusif

  const [incomeAgg, expenseAgg] = await Promise.all([
    prisma.income.aggregate({
      _sum: { amount: true },
      where: {
        user_id: user.id,
        propertyId,
        date: { gte: start, lt: end },
      },
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: {
        user_id: user.id,
        propertyId,
        date: { gte: start, lt: end },
      },
    }),
  ]);

  const incoming = round2(Number(incomeAgg._sum.amount || 0));
  const outgoing = round2(Number(expenseAgg._sum.amount || 0));
  const result = round2(incoming - outgoing);

  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const amortExists = await prisma.amortization.findFirst({
    where: { user_id: user.id, propertyId, year, note: { contains: `month:${monthKey}` } },
    select: { id: true },
  });
  const amortPosted = Boolean(amortExists);

  return new Response(
    JSON.stringify({ incoming, outgoing, result, amortPosted }),
    { headers: { "Content-Type": "application/json" } },
  );
}

