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
 * Fabrique un client Supabase pour le middleware (Edge) tout en conservant la capacité de définir des cookies.
 */
export function createSupabaseMiddleware(request: NextRequest) {
    let response = NextResponse.next({
        request: { headers: request.headers },
    });
    const supabase = createServerClient(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll().map(({name, value}) => ({name, value}));
                },
                setAll(cookiesToSet) {
                    response = NextResponse.next({ request });
                    cookiesToSet.forEach(({name, value, options}) => {
                        response.cookies.set(name, value, { ...secureCookieBase, ...options });
                    });
                },
            },
        },
    );
    return {supabase, response};
}
