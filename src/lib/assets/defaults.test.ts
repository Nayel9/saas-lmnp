import { describe, it, expect } from "vitest";
import { monthsToYearsRounded, prefillYears } from "./defaults";

describe("assets defaults utils", () => {
  it("monthsToYearsRounded arrondit vers l'année la plus proche et min 1", () => {
    expect(monthsToYearsRounded(60)).toBe(5);
    expect(monthsToYearsRounded(61)).toBe(5);
    expect(monthsToYearsRounded(1)).toBe(1);
    expect(monthsToYearsRounded(0)).toBe(1);
  });
  it("prefillYears retourne la durée en années quand dispo, sinon chaîne vide", () => {
    const d: Partial<Record<"vehicule" | "mobilier" | "batiment", number>> = { vehicule: 48 };
    expect(prefillYears("vehicule", d)).toBe("4");
    expect(prefillYears("mobilier", d)).toBe("");
    expect(prefillYears("", d)).toBe("");
  });
});
