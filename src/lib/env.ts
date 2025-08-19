// Centralisation minimale des variables publiques nécessaires au client / serveur
const isTest = process.env.NODE_ENV === 'test';
const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const rawAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const NEXT_PUBLIC_SUPABASE_URL = rawUrl || (isTest ? 'http://localhost:54321' : undefined);
const NEXT_PUBLIC_SUPABASE_ANON_KEY = rawAnon || (isTest ? 'test-anon-key' : undefined);

if (!NEXT_PUBLIC_SUPABASE_URL && !isTest) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL manquante dans .env");
}
if (!NEXT_PUBLIC_SUPABASE_ANON_KEY && !isTest) {
  throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY manquante dans .env");
}

export const env = {
  NEXT_PUBLIC_SUPABASE_URL: NEXT_PUBLIC_SUPABASE_URL!,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: NEXT_PUBLIC_SUPABASE_ANON_KEY!,
};
