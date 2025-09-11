import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/core";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ propertyId: z.string().uuid(), vatEnabled: z.boolean() });
const UUID = z.string().uuid();

export async function GET(req: NextRequest) {
  const session = await auth();
  const user = session?.user;
  if (!user) return new Response("Non authentifié", { status: 401 });
  const { searchParams } = new URL(req.url);
  const p = searchParams.get("property");
  const parse = UUID.safeParse(p);
  if (!parse.success) return new Response("BAD_REQUEST: property invalide", { status: 400 });
  const propertyId = parse.data;
  const rows = await prisma.$queryRawUnsafe<Array<{ vatEnabled: boolean }>>(
    `SELECT "vatEnabled" FROM "Property" WHERE "id" = $1 AND "user_id" = $2`,
    propertyId,
    user.id,
  );
  if (!rows.length) return new Response("FORBIDDEN: propriété inconnue", { status: 403 });
  const vatEnabled = !!rows[0]?.vatEnabled;
  return new Response(JSON.stringify({ vatEnabled }), { headers: { "Content-Type": "application/json" } });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  const user = session?.user;
  if (!user) return new Response("Non authentifié", { status: 401 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return new Response("BAD_REQUEST: JSON invalide", { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return new Response("BAD_REQUEST", { status: 400 });
  }
  const { propertyId, vatEnabled } = parsed.data;

  // contrôle ownership
  const prop = await prisma.property.findUnique({ where: { id: propertyId }, select: { id: true, user_id: true } });
  if (!prop || prop.user_id !== user.id) {
    return new Response("FORBIDDEN: propriété inconnue", { status: 403 });
  }

  const upd = await prisma.property.update({ where: { id: propertyId }, data: { vatEnabled } });
  return new Response(JSON.stringify({ ok: true, vatEnabled: upd.vatEnabled }), {
    headers: { "Content-Type": "application/json" },
  });
}
