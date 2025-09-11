import { describe, it, expect, vi, beforeEach } from "vitest";
import { postMonthlyAmortization, markRentPaid } from "./actions";

vi.mock("@/lib/auth/core", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "u1" } }),
}));

const P1 = "11111111-1111-1111-1111-111111111111";
const prismaMock = vi.hoisted(() => ({
  property: { findUnique: vi.fn() },
  amortization: { findFirst: vi.fn(), create: vi.fn() },
  journalEntry: { findUnique: vi.fn(), update: vi.fn() },
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

describe("markRentPaid", () => {
  it("met à jour account_code en 512 si vente non dépôt et pas encore encaissé", async () => {
    prismaMock.journalEntry.findUnique.mockResolvedValue({
      id: "e1",
      user_id: "u1",
      type: "vente",
      isDeposit: false,
      account_code: "411",
    });
    prismaMock.journalEntry.update.mockResolvedValue({ id: "e1" });

    const r = await markRentPaid("e1");
    expect(r).toEqual({ updated: true });
    expect(prismaMock.journalEntry.update).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: { account_code: "512" },
    });
  });

  it("idempotent si déjà 512/53", async () => {
    prismaMock.journalEntry.findUnique.mockResolvedValue({
      id: "e2",
      user_id: "u1",
      type: "vente",
      isDeposit: false,
      account_code: "512",
    });

    const r = await markRentPaid("e2");
    expect(r).toEqual({ updated: false });
    expect(prismaMock.journalEntry.update).not.toHaveBeenCalled();
  });

  it("rejette si entrée est un dépôt ou un achat ou autre user", async () => {
    prismaMock.journalEntry.findUnique.mockResolvedValueOnce({
      id: "e3",
      user_id: "u1",
      type: "vente",
      isDeposit: true,
      account_code: "411",
    });
    await expect(markRentPaid("e3")).rejects.toThrow("BAD_REQUEST");

    prismaMock.journalEntry.findUnique.mockResolvedValueOnce({
      id: "e4",
      user_id: "u1",
      type: "achat",
      isDeposit: false,
      account_code: "401",
    });
    await expect(markRentPaid("e4")).rejects.toThrow("BAD_REQUEST");

    prismaMock.journalEntry.findUnique.mockResolvedValueOnce({
      id: "e5",
      user_id: "other",
      type: "vente",
      isDeposit: false,
      account_code: "411",
    });
    await expect(markRentPaid("e5")).rejects.toThrow("FORBIDDEN");
  });
});
