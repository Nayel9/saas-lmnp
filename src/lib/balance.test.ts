import { describe, it, expect } from "vitest";
import { aggregateBalance } from "./balance";

describe("aggregateBalance", () => {
  it("agrège achat=debit vente=credit et calcule solde", () => {
    const rows = aggregateBalance([
      { type: "achat", account_code: "606", amount: 100 },
      { type: "achat", account_code: "606", amount: 50.255 },
      { type: "vente", account_code: "706", amount: 200 },
      { type: "vente", account_code: "706", amount: 19.99 },
      { type: "vente", account_code: "606", amount: 20 }, // crédit sur 606
    ]);
    const c606 = rows.find((r) => r.account_code === "606");
    const c706 = rows.find((r) => r.account_code === "706");
    expect(c606).toBeDefined();
    expect(c606?.total_debit).toBeCloseTo(150.26, 2); // 100 + 50.255 arrondi 150.26
    expect(c606?.total_credit).toBeCloseTo(20.0, 2);
    expect(c606?.balance).toBeCloseTo(130.26, 2);
    expect(c706?.total_debit).toBe(0);
    expect(c706?.total_credit).toBeCloseTo(219.99, 2);
    expect(c706?.balance).toBeCloseTo(-219.99, 2);
  });
  it("ignore montants invalides", () => {
    const rows = aggregateBalance([
      { type: "achat", account_code: "601", amount: "abc" },
      { type: "vente", account_code: "701", amount: 10 },
    ]);
    expect(rows.find((r) => r.account_code === "601")).toBeUndefined();
    expect(rows.find((r) => r.account_code === "701")?.total_credit).toBe(10);
  });
});
