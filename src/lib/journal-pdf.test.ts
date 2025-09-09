import { describe, it, expect } from "vitest";
import { generateJournalPdf } from "./journal-pdf";

// Test basique que le PDF est généré et contient quelques octets

describe("generateJournalPdf", () => {
  it("génère un PDF non vide avec totaux", async () => {
    const buf = await generateJournalPdf({
      title: "Journal Achats",
      period: { from: "2025-01-01", to: "2025-01-31" },
      rows: [
        {
          date: new Date("2025-01-05"),
          designation: "Test A",
          tier: "Fournisseur X",
          account_code: "606",
          amount: 123.45,
        },
        {
          date: new Date("2025-01-10"),
          designation: "Test B",
          tier: "Fournisseur Y",
          account_code: "606",
          amount: 54.55,
        },
      ],
      filters: { tier: "Fournisseur X", q: "Test" },
    });
    expect(buf.length).toBeGreaterThan(500); // taille arbitraire minimale
  });
});
