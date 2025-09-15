import Link from "next/link";

export const metadata = { title: "Non authentifié" };

export default function Page401() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">401 – Authentification requise</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Vous devez être connecté pour accéder à cette ressource.
        </p>
      </div>
      <div className="flex gap-3">
        <Link href="/login" className="btn">Se connecter</Link>
        <Link href="/dashboard" className="btn btn-ghost">Retour au Dashboard</Link>
      </div>
    </main>
  );
}

