// TypeScript
import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/**/*.{ts,tsx,js,jsx,html}",
    "./app/**/*.{ts,tsx,js,jsx,html}",
    "./components/**/*.{ts,tsx,js,jsx,html}",
    "./pages/**/*.{ts,tsx,js,jsx,html}",
  ],
  // Safelist: certaines classes utilitaires positionnelles peuvent être construites
  // dynamiquement ou utilisées de façon peu courante (ex: "top-full"). Si Tailwind
  // purge ne les voit pas dans les sources au moment du build, elles peuvent
  // être absentes du CSS généré — on les ajoute ici pour sécurité.
  safelist: [
    // patterns pour top/right/left/bottom (ex: top-full, right-0)
    { pattern: /^(top|right|left|bottom)-/ },
    // inset utilities (inset-0, inset-x-0, inset-y-0, inset-full...)
    { pattern: /^inset-/ },
  ],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;