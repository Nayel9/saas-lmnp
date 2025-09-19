// src/config/nav.config.ts
import type { ComponentType } from "react";

export type NavItem = {
  label: string;
  href: string;
  icon?: ComponentType<{ className?: string }>;
  section: "main" | "secondary";
  requires?: { plan?: "free" | "pro"; auth?: boolean };
  match?: "startsWith" | "exact";
  disabled?: boolean;
};

export const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    section: "main",
    requires: { auth: true },
    match: "exact",
  },
  {
    label: "Ventes",
    href: "/journal/ventes",
    section: "main",
    requires: { auth: true },
    match: "startsWith",
  },
  {
    label: "Achats",
    href: "/journal/achats",
    section: "main",
    requires: { auth: true },
    match: "startsWith",
  },
  {
    label: "Immobilisations",
    href: "/assets",
    section: "main",
    requires: { auth: true, plan: "pro" },
    match: "startsWith",
  },
  {
    label: "Synthèse",
    href: "/synthesis",
    section: "main",
    requires: { auth: true },
    match: "startsWith",
  },
  {
    label: "Paramètres",
    href: "/settings/accounts",
    section: "main",
    requires: { auth: true },
    match: "startsWith",
  },
  // secondaires
  {
    label: "Profil",
    href: "/settings/accounting",
    section: "secondary",
    requires: { auth: true },
    match: "startsWith",
  },
  {
    label: "Contact",
    href: "/",
    section: "secondary",
    match: "exact",
  },
  {
    label: "Plans",
    href: "/settings/accounting#plan",
    section: "secondary",
    match: "startsWith",
  },
];

export type NavConfig = typeof navItems;

export function isActive(pathname: string, item: NavItem): boolean {
  const mode = item.match ?? "exact";
  if (mode === "startsWith") return pathname.startsWith(item.href);
  return pathname === item.href;
}

