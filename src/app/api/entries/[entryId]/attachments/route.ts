import { auth } from "@/lib/auth/core";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const session = await auth();
  const user = session?.user;
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { entryId } = await params;
  const entry = await prisma.journalEntry.findUnique({
    where: { id: entryId },
  });
  if (!entry || entry.user_id !== user.id)
    return new Response("Forbidden", { status: 403 });
  const items = await prisma.attachment.findMany({
    where: { entryId },
    orderBy: { createdAt: "desc" },
  });
  return Response.json(items);
}
