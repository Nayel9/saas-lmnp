import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PATCH, DELETE } from "./[id]/route";

vi.mock("@/lib/auth/core", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "u1" } }),
}));

const prismaMock = vi.hoisted(() => ({
  amortizationDefault: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  property: { findUnique: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const P1 = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.amortizationDefault.findUnique.mockResolvedValue({ id: ID, propertyId: P1 });
  prismaMock.property.findUnique.mockResolvedValue({ id: P1, user_id: "u1" });
  prismaMock.amortizationDefault.update.mockResolvedValue({ id: ID });
});

function makePatch(body: object) {
  return new NextRequest(`http://test/api/settings/amortization-defaults/${ID}`, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function makeDelete() {
  return new NextRequest(`http://test/api/settings/amortization-defaults/${ID}`, {
    method: "DELETE",
  });
}

describe("/api/settings/amortization-defaults/[id]", () => {
  it("PATCH met à jour la durée", async () => {
    const res = await PATCH(makePatch({ defaultDurationMonths: 72 }), { params: Promise.resolve({ id: ID }) });
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j).toEqual({ ok: true, id: ID });
  });
  it("PATCH refuse si not owner", async () => {
    prismaMock.property.findUnique.mockResolvedValueOnce({ id: P1, user_id: "xx" });
    const res = await PATCH(makePatch({ defaultDurationMonths: 72 }), { params: Promise.resolve({ id: ID }) });
    expect(res.status).toBe(403);
  });
  it("DELETE supprime", async () => {
    prismaMock.amortizationDefault.delete.mockResolvedValueOnce({ id: ID });
    const res = await DELETE(makeDelete(), { params: Promise.resolve({ id: ID }) });
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j).toEqual({ ok: true });
  });
});
