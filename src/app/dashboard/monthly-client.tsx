"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import TWSpinner from "@/components/ui/loader/spinner";

type PropertyOpt = { id: string; label: string };

function formatEUR(n: number) {
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
  } catch {
    return n.toFixed(2);
  }
}

export default function DashboardMonthlyClient({ properties }: { properties: PropertyOpt[] }) {
  const router = useRouter();
  const search = useSearchParams();
  const [propertyId, setPropertyId] = useState<string>(
    search.get("property") || properties[0]?.id || "",
  );
  const [scope, setScope] = useState<"user" | "property">(
    search.get("scope") === "property" ? "property" : "user",
  );
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const currentMonth = useMemo(() => new Date().getMonth() + 1, []);
  const [year, setYear] = useState<number>(() => parseInt(search.get("year") || String(currentYear), 10));
  const [month, setMonth] = useState<number>(() => parseInt(search.get("month") || String(currentMonth), 10));

  const years = useMemo(() => {
    const cy = currentYear;
    const arr: number[] = [];
    for (let y = cy + 1; y >= cy - 10; y--) arr.push(y);
    return arr;
  }, [currentYear]);

  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    incoming: number;
    outgoing: number;
    result: number;
    amortPosted: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [posting, setPosting] = useState(false);

  const q = useMemo(() => {
    const p = new URLSearchParams();
    if (propertyId) p.set("property", propertyId);
    if (year) p.set("year", String(year));
    if (month) p.set("month", String(month).padStart(2, "0"));
    if (scope) p.set("scope", scope);
    return p.toString();
  }, [propertyId, year, month, scope]);

  useEffect(() => {
    const url = `/dashboard${q ? `?${q}` : ""}`;
    router.replace(url, { scroll: false });
  }, [q, router]);

  useEffect(() => {
    async function load() {
      if (!propertyId) {
        setData(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/dashboard/monthly?property=${encodeURIComponent(propertyId)}&year=${year}&month=${String(month).padStart(2, "0")}&scope=${scope}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          const txt = await res.text();
          setError(txt || `Erreur ${res.status}`);
          setData(null);
          return;
        }
        const j = await res.json();
        setData({
          incoming: Number(j.incoming ?? 0),
          outgoing: Number(j.outgoing ?? 0),
          result: Number(j.result ?? 0),
          amortPosted: Boolean(j.amortPosted),
        });
      } catch {
        setError("Erreur");
        setData(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [propertyId, year, month, scope]);

  return (
    <section className="space-y-4">
      <form className="grid sm:grid-cols-4 gap-3 items-end">
        <label className="space-y-1">
          <div className="text-sm font-medium">Portée</div>
          <select
            aria-label="Portée"
            value={scope}
            onChange={(e) => setScope(e.target.value === "property" ? "property" : "user")}
            className="input w-full"
          >
            <option value="user">Utilisateur (tous biens)</option>
            <option value="property">Bien</option>
          </select>
        </label>
        <label className="space-y-1">
          <div className="text-sm font-medium">Bien</div>
          <select
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            className="input w-full"
          >
            <option value="">Sélectionne…</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <div className="text-sm font-medium">Mois</div>
          <select
            aria-label="Mois"
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value, 10) || currentMonth)}
            className="input w-full"
          >
            {months.map((m) => (
              <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <div className="text-sm font-medium">Année</div>
          <select
            aria-label="Année"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value, 10) || currentYear)}
            className="input w-full"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </label>
      </form>

      {!propertyId && (
        <div className="text-sm text-muted-foreground">Sélectionne un bien</div>
      )}

      {propertyId && (
        loading ? (
          <div className="flex items-center justify-center py-6"><TWSpinner /></div>
        ) : error ? (
          <div className="text-sm text-[--color-danger]">{error}</div>
        ) : data ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="card p-4">
              <div className="text-sm text-muted-foreground">Encaissements (mois)</div>
              <div className="text-xl font-semibold mt-1">{formatEUR(data.incoming)}</div>
            </div>
            <div className="card p-4">
              <div className="text-sm text-muted-foreground">Dépenses (mois)</div>
              <div className="text-xl font-semibold mt-1">{formatEUR(data.outgoing)}</div>
            </div>
            <div className="card p-4">
              <div className="text-sm text-muted-foreground">Résultat (mois)</div>
              <div className="text-xl font-semibold mt-1">{formatEUR(data.result)}</div>
            </div>
            <div className="card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Amortissement du mois</div>
                  {data.amortPosted ? (
                    <span className="inline-flex items-center mt-1 text-xs px-2 py-1 rounded bg-green-100 text-green-800">OK</span>
                  ) : (
                    <span className="inline-flex items-center mt-1 text-xs px-2 py-1 rounded bg-amber-100 text-amber-800">À poster</span>
                  )}
                </div>
                {!data.amortPosted && (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => setConfirmOpen(true)}
                  >
                    Poster l’amortissement
                  </button>
                )}
              </div>
              {confirmOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                  <div className="bg-card rounded-md shadow-md w-full max-w-md p-5 space-y-4">
                    <h3 className="text-lg font-medium">Confirmer</h3>
                    <p className="text-sm text-muted-foreground">
                      Poster l’amortissement de {String(month).padStart(2, "0")}/{year} pour le bien sélectionné ?
                    </p>
                    <div className="flex justify-end gap-2">
                      <button className="btn" type="button" onClick={() => setConfirmOpen(false)} disabled={posting}>Annuler</button>
                      <button
                        className="btn-primary"
                        type="button"
                        disabled={posting}
                        onClick={async () => {
                          setPosting(true);
                          try {
                            const res = await fetch('/api/amortizations/post-month', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ propertyId, year, month, scope: 'property' }),
                            });
                            if (!res.ok) {
                              const t = await res.text().catch(()=> 'Erreur');
                              throw new Error(t || `HTTP ${res.status}`);
                            }
                            const j = await res.json();
                            toast.success(`Amortissement posté (${j.createdCount} créé(s), ${j.skippedCount} déjà présent(s))`);
                            setConfirmOpen(false);
                            const ref = await fetch(`/api/dashboard/monthly?property=${encodeURIComponent(propertyId)}&year=${year}&month=${String(month).padStart(2, '0')}&scope=${scope}`, { cache: 'no-store' });
                            const jj = await ref.json();
                            setData({ incoming: Number(jj.incoming||0), outgoing: Number(jj.outgoing||0), result: Number(jj.result||0), amortPosted: Boolean(jj.amortPosted) });
                          } catch {
                            toast.error('Échec du post');
                          } finally {
                            setPosting(false);
                          }
                        }}
                      >
                        {posting ? '…' : 'Confirmer'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Aucune donnée pour ce mois.</div>
        )
      )}
    </section>
  );
}
