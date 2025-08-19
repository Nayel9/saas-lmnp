import {createServerClient} from "@supabase/ssr";
import {type NextRequest, NextResponse} from "next/server";
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
export function createSupabaseMiddleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options) {
          // Met à jour le cookie côté réponse (et redérive une nouvelle response)
            response = NextResponse.next({ request: { headers: request.headers } });
            response.cookies.set(name, value, { ...secureCookieBase, ...options });
        },
        remove(name: string, options) {
            response = NextResponse.next({ request: { headers: request.headers } });
            response.cookies.set(name, "", { ...secureCookieBase, ...options, maxAge: 0 });
        },
      },
    },
  );
  return { supabase, response };
}
