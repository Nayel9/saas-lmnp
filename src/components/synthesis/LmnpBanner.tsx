"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ackKey, shouldShowLmnpBanner } from "@/lib/lmnp/banner";

type Totals = { revenus: number; depenses: number; amortissements: number };

export default function LmnpBanner({
  propertyId,
  year,
  totals,
}: {
  propertyId: string;
  year: number;
  totals: Totals | null;
}) {
  const [acked, setAcked] = useState(false);
  const show = useMemo(() => {
    if (!totals) return false;
    return shouldShowLmnpBanner({
      revenues: totals.revenus,
      expenses: totals.depenses,
      amort: totals.amortissements,
    });
  }, [totals]);

  useEffect(() => {
    try {
      const v =
        typeof window !== "undefined"
          ? window.localStorage.getItem(ackKey(propertyId, year))
          : null;
      setAcked(Boolean(v));
    } catch {
      setAcked(false);
    }
  }, [propertyId, year]);

  const onAck = useCallback(() => {
    try {
      window.localStorage.setItem(ackKey(propertyId, year), "1");
    } catch {}
    setAcked(true);
  }, [propertyId, year]);

  const message: string[] = [
    "L’amortissement est un calcul comptable (pas une dépense cash).",
    "Il peut dépasser vos revenus d’une année sans que ce soit une perte réelle.",
    "L’excédent d’amortissement est reporté sur les années suivantes.",
    "Résultat : on paye souvent peu ou pas d’impôts LMNP pendant plusieurs années.",
  ];

  if (!propertyId || !year || !totals) {
    // Rien si pas de données
    return null;
  }
  if (show && !acked) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-md border border-amber-400 bg-amber-50 text-amber-900 p-3 flex items-start gap-3"
      >
        <span aria-hidden="true" className="mt-0.5">
          ⚠️
        </span>
        <div className="flex-1">
          {" "}
          <div className="font-medium">Aide LMNP</div>
          <div className="text-sm leading-snug">
            <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
              {message.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>{" "}
        </div>
        <button
          type="button"
          onClick={onAck}
          className="btn-outline btn-sm whitespace-nowrap"
        >
          J’ai compris
        </button>{" "}
      </div>
    );
  }
  // Info-bulle compacte (affichée en permanence quand pas de bannière)
  return (
    <details className="text-sm text-muted-foreground select-none">
      {" "}
      <summary className="cursor-pointer inline-flex items-center gap-2">
        {" "}
        <span aria-hidden="true">ℹ️</span> <span>TIPS LMNP</span>{" "}
      </summary>{" "}
      <div className="mt-2 rounded-md border bg-bg-muted p-3" role="note">
        <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
          {message.map((t, i) => (
            <li key={i}>{t}</li>
          ))}{" "}
        </ul>
      </div>{" "}
    </details>
  );
}
