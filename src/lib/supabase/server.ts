import {type CookieOptions, createServerClient} from "@supabase/ssr";
import {cookies} from "next/headers";
import {env} from "@/lib/env";

// Configuration centralisée des options cookies (session Supabase)
const baseCookieOptions: CookieOptions = {
  path: "/",
  sameSite: "lax",
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 30, // 30 jours (aligné sur Supabase par défaut)
};

/**
 * Client Supabase côté serveur (Server Components, Server Actions, Route Handlers).
 * N'expose que la clé anonyme (jamais la service_role ici).
 */
export async function createSupabaseServerClient() {
    const store = await cookies();
    return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
        cookies: {
            get(name: string) {
                try { return store.get(name)?.value; } catch { return undefined; }
            },
            set(name: string, value: string, options?: CookieOptions) {
                try { store.set(name, value, { ...baseCookieOptions, ...options }); } catch {/* ignore */}
            },
            remove(name: string, options?: CookieOptions) {
                try { store.set(name, "", { ...baseCookieOptions, ...options, maxAge: 0 }); } catch {/* ignore */}
            },
        },
    });
}
