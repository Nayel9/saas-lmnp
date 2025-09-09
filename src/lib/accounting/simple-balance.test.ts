import { describe, it, expect } from "vitest";
import {
  computeVNC,
  computeCashAndDeposits,
  computeSimpleBalance,
} from "./simple-balance";

function d(s: string) {
  return new Date(s);
}

describe("simple-balance (unit)", () => {
  const year = 2025;
  it("VNC = coût – amort cumulé (linéaire, prorata 1ère année)", () => {
    const assets = [
      {
        amount_ht: 12000,
        duration_years: 5,
        acquisition_date: d("2024-04-15"),
      }, // 2024 dotation ~ 9/12 * 2400 = 1800; 2025 dot=2400; cumul fin 2025=4200; VNC=7800
      {
        amount_ht: 10000,
        duration_years: 10,
        acquisition_date: d("2023-01-10"),
      }, // cumul fin 2025 = 3000; VNC=7000
    ];
    const vnc = computeVNC(assets, year);
    // somme ~ 7800 + 7000 = 14800
    expect(vnc).toBe(14800);
  });
  it("Trésorerie MVP = ventes (hors cautions) – achats sur l’année", () => {
    const entries = [
      { type: "vente" as const, amount: 1000, date: d("2025-01-10") },
      {
        type: "vente" as const,
        amount: 200,
        date: d("2025-03-01"),
        isDeposit: true,
      },
      { type: "achat" as const, amount: 300, date: d("2025-02-05") },
      { type: "achat" as const, amount: 50, date: d("2025-04-01") },
      { type: "achat" as const, amount: 999, date: d("2026-01-01") }, // autre année
    ];
    const { cash, deposits } = computeCashAndDeposits(entries, year);
    expect(cash).toBe(650); // 1000 - (300+50)
    expect(deposits).toBe(200);
  });
  it("computeSimpleBalance assemble ACTIF/PASSIF et calcule écart", () => {
    const assets = [
      {
        amount_ht: 12000,
        duration_years: 5,
        acquisition_date: d("2024-04-15"),
      },
    ];
    const entries = [
      { type: "vente" as const, amount: 1000, date: d("2025-01-10") },
    ];
    const r = computeSimpleBalance({ assets, entries, year });
    expect(r.actif.vnc).toBeGreaterThan(0);
    expect(r.actif.total).toBeCloseTo(r.actif.vnc + r.actif.treso, 2);
    expect(r.passif.total).toBe(r.passif.cautions + r.passif.dettes);
    expect(r.ecart).toBeCloseTo(r.actif.total - r.passif.total, 2);
  });
});
