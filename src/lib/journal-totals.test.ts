import { describe, it, expect } from "vitest";
import { computeVisibleTotals } from "./journal-totals";

describe("computeVisibleTotals", () => {
  it("somme nombres", () => {
    const r = computeVisibleTotals([{ amount: 10 }, { amount: 5.25 }]);
    expect(r).toEqual({ count: 2, sum: 15.25 });
  });
  it("somme chaînes + ignorés", () => {
    const r = computeVisibleTotals([
      { amount: "3.10" },
      { amount: null },
      { amount: "1.20" },
    ]);
    expect(r.count).toBe(3);
    expect(r.sum).toBe(4.3);
  });
  it("arrondi 2 décimales", () => {
    const r = computeVisibleTotals([{ amount: 0.105 }, { amount: 0.105 }]);
    expect(r.sum).toBe(0.21);
  });
});
