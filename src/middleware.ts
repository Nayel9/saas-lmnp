// middleware.ts (NextAuth v5)
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth/core";
import { getUserRole } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { nextUrl } = request;
  const path = nextUrl.pathname;

  // // 0) Redirection www -> apex (SEO-friendly, garde le chemin & la query)
  // const host = request.headers.get("host") ?? "";
  // if (host.startsWith("www.")) {
  //   const url = new URL(request.url);
  //   url.hostname = host.slice(4); // enlève "www."
  //   return NextResponse.redirect(url, 308);
  // }

  // 1) Exclusions (assets / api / favicon / onboarding lui-même)
  const isExcluded =
    path.startsWith("/_next") ||
    path.startsWith("/api") ||
    path.startsWith("/static") ||
    path === "/favicon.ico" ||
    path.startsWith("/onboarding/profile");

  if (isExcluded) return NextResponse.next();

  // 2) Session utilisateur
  const session = await auth();
  const user = session?.user as
    | { role?: string; needsProfile?: boolean; isSso?: boolean }
    | undefined;

  // 3) Onboarding pour comptes SSO au profil incomplet
  if (user?.isSso && user?.needsProfile) {
    return NextResponse.redirect(new URL("/onboarding/profile", request.url));
  }

  // 4) Règles d’accès
  if (
    path.startsWith("/dashboard") ||
    path.startsWith("/admin") ||
    path.startsWith("/reports")
  ) {
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (
      (path.startsWith("/admin") || path.startsWith("/reports")) &&
      getUserRole(user) !== "admin"
    ) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

// Matcher : applique partout sauf assets/api/fichiers statiques courants
export const config = {
  matcher: [
    // Utiliser des groupes non-capturants pour la liste d'extensions afin d'éviter des groupes capturants
    "/((?!_next|api|static|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|txt|xml|map)).*)",
  ],
};
