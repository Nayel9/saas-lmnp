// src/app/api/profile/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth/core";
import { ensureRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(60),
  phone: z
    .string()
    .trim()
    .min(5)
    .max(30)
    .regex(/^[+0-9 ()-]*$/, "Format téléphone invalide"),
});

export async function POST(req: Request) {
  const limited = ensureRateLimit(req, 'profile-update', { capacity: 5 });
  if (limited) return limited;

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "VALIDATION", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { firstName, lastName, phone } = parsed.data;

  await prisma.user.update({
    where: { email: session.user.email },
    data: { firstName, lastName, phone },
  });

  // Force NextAuth à rafraîchir le JWT côté client si tu appelles session.update()
  return NextResponse.json({ ok: true });
}
