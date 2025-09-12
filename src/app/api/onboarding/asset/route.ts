import { NextResponse } from "next/server";
import { createOnboardingAsset, assetSchema } from "@/app/onboarding/wizard/actions";

export async function POST(req: Request) {
  const data = await req.json().catch(() => ({}));
  const parsed = assetSchema.safeParse(data);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, errors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  try {
    const res = await createOnboardingAsset(parsed.data);
    if (!res.ok) return NextResponse.json(res, { status: 400 });
    return NextResponse.json(res);
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHENTICATED") {
      return NextResponse.json({ ok: false, error: "Non authentifié" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: "Erreur serveur" }, { status: 500 });
  }
}

export const runtime = "nodejs";
