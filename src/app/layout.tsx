import Providers from "./providers";

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="fr">
        <head>
            {/* CSS compilé par la CLI Tailwind */}
            <link rel="stylesheet" href="/tailwind.css" />
        </head>
        <body>
        <Providers>{children}</Providers>
        </body>
        </html>
    );
}
