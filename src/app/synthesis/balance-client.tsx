"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import TWSpinner from "@/components/ui/loader/spinner";
import { toast } from "sonner";

type PropertyOpt = { id: string; label: string };

function formatMoney(n: number) {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(n);
  } catch {
    return n.toFixed(2);
  }
}

export default function BalanceClient({
  properties,
  defaultYear,
}: {
  properties: PropertyOpt[];
  defaultYear: number;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const [propertyId, setPropertyId] = useState<string>(
    search.get("property") || properties[0]?.id || "",
  );
  const [scope, setScope] = useState<"user" | "property">(
    search.get("scope") === "property" ? "property" : "user",
  );
  const [year, setYear] = useState<number>(() =>
    parseInt(search.get("year") || String(defaultYear), 10),
  );

  const years = useMemo(() => {
    const cy = defaultYear;
    const start = cy - 10;
    const arr: number[] = [];
    for (let y = cy + 1; y >= start; y--) arr.push(y);
    return arr;
  }, [defaultYear]);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    actif: { vnc: number; treso: number; total: number };
    passif: { cautions: number; dettes: number; total: number };
    ecart: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const q = useMemo(() => {
    const p = new URLSearchParams();
    if (propertyId) p.set("property", propertyId);
    if (year) p.set("year", String(year));
    if (scope) p.set("scope", scope);
    p.set("tab", "balance");
    return p.toString();
  }, [propertyId, year, scope]);

  useEffect(() => {
    const url = `/synthesis${q ? `?${q}` : ""}`;
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
          `/api/synthesis/balance?property=${encodeURIComponent(propertyId)}&year=${year}&scope=${scope}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          const txt = await res.text();
          setError(txt || `Erreur ${res.status}`);
          setData(null);
          return;
        }
        const j = await res.json();
        setData({ actif: j.actif, passif: j.passif, ecart: j.ecart });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Erreur";
        setError(msg);
        setData(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [propertyId, year, scope]);

  return (
    <div className="space-y-4">
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
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <div className="text-sm font-medium">Année</div>
          <select
            aria-label="Année"
            value={year}
            onChange={(e) =>
              setYear(parseInt(e.target.value, 10) || defaultYear)
            }
            className="input w-full"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        {(search.get("property") || search.get("year")) && (
          <div>
            <a href="/synthesis?tab=balance" className="underline text-sm">
              Réinitialiser
            </a>
          </div>
        )}
      </form>

      {/* Barre d'actions Export */}
      <div className="flex gap-3 items-center">
        <button
          type="button"
          className="btn-outline text-sm"
          disabled={!propertyId}
          onClick={async () => {
            if (!propertyId) {
              toast.error("Sélectionne un bien");
              return;
            }
            const q = new URLSearchParams({
              property: propertyId,
              year: String(year),
              scope,
            });
            const url = `/api/synthesis/export/pdf?${q.toString()}`;
            const t = toast("Export PDF en cours…");
            try {
              const a = document.createElement("a");
              a.href = url;
              a.download = "";
              document.body.appendChild(a);
              a.click();
              a.remove();
              toast.success("Export prêt");
            } catch {
              toast.error("Export échoué");
            } finally {
              toast.dismiss(t);
            }
          }}
        >
          Exporter PDF
        </button>
        <button
          type="button"
          className="btn-outline text-sm"
          disabled={!propertyId}
          onClick={async () => {
            if (!propertyId) {
              toast.error("Sélectionne un bien");
              return;
            }
            const q = new URLSearchParams({
              property: propertyId,
              year: String(year),
              scope,
            });
            const url = `/api/synthesis/export/csv?${q.toString()}`;
            const t = toast("Export CSV en cours…");
            try {
              const a = document.createElement("a");
              a.href = url;
              a.download = "";
              document.body.appendChild(a);
              a.click();
              a.remove();
              toast.success("Export prêt");
            } catch {
              toast.error("Export échoué");
            } finally {
              toast.dismiss(t);
            }
          }}
        >
          Exporter CSV
        </button>
      </div>

      {!propertyId && (
        <div className="text-sm text-muted-foreground">Sélectionne un bien</div>
      )}

      {propertyId &&
        (loading ? (
          <div className="flex items-center justify-center py-6">
            <TWSpinner />
          </div>
        ) : error ? (
          <div className="text-sm text-[--color-danger]">{error}</div>
        ) : data ? (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="card p-4 text-sm">
              <h3 className="font-semibold mb-3">Actif</h3>
              <table className="w-full">
                <tbody>
                  <tr>
                    <td className="py-1 pr-4">
                      Immobilisations (valeur restante)
                    </td>
                    <td className="py-1 text-right tabular-nums">
                      {formatMoney(data.actif.vnc)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-4">Trésorerie (année)</td>
                    <td className="py-1 text-right tabular-nums">
                      {formatMoney(data.actif.treso)}
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="font-semibold border-t">
                    <td className="py-2 pr-4">Total Actif</td>
                    <td className="py-2 text-right tabular-nums">
                      {formatMoney(data.actif.total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="card p-4 text-sm">
              <h3 className="font-semibold mb-3">Passif</h3>
              <table className="w-full">
                <tbody>
                  <tr>
                    <td className="py-1 pr-4">Cautions détenues</td>
                    <td className="py-1 text-right tabular-nums">
                      {formatMoney(data.passif.cautions)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-4">Autres dettes</td>
                    <td className="py-1 text-right tabular-nums">
                      {formatMoney(data.passif.dettes)}
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="font-semibold border-t">
                    <td className="py-2 pr-4">Total Passif</td>
                    <td className="py-2 text-right tabular-nums">
                      {formatMoney(data.passif.total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            Aucune donnée pour cette période. Totaux à 0.
          </div>
        ))}

      {data && (
        <div className="text-xs text-muted-foreground">
          Équilibre:{" "}
          {Math.abs(data.actif.total - data.passif.total) < 0.01 ? (
            <span className="text-[--color-success] font-medium">OK</span>
          ) : (
            <>
              <span className="text-[--color-danger] font-medium">Écart</span>
              <span>
                {" "}
                (Écart d’ouverture:{" "}
                {formatMoney(data.actif.total - data.passif.total)})
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
