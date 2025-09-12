import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/accounting/accountsCatalog", () => ({
  isAllowed: vi.fn().mockReturnValue(true),
  listFor: vi.fn().mockReturnValue([{ code: "2183" }]),
}));

vi.mock("@/lib/auth/core", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "u1" } }),
}));

const prismaMock = vi.hoisted(() => ({
  property: { findUnique: vi.fn() },
  amortizationDefault: { findUnique: vi.fn() },
  asset: { create: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const P1 = "11111111-1111-1111-1111-111111111111";

describe("createAsset with amortization defaults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.property.findUnique.mockResolvedValue({ id: P1, user_id: "u1" });
    prismaMock.asset.create.mockResolvedValue({ id: "a1" });
  });

  it("applique la durée par défaut si catégorie définie et défaut existant", async () => {
    const { createAsset } = await import("./actions");
    prismaMock.amortizationDefault.findUnique.mockResolvedValue({ defaultDurationMonths: 60 });
    const fd = new FormData();
    fd.set("label", "Chaise");
    fd.set("amount_ht", "1000");
    fd.set("acquisition_date", "2024-01-15");
    fd.set("account_code", "2183");
    fd.set("propertyId", P1);
    fd.set("category", "mobilier");
    const res = await createAsset(fd);
    expect(res.ok).toBe(true);
    expect(prismaMock.asset.create).toHaveBeenCalled();
    const call = prismaMock.asset.create.mock.calls[0][0];
    expect(call.data.duration_years).toBe(5);
  });

  it("échoue si aucune durée fournie et aucun défaut pour la catégorie", async () => {
    const { createAsset } = await import("./actions");
    prismaMock.amortizationDefault.findUnique.mockResolvedValue(null);
    const fd = new FormData();
    fd.set("label", "Bâtiment A");
    fd.set("amount_ht", "100000");
    fd.set("acquisition_date", "2024-02-01");
    fd.set("account_code", "2183");
    fd.set("propertyId", P1);
    fd.set("category", "batiment");
    const res = await createAsset(fd);
    expect(res.ok).toBe(false);
  });
});
