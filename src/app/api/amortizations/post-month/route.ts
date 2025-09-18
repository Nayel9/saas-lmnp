import { NextRequest } from "next/server";
import { requirePropertyAccess } from "@/lib/auth/guards";
import { PostAmortizationInput, postAmortizationForMonth } from "@/lib/amortization/post";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = PostAmortizationInput.safeParse(body);
    if (!parsed.success) {
      return new Response("BAD_REQUEST", { status: 400 });
    }
    const { propertyId, year, month, scope, assetId } = parsed.data;
    const { user } = await requirePropertyAccess(propertyId);
    const result = await postAmortizationForMonth({ userId: user.id, propertyId, year, month, scope, assetId });
    return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    if (msg === "ASSET_FORBIDDEN") return new Response("FORBIDDEN", { status: 403 });
    if (msg.startsWith("assetId requis")) return new Response("BAD_REQUEST", { status: 400 });
    return new Response("Server error", { status: 500 });
  }
}

