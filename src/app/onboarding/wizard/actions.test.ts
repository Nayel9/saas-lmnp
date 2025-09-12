import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mocks ----
vi.mock("@/lib/auth/core", () => ({ auth: vi.fn().mockResolvedValue({ user: { id: "user-1" } }) }));

const prismaMock = vi.hoisted(() => ({
  property: { create: vi.fn(), findUnique: vi.fn() },
  journalEntry: { create: vi.fn() },
  amortizationDefault: { findUnique: vi.fn() },
  asset: { create: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

// ---- Import après mocks ----
import { propertySchema, saleSchema, assetSchema, createOnboardingProperty, createOnboardingSale, createOnboardingAsset } from "./actions";
import { computeLinearAmortization } from "@/lib/asset-amortization";

const P1 = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const P2 = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("propertySchema", () => {
  it("rejette label vide", () => {
    const r = propertySchema.safeParse({ label: "" });
    expect(r.success).toBe(false);
  });
  it("accepte label + date", () => {
    const r = propertySchema.safeParse({ label: "Bien A", startDate: "2025-01-01" });
    expect(r.success).toBe(true);
  });
});

describe("saleSchema", () => {
  it("rejette montant négatif", () => {
    const r = saleSchema.safeParse({ propertyId: P1, amountTTC: -10, tenant: "Loc", date: "2025-01-01" });
    expect(r.success).toBe(false);
  });
  it("ok montant positif", () => {
    const r = saleSchema.safeParse({ propertyId: P1, amountTTC: 100, tenant: "Loc", date: "2025-01-01" });
    expect(r.success).toBe(true);
  });
});

describe("assetSchema", () => {
  it("rejette coût 0", () => {
    const r = assetSchema.safeParse({ propertyId: P1, category: "mobilier", label: "Chaise", costTTC: 0, inServiceDate: "2025-01-10" });
    expect(r.success).toBe(false);
  });
  it("ok cost >0", () => {
    const r = assetSchema.safeParse({ propertyId: P1, category: "mobilier", label: "Chaise", costTTC: 50, inServiceDate: "2025-01-10" });
    expect(r.success).toBe(true);
  });
});

describe("createOnboardingProperty", () => {
  it("crée et retourne propertyId", async () => {
    prismaMock.property.create.mockResolvedValueOnce({ id: P1 });
    const res = await createOnboardingProperty({ label: "Test" });
    expect(res.ok).toBe(true);
    expect(res.propertyId).toBe(P1);
    expect(prismaMock.property.create).toHaveBeenCalled();
  });
});

describe("createOnboardingSale", () => {
  it("refuse propriété d'un autre user", async () => {
    prismaMock.property.findUnique.mockResolvedValueOnce({ id: P1, user_id: "other" });
    const res = await createOnboardingSale({ propertyId: P1, amountTTC: 100, tenant: "Loc", date: "2025-01-02" });
    expect(res.ok).toBe(false);
  });
  it("crée vente quand propriété appartient à user", async () => {
    prismaMock.property.findUnique.mockResolvedValueOnce({ id: P1, user_id: "user-1" });
    prismaMock.journalEntry.create.mockResolvedValueOnce({ id: "sale-1" });
    const res = await createOnboardingSale({ propertyId: P1, amountTTC: 123.45, tenant: "Loc 1", date: "2025-01-02" });
    expect(res.ok).toBe(true);
    expect(res.saleId).toBe("sale-1");
    const call = prismaMock.journalEntry.create.mock.calls[0][0];
    expect(call.data.account_code).toBe("706");
    expect(call.data.isDeposit).toBe(false);
  });
});

describe("createOnboardingAsset", () => {
  it("utilise défaut de durée si absence durationMonths", async () => {
    prismaMock.property.findUnique.mockResolvedValueOnce({ id: P1, user_id: "user-1" });
    prismaMock.amortizationDefault.findUnique.mockResolvedValueOnce({ defaultDurationMonths: 36 });
    prismaMock.asset.create.mockResolvedValueOnce({ id: "asset-1", amount_ht: 1200, duration_years: 3, acquisition_date: new Date("2025-05-15") });
    const res = await createOnboardingAsset({ propertyId: P1, category: "mobilier", label: "Lit", costTTC: 1200, inServiceDate: "2025-05-15" });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.schedule.length).toBe(3);
      const annual = 1200 / 3;
      expect(res.schedule[0].dotation).toBeLessThan(annual); // prorata
    }
  });
  it("erreur si pas de durée ni défaut", async () => {
    prismaMock.property.findUnique.mockResolvedValueOnce({ id: P1, user_id: "user-1" });
    prismaMock.amortizationDefault.findUnique.mockResolvedValueOnce(null);
    const res = await createOnboardingAsset({ propertyId: P1, category: "mobilier", label: "Lit", costTTC: 500, inServiceDate: "2025-01-01" });
    expect(res.ok).toBe(false);
  });
  it("planning cohérent avec helper computeLinearAmortization", async () => {
    prismaMock.property.findUnique.mockResolvedValueOnce({ id: P2, user_id: "user-1" });
    prismaMock.amortizationDefault.findUnique.mockResolvedValueOnce(null);
    prismaMock.asset.create.mockResolvedValueOnce({ id: "asset-2", amount_ht: 600, duration_years: 2, acquisition_date: new Date("2025-03-10") });
    const res = await createOnboardingAsset({ propertyId: P2, category: "mobilier", label: "Armoire", costTTC: 600, inServiceDate: "2025-03-10", durationMonths: 24 });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const ref = computeLinearAmortization(600, 2, new Date("2025-03-10"));
      expect(res.schedule).toEqual(ref);
    }
  });
});

