import { describe, it, expect } from "vitest";
import { computeLinearAmortization } from "./asset-amortization";

function d(str: string) {
  return new Date(str + "T00:00:00Z");
}

describe("computeLinearAmortization", () => {
  it("répartition linéaire simple (début année)", () => {
    const rows = computeLinearAmortization(1200, 4, d("2024-01-01"));
    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r.dotation)).toEqual([300, 300, 300, 300]);
    expect(rows[3].cumul).toBe(1200);
  });
  it("prorata temporis 1ère année (mois restants)", () => {
    const rows = computeLinearAmortization(1200, 4, d("2024-07-10"));
    // Mois restants = 6 => 300 * 0.5 = 150
    expect(rows[0].dotation).toBe(150);
    // Ensuite 300, 300 et ajustement final 450
    expect(rows.map((r) => r.dotation)).toEqual([150, 300, 300, 450]);
    expect(rows.at(-1)?.cumul).toBe(1200);
  });
  it("arrondis contrôlés (cas fractionnaire)", () => {
    const rows = computeLinearAmortization(1000, 3, d("2024-10-15"));
    // Vérifie cumul = montant
    const last = rows.at(-1)!;
    expect(Math.abs(1000 - last.cumul)).toBeLessThanOrEqual(0.01);
  });
});
