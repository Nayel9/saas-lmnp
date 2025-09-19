// TypeScript
import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/**/*.{ts,tsx,js,jsx,html}",
    "./app/**/*.{ts,tsx,js,jsx,html}",
    "./components/**/*.{ts,tsx,js,jsx,html}",
    "./pages/**/*.{ts,tsx,js,jsx,html}",
  ],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;