export type VatInput = { ht?: number; rate?: number; tva?: number; ttc?: number };

export type VatTuple = { ht: number; rate: number; tva: number; ttc: number };

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeFromHT(ht: number, rate: number): VatTuple {
  const r = rate / 100;
  const tva = round2(ht * r);
  const ttc = round2(ht + tva);
  return { ht: round2(ht), rate: round2(rate), tva, ttc };
}

export function computeFromTTC(ttc: number, rate: number): VatTuple {
  const r = rate / 100;
  const ht = round2(ttc / (1 + r));
  const tva = round2(ttc - ht);
  return { ht, rate: round2(rate), tva, ttc: round2(ttc) };
}

export function validateVat(enabled: boolean, v: VatInput): { ok: true } | { ok: false; error: string } {
  if (!enabled) return { ok: true };
  const rate = Number(v.rate ?? NaN);
  if (!(rate >= 0 && rate <= 100)) return { ok: false, error: "Taux TVA invalide" };
  const ht = v.ht != null ? Number(v.ht) : undefined;
  const ttc = v.ttc != null ? Number(v.ttc) : undefined;
  const tva = v.tva != null ? Number(v.tva) : undefined;
  // Au moins HT+rate ou TTC+rate
  if ((ht == null && ttc == null) || isNaN(rate)) return { ok: false, error: "Champs TVA incomplets" };
  // Vérif cohérence si 3 valeurs présentes
  const tol = 0.02; // tolérance arrondis
  if (ht != null) {
    const exp = computeFromHT(ht, rate);
    if (ttc != null && Math.abs(exp.ttc - ttc) > tol) return { ok: false, error: "Incohérence TTC" };
    if (tva != null && Math.abs(exp.tva - tva) > tol) return { ok: false, error: "Incohérence TVA" };
  }
  if (ttc != null && ht == null) {
    const exp = computeFromTTC(ttc, rate);
    if (tva != null && Math.abs(exp.tva - tva) > tol) return { ok: false, error: "Incohérence TVA" };
  }
  return { ok: true };
}

