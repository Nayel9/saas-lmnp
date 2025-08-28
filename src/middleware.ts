// middleware.ts (NextAuth v5)
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth/core";
import { getUserRole } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Exclusions (assets/api/onboarding lui-même)
  const isExcluded =
    path.startsWith("/_next") ||
    path.startsWith("/api") ||
    path.startsWith("/static") ||
    path === "/favicon.ico" ||
    path.startsWith("/onboarding/profile");

  if (isExcluded) return NextResponse.next();

  const session = await auth();
  const user = session?.user as { role?: string; needsProfile?: boolean; isSso?: boolean } | undefined;

  // 1) Redirection onboarding seulement pour SSO si profil incomplet
  if (user?.isSso && user?.needsProfile) {
    const url = new URL("/onboarding/profile", request.url);
    return NextResponse.redirect(url);
  }

  // 2) Tes règles d’accès existantes
  if (path.startsWith("/dashboard") || path.startsWith("/admin") || path.startsWith("/reports")) {
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if ((path.startsWith("/admin") || path.startsWith("/reports")) && getUserRole(user) !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

// Matcher “global” conseillé : applique le middleware partout sauf assets/api
export const config = {
  matcher: ["/((?!_next|api|static|favicon.ico).*)"],
};
