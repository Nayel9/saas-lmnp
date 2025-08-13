// src/lib/supabase/server.ts
import {type CookieOptions, createServerClient} from "@supabase/ssr";
import {cookies} from "next/headers";

export function createClient() {
    const cookieStore = cookies();

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,        // ne pas fallback sur ""
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,   // idem
        {
            cookies: {
                // Nouvel adapter: getAll / setAll (plus get/set/remove)
                getAll() {
                    // Next 15 -> cookieStore.getAll() renvoie { name, value, ... }
                    return cookieStore.getAll().map(({name, value}) => ({
                        name,
                        value,
                    }));
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({name, value, options}) => {
                        // Type compatible avec Next 15 + @supabase/ssr
                        const opts = (options as CookieOptions) ?? {};
                        cookieStore.set({
                            name,
                            value,
                            ...opts,
                            path: opts.path ?? "/",
                        });
                    });
                },
            },
        }
    );
}
