/* eslint-disable @next/next/no-css-tags */
import Providers from "./providers";
import { NavBar } from "@/components/NavBar";
import React from "react";

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="fr">
        <head>
            {/* CSS compilé par la CLI Tailwind */}
            <link rel="stylesheet" href="/tailwind.css" />
            <title></title>
        </head>
        <body className="min-h-screen flex flex-col">
        <Providers>
            <NavBar />
            <div className="flex-1">{children}</div>
        </Providers>
        </body>
        </html>
    );
}
