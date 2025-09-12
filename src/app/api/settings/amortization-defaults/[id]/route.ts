import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth/core";
import { updateSchema } from "../validators";

async function ensureOwnershipByDefaultId(id: string, userId: string) {
  const row = await prisma.amortizationDefault.findUnique({ where: { id } });
  if (!row) return { ok: false as const, status: 404 as const };
  const prop = await prisma.property.findUnique({ where: { id: row.propertyId } });
  if (!prop || prop.user_id !== userId) return { ok: false as const, status: 403 as const };
  return { ok: true as const, row };
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await auth();
  const user = session?.user;
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  let body: object;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation" }, { status: 400 });
  const res = await ensureOwnershipByDefaultId(id, user.id);
  if (!res.ok) return NextResponse.json({ error: "Forbidden" }, { status: res.status });
  const updated = await prisma.amortizationDefault.update({
    where: { id },
    data: parsed.data,
  });
  return NextResponse.json({ ok: true, id: updated.id });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await auth();
  const user = session?.user;
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const res = await ensureOwnershipByDefaultId(id, user.id);
  if (!res.ok) return NextResponse.json({ error: "Forbidden" }, { status: res.status });
  await prisma.amortizationDefault.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
