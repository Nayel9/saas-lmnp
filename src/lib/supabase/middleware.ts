import {env} from "@/lib/env";

const secureCookieBase = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

/**
 * Fabrique un client Supabase pour le middleware (Edge) tout en conservant la capacité de définir/supprimer les cookies.
 */
// Supabase retiré – middleware neutralisé.
export function createSupabaseMiddleware() {
  throw new Error('Supabase retiré');
}
