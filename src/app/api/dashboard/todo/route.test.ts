import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const P1 = "11111111-1111-1111-1111-111111111111";

vi.mock("@/lib/auth/core", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "u1" } }),
}));

const prismaMock = vi.hoisted(() => ({
  property: { findUnique: vi.fn() },
  journalEntry: {
    findMany: vi.fn(),
    aggregate: vi.fn(),
    count: vi.fn(),
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

type WhereShape = {
  type?: string;
  isDeposit?: boolean;
  NOT?: { account_code?: { in?: string[] } };
  attachments?: { none?: unknown };
  date?: unknown;
  user_id?: string;
  propertyId?: string;
};

type FindManyArgs = { where?: WhereShape; take?: number };

type AggArgs = { where?: { type?: string; isDeposit?: boolean } & WhereShape };

type CountArgs = { where?: { type?: string; isDeposit?: boolean } & WhereShape };

function makeReq(url: string) {
  return new NextRequest(url, { method: "GET" });
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.property.findUnique.mockResolvedValue({ id: P1, user_id: "u1" });
  prismaMock.journalEntry.findMany.mockImplementation(async ({ where, take }: FindManyArgs) => {
    // unpaidRents → simulate one rent
    if (where?.type === "vente" && where?.isDeposit === false && where?.NOT?.account_code?.in) {
      return [
        { id: "r1", date: new Date("2025-09-05"), amount: 600, tier: "Loc A", designation: "Loyer Sept" },
      ].slice(0, take || 5);
    }
    // expensesWithoutDocs → simulate one expense
    if (where?.type === "achat" && where?.attachments?.none !== undefined) {
      return [
        { id: "e1", date: new Date("2025-09-06"), amount: 120, tier: "EDF", designation: "Élec" },
      ].slice(0, take || 5);
    }
    return [];
  });
  prismaMock.journalEntry.aggregate.mockImplementation(async ({ where }: AggArgs) => {
    if (where?.type === "vente" && where?.isDeposit === true) {
      return { _sum: { amount: 800 } };
    }
    return { _sum: { amount: 0 } };
  });
  prismaMock.journalEntry.count.mockImplementation(async ({ where }: CountArgs) => {
    if (where?.type === "vente" && where?.isDeposit === true) return 2;
    return 0;
  });
});

describe("GET /api/dashboard/todo", () => {
  it("retourne les 3 catégories avec des valeurs (scope=user par défaut)", async () => {
    const res = await GET(makeReq(`http://test/api/dashboard/todo?year=2025&month=09`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.unpaidRents).toHaveLength(1);
    expect(body.expensesWithoutDocs).toHaveLength(1);
    expect(body.depositsHeld).toEqual({ total: 800, count: 2 });
  });

  it("valide les inputs uniquement quand scope=property", async () => {
    const r1 = await GET(makeReq(`http://test/api/dashboard/todo?scope=property&year=2025&month=09`));
    expect(r1.status).toBe(400);
    const r2 = await GET(makeReq(`http://test/api/dashboard/todo?scope=property&property=${P1}&year=1999&month=09`));
    expect(r2.status).toBe(400);
    const r3 = await GET(makeReq(`http://test/api/dashboard/todo?scope=property&property=${P1}&year=2025&month=13`));
    expect(r3.status).toBe(400);
  });
});
