import { describe, it, expect } from "vitest";
import { buildSeedData } from "./seedDemoCore";

describe("buildSeedData", () => {
  const data = buildSeedData();
  it("contient journal et assets", () => {
    expect(data.journal.length).toBeGreaterThan(5);
    expect(data.assets.length).toBe(2);
  });
  it("montants clefs cohérents (loyers 2025)", () => {
    const loyers = data.journal
      .filter(
        (j) =>
          j.type === "vente" &&
          j.account_code === "706" &&
          j.date.startsWith("2025-"),
      )
      .reduce((a, b) => a + b.amount, 0);
    expect(loyers).toBe(2400); // janvier + février 1200 chacun
  });
  it("remise commerciale négative", () => {
    const remise = data.journal.find(
      (j) => j.account_code === "709" && j.date === "2025-03-31",
    );
    expect(remise?.amount).toBe(-50);
  });
});
