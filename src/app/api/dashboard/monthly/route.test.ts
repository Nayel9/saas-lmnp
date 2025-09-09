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
      if (id === P1) return { id: P1, user_id: "u1" };
      if (id === P2) return { id: P2, user_id: "other" };
      return null;
    }),
  };
  const income = {
    aggregate: vi.fn(async () => ({ _sum: { amount: 1200 } })),
  };
  const expense = {
    aggregate: vi.fn(async () => ({ _sum: { amount: 450 } })),
  };
  const amortization = {
    findFirst: vi.fn(async ({ where }: { where: { note?: { contains?: string } } }) => {
      if (where?.note?.contains?.includes("2025-09")) return { id: "am1" };
      return null;
    }),
  };
  return { prisma: { property, income, expense, amortization } };
});

const P1 = "11111111-1111-1111-1111-111111111111";
const P2 = "22222222-2222-2222-2222-222222222222";

function makeReq(url: string) {
  return new NextRequest(url, { method: "GET" });
}

describe("GET /api/dashboard/monthly", () => {
  it("retourne incoming/outgoing/result et amortPosted=true quand présent", async () => {
    const res = await GET(
      makeReq(`http://test/api/dashboard/monthly?property=${P1}&year=2025&month=09`),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ incoming: 1200, outgoing: 450, result: 750, amortPosted: true });
  });
  it("amortPosted=false quand aucune écriture", async () => {
    const res = await GET(
      makeReq(`http://test/api/dashboard/monthly?property=${P1}&year=2025&month=10`),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.amortPosted).toBe(false);
  });
  it("forbidden si propriété autre user", async () => {
    const res = await GET(
      makeReq(`http://test/api/dashboard/monthly?property=${P2}&year=2025&month=09`),
    );
    expect(res.status).toBe(403);
  });
  it("valide year/mois/property", async () => {
    const r1 = await GET(makeReq(`http://test/api/dashboard/monthly?year=2025&month=09`));
    expect(r1.status).toBe(400);
    const r2 = await GET(
      makeReq(`http://test/api/dashboard/monthly?property=${P1}&year=1999&month=09`),
    );
    expect(r2.status).toBe(400);
    const r3 = await GET(
      makeReq(`http://test/api/dashboard/monthly?property=${P1}&year=2025&month=13`),
    );
    expect(r3.status).toBe(400);
  });
});

