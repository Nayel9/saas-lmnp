import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PATCH } from "./route";

vi.mock("@/lib/auth/core", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "u1" } }),
}));

const prismaMock = vi.hoisted(() => ({
  property: { findUnique: vi.fn(), update: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

function makeReq(body: unknown) {
  return new NextRequest("http://test/api/settings/vat", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const P1 = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.property.findUnique.mockResolvedValue({ id: P1, user_id: "u1", vatEnabled: false });
  prismaMock.property.update.mockImplementation(async ({ data }: { data: { vatEnabled: boolean } }) => ({ id: P1, user_id: "u1", vatEnabled: data.vatEnabled }));
});

describe("PATCH /api/settings/vat", () => {
  it("active la TVA pour un bien de l'utilisateur", async () => {
    const res = await PATCH(makeReq({ propertyId: P1, vatEnabled: true }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j).toEqual({ ok: true, vatEnabled: true });
  });
  it("refuse si property n'appartient pas", async () => {
    prismaMock.property.findUnique.mockResolvedValueOnce({ id: P1, user_id: "other", vatEnabled: false });
    const res = await PATCH(makeReq({ propertyId: P1, vatEnabled: true }));
    expect(res.status).toBe(403);
  });
  it("valide le body", async () => {
    const r1 = await PATCH(makeReq({ propertyId: "not-uuid", vatEnabled: true }));
    expect(r1.status).toBe(400);
  });
});

