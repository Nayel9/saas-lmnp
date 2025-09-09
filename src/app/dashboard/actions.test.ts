import { describe, it, expect, vi, beforeEach } from "vitest";
import { postMonthlyAmortization } from "./actions";

vi.mock("@/lib/auth/core", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "u1" } }),
}));

const P1 = "11111111-1111-1111-1111-111111111111";
const prismaMock = vi.hoisted(() => ({
  property: { findUnique: vi.fn() },
  amortization: { findFirst: vi.fn(), create: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("postMonthlyAmortization", () => {
  it("crée la ligne si absente (idempotent)", async () => {
    prismaMock.property.findUnique.mockResolvedValue({ id: P1, user_id: "u1" });
    prismaMock.amortization.findFirst.mockResolvedValueOnce(null);
    prismaMock.amortization.create.mockResolvedValueOnce({ id: "am1" });

    const r1 = await postMonthlyAmortization({ propertyId: P1, year: 2025, month: 9 });
    expect(r1).toEqual({ created: true, id: "am1" });

    prismaMock.amortization.findFirst.mockResolvedValueOnce({ id: "am1" });
    const r2 = await postMonthlyAmortization({ propertyId: P1, year: 2025, month: 9 });
    expect(r2).toEqual({ created: false, id: "am1" });
  });

  it("refuse si property ≠ user", async () => {
    prismaMock.property.findUnique.mockResolvedValue({ id: P1, user_id: "other" });
    await expect(
      postMonthlyAmortization({ propertyId: P1, year: 2025, month: 9 }),
    ).rejects.toThrow("FORBIDDEN");
  });
});
