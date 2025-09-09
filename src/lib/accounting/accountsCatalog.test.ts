import { describe, it, expect } from "vitest";
import {
  listFor,
  isAllowed,
  findClosest,
  searchAccounts,
} from "./accountsCatalog";
import { z } from "zod";

describe("accountsCatalog", () => {
  it("listFor filtre par type", () => {
    const achats = listFor("achat");
    const ventes = listFor("vente");
    expect(achats.find((a) => a.code === "706")).toBeUndefined();
    expect(ventes.find((a) => a.code === "606")).toBeUndefined();
    expect(achats.find((a) => a.code === "606")).toBeDefined();
    expect(ventes.find((a) => a.code === "706")).toBeDefined();
  });
  it("listFor asset retourne uniquement immobilisations", () => {
    const assets = listFor("asset");
    const codes = assets.map((a) => a.code);
    expect(codes).toEqual(
      expect.arrayContaining(["205", "2135", "2155", "2183", "2184"]),
    );
    expect(codes).not.toContain("706");
    expect(codes).not.toContain("606");
  });
  it("isAllowed vrai pour code/ type correct", () => {
    expect(isAllowed("606", "achat")).toBe(true);
    expect(isAllowed("606", "vente")).toBe(false);
    expect(isAllowed("706", "vente")).toBe(true);
  });
  it("isAllowed asset", () => {
    expect(isAllowed("2183", "asset")).toBe(true);
    expect(isAllowed("706", "asset")).toBe(false);
  });
  it("findClosest fournit meilleur préfixe", () => {
    const f1 = findClosest("60", "achat");
    expect(f1?.code.startsWith("60")).toBe(true);
    const f2 = findClosest("70", "vente");
    expect(f2?.code.startsWith("70")).toBe(true);
  });
  it("searchAccounts retourne résultats partiels case insensitive", () => {
    const res = searchAccounts("assu", "achat");
    expect(res.find((r) => r.code === "616")).toBeDefined();
  });
  it("Zod enum asset refuse code non listé", () => {
    const codes = listFor("asset").map((a) => a.code) as [string, ...string[]];
    const schema = z.enum(codes);
    expect(() => schema.parse("2183")).not.toThrow();
    expect(() => schema.parse("706")).toThrow();
  });
});
