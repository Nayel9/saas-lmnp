"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getUserRole } from "@/lib/auth";

export function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const hide = pathname === "/login"; // garder la logique d'affichage

  useEffect(() => {
    if (hide) return; // ne pas initialiser sur /login
    const client = getSupabaseBrowserClient();
    setSupabase(client);
    let active = true;
    client.auth.getUser().then(({ data }) => { if (active) setUser(data.user ?? null); });
    const { data: sub } = client.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [hide]);

  const logout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.replace('/login');
  };

  if (hide) return null;

  const role = getUserRole(user);
  const linkClass = (target: string) => `px-3 py-2 rounded-md text-sm font-medium ${pathname === target ? 'bg-gray-200' : 'hover:bg-gray-100'}`;

  return (
    <nav className="w-full border-b bg-white/70 backdrop-blur flex items-center justify-between px-4 h-12">
      <div className="flex items-center gap-2">
        <Link href="/" className="font-semibold text-sm tracking-tight">LMNP</Link>
        <div className="flex items-center gap-1 ml-2">
          <Link href="/" className={linkClass('/')}>Accueil</Link>
          {user && <Link href="/dashboard" className={linkClass('/dashboard')}>Dashboard</Link>}
          {user && role === 'admin' && <Link href="/admin" className={linkClass('/admin')}>Admin</Link>}
        </div>
      </div>
      <div className="flex items-center gap-3 text-sm">
        {user ? (
          <>
            <span className="text-gray-600 hidden sm:inline">{user.email}{role === 'admin' ? ' (admin)' : ''}</span>
            <button onClick={logout} className="px-3 py-1.5 rounded-md bg-gray-900 text-white text-xs font-medium hover:bg-gray-800">Déconnexion</button>
          </>
        ) : (
          <Link href="/login" className="px-3 py-1.5 rounded-md bg-gray-900 text-white text-xs font-medium hover:bg-gray-800">Connexion</Link>
        )}
      </div>
    </nav>
  );
}
