import { describe, it, expect } from "vitest";
import {
  buildIndexCsv,
  buildIndexRows,
  buildZipPath,
  type IndexRow,
  type JournalType,
} from "./attachmentsIndex";

type EntryLike = {
  id: string;
  type: JournalType;
  date: Date;
  amount: number | string;
  tier: string | null;
  account_code: string;
};
type AttachmentLike = {
  entryId: string | null;
  fileName: string;
  storageKey: string;
};

function mkEntry(over: Partial<EntryLike>): EntryLike {
  return {
    id: over.id ?? "e1",
    type: over.type ?? "achat",
    date: over.date ?? new Date("2025-07-12"),
    amount: over.amount ?? 12.34,
    tier: over.tier ?? "ACME",
    account_code: over.account_code ?? "606",
  } as EntryLike;
}

function mkAtt(over: Partial<AttachmentLike>): AttachmentLike {
  return {
    entryId: over.entryId ?? "e1",
    fileName: over.fileName ?? "facture 001.pdf",
    storageKey: over.storageKey ?? "mock/u/e1/file.pdf",
  } as AttachmentLike;
}

describe("attachmentsIndex", () => {
  it("buildIndexCsv: colonnes et valeurs", () => {
    const rows: IndexRow[] = [
      {
        type: "achat",
        date: "2025-07-12",
        entryId: "e1",
        montant: 12.5,
        counterparty: "ACME",
        category: "606",
        fileName: "facture 001.pdf",
        storageKey: "mock/u/e1/f1.pdf",
      },
    ];
    const csv = buildIndexCsv(rows);
    const lines = csv.trimEnd().split("\n");
    expect(lines[0]).toBe(
      "type;date;entryId;montant;counterparty;category;fileName;storageKey",
    );
    expect(lines[1]).toBe(
      "ACHAT;2025-07-12;e1;12.5;ACME;606;facture-001.pdf;mock/u/e1/f1.pdf",
    );
  });

  it("buildIndexRows: mappe entries/attachments", () => {
    const e1 = mkEntry({
      id: "e1",
      type: "vente",
      amount: "42.00",
      tier: "ClientX",
    });
    const e2 = mkEntry({
      id: "e2",
      type: "achat",
      amount: 9.99,
      account_code: "606",
    });
    const rows = buildIndexRows(
      [e1, e2],
      [
        mkAtt({ entryId: "e1", fileName: "a.pdf" }),
        mkAtt({
          entryId: "e2",
          fileName: "b.png",
          storageKey: "mock/u/e2/b.png",
        }),
      ],
    );
    expect(rows).toHaveLength(2);
    const r1 = rows.find((r) => r.entryId === "e1")!;
    expect(r1.type).toBe("vente");
    expect(r1.counterparty).toBe("ClientX");
    expect(r1.montant).toBe(42);
    const r2 = rows.find((r) => r.entryId === "e2")!;
    expect(r2.category).toBe("606");
  });

  it("buildIndexCsv: vide -> seulement en-tête", () => {
    const csv = buildIndexCsv([]);
    expect(csv).toBe(
      "type;date;entryId;montant;counterparty;category;fileName;storageKey\n",
    );
  });

  it("buildZipPath: format dossiers VENTES/ACHATS par mois", () => {
    const p1 = buildZipPath({
      type: "vente",
      dateISO: "2025-07-12",
      entryId: "e1",
      fileName: "Facture Client.pdf",
    });
    expect(p1).toBe("VENTES/2025-07/entry_e1/Facture-Client.pdf");
    const p2 = buildZipPath({
      type: "achat",
      dateISO: "2024-01-01",
      entryId: "e2",
      fileName: "justif.png",
    });
    expect(p2).toBe("ACHATS/2024-01/entry_e2/justif.png");
  });
});
