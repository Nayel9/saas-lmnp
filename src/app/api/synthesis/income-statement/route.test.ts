import { describe, it, expect, vi } from "vitest";
import { GET } from "./route";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth/core", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "u1" } }),
}));

// Mock Prisma client
vi.mock("@/lib/prisma", () => {
  const P1 = "11111111-1111-1111-1111-111111111111";
  const P2 = "22222222-2222-2222-2222-222222222222";
  const property = {
    findUnique: vi.fn(async ({ where: { id } }: { where: { id: string } }) => {
      if (id === P1) return { id: P1, user_id: "u1" };
      if (id === P2) return { id: P2, user_id: "other" };
      return null;
    }),
  };
  const journalEntry = {
    findMany: vi.fn(async () => {
      // Jeu fixe pour 2025
      return [
        {
          type: "vente",
          amount: 1000,
          isDeposit: false,
          account_code: "706",
          date: new Date("2025-03-10"),
        },
        {
          type: "vente",
          amount: 200,
          isDeposit: true,
          account_code: "706",
          date: new Date("2025-04-01"),
        },
        {
          type: "achat",
          amount: 300,
          isDeposit: false,
          account_code: "606",
          date: new Date("2025-02-11"),
        },
        // Note: plus besoin d'une ligne 6811 ici, l'amort vient de prisma.amortization
        {
          type: "achat",
          amount: 999,
          isDeposit: false,
          account_code: "606",
          date: new Date("2026-01-01"),
        },
      ];
    }),
  };
  type AmortWhere = { user_id?: string; propertyId?: string; year?: number };
  const amortization = {
    findMany: vi.fn(async ({ where }: { where: AmortWhere }) => {
      if (where?.user_id === "u1" && where?.propertyId === P1 && where?.year === 2025) {
        return [{ amount: 150 }];
      }
      return [];
    }),
  };
  return { prisma: { property, journalEntry, amortization } };
});

const P1 = "11111111-1111-1111-1111-111111111111";
const P2 = "22222222-2222-2222-2222-222222222222";

function makeReq(url: string) {
  return new NextRequest(url, { method: "GET" });
}

describe("GET /api/synthesis/income-statement", () => {
  it("retourne les bons totaux (exclut cautions, sépare amortissements)", async () => {
    const res = await GET(
      makeReq(
        `http://test/api/synthesis/income-statement?property=${P1}&year=2025`,
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.revenus).toBe(1000);
    expect(body.depenses).toBe(300);
    expect(body.amortissements).toBe(150);
    expect(body.resultat).toBe(550);
  });
  it("contrôle multi-tenant: forbidden si propriété autre user", async () => {
    const res = await GET(
      makeReq(
        `http://test/api/synthesis/income-statement?property=${P2}&year=2025`,
      ),
    );
    expect(res.status).toBe(403);
  });
  it("valide year min/max et property requis", async () => {
    const r1 = await GET(
      makeReq("http://test/api/synthesis/income-statement?year=2025"),
    );
    expect(r1.status).toBe(400);
    const r2 = await GET(
      makeReq(
        `http://test/api/synthesis/income-statement?property=${P1}&year=1999`,
      ),
    );
    expect(r2.status).toBe(400);
  });
});
