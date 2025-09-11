import { describe, it, expect } from "vitest";
import { computeFromHT, computeFromTTC, validateVat } from "./vat";

describe("VAT utils", () => {
  it("computeFromHT calcule TVA et TTC (arrondi 2 déc)", () => {
    const r = computeFromHT(100, 20);
    expect(r).toEqual({ ht: 100, rate: 20, tva: 20, ttc: 120 });
  });
  it("computeFromTTC calcule HT et TVA (arrondi 2 déc)", () => {
    const r = computeFromTTC(120, 20);
    expect(r.ht).toBe(100);
    expect(r.tva).toBe(20);
  });
  it("validateVat: OFF => ok sans champs", () => {
    expect(validateVat(false, {})).toEqual({ ok: true });
  });
  it("validateVat: ON => taux requis et cohérence", () => {
    expect(validateVat(true, { ht: 100, rate: 20 })).toEqual({ ok: true });
    expect(validateVat(true, { ttc: 120, rate: 20 })).toEqual({ ok: true });
    expect(validateVat(true, { ht: 100, rate: -1 }).ok).toBe(false);
    expect(validateVat(true, { ht: 100, rate: 20, ttc: 119 }).ok).toBe(false);
  });
});

