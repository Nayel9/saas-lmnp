"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getUserRole } from "@/lib/auth";
import Image from 'next/image';

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
    router.replace('/');
  };

  if (hide) return null;

  const role = getUserRole(user);
  const linkClass = (target: string) => {
    const active = pathname === target;
    return `px-3 py-2 rounded-md text-sm font-medium transition-colors focus-visible:ring-2 ring-[--color-ring] outline-none ${active ? 'bg-bg-muted text-brand' : 'hover:bg-bg-muted'}`;
  };

  return (
    <nav className="w-full border-b border-border bg-bg backdrop-blur flex items-center justify-between px-4 h-14" aria-label="Navigation principale">
      <div className="flex items-center gap-3">
        <Link href="/" className="font-semibold text-sm tracking-tight focus-visible:ring-2 ring-[--color-ring] outline-none flex items-center gap-2" aria-label="Accueil" title="Accueil LMNP App" aria-current={pathname==='/'? 'page':undefined}>
          <Image src="/LMNPlus_logo_variant_2.png" alt="LMNP App" width={200} height={100} priority className="rounded-[--radius-sm] object-contain" />
          <span className="sr-only">LMNP App</span>
        </Link>
        <div className="flex items-center gap-1 ml-2">
          {user && <Link href="/dashboard" aria-current={pathname==='/dashboard'? 'page':undefined} className={linkClass('/dashboard')}>Dashboard</Link>}
          {user && <Link href="/journal/achats" aria-current={pathname==='/journal/achats'? 'page':undefined} className={linkClass('/journal/achats')}>Journal Achats</Link>}
          {user && <Link href="/journal/ventes" aria-current={pathname==='/journal/ventes'? 'page':undefined} className={linkClass('/journal/ventes')}>Journal Ventes</Link>}
          {user && <Link href="/assets" aria-current={pathname==='/assets'? 'page':undefined} className={linkClass('/assets')}>Immobilisations</Link>}
          {user && role === 'admin' && <Link href="/admin" aria-current={pathname==='/admin'? 'page':undefined} className={linkClass('/admin')}>Admin</Link>}
          {user && role === 'admin' && <Link href="/reports/balance" aria-current={pathname==='/reports/balance'? 'page':undefined} className={linkClass('/reports/balance')}>Balance</Link>}
        </div>
      </div>
      <div className="flex items-center gap-3 text-sm">
        {user ? (
          <>
            <span className="text-muted-foreground hidden sm:inline">{user.email}{role === 'admin' ? ' (admin)' : ''}</span>
            <button onClick={logout} className="btn-ghost px-3 py-1.5 text-xs" aria-label="Se déconnecter">Déconnexion</button>
          </>
        ) : (
          <Link href="/login" className="btn-primary px-3 py-1.5 text-xs" aria-label="Aller à la page de connexion">Connexion</Link>
        )}
      </div>
    </nav>
  );
}
