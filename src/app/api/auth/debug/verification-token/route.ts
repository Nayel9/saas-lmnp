import { NextRequest } from "next/server";
import { getPlainVerificationToken } from "@/lib/auth/emailVerificationStore";

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
  const token = getPlainVerificationToken(email);
  if (!token)
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  return new Response(JSON.stringify({ email, token }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
