import { auth } from "@/lib/auth/core";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const user = session?.user;
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset || asset.user_id !== user.id)
    return new Response("Forbidden", { status: 403 });
  const items = await prisma.attachment.findMany({
    where: { assetId: id },
    orderBy: { createdAt: "desc" },
  });
  return Response.json(items);
}
