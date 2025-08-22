// app/layout.tsx
import "./globals.css"; // <= c'est ça qui charge ton CSS
// import "./tailwind.css";

import Providers from "./providers";
import { NavBar } from "@/components/NavBar";
import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LMNP App – Comptabilité LMNP simple (amortissements, 2033C/E/A)",
  description:
    "Automatisez amortissements, journaux et exports fiscaux LMNP (2033C, 2033E, 2033A). Essayez gratuitement – plan gratuit 20 écritures.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const titleValue = typeof metadata.title === "string" ? metadata.title : "";

  return (
    <html lang="fr" className="scroll-smooth">
    <head>
      <meta name="description" content={metadata.description ?? undefined} />
      <title>{titleValue}</title>
    </head>
    <body className="min-h-screen flex flex-col">
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-brand focus:text-[--color-brand-foreground] focus:px-4 focus:py-2 focus:rounded-md shadow"
    >
      Aller au contenu
    </a>
    <Providers>
      <NavBar />
      <div className="flex-1">{children}</div>
    </Providers>
    </body>
    </html>
  );
}
