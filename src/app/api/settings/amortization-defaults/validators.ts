import { z } from "zod";
import { zAssetCategory } from "@/types/asset-category";

export const querySchema = z.object({
  property: z.string().uuid(),
});

export const createSchema = z.object({
  propertyId: z.string().uuid(),
  category: zAssetCategory,
  defaultDurationMonths: z.number().int().gt(0),
});

export const updateSchema = z.object({
  category: zAssetCategory.optional(),
  defaultDurationMonths: z.number().int().gt(0).optional(),
});

export type CreatePayload = z.infer<typeof createSchema>;
export type UpdatePayload = z.infer<typeof updateSchema>;

