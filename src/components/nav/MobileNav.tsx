"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { navItems, isActive, type NavItem } from "@/config/nav.config";
import { Sheet, SheetContent, SheetTrigger, SheetClose, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";

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

export function MobileNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user ?? null;
  const isAuth = Boolean(user?.id);
  const plan = (user?.plan as string | null | undefined) ?? null;

  const mains = navItems.filter((i) => i.section === "main" && canShow(i, isAuth));
  const secs = navItems.filter((i) => i.section === "secondary" && canShow(i, isAuth));

  return (
    <div className="sticky top-0 z-50 border-b border-border bg-bg/80 backdrop-blur-md supports-[backdrop-filter]:bg-bg/60 md:hidden">
      <div className="px-3 safe-area-inset-x">
        <div className="h-14 flex items-center justify-between">
          <Link href="/" aria-label="Accueil" className="flex items-center gap-2 text-foreground">
            <Image src="/LMNPlus_logo_variant_2.png" alt="LMNP App" width={120} height={28} priority className="h-7 w-auto dark:hidden" />
            <Image src="/LMNPlus_logo_variant_2.png" alt="LMNP App" width={120} height={28} priority className="h-7 w-auto hidden dark:block" />
            <span className="sr-only">LMNP App</span>
          </Link>
          <Sheet>
            <SheetTrigger asChild>
              <button aria-label="Ouvrir le menu" className="inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-bg-muted focus-visible:ring-2 ring-[--color-ring] outline-none">
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="px-3 pt-3 pb-6">
              <SheetTitle className="sr-only">Menu de navigation</SheetTitle>
              <SheetDescription className="sr-only">Liste des liens principaux et du compte</SheetDescription>
              <div className="flex items-center justify-between px-1">
                <Link href="/" aria-label="Accueil" className="flex items-center gap-2 text-foreground">
                  <Image src="/LMNPlus_logo_variant_2.png" alt="LMNP App" width={120} height={28} priority className="h-7 w-auto" />
                </Link>
                <SheetClose asChild>
                  <button aria-label="Fermer" className="inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-bg-muted">
                    ✕
                  </button>
                </SheetClose>
              </div>
              <nav className="mt-4" role="navigation" aria-label="Navigation principale">
                <div className="text-xs uppercase tracking-wide text-muted-foreground px-2">Navigation</div>
                <ul className="mt-2">
                  {mains.map((item) => {
                    const active = isActive(pathname, item);
                    const disabled = isDisabled(item, plan);
                    const cls = cn(
                      "block px-3 py-2 rounded-md text-sm font-medium outline-none focus-visible:ring-2 ring-[--color-ring]",
                      active ? "bg-bg-muted text-brand" : "hover:bg-bg-muted",
                      disabled && "opacity-50 cursor-not-allowed",
                    );
                    const isSynthesis = item.href === "/synthesis" || item.label.toLowerCase() === "synthèse";
                    return (
                      <li key={item.href}>
                        {disabled ? (
                          <span aria-disabled className={cls}>
                            <span className="inline-flex items-center">
                              <span>{item.label}</span>
                              {isSynthesis ? (
                                <span aria-hidden className="ml-2 inline-flex items-center badge badge-rounded px-1.5 py-0.5 text-xs font-semibold uppercase leading-none text-brand">
                                  Pro
                                </span>
                              ) : null}
                            </span>
                          </span>
                        ) : (
                          <SheetClose asChild>
                            <Link href={item.href} aria-current={active ? "page" : undefined} className={cls}>
                              <span className="inline-flex items-center">
                                <span>{item.label}</span>
                                {isSynthesis ? (
                                  <span aria-hidden className="ml-2 inline-flex items-center badge badge-rounded px-1.5 py-0.5 text-xs font-semibold uppercase leading-none text-brand">
                                    Pro
                                  </span>
                                ) : null}
                              </span>
                            </Link>
                          </SheetClose>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <div className="text-xs uppercase tracking-wide text-muted-foreground px-2 mt-6">Compte</div>
                <ul className="mt-2">
                  {secs.map((item) => {
                    const active = isActive(pathname, item);
                    const disabled = isDisabled(item, plan);
                    const cls = cn(
                      "block px-3 py-2 rounded-md text-sm font-medium outline-none focus-visible:ring-2 ring-[--color-ring]",
                      active ? "bg-bg-muted text-brand" : "hover:bg-bg-muted",
                      disabled && "opacity-50 cursor-not-allowed",
                    );
                    return (
                      <li key={item.href}>
                        {disabled ? (
                          <span aria-disabled className={cls}>{item.label}</span>
                        ) : (
                          <SheetClose asChild>
                            <Link href={item.href} aria-current={active ? "page" : undefined} className={cls}>
                              {item.label}
                            </Link>
                          </SheetClose>
                        )}
                      </li>
                    );
                  })}
                  {isAuth ? (
                    <li className="mt-2">
                      <SheetClose asChild>
                        <button onClick={() => void signOut()} className="w-full text-left block px-3 py-2 rounded-md text-sm hover:bg-bg-muted">
                          Déconnexion
                        </button>
                      </SheetClose>
                    </li>
                  ) : (
                    <li className="mt-2">
                      <SheetClose asChild>
                        <Link href="/login" className="block px-3 py-2 rounded-md text-sm hover:bg-bg-muted">
                          Connexion
                        </Link>
                      </SheetClose>
                    </li>
                  )}
                </ul>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </div>
  );
}

export default MobileNav;
