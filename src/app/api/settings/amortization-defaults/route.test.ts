import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";

vi.mock("@/lib/auth/core", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "u1" } }),
}));

const prismaMock = vi.hoisted(() => ({
  property: { findUnique: vi.fn() },
  amortizationDefault: { findMany: vi.fn(), create: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const P1 = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.property.findUnique.mockResolvedValue({ id: P1, user_id: "u1" });
  prismaMock.amortizationDefault.findMany.mockResolvedValue([
    { id: "d1", propertyId: P1, category: "mobilier", defaultDurationMonths: 60 },
  ]);
  prismaMock.amortizationDefault.create.mockResolvedValue({ id: "d2" });
});

function makeGet(url: string) {
  return new NextRequest(url, { method: "GET" });
}
function makePost(body: unknown) {
  return new NextRequest("http://test/api/settings/amortization-defaults", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("/api/settings/amortization-defaults", () => {
  it("GET liste les defaults pour un bien appartenant à l'utilisateur", async () => {
    const res = await GET(makeGet(`http://test/api/settings/amortization-defaults?property=${P1}`));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(Array.isArray(j)).toBe(true);
    expect(j[0].category).toBe("mobilier");
  });
  it("GET refuse propriété d'un autre utilisateur", async () => {
    prismaMock.property.findUnique.mockResolvedValueOnce({ id: P1, user_id: "other" });
    const res = await GET(makeGet(`http://test/api/settings/amortization-defaults?property=${P1}`));
    expect(res.status).toBe(403);
  });
  it("POST crée un défaut valide", async () => {
    const res = await POST(makePost({ propertyId: P1, category: "vehicule", defaultDurationMonths: 48 }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j).toEqual({ ok: true, id: "d2" });
  });
  it("POST refuse propriété d'un autre utilisateur", async () => {
    prismaMock.property.findUnique.mockResolvedValueOnce({ id: P1, user_id: "x" });
    const res = await POST(makePost({ propertyId: P1, category: "vehicule", defaultDurationMonths: 48 }));
    expect(res.status).toBe(403);
  });
  it("POST valide les inputs", async () => {
    const res = await POST(makePost({ propertyId: P1, category: "vehicule", defaultDurationMonths: 0 }));
    expect(res.status).toBe(400);
  });
});

