import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

let browserClient: SupabaseClient | null = null;

/**
 * Client Supabase pour le navigateur.
 * Ne doit jamais être instancié côté serveur.
 */
export function getSupabaseBrowserClient() {
  if (typeof window === "undefined") {
    // Protection: rendu côté serveur accidentel
    throw new Error("getSupabaseBrowserClient appelé côté serveur");
  }
  if (!browserClient) {
    browserClient = createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  }
  return browserClient;
}
