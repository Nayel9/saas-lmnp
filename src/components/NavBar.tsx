"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import Image from "next/image";
import { getUserRole } from "@/lib/auth";

export function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user;
  const minimal = pathname === "/login"; // variante minimale sur /login
  const role = getUserRole(user);

  if (minimal) {
    return (
      <nav
        className="w-full border-b border-border bg-bg backdrop-blur flex items-center justify-between px-4 h-14"
        aria-label="Navigation minimale"
      >
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="font-semibold text-sm tracking-tight focus-visible:ring-2 ring-[--color-ring] outline-none flex items-center gap-2"
            aria-label="Accueil"
            title="Accueil LMNP App"
          >
            <Image
              src="/LMNPlus_logo_variant_2.png"
              alt="LMNP App"
              width={160}
              height={60}
              priority
              className="rounded-[--radius-sm] object-contain"
            />
            <span className="sr-only">LMNP App</span>
          </Link>
          <Link
            href="/"
            className="px-3 py-2 rounded-md text-sm font-medium transition-colors focus-visible:ring-2 ring-[--color-ring] outline-none hover:bg-bg-muted"
          >
            Accueil
          </Link>
        </div>
      </nav>
    );
  }

  const logout = async () => {
    await signOut({ redirect: false });
    router.replace("/");
  };

  const linkClass = (target: string) => {
    const active = pathname === target;
    return `px-3 py-2 rounded-md text-sm font-medium transition-colors focus-visible:ring-2 ring-[--color-ring] outline-none ${active ? "bg-bg-muted text-brand" : "hover:bg-bg-muted"}`;
  };

  const displayName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.email;

  return (
    <nav
      className="w-full border-b border-border bg-bg backdrop-blur flex items-center justify-between px-4 h-14"
      aria-label="Navigation principale"
    >
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="font-semibold text-sm tracking-tight focus-visible:ring-2 ring-[--color-ring] outline-none flex items-center gap-2"
          aria-label="Accueil"
          title="Accueil LMNP App"
        >
          <Image
            src="/LMNPlus_logo_variant_2.png"
            alt="LMNP App"
            width={160}
            height={60}
            priority
            className="rounded-[--radius-sm] object-contain"
          />
          <span className="sr-only">LMNP App</span>
        </Link>
        <div className="flex items-center gap-1 ml-2">
          {user && (
            <Link
              href="/dashboard"
              aria-current={pathname === "/dashboard" ? "page" : undefined}
              className={linkClass("/dashboard")}
            >
              Dashboard
            </Link>
          )}
          {user && (
            <Link
              href="/journal/achats"
              aria-current={pathname === "/journal/achats" ? "page" : undefined}
              className={linkClass("/journal/achats")}
            >
              Journal Achats
            </Link>
          )}
          {user && (
            <Link
              href="/journal/ventes"
              aria-current={pathname === "/journal/ventes" ? "page" : undefined}
              className={linkClass("/journal/ventes")}
            >
              Journal Ventes
            </Link>
          )}
          {user && (
            <Link
              href="/assets"
              aria-current={pathname === "/assets" ? "page" : undefined}
              className={linkClass("/assets")}
            >
              Immobilisations
            </Link>
          )}
          {user && (
            <Link
              href="/synthesis"
              aria-current={pathname === "/synthesis" ? "page" : undefined}
              className={linkClass("/synthesis")}
            >
              Synthèse
            </Link>
          )}
          {user && role === "admin" && (
            <Link
              href="/admin"
              aria-current={pathname === "/admin" ? "page" : undefined}
              className={linkClass("/admin")}
            >
              Admin
            </Link>
          )}
          {user && role === "admin" && (
            <Link
              href="/reports/balance"
              aria-current={
                pathname === "/reports/balance" ? "page" : undefined
              }
              className={linkClass("/reports/balance")}
            >
              Balance
            </Link>
          )}
        </div>
      </div>
      {user && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">{displayName}</span>
          <button
            onClick={logout}
            className="btn-primary px-3 py-1.5 text-xs"
            aria-label="Se déconnecter"
          >
            Déconnexion
          </button>
        </div>
      )}
      {!user && (
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="btn-primary px-3 py-1.5 text-xs"
            aria-label="Se connecter"
          >
            Connexion
          </Link>
        </div>
      )}
    </nav>
  );
}
