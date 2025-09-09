"use client";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";

type PropertyOpt = { id: string; label: string };

export default function ExportAttachmentsClient({
  properties,
}: {
  properties: PropertyOpt[];
}) {
  const [propertyId, setPropertyId] = useState(properties[0]?.id || "");
  const [mode, setMode] = useState<"month" | "range">("month");
  const [month, setMonth] = useState<string>(() =>
    new Date().toISOString().slice(0, 7),
  ); // YYYY-MM
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const computed = useMemo(() => {
    if (mode === "month" && month) {
      const [y, m] = month.split("-").map(Number);
      const fromD = new Date(Date.UTC(y, m - 1, 1));
      const toD = new Date(Date.UTC(y, m, 0));
      return { from: isoDate(fromD), to: isoDate(toD) };
    }
    return { from, to };
  }, [mode, month, from, to]);

  function isoDate(d: Date) {
    return d.toISOString().slice(0, 10);
  }

  async function onExport(e: React.FormEvent) {
    e.preventDefault();
    if (!propertyId) {
      toast.error("Sélectionnez un bien");
      return;
    }
    const q = new URLSearchParams({
      propertyId,
      from: computed.from,
      to: computed.to,
    });
    const url = `/api/exports/attachments.zip?${q.toString()}`;
    setLoading(true);
    const t = toast("Préparation de l’archive…", {
      description: `${computed.from} → ${computed.to}`,
    });
    try {
      // démarrer un téléchargement via un lien temporaire
      const a = document.createElement("a");
      a.href = url;
      a.download = "";
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Export démarré");
    } catch (err) {
      console.error(err);
      toast.error("Export échoué");
    } finally {
      setLoading(false);
      toast.dismiss(t);
    }
  }

  return (
    <form onSubmit={onExport} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="space-y-1">
          <div className="text-sm font-medium">Bien</div>
          <select
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            className="input w-full"
          >
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <div className="space-y-2">
          <div className="text-sm font-medium">Mode</div>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="mode"
                checked={mode === "month"}
                onChange={() => setMode("month")}
              />{" "}
              Mois
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="mode"
                checked={mode === "range"}
                onChange={() => setMode("range")}
              />{" "}
              Intervalle
            </label>
          </div>
        </div>
      </div>

      {mode === "month" ? (
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="space-y-1">
            <div className="text-sm font-medium">Mois</div>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="input w-full"
            />
          </label>
          <div className="text-xs text-muted-foreground flex items-end">
            Export du mois sélectionné
          </div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="space-y-1">
            <div className="text-sm font-medium">De</div>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="input w-full"
            />
          </label>
          <label className="space-y-1">
            <div className="text-sm font-medium">À</div>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="input w-full"
            />
          </label>
        </div>
      )}

      <div>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Préparation…" : "Exporter pièces (ZIP)"}
        </button>
      </div>
    </form>
  );
}
