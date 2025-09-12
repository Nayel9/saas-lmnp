import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth/core";
import { createSchema, querySchema } from "./validators";

export async function GET(req: NextRequest) {
  const session = await auth();
  const user = session?.user;
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({ property: url.searchParams.get("property") });
  if (!parsed.success) return NextResponse.json({ error: "Validation" }, { status: 400 });
  const propertyId = parsed.data.property;
  const prop = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!prop || prop.user_id !== user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const rows = await prisma.amortizationDefault.findMany({
    where: { propertyId },
    orderBy: { category: "asc" },
  });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const user = session?.user;
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  let body: object;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Validation" }, { status: 400 });
  const { propertyId, category, defaultDurationMonths } = parsed.data;
  const prop = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!prop || prop.user_id !== user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const created = await prisma.amortizationDefault.create({
      data: { propertyId, category, defaultDurationMonths },
    });
    return NextResponse.json({ ok: true, id: created.id });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2002")
      return NextResponse.json({ error: "Conflit" }, { status: 409 });
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
