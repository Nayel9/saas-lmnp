import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const P1 = "11111111-1111-1111-1111-111111111111";
const P2 = "22222222-2222-2222-2222-222222222222";

vi.mock("@/lib/auth/core", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "u1" } }),
}));

const prismaMock = vi.hoisted(() => ({
  property: { findUnique: vi.fn() },
  journalEntry: { findMany: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

function makeReq(url: string) {
  return new NextRequest(url, { method: "GET" });
}

type FindManyArgs = {
  where?: Record<string, unknown>;
  select?: unknown;
  orderBy?: { date?: "asc" | "desc" };
  take?: number;
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.property.findUnique.mockImplementation(async ({ where: { id } }: { where: { id: string } }) => {
    if (id === P1) return { id: P1, user_id: "u1" };
    if (id === P2) return { id: P2, user_id: "other" };
    return null;
  });

  prismaMock.journalEntry.findMany.mockImplementation(async ({ where, orderBy, take }: FindManyArgs) => {
    const sampleSales = [
      { id: "s1", date: new Date("2025-09-01"), amount: 500, tier: "Loc A", designation: "" },
      { id: "s2", date: new Date("2025-09-03"), amount: 650, tier: "Loc B", designation: "" },
      { id: "s3", date: new Date("2025-08-28"), amount: 520, tier: "Loc C", designation: "" },
      { id: "s4", date: new Date("2025-09-05"), amount: 700, tier: "Loc D", designation: "" },
      { id: "s5", date: new Date("2025-09-02"), amount: 600, tier: "Loc E", designation: "" },
      { id: "s6", date: new Date("2025-09-06"), amount: 710, tier: "Loc F", designation: "" },
    ];
    const samplePurchases = [
      { id: "p1", date: new Date("2025-09-02"), amount: 120, tier: "EDF", designation: "" },
      { id: "p2", date: new Date("2025-09-01"), amount: 80, tier: "EAU", designation: "" },
      { id: "p3", date: new Date("2025-09-05"), amount: 200, tier: "ORANGE", designation: "" },
      { id: "p4", date: new Date("2025-09-03"), amount: 60, tier: "Fourn X", designation: "" },
      { id: "p5", date: new Date("2025-08-30"), amount: 50, tier: "Fourn Y", designation: "" },
      { id: "p6", date: new Date("2025-09-06"), amount: 40, tier: "Fourn Z", designation: "" },
    ];

    // sales query
    if (where?.type === "vente" && where?.isDeposit === false) {
      const arr = [...sampleSales];
      if (orderBy?.date === "desc") arr.sort((a, b) => +b.date - +a.date);
      if (orderBy?.date === "asc") arr.sort((a, b) => +a.date - +b.date);
      return arr.slice(0, take || 5);
    }
    // purchases query
    if (where?.type === "achat") {
      const arr = [...samplePurchases];
      if (orderBy?.date === "desc") arr.sort((a, b) => +b.date - +a.date);
      if (orderBy?.date === "asc") arr.sort((a, b) => +a.date - +b.date);
      return arr.slice(0, take || 5);
    }

    return [];
  });
});

describe("GET /api/dashboard/history", () => {
  it("retourne 5 ventes (hors cautions) triées desc et 5 achats triés desc (scope=user par défaut)", async () => {
    const res = await GET(makeReq(`http://test/api/dashboard/history`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sales).toHaveLength(5);
    expect(body.purchases).toHaveLength(5);
    // Vérifie tri desc (premier = date max)
    expect(body.sales[0].id).toBe("s6");
    expect(body.purchases[0].id).toBe("p6");
  });

  it("retourne [] si aucune donnée (mock vide)", async () => {
    prismaMock.journalEntry.findMany.mockResolvedValueOnce([]); // for sales
    prismaMock.journalEntry.findMany.mockResolvedValueOnce([]); // for purchases
    const res = await GET(makeReq(`http://test/api/dashboard/history`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sales).toEqual([]);
    expect(body.purchases).toEqual([]);
  });

  it("scope=property : valide propriété et contrôle multi-tenant", async () => {
    const r1 = await GET(makeReq(`http://test/api/dashboard/history?scope=property`));
    expect(r1.status).toBe(400);
    const r2 = await GET(makeReq(`http://test/api/dashboard/history?scope=property&property=${P2}`));
    expect(r2.status).toBe(403);
    const r3 = await GET(makeReq(`http://test/api/dashboard/history?scope=property&property=${P1}`));
    expect(r3.status).toBe(200);
  });
});
