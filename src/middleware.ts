// middleware.ts (NextAuth v5)
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth/core";

// Routes publiques explicites (pages)
const PUBLIC_PAGE_PATHS = new Set([
  "/", // landing
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
]);

// Préfixes publics (tout ce qui est sous /public/* )
const PUBLIC_PREFIXES = ["/public/"];

// Préfixes de pages protégées (remplacé par logique d'exclusion globale)
// const PROTECTED_PAGE_PREFIXES = [ ... ] // supprimé

// Routes publiques explicites
const PUBLIC_STATIC_PREFIXES = ["/_next", "/static"]; // assets

function isApiPath(path: string) {
  return path.startsWith("/api");
}
function isAuthApi(path: string) {
  return path.startsWith("/api/auth");
}
function isPublicApi(path: string) {
  return path.startsWith("/api/public");
}

export async function middleware(request: NextRequest) {
  const { nextUrl } = request;
  const path = nextUrl.pathname;

  // Exclusions basiques (static files ext)
  if (
    PUBLIC_STATIC_PREFIXES.some((p) => path.startsWith(p)) ||
    path === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Pages publiques exactes
  const isPublicExact = PUBLIC_PAGE_PATHS.has(path);
  const isPublicPrefixed = PUBLIC_PREFIXES.some((p) => path.startsWith(p));

  // API publique /auth
  const api = isApiPath(path);
  const apiAuth = api && isAuthApi(path);
  const apiPublic = api && isPublicApi(path);

  // Besoin session ? Toute page non publique (hors API & exclusions) nécessite auth
  const needsProtectionPage = !api && !isPublicExact && !isPublicPrefixed;
  const needsProtectionApi = api && !apiAuth && !apiPublic; // API protégées

  if (!needsProtectionPage && !needsProtectionApi) {
    // Cas spécial: déjà connecté allant sur /login -> rediriger dashboard
    if (isPublicExact && path === "/login") {
      const session = await auth();
      if (session?.user) {
        return NextResponse.redirect(new URL("/dashboard", request.url), { status: 302 });
      }
    }
    return NextResponse.next();
  }

  const session = await auth();
  const user = session?.user as { id?: string } | undefined;
  if (!user?.id) {
    if (api) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Redirection vers /login?next=...
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", path + (nextUrl.search || ""));
    return NextResponse.redirect(loginUrl, { status: 302 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Inclure /api maintenant pour appliquer la protection centrale
    "/((?!_next|static|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|txt|xml|map)).*)",
  ],
};
