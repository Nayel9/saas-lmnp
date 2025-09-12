import { describe, it, expect } from "vitest";
import { createSchema } from "./validators";

const P1 = "11111111-1111-1111-1111-111111111111";

describe("validators amortization-defaults", () => {
  it("accepte une catégorie valide et une durée > 0", () => {
    const r = createSchema.safeParse({ propertyId: P1, category: "mobilier", defaultDurationMonths: 60 });
    expect(r.success).toBe(true);
  });
  it("rejette une durée <= 0", () => {
    const r = createSchema.safeParse({ propertyId: P1, category: "vehicule", defaultDurationMonths: 0 });
    expect(r.success).toBe(false);
  });
});
