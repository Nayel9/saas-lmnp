import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

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
  const asset = {
    findMany: vi.fn(async () => {
      // Deux actifs; on renvoie toujours les mêmes pour simplifier
      return [
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
      ];
    }),
  };
  const journalEntry = {
    findMany: vi.fn(async () => {
      return [
        {
          type: "vente",
          amount: 1000,
          isDeposit: false,
          date: new Date("2025-03-10"),
        },
        {
          type: "vente",
          amount: 200,
          isDeposit: true,
          date: new Date("2025-04-01"),
        },
        {
          type: "achat",
          amount: 300,
          isDeposit: false,
          date: new Date("2025-02-11"),
        },
        {
          type: "achat",
          amount: 50,
          isDeposit: false,
          date: new Date("2025-05-20"),
        },
        {
          type: "achat",
          amount: 999,
          isDeposit: false,
          date: new Date("2026-01-01"),
        },
      ];
    }),
  };
  return { prisma: { property, asset, journalEntry } };
});

const P1 = "11111111-1111-1111-1111-111111111111";
const P2 = "22222222-2222-2222-2222-222222222222";

function makeReq(url: string) {
  return new NextRequest(url, { method: "GET" });
}

describe("GET /api/synthesis/balance", () => {
  it("retourne un bilan simple cohérent (VNC, trésorerie, cautions)", async () => {
    const res = await GET(
      makeReq(`http://test/api/synthesis/balance?property=${P1}&year=2025`),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    // VNC attendue (voir test unitaire) ~ 14800
    expect(body.actif.vnc).toBe(14800);
    // Trésorerie = 1000 - (300+50) = 650
    expect(body.actif.treso).toBe(650);
    // Cautions = 200
    expect(body.passif.cautions).toBe(200);
    // Totaux
    expect(body.actif.total).toBe(14800 + 650);
    expect(body.passif.total).toBe(200);
  });
  it("contrôle multi-tenant: forbidden si propriété autre user", async () => {
    const res = await GET(
      makeReq(`http://test/api/synthesis/balance?property=${P2}&year=2025`),
    );
    expect(res.status).toBe(403);
  });
  it("valide year / property requis", async () => {
    const r1 = await GET(
      makeReq("http://test/api/synthesis/balance?year=2025"),
    );
    expect(r1.status).toBe(400);
    const r2 = await GET(
      makeReq(`http://test/api/synthesis/balance?property=${P1}&year=1999`),
    );
    expect(r2.status).toBe(400);
  });
});
