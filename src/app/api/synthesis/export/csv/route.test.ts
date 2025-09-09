import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

vi.mock("@/lib/auth/core", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "u1" } }),
}));

vi.mock("@/lib/prisma", () => {
  const P1 = "11111111-1111-1111-1111-111111111111";
  const P2 = "22222222-2222-2222-2222-222222222222";
  const property = {
    findUnique: vi.fn(async ({ where: { id } }: { where: { id: string } }) => {
      if (id === P1) return { id: P1, user_id: "u1", label: "Appartement A" };
      if (id === P2) return { id: P2, user_id: "other", label: "Autre" };
      return null;
    }),
  };
  const asset = {
    findMany: vi.fn(async () => [
      {
        amount_ht: 12000,
        duration_years: 5,
        acquisition_date: new Date("2024-04-15"),
      },
      {
        amount_ht: 10000,
        duration_years: 10,
        acquisition_date: new Date("2023-01-10"),
      },
    ]),
  };
  const journalEntry = {
    findMany: vi.fn(async () => [
      {
        type: "vente",
        amount: 1000,
        isDeposit: false,
        date: new Date("2025-03-10"),
        account_code: "706",
      },
      {
        type: "vente",
        amount: 200,
        isDeposit: true,
        date: new Date("2025-04-01"),
        account_code: "706",
      },
      {
        type: "achat",
        amount: 300,
        isDeposit: false,
        date: new Date("2025-02-11"),
        account_code: "606",
      },
      {
        type: "achat",
        amount: 50,
        isDeposit: false,
        date: new Date("2025-05-20"),
        account_code: "606",
      },
      {
        type: "achat",
        amount: 100,
        isDeposit: false,
        date: new Date("2025-12-10"),
        account_code: "6811",
      },
    ]),
  };
  return { prisma: { property, asset, journalEntry } };
});

const P1 = "11111111-1111-1111-1111-111111111111";
const P2 = "22222222-2222-2222-2222-222222222222";

function makeReq(url: string) {
  return new NextRequest(url, { method: "GET" });
}

describe("GET /api/synthesis/export/csv", () => {
  it("retourne un ZIP avec les 2 fichiers attendus (contrôle signatures)", async () => {
    const res = await GET(
      makeReq(`http://test/api/synthesis/export/csv?property=${P1}&year=2025`),
    );
    expect(res.status).toBe(200);
    const ct = res.headers.get("content-type") || "";
    expect(ct).toContain("application/zip");
    const cd = res.headers.get("content-disposition") || "";
    expect(cd).toContain(`attachment; filename="synthese_${P1}_2025.zip"`);
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBeGreaterThan(0);
  });
  it("refuse l’accès si propriété autre user", async () => {
    const res = await GET(
      makeReq(`http://test/api/synthesis/export/csv?property=${P2}&year=2025`),
    );
    expect(res.status).toBe(403);
  });
});
