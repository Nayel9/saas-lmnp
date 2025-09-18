import { NextRequest } from "next/server";
import { getPlainVerificationToken, storePlainVerificationToken } from "@/lib/auth/emailVerificationStore";
import { prisma } from "@/lib/prisma";
import { generateVerificationToken } from "@/lib/mailer/brevo";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return new Response("Forbidden", { status: 403 });
  }
  const url = new URL(req.url);
  const email = url.searchParams.get("email");
  if (!email)
    return new Response(JSON.stringify({ error: "email param requis" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  // Try in-memory store first
  let token = getPlainVerificationToken(email);
  if (!token) {
    // Dev/test convenience: regenerate a fresh token if not found in memory
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user)
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    await prisma.verificationToken.deleteMany({ where: { identifier: email } }).catch(() => {});
    const gen = generateVerificationToken();
    await prisma.verificationToken.create({
      data: { identifier: email, token: gen.hash, expires: gen.expires },
    });
    storePlainVerificationToken(email, gen.token);
    token = gen.token;
  }
  return new Response(JSON.stringify({ email, token }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
