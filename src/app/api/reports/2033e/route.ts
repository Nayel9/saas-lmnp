import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/core";
import { getUserRole } from "@/lib/auth";
import { compute2033E } from "@/lib/accounting/compute2033e";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const yearStr = searchParams.get("year");
  const year = yearStr ? parseInt(yearStr, 10) : new Date().getFullYear();
  if (isNaN(year)) return new Response("Bad year", { status: 400 });
  const q = searchParams.get("q");
  const session = await auth();
  const user = session?.user;
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (getUserRole(user) !== "admin")
    return new Response("Forbidden", { status: 403 });
  const result = await compute2033E({ userId: user.id, year, q });
  return Response.json(result);
}
