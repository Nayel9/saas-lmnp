"use client";
import React, { useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { isActive, type NavItem, navItems } from "@/config/nav.config";
import { cn } from "@/lib/utils";
import Image from "next/image";

function initials(name?: string | null, email?: string | null): string {
  if (name && name.trim().length > 0) {
    const parts = name.trim().split(/\s+/);
    const ini = parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("");
    return ini || (email ? (email[0]?.toUpperCase() ?? "?") : "?");
  }
  return email ? (email[0]?.toUpperCase() ?? "?") : "?";
}

function canShow(item: NavItem, isAuth: boolean): boolean {
  const req = item.requires;
  if (!req) return true;
  return !(req.auth && !isAuth);
}

function isDisabled(item: NavItem, plan: string | null | undefined): boolean {
  if (item.disabled) return true;
  const req = item.requires;
  return req?.plan === "pro" && plan !== "pro";
}

function DesktopNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user ?? null;
  const isAuth = Boolean(user?.id);
  const plan = (user?.plan as string | null | undefined) ?? null;

  useEffect(() => {
    // Debug log pour reproduire certains cas; conservé mais sans directive eslint inutile
    console.debug("[DesktopNav] render", {
      pathname,
      isAuth,
      plan,
      hasUser: !!user,
    });
  }, [pathname, isAuth, plan, user]);

  const main = useMemo(() => navItems.filter((i) => i.section === "main"), []);

  return (
    <div className="sticky top-0 z-40 w-full border-b border-border bg-bg/80 backdrop-blur-md supports-[backdrop-filter]:bg-bg/60">
      <div className="mx-auto max-w-screen-2xl px-3">
        <nav
          data-testid="desktop-nav"
          className="h-14 flex items-center justify-between gap-3"
          role="navigation"
          aria-label="Navigation principale"
        >
          <div className="flex items-center gap-2 min-w-[120px]">
            <Link
              href="/"
              aria-label="Accueil"
              className="flex items-center gap-2 text-foreground"
            >
              <Image
                src="/LMNPlus_logo_variant_2.png"
                alt="LMNP App"
                width={120}
                height={28}
                priority
                className="h-7 w-auto dark:hidden"
              />
              <Image
                src="/LMNPlus_logo_variant_2.png"
                alt="LMNP App"
                width={120}
                height={28}
                priority
                className="h-7 w-auto hidden dark:block"
              />
              <span className="sr-only">LMNP App</span>
            </Link>
          </div>
          <div className="flex items-center justify-center">
            <ul className="flex items-center gap-1">
              {main
                .filter((i) => canShow(i, isAuth))
                .map((item) => {
                  const active = isActive(pathname, item);
                  const disabled = isDisabled(item, plan);
                  const common =
                    "px-3 py-2 rounded-md text-sm font-medium transition-colors focus-visible:ring-2 ring-[--color-ring] outline-none";
                  const isSynthesis =
                    item.href === "/synthesis" ||
                    item.label.toLowerCase() === "synthèse";
                  const isSettings = item.href === "/settings/accounts";
                  const settingsActive = pathname.startsWith("/settings");

                  if (disabled) {
                    return (
                      <li key={item.href}>
                        <span
                          aria-disabled
                          className={cn(
                            common,
                            "opacity-50 cursor-not-allowed select-none",
                          )}
                        >
                          {item.label}
                        </span>
                      </li>
                    );
                  }

                  if (isSettings) {
                    return (
                      <li key={item.href} className="relative">
                        <details className="group">
                          <summary
                            className={cn(
                              common,
                              settingsActive
                                ? "bg-bg-muted text-brand"
                                : "hover:bg-bg-muted",
                              "list-none cursor-pointer",
                            )}
                          >
                            {item.label}
                          </summary>
                          <ul className="absolute left-0 top-full mt-1 w-56 rounded-md border border-border bg-bg p-2 shadow-lg">
                            <li>
                              <Link
                                href="/settings/accounts"
                                className="block w-full text-left px-2 py-1.5 rounded hover:bg-bg-muted"
                              >
                                Comptes
                              </Link>
                            </li>
                            <li>
                              <Link
                                href="/settings/accounting"
                                className="block w-full text-left px-2 py-1.5 rounded hover:bg-bg-muted"
                              >
                                Profil
                              </Link>
                            </li>
                            <li>
                              <Link
                                href="/settings/accounting#plan"
                                className="block w-full text-left px-2 py-1.5 rounded hover:bg-bg-muted"
                              >
                                Plans
                              </Link>
                            </li>
                          </ul>
                        </details>
                      </li>
                    );
                  }

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          common,
                          active
                            ? "bg-bg-muted text-brand"
                            : "hover:bg-bg-muted",
                        )}
                      >
                        <span className="inline-flex items-center">
                          <span>{item.label}</span>
                          {isSynthesis ? (
                            <span
                              aria-hidden
                              className="ml-1 mb-3 inline-flex items-center badge badge-rounded text-xs font-semibold uppercase leading-none text-brand"
                            >
                              Pro
                            </span>
                          ) : null}
                        </span>
                      </Link>
                    </li>
                  );
                })}
            </ul>
          </div>
          <div className="flex items-center gap-3">
            {isAuth ? (
              <details
                className="relative"
              >
                <summary
                  className="flex relative items-center gap-2 outline-none focus-visible:ring-2 ring-[--color-ring] rounded-md cursor-pointer"
                >
                  <div
                    data-testid="account-menu-button"
                    className="h-8 w-8 relative items-center justify-center rounded-full bg-brand text-brand-foreground flex"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => e.stopPropagation()}
                    tabIndex={-1}
                    aria-hidden="true"
                  >
                    {initials(
                      user?.name ?? undefined,
                      user?.email ?? undefined,
                    )}
                  </div>
                </summary>
                <ul
                  style={{ top: "40px", right: "0" }}
                  className="absolute mt-1 w-56 rounded-md border border-border bg-bg p-2 shadow-lg"
                >
                  <li>
                    <Link
                      href="/settings/accounting"
                      className="block w-full text-left px-2 py-1.5 rounded hover:bg-bg-muted"
                    >
                      Profil
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/settings/accounts"
                      className="block w-full text-left px-2 py-1.5 rounded hover:bg-bg-muted"
                    >
                      Paramètres
                    </Link>
                  </li>
                  <li>
                    <button
                      onClick={() => void signOut()}
                      className="block w-full text-left px-2 py-1.5 rounded hover:bg-bg-muted"
                    >
                      Déconnexion
                    </button>
                  </li>
                </ul>
              </details>
            ) : (
              <Link
                href="/login"
                className="btn-primary px-3 py-1.5 text-xs"
                aria-label="Se connecter"
              >
                Connexion
              </Link>
            )}
          </div>
        </nav>
      </div>
    </div>
  );
}
export default DesktopNav;
