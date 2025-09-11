"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { markRentPaid, unmarkRentPaid } from "./actions";
import TWSpinner from "@/components/ui/loader/spinner";
import { toast } from "sonner";

function formatEUR(n: number) {
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
  } catch {
    return n.toFixed(2);
  }
}

function toISODate(d: string | Date): string {
  const dd = new Date(d);
  return dd.toISOString().slice(0, 10);
}

type UnpaidDto = { id: string; date: string | Date; amount: number; tenant: string | null };
type NoDocDto = { id: string; date: string | Date; amount: number; supplier: string | null };

type Scope = "user" | "property";

export default function DashboardTodoClient() {
  const search = useSearchParams();
  const propertyId = search.get("property") || "";
  const scope: Scope = (search.get("scope") === "property" ? "property" : "user");
  const year = parseInt(search.get("year") || String(new Date().getFullYear()), 10);
  const month = parseInt(search.get("month") || String(new Date().getMonth() + 1), 10);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    unpaidRents: UnpaidDto[];
    expensesWithoutDocs: NoDocDto[];
    recentlyPaidRents: UnpaidDto[];
    depositsHeld: { total: number; count: number };
  } | null>(null);

  const q = useMemo(() => {
    const p = new URLSearchParams();
    if (scope === "property" && propertyId) p.set("property", propertyId);
    p.set("scope", scope);
    if (year) p.set("year", String(year));
    if (month) p.set("month", String(month).padStart(2, "0"));
    return p.toString();
  }, [propertyId, year, month, scope]);

  useEffect(() => {
    async function load() {
      if (scope === "property" && !propertyId) {
        setData(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/dashboard/todo?${q}`, { cache: "no-store" });
        if (!res.ok) {
          const txt = await res.text();
          setError(txt || `Erreur ${res.status}`);
          setData(null);
          return;
        }
        const j = await res.json();
        setData(j);
      } catch {
        setError("Erreur");
        setData(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [q, propertyId, scope]);

  if (scope === "property" && !propertyId) {
    return <div className="text-sm text-muted-foreground">Sélectionne un bien pour voir les tâches.</div>;
  }

  if (loading) return <div className="flex items-center justify-center py-6"><TWSpinner /></div>;
  if (error) return <div className="text-sm text-[--color-danger]">{error}</div>;
  if (!data) return <div className="text-sm text-muted-foreground">Aucune tâche.</div>;

  const { unpaidRents, expensesWithoutDocs, recentlyPaidRents, depositsHeld } = data;
  const empty = unpaidRents.length === 0 && expensesWithoutDocs.length === 0 && recentlyPaidRents.length === 0 && depositsHeld.count === 0;

  return (
    <div className="card p-4 space-y-4">
      <h2 className="text-lg font-medium">À faire</h2>
      {empty ? (
        <div className="text-sm text-muted-foreground">Rien à signaler 🎉</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          <section>
            <h3 className="font-medium mb-2">Loyers non encaissés</h3>
            {unpaidRents.length === 0 ? (
              <div className="text-sm text-muted-foreground">Aucun</div>
            ) : (
              <ul className="space-y-2 text-sm">
                {unpaidRents.map((r) => {
                  const day = toISODate(r.date);
                  const qTxt = r.tenant ? encodeURIComponent(r.tenant) : "";
                  const openHref = `/journal/ventes?from=${day}&to=${day}${qTxt ? `&q=${qTxt}` : ""}`;
                  return (
                    <li key={r.id} className="flex items-center justify-between gap-3">
                      <div className="truncate">
                        <div className="font-medium truncate">{r.tenant || "Locataire"}</div>
                        <div className="text-muted-foreground text-xs">{new Date(r.date).toLocaleDateString("fr-FR")} · {formatEUR(r.amount)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link className="btn" href={openHref}>Ouvrir</Link>
                        <button
                          className="btn-primary"
                          onClick={async () => {
                            const t = toast("Marquage en cours…");
                            try {
                              await markRentPaid(r.id);
                              const res = await fetch(`/api/dashboard/todo?${q}`, { cache: "no-store" });
                              const j = await res.json();
                              setData(j);
                              toast.success("Marqué encaissé", {
                                action: {
                                  label: "Annuler",
                                  onClick: async () => {
                                    try {
                                      await unmarkRentPaid(r.id);
                                      const res2 = await fetch(`/api/dashboard/todo?${q}`, { cache: "no-store" });
                                      const j2 = await res2.json();
                                      setData(j2);
                                      toast.success("Annulé");
                                    } catch {
                                      toast.error("Échec de l’annulation");
                                    }
                                  },
                                },
                              });
                            } catch {
                              toast.error("Échec du marquage");
                            } finally {
                              toast.dismiss(t);
                            }
                          }}
                        >
                          Marquer encaissé
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <section>
            <h3 className="font-medium mb-2">Dépenses sans justificatif</h3>
            {expensesWithoutDocs.length === 0 ? (
              <div className="text-sm text-muted-foreground">Aucune</div>
            ) : (
              <ul className="space-y-2 text-sm">
                {expensesWithoutDocs.map((e) => {
                  const day = toISODate(e.date);
                  const qTxt = e.supplier ? encodeURIComponent(e.supplier) : "";
                  const openHref = `/journal/achats?from=${day}&to=${day}${qTxt ? `&q=${qTxt}` : ""}`;
                  return (
                    <li key={e.id} className="flex items-center justify-between gap-3">
                      <div className="truncate">
                        <div className="font-medium truncate">{e.supplier || "Fournisseur"}</div>
                        <div className="text-muted-foreground text-xs">{new Date(e.date).toLocaleDateString("fr-FR")} · {formatEUR(e.amount)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span title="Pièce jointe manquante" className="text-base opacity-70">📎̶</span>
                        <Link className="btn-primary" href={openHref}>Ajouter justificatif</Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <section className="md:col-span-2">
            <h3 className="font-medium mb-2">Récemment encaissés</h3>
            {recentlyPaidRents.length === 0 ? (
              <div className="text-sm text-muted-foreground">Aucun</div>
            ) : (
              <ul className="space-y-2 text-sm">
                {recentlyPaidRents.map((r) => {
                  const day = toISODate(r.date);
                  const qTxt = r.tenant ? encodeURIComponent(r.tenant) : "";
                  const openHref = `/journal/ventes?from=${day}&to=${day}${qTxt ? `&q=${qTxt}` : ""}`;
                  return (
                    <li key={r.id} className="flex items-center justify-between gap-3">
                      <div className="truncate">
                        <div className="font-medium truncate">{r.tenant || "Locataire"}</div>
                        <div className="text-muted-foreground text-xs">{new Date(r.date).toLocaleDateString("fr-FR")} · {formatEUR(r.amount)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link className="btn" href={openHref}>Ouvrir</Link>
                        <button
                          className="btn"
                          onClick={async () => {
                            const t = toast("Annulation en cours…");
                            try {
                              await unmarkRentPaid(r.id);
                              const res = await fetch(`/api/dashboard/todo?${q}`, { cache: "no-store" });
                              const j = await res.json();
                              setData(j);
                              toast.success("Encaissement annulé");
                            } catch {
                              toast.error("Échec de l’annulation");
                            } finally {
                              toast.dismiss(t);
                            }
                          }}
                        >
                          Annuler l’encaissement
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <section className="md:col-span-2">
            <h3 className="font-medium mb-2">Cautions en cours</h3>
            <div className="flex items-center gap-3 text-sm">
              <span className="badge">{depositsHeld.count}</span>
              <span>Total: <strong>{formatEUR(depositsHeld.total)}</strong></span>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
